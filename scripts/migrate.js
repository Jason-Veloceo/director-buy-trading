#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Database configuration
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DATABASE,
  ssl: process.env.POSTGRES_SSL === 'true' ? {
    rejectUnauthorized: false,
  } : undefined,
});

async function runMigration() {
  console.log('Running database migration...');
  
  try {
    // Read schema file
    const schemaPath = path.join(__dirname, '..', 'src', 'lib', 'db', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Connect to database and run schema
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Check if migrations table exists, if not create it
      await client.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Check if we've already run the schema migration
      const migrationName = 'initial_schema';
      const migrationCheck = await client.query(
        'SELECT * FROM migrations WHERE name = $1',
        [migrationName]
      );
      
      if (migrationCheck.rows.length === 0) {
        // Run the schema script
        await client.query(schema);
        
        // Record that we ran the migration
        await client.query(
          'INSERT INTO migrations (name) VALUES ($1)',
          [migrationName]
        );
        
        console.log('Migration successful!');
      } else {
        console.log('Migration already applied.');
      }
      
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Run migration
runMigration(); 
import { Pool } from 'pg';

// Database connection pool
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

// Function to run SQL queries
export async function query(text: string, params?: any[]) {
  try {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Error executing query', error);
    throw error;
  }
}

// Helper functions for common operations
export async function findOne(table: string, conditions: Record<string, any>) {
  const keys = Object.keys(conditions);
  const values = Object.values(conditions);
  
  const whereClause = keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
  const text = `SELECT * FROM ${table} WHERE ${whereClause} LIMIT 1`;
  
  const result = await query(text, values);
  return result.rows[0] || null;
}

export async function findMany(table: string, conditions?: Record<string, any>, limit?: number, offset?: number) {
  let text = `SELECT * FROM ${table}`;
  const values: any[] = [];
  
  if (conditions && Object.keys(conditions).length > 0) {
    const keys = Object.keys(conditions);
    const whereClause = keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
    text += ` WHERE ${whereClause}`;
    values.push(...Object.values(conditions));
  }
  
  if (limit) {
    text += ` LIMIT ${limit}`;
  }
  
  if (offset) {
    text += ` OFFSET ${offset}`;
  }
  
  const result = await query(text, values);
  return result.rows;
}

export async function insertOne(table: string, data: Record<string, any>) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  const columns = keys.join(', ');
  
  const text = `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`;
  
  const result = await query(text, values);
  return result.rows[0];
}

export async function updateOne(table: string, id: string | number, data: Record<string, any>) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  
  const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
  const text = `UPDATE ${table} SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`;
  
  values.push(id);
  
  const result = await query(text, values);
  return result.rows[0];
}

export async function deleteOne(table: string, id: string | number) {
  const text = `DELETE FROM ${table} WHERE id = $1 RETURNING *`;
  const result = await query(text, [id]);
  return result.rows[0];
}

// Export pool for transaction support
export { pool }; 
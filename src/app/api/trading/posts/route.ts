import { NextResponse } from 'next/server';
import { query } from '@/lib/db/postgres';

export async function GET() {
  try {
    // Fetch recent X posts
    const postsResult = await query(`
      SELECT * FROM x_posts 
      ORDER BY created_at DESC 
      LIMIT 10
    `);

    // Fetch trade signals for these posts
    const signalsResult = await query(`
      SELECT * FROM trade_signals 
      WHERE x_post_id IN (SELECT id FROM x_posts ORDER BY created_at DESC LIMIT 10)
      ORDER BY signal_generated_at DESC
    `);

    return NextResponse.json({
      success: true,
      data: postsResult.rows,
      signals: signalsResult.rows
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}


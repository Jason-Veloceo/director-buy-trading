import { NextRequest, NextResponse } from 'next/server';
import TradingServiceSingleton from '@/lib/trading/tradingServiceSingleton';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { count = 5 } = body; // Default to 5 posts
    
    console.log(`🧪 Testing trade system with ${count} director buy posts...`);
    
    const tradingService = await TradingServiceSingleton.getInstance();
    
    // Force a scrape and process of director buys
    const result = await tradingService.testTrade(count);
    
    return NextResponse.json({
      success: true,
      message: `Test trade completed`,
      data: result
    });
  } catch (error) {
    console.error('Error in test trade:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute test trade'
    }, { status: 500 });
  }
}


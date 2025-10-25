import { NextRequest, NextResponse } from 'next/server';
import { TradingService } from '@/lib/trading/tradingService';

let tradingService: TradingService | null = null;

export async function GET(request: NextRequest) {
  try {
    if (!tradingService) {
      tradingService = new TradingService();
      await tradingService.initialize();
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const type = searchParams.get('type') || 'recent';

    let trades;
    if (type === 'active') {
      trades = await tradingService.getActivePositions();
    } else {
      trades = await tradingService.getRecentTrades(limit);
    }
    
    return NextResponse.json({
      success: true,
      data: trades
    });
  } catch (error) {
    console.error('Error fetching trades:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch trades'
    }, { status: 500 });
  }
}

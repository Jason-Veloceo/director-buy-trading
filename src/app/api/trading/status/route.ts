import { NextRequest, NextResponse } from 'next/server';
import { TradingService } from '@/lib/trading/tradingService';

let tradingService: TradingService | null = null;

export async function GET(request: NextRequest) {
  try {
    if (!tradingService) {
      tradingService = new TradingService();
      await tradingService.initialize();
    }

    const status = await tradingService.getSystemStatus();
    
    return NextResponse.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting trading status:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get trading status'
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { TradingService } from '@/lib/trading/tradingService';

let tradingService: TradingService | null = null;

export async function POST(request: NextRequest) {
  try {
    if (!tradingService) {
      tradingService = new TradingService();
      await tradingService.initialize();
    }

    await tradingService.startMonitoring();
    
    return NextResponse.json({
      success: true,
      message: 'Trading system monitoring started'
    });
  } catch (error) {
    console.error('Error starting trading system:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to start trading system'
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { TradingService } from '@/lib/trading/tradingService';

let tradingService: TradingService | null = null;

export async function POST(request: NextRequest) {
  try {
    if (!tradingService) {
      return NextResponse.json({
        success: false,
        error: 'Trading system not initialized'
      }, { status: 400 });
    }

    await tradingService.stopMonitoring();
    
    return NextResponse.json({
      success: true,
      message: 'Trading system monitoring stopped'
    });
  } catch (error) {
    console.error('Error stopping trading system:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to stop trading system'
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import TradingServiceSingleton from '@/lib/trading/tradingServiceSingleton';

export async function POST(request: NextRequest) {
  try {
    const tradingService = await TradingServiceSingleton.getInstance();
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

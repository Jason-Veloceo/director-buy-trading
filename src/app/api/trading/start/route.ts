import { NextRequest, NextResponse } from 'next/server';
import TradingServiceSingleton from '@/lib/trading/tradingServiceSingleton';

export async function POST(request: NextRequest) {
  try {
    const tradingService = await TradingServiceSingleton.getInstance();
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

import { NextRequest, NextResponse } from 'next/server';
import TradingServiceSingleton from '@/lib/trading/tradingServiceSingleton';

export async function GET(request: NextRequest) {
  try {
    const tradingService = await TradingServiceSingleton.getInstance();
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

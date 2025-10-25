'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TradingStatus {
  isRunning: boolean;
  isConnectedToIB: boolean;
  performance: any;
  priceCache: any;
  timestamp: string;
}

interface Trade {
  id: number;
  stock_ticker: string;
  action: string;
  quantity: number;
  price: number;
  status: string;
  created_at: string;
  post_content?: string;
}

export default function TradingDashboard() {
  const [status, setStatus] = useState<TradingStatus | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/trading/status');
      const data = await response.json();
      
      if (data.success) {
        setStatus(data.data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch trading status');
    }
  };

  const fetchTrades = async () => {
    try {
      const response = await fetch('/api/trading/trades?limit=10');
      const data = await response.json();
      
      if (data.success) {
        setTrades(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch trades:', err);
    }
  };

  const startMonitoring = async () => {
    try {
      const response = await fetch('/api/trading/start', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        await fetchStatus();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to start monitoring');
    }
  };

  const stopMonitoring = async () => {
    try {
      const response = await fetch('/api/trading/stop', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        await fetchStatus();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to stop monitoring');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchStatus(), fetchTrades()]);
      setLoading(false);
    };

    loadData();

    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading trading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Director Trading System</h1>
        <div className="space-x-2">
          <Button 
            onClick={startMonitoring} 
            disabled={status?.isRunning}
            variant="default"
          >
            Start Monitoring
          </Button>
          <Button 
            onClick={stopMonitoring} 
            disabled={!status?.isRunning}
            variant="destructive"
          >
            Stop Monitoring
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* System Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Monitoring:</span>
                <Badge variant={status?.isRunning ? "default" : "secondary"}>
                  {status?.isRunning ? "Running" : "Stopped"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>IB Connection:</span>
                <Badge variant={status?.isConnectedToIB ? "default" : "destructive"}>
                  {status?.isConnectedToIB ? "Connected" : "Disconnected"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Last Update:</span>
                <span className="text-sm text-gray-500">
                  {status?.timestamp ? new Date(status.timestamp).toLocaleTimeString() : 'N/A'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trading Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {status?.performance ? (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Total Trades:</span>
                  <span>{status.performance.total_trades || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Win Rate:</span>
                  <span>
                    {status.performance.total_trades > 0 
                      ? Math.round((status.performance.winning_trades / status.performance.total_trades) * 100)
                      : 0}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Total P&L:</span>
                  <span className={status.performance.total_pnl >= 0 ? "text-green-600" : "text-red-600"}>
                    ${status.performance.total_pnl?.toFixed(2) || '0.00'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-gray-500">No performance data available</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Price Cache</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Cached Symbols:</span>
                <span>{status?.priceCache?.size || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Symbols:</span>
                <span className="text-sm text-gray-500">
                  {status?.priceCache?.symbols?.join(', ') || 'None'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Trades */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Trades</CardTitle>
          <CardDescription>Latest trading activity</CardDescription>
        </CardHeader>
        <CardContent>
          {trades.length > 0 ? (
            <div className="space-y-4">
              {trades.map((trade) => (
                <div key={trade.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold">{trade.stock_ticker}</div>
                      <div className="text-sm text-gray-600">
                        {trade.action} {trade.quantity.toLocaleString()} shares @ ${trade.price}
                      </div>
                      {trade.post_content && (
                        <div className="text-xs text-gray-500 mt-1">
                          {trade.post_content.substring(0, 100)}...
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <Badge variant={
                        trade.status === 'FILLED' ? 'default' : 
                        trade.status === 'PENDING' ? 'secondary' : 'destructive'
                      }>
                        {trade.status}
                      </Badge>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(trade.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              No trades found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

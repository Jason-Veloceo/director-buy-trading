'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Activity, Database, Clock, DollarSign, TrendingUp, Percent } from 'lucide-react';

interface Trade {
  id: number;
  stock_ticker: string;
  action: string;
  quantity: number;
  price: number;
  status: string;
  created_at: string;
  signal_id?: number;
}

interface DirectorBuyPost {
  id: number;
  post_id: string;
  content: string;
  stock_ticker: string;
  shares_quantity: number;
  created_at: string;
}

interface TradeSignal {
  id: number;
  x_post_id: number;
  stock_ticker: string;
  shares_quantity: number;
  current_price: number;
  total_value: number;
  meets_threshold: boolean;
  signal_generated_at: string;
}

interface SystemStatus {
  isRunning: boolean;
  isConnectedToIB: boolean;
  performance: {
    total_trades: string;
    winning_trades: string;
    losing_trades: string;
    avg_pnl: string | null;
    total_pnl: string | null;
  };
  timestamp: string;
}

export default function TradingDashboard() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [posts, setPosts] = useState<DirectorBuyPost[]>([]);
  const [signals, setSignals] = useState<TradeSignal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/trading/status');
      const data = await response.json();
      if (data.success) {
        setStatus(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch status:', err);
    }
  };

  const fetchTrades = async () => {
    try {
      const response = await fetch('/api/trading/trades');
      const data = await response.json();
      if (data.success) {
        setTrades(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch trades:', err);
    }
  };

  const fetchPosts = async () => {
    try {
      const response = await fetch('/api/trading/posts');
      const data = await response.json();
      if (data.success) {
        setPosts(data.data);
        setSignals(data.signals || []);
      }
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchTrades();
    fetchPosts();
    const interval = setInterval(() => {
      fetchStatus();
      fetchTrades();
      fetchPosts();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/trading/start', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        fetchStatus();
      } else {
        setError(data.error || 'Failed to start trading system');
      }
    } catch (err) {
      setError('Failed to start trading system');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/trading/stop', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        fetchStatus();
      } else {
        setError(data.error || 'Failed to stop trading system');
      }
    } catch (err) {
      setError('Failed to stop trading system');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-AU', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-AU', { 
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const winRate = status?.performance.total_trades && parseInt(status.performance.total_trades) > 0
    ? Math.round((parseInt(status.performance.winning_trades) / parseInt(status.performance.total_trades)) * 100)
    : 0;

  const getSignalForPost = (postId: number) => {
    return signals.find(s => s.x_post_id === postId);
  };

  const getTradeForSignal = (signalId: number) => {
    return trades.find(t => t.signal_id === signalId);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-black rounded-lg">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Director Trading System</h1>
              <p className="text-sm text-gray-600">ASX Insider Monitoring</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleStart} 
              disabled={loading || status?.isRunning}
              className="bg-black hover:bg-gray-800"
            >
              <Activity className="h-4 w-4 mr-2" />
              Start Monitoring
            </Button>
            <Button 
              onClick={handleStop} 
              disabled={loading || !status?.isRunning}
              variant="outline"
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

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Monitoring Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge 
                variant={status?.isRunning ? "default" : "secondary"}
                className={status?.isRunning ? "bg-red-500" : "bg-gray-300"}
              >
                {status?.isRunning ? 'Running' : 'Stopped'}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Database className="h-4 w-4" />
                IB Connection
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={status?.isConnectedToIB ? "default" : "secondary"}>
                {status?.isConnectedToIB ? 'Connected' : 'Disconnected'}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Last Update
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">
                {status?.timestamp ? formatTime(status.timestamp) : '--:--:--'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Total P&L
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold text-green-600">
                ${status?.performance.total_pnl || '0.00'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Total Trades
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">{status?.performance.total_trades || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <Percent className="h-4 w-4" />
                Win Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">{winRate}%</div>
            </CardContent>
          </Card>
        </div>

        {/* ASX Insider Posts */}
        <Card>
          <CardHeader>
            <CardTitle>ASX Insider Posts</CardTitle>
            <p className="text-sm text-gray-600">Director buy signals from @ASXinsiders</p>
          </CardHeader>
          <CardContent>
            {posts.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No posts yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Post Text</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Ticker</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Amount Purchased</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Share Price</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Purchase Value</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-600">Trade Triggered</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {posts.map((post) => {
                      const signal = getSignalForPost(post.id);
                      const trade = signal ? getTradeForSignal(signal.id) : null;
                      return (
                        <tr key={post.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm max-w-md truncate">{post.content}</td>
                          <td className="py-3 px-4 text-sm font-medium">{post.stock_ticker}</td>
                          <td className="py-3 px-4 text-sm text-right">{post.shares_quantity?.toLocaleString() || '--'}</td>
                          <td className="py-3 px-4 text-sm text-right">
                            {signal?.current_price ? `$${Number(signal.current_price).toFixed(4)}` : '--'}
                          </td>
                          <td className="py-3 px-4 text-sm text-right font-semibold">
                            {signal?.total_value ? `$${Number(signal.total_value).toLocaleString()}` : '--'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {trade ? (
                              <Badge variant="default" className="bg-green-500">
                                <span className="mr-1">✓</span> Yes
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                <span className="mr-1">✗</span> No
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm text-right text-gray-600">
                            {formatDate(post.created_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Executed Trades */}
        <Card>
          <CardHeader>
            <CardTitle>Executed Trades</CardTitle>
            <p className="text-sm text-gray-600">Orders placed on ASX</p>
          </CardHeader>
          <CardContent>
            {trades.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No trades yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Order ID</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Timestamp</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Ticker</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-600">Action</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Shares</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Price/Share</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Total Invested</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((trade) => (
                      <tr key={trade.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm">ORD-{new Date().getFullYear()}-{String(trade.id).padStart(3, '0')}</td>
                        <td className="py-3 px-4 text-sm">{formatDate(trade.created_at)}</td>
                        <td className="py-3 px-4 text-sm font-medium">{trade.stock_ticker}</td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant="default" className="bg-black">
                            {trade.action}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-right">{Number(trade.quantity).toLocaleString()}</td>
                        <td className="py-3 px-4 text-sm text-right">${Number(trade.price).toFixed(4)}</td>
                        <td className="py-3 px-4 text-sm text-right font-semibold">
                          ${(Number(trade.quantity) * Number(trade.price)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant={trade.status === 'FILLED' ? 'default' : 'secondary'}>
                            {trade.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

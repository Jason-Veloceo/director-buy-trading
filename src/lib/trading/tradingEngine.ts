import { query, insertOne, findOne } from '../db/postgres';
import { PriceFetcher, StockPrice } from './priceFetcher';
import { DirectorBuyPost } from './xScraper';

export interface TradingRule {
  id: number;
  name: string;
  minPurchaseThreshold: number;
  takeProfitPercentage: number;
  stopLossPercentage: number;
  useTrailingStop: boolean;
  trailingStopPercentage: number;
  maxPositionSize: number;
  maxConcurrentPositions: number;
  isActive: boolean;
}

export interface TradeSignal {
  id?: number;
  xPostId: number;
  stockTicker: string;
  sharesQuantity: number;
  currentPrice: number;
  totalValue: number;
  meetsThreshold: boolean;
  tradingRuleId: number;
  signalGeneratedAt: Date;
}

export interface PositionSizing {
  maxShares: number;
  positionValue: number;
  riskAmount: number;
  stopLossPrice: number;
  takeProfitPrice: number;
}

export class TradingEngine {
  private priceFetcher: PriceFetcher;
  private readonly EFFECTIVE_ACCOUNT_SIZE = parseInt(process.env.EFFECTIVE_ACCOUNT_SIZE || '20000'); // AUD
  private readonly RISK_PER_TRADE = parseFloat(process.env.RISK_PER_TRADE || '0.05'); // 5%

  constructor() {
    this.priceFetcher = new PriceFetcher();
  }

  async processDirectorBuyPost(post: DirectorBuyPost): Promise<TradeSignal | null> {
    try {
      console.log(`Processing director buy post for ${post.stockTicker}`);

      // Get current stock price
      const stockPrice = await this.priceFetcher.getStockPrice(post.stockTicker!);
      if (!stockPrice) {
        console.error(`Could not fetch price for ${post.stockTicker}`);
        return null;
      }

      // Get active trading rules
      const tradingRule = await this.getActiveTradingRule();
      if (!tradingRule) {
        console.error('No active trading rules found');
        return null;
      }

      // Calculate total value of director's purchase
      const totalValue = (post.sharesQuantity || 0) * stockPrice.price;
      
      // Check if it meets the threshold (use environment variable if available)
      const threshold = parseFloat(process.env.MIN_PURCHASE_THRESHOLD || tradingRule.minPurchaseThreshold.toString());
      const meetsThreshold = totalValue >= threshold;

      console.log(`Director purchase analysis:
        - Stock: ${post.stockTicker}
        - Shares: ${post.sharesQuantity}
        - Price: $${stockPrice.price}
        - Total Value: $${totalValue.toFixed(2)}
        - Threshold: $${tradingRule.minPurchaseThreshold}
        - Meets Threshold: ${meetsThreshold}`);

      // Create trade signal
      const signal: TradeSignal = {
        xPostId: post.postId as any, // This will be the database ID
        stockTicker: post.stockTicker!,
        sharesQuantity: post.sharesQuantity || 0,
        currentPrice: stockPrice.price,
        totalValue,
        meetsThreshold,
        tradingRuleId: tradingRule.id,
        signalGeneratedAt: new Date()
      };

      // Save signal to database
      const savedSignal = await insertOne('trade_signals', {
        x_post_id: signal.xPostId,
        stock_ticker: signal.stockTicker,
        shares_quantity: signal.sharesQuantity,
        current_price: signal.currentPrice,
        total_value: signal.totalValue,
        meets_threshold: signal.meetsThreshold,
        trading_rule_id: signal.tradingRuleId
      });

      signal.id = savedSignal.id;

      if (meetsThreshold) {
        console.log(`✅ Trade signal generated for ${post.stockTicker} - meets threshold!`);
        await this.executeTrade(signal, tradingRule);
      } else {
        console.log(`❌ Trade signal for ${post.stockTicker} - does not meet threshold`);
      }

      return signal;
    } catch (error) {
      console.error('Error processing director buy post:', error);
      return null;
    }
  }

  private async getActiveTradingRule(): Promise<TradingRule | null> {
    try {
      const rule = await findOne('trading_rules', { is_active: true });
      return rule;
    } catch (error) {
      console.error('Error fetching trading rules:', error);
      return null;
    }
  }

  private async executeTrade(signal: TradeSignal, rule: TradingRule): Promise<void> {
    try {
      // Check if market is open (ASX hours: 10:00 AM - 4:00 PM AEST)
      if (!this.isMarketOpen()) {
        console.log('Market is closed - trade will be executed when market opens');
        return;
      }

      // Check current positions
      const currentPositions = await this.getCurrentPositions();
      if (currentPositions.length >= rule.maxConcurrentPositions) {
        console.log(`Maximum concurrent positions (${rule.maxConcurrentPositions}) reached`);
        return;
      }

      // Calculate position sizing
      const positionSizing = this.calculatePositionSizing(signal.currentPrice, rule);
      
      if (positionSizing.maxShares <= 0) {
        console.log('Position size too small to trade');
        return;
      }

      console.log(`Executing trade:
        - Stock: ${signal.stockTicker}
        - Shares: ${positionSizing.maxShares}
        - Entry Price: $${signal.currentPrice}
        - Position Value: $${positionSizing.positionValue}
        - Stop Loss: $${positionSizing.stopLossPrice}
        - Take Profit: $${positionSizing.takeProfitPrice}`);

      // Create trade record
      const trade = await insertOne('trades', {
        signal_id: signal.id,
        stock_ticker: signal.stockTicker,
        action: 'BUY',
        quantity: positionSizing.maxShares,
        price: signal.currentPrice,
        status: 'PENDING',
        take_profit_price: positionSizing.takeProfitPrice,
        stop_loss_price: positionSizing.stopLossPrice,
        trailing_stop_active: rule.useTrailingStop
      });

      console.log(`Trade created with ID: ${trade.id}`);

      // TODO: Integrate with Interactive Brokers API to place actual order
      // For now, we'll just log the trade
      console.log('🚀 Trade order ready for execution via Interactive Brokers');

    } catch (error) {
      console.error('Error executing trade:', error);
    }
  }

  private calculatePositionSizing(entryPrice: number, rule: TradingRule): PositionSizing {
    const maxRiskAmount = this.EFFECTIVE_ACCOUNT_SIZE * this.RISK_PER_TRADE; // $1,000
    const stopLossAmount = entryPrice * (rule.stopLossPercentage / 100);
    
    const maxShares = Math.floor(maxRiskAmount / stopLossAmount);
    const positionValue = maxShares * entryPrice;
    
    const stopLossPrice = entryPrice * (1 - rule.stopLossPercentage / 100);
    const takeProfitPrice = entryPrice * (1 + rule.takeProfitPercentage / 100);

    return {
      maxShares,
      positionValue,
      riskAmount: maxRiskAmount,
      stopLossPrice,
      takeProfitPrice
    };
  }

  private isMarketOpen(): boolean {
    const now = new Date();
    const aestTime = new Date(now.toLocaleString("en-US", {timeZone: "Australia/Sydney"}));
    
    const hour = aestTime.getHours();
    const minute = aestTime.getMinutes();
    const timeInMinutes = hour * 60 + minute;
    
    // ASX trading hours: 10:00 AM - 4:00 PM AEST
    const marketOpen = 10 * 60; // 10:00 AM
    const marketClose = 16 * 60; // 4:00 PM
    
    // Check if it's a weekday (Monday = 1, Friday = 5)
    const dayOfWeek = aestTime.getDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    
    return isWeekday && timeInMinutes >= marketOpen && timeInMinutes <= marketClose;
  }

  private async getCurrentPositions(): Promise<any[]> {
    try {
      const positions = await query(`
        SELECT * FROM trades 
        WHERE status IN ('PENDING', 'FILLED') 
        AND action = 'BUY'
        AND closed_at IS NULL
      `);
      return positions.rows;
    } catch (error) {
      console.error('Error fetching current positions:', error);
      return [];
    }
  }

  async getTradingPerformance(): Promise<any> {
    try {
      const performance = await query(`
        SELECT 
          COUNT(*) as total_trades,
          COUNT(CASE WHEN pnl > 0 THEN 1 END) as winning_trades,
          COUNT(CASE WHEN pnl <= 0 THEN 1 END) as losing_trades,
          AVG(pnl) as avg_pnl,
          SUM(pnl) as total_pnl,
          MAX(pnl) as best_trade,
          MIN(pnl) as worst_trade
        FROM trades 
        WHERE status = 'FILLED' 
        AND closed_at IS NOT NULL
      `);

      return performance.rows[0];
    } catch (error) {
      console.error('Error fetching trading performance:', error);
      return null;
    }
  }

  async createDefaultTradingRule(): Promise<void> {
    try {
      const existingRule = await findOne('trading_rules', { is_active: true });
      if (existingRule) {
        console.log('Default trading rule already exists');
        return;
      }

      await insertOne('trading_rules', {
        name: 'Default Director Buy Strategy',
        min_purchase_threshold: 20000,
        take_profit_percentage: 20.0,
        stop_loss_percentage: 10.0,
        use_trailing_stop: false,
        trailing_stop_percentage: 5.0,
        max_position_size: 5000,
        max_concurrent_positions: 5,
        is_active: true
      });

      console.log('Default trading rule created');
    } catch (error) {
      console.error('Error creating default trading rule:', error);
    }
  }
}

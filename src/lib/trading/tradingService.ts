import cron from 'node-cron';
import { XScraper, DirectorBuyPost } from './xScraper';
import { TradingEngine } from './tradingEngine';
import { IBClient } from './ibClient';
import { PriceFetcher } from './priceFetcher';

export class TradingService {
  private xScraper: XScraper;
  private tradingEngine: TradingEngine;
  private ibClient: IBClient;
  private priceFetcher: PriceFetcher;
  private isRunning = false;
  private monitoringJob: cron.ScheduledTask | null = null;

  constructor() {
    this.xScraper = new XScraper();
    this.tradingEngine = new TradingEngine();
    this.ibClient = new IBClient();
    this.priceFetcher = new PriceFetcher();
  }

  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing Director Trading System...');

      // Initialize X scraper
      await this.xScraper.initialize();
      console.log('✅ X Scraper initialized');

      // Connect to Interactive Brokers
      try {
        await this.ibClient.connect();
        console.log('✅ Connected to Interactive Brokers');
      } catch (error) {
        console.warn('⚠️ Could not connect to Interactive Brokers:', error);
        console.log('System will continue without live trading');
      }

      // Create default trading rules
      await this.tradingEngine.createDefaultTradingRule();
      console.log('✅ Default trading rules created');

      console.log('🎯 Director Trading System initialized successfully!');
    } catch (error) {
      console.error('❌ Failed to initialize trading system:', error);
      throw error;
    }
  }

  async startMonitoring(): Promise<void> {
    if (this.isRunning) {
      console.log('Monitoring already running');
      return;
    }

    this.isRunning = true;
    console.log('📡 Starting X monitoring for director buys...');

    // Run immediately
    await this.checkForDirectorBuys();

    // Set up cron job to check every 5 minutes
    this.monitoringJob = cron.schedule('*/5 * * * *', async () => {
      await this.checkForDirectorBuys();
    });

    console.log('⏰ Monitoring scheduled every 5 minutes');
  }

  private async checkForDirectorBuys(): Promise<void> {
    try {
      console.log('🔍 Checking for new director buy posts...');
      
      const directorBuys = await this.xScraper.scrapeDirectorBuys();
      
      if (directorBuys.length === 0) {
        console.log('📭 No new director buy posts found');
        return;
      }

      console.log(`📈 Found ${directorBuys.length} new director buy posts`);

      for (const post of directorBuys) {
        try {
          console.log(`\n📊 Processing director buy: ${post.stockTicker}`);
          console.log(`   Shares: ${post.sharesQuantity?.toLocaleString()}`);
          console.log(`   Total Holding: $${post.totalHoldingValue?.toLocaleString()}`);
          console.log(`   Ownership: ${post.ownershipPercentage}%`);

          // Process through trading engine
          const signal = await this.tradingEngine.processDirectorBuyPost(post);
          
          if (signal && signal.meetsThreshold) {
            console.log(`🎯 Trade signal generated for ${post.stockTicker}!`);
            await this.executeTradeIfMarketOpen(signal);
          } else {
            console.log(`❌ Trade signal for ${post.stockTicker} - does not meet criteria`);
          }
        } catch (error) {
          console.error(`Error processing post for ${post.stockTicker}:`, error);
        }
      }
    } catch (error) {
      console.error('Error checking for director buys:', error);
    }
  }

  private async executeTradeIfMarketOpen(signal: any): Promise<void> {
    // Check if market is open
    const now = new Date();
    const aestTime = new Date(now.toLocaleString("en-US", {timeZone: "Australia/Sydney"}));
    const hour = aestTime.getHours();
    const dayOfWeek = aestTime.getDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const isMarketHours = hour >= 10 && hour < 16;

    if (!isWeekday || !isMarketHours) {
      console.log('🏦 Market is closed - trade will be executed when market opens');
      return;
    }

    if (!this.ibClient.isConnectedToIB()) {
      console.log('🔌 Not connected to Interactive Brokers - trade will be executed when connection is restored');
      return;
    }

    try {
      console.log(`🚀 Executing trade for ${signal.stockTicker}`);
      
      // Place buy order
      const orderId = await this.ibClient.placeBuyOrder(
        signal.stockTicker,
        signal.quantity || 1000, // Default quantity for now
        signal.currentPrice
      );

      console.log(`📋 Buy order placed: ${orderId}`);

      // Update trade record with order ID
      const { query } = await import('../db/postgres');
      await query(
        'UPDATE trades SET order_id = $1 WHERE signal_id = $2',
        [orderId.toString(), signal.id]
      );

    } catch (error) {
      console.error('Error executing trade:', error);
    }
  }

  async stopMonitoring(): Promise<void> {
    if (this.monitoringJob) {
      this.monitoringJob.stop();
      this.monitoringJob = null;
    }
    
    this.isRunning = false;
    console.log('⏹️ Monitoring stopped');
  }

  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down Director Trading System...');
    
    await this.stopMonitoring();
    await this.xScraper.stop();
    await this.ibClient.disconnect();
    
    console.log('✅ System shutdown complete');
  }

  async getSystemStatus(): Promise<any> {
    const performance = await this.tradingEngine.getTradingPerformance();
    const cacheStats = this.priceFetcher.getCacheStats();
    
    return {
      isRunning: this.isRunning,
      isConnectedToIB: this.ibClient.isConnectedToIB(),
      performance,
      priceCache: cacheStats,
      timestamp: new Date()
    };
  }

  async getRecentTrades(limit: number = 10): Promise<any[]> {
    try {
      const { query } = await import('../db/postgres');
      const result = await query(`
        SELECT 
          t.*,
          ts.stock_ticker,
          ts.current_price,
          ts.total_value,
          xp.content as post_content
        FROM trades t
        JOIN trade_signals ts ON t.signal_id = ts.id
        LEFT JOIN x_posts xp ON ts.x_post_id = xp.id
        ORDER BY t.created_at DESC
        LIMIT $1
      `, [limit]);

      return result.rows;
    } catch (error) {
      console.error('Error fetching recent trades:', error);
      return [];
    }
  }

  async getActivePositions(): Promise<any[]> {
    try {
      const { query } = await import('../db/postgres');
      const result = await query(`
        SELECT 
          t.*,
          ts.stock_ticker,
          ts.current_price,
          xp.content as post_content
        FROM trades t
        JOIN trade_signals ts ON t.signal_id = ts.id
        LEFT JOIN x_posts xp ON ts.x_post_id = xp.id
        WHERE t.status IN ('PENDING', 'FILLED')
        AND t.action = 'BUY'
        AND t.closed_at IS NULL
        ORDER BY t.created_at DESC
      `);

      return result.rows;
    } catch (error) {
      console.error('Error fetching active positions:', error);
      return [];
    }
  }
}

import yahooFinance from 'yahoo-finance';

export interface StockPrice {
  symbol: string;
  price: number;
  currency: string;
  timestamp: Date;
  volume?: number;
  marketCap?: number;
}

export class PriceFetcher {
  private cache: Map<string, { price: StockPrice; timestamp: Date }> = new Map();
  private readonly CACHE_DURATION = 60000; // 1 minute cache

  constructor() {}

  async getStockPrice(symbol: string): Promise<StockPrice | null> {
    try {
      // Check cache first
      const cached = this.cache.get(symbol);
      if (cached && (Date.now() - cached.timestamp.getTime()) < this.CACHE_DURATION) {
        console.log(`Using cached price for ${symbol}: $${cached.price.price}`);
        return cached.price;
      }

      // Ensure symbol has .AX suffix for ASX stocks
      const asxSymbol = symbol.endsWith('.AX') ? symbol : `${symbol}.AX`;
      
      console.log(`Fetching price for ${asxSymbol}...`);
      
      const quote = await yahooFinance.quote({
        symbol: asxSymbol,
        modules: ['price', 'summaryDetail']
      });

      if (!quote.price) {
        console.error(`No price data found for ${asxSymbol}`);
        return null;
      }

      const stockPrice: StockPrice = {
        symbol: asxSymbol,
        price: quote.price.regularMarketPrice || quote.price.previousClose || 0,
        currency: quote.price.currency || 'AUD',
        timestamp: new Date(),
        volume: quote.price.regularMarketVolume,
        marketCap: quote.summaryDetail?.marketCap
      };

      // Cache the result
      this.cache.set(symbol, { price: stockPrice, timestamp: new Date() });

      console.log(`Fetched price for ${asxSymbol}: $${stockPrice.price}`);
      return stockPrice;
    } catch (error) {
      console.error(`Error fetching price for ${symbol}:`, error);
      return null;
    }
  }

  async getMultipleStockPrices(symbols: string[]): Promise<Map<string, StockPrice>> {
    const results = new Map<string, StockPrice>();
    
    // Process in batches to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (symbol) => {
        const price = await this.getStockPrice(symbol);
        if (price) {
          results.set(symbol, price);
        }
      });

      await Promise.all(batchPromises);
      
      // Small delay between batches
      if (i + batchSize < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  async validateStockSymbol(symbol: string): Promise<boolean> {
    try {
      const asxSymbol = symbol.endsWith('.AX') ? symbol : `${symbol}.AX`;
      const quote = await yahooFinance.quote({ symbol: asxSymbol });
      return !!quote.price;
    } catch (error) {
      console.error(`Error validating symbol ${symbol}:`, error);
      return false;
    }
  }

  async getStockInfo(symbol: string): Promise<any> {
    try {
      const asxSymbol = symbol.endsWith('.AX') ? symbol : `${symbol}.AX`;
      
      const quote = await yahooFinance.quote({
        symbol: asxSymbol,
        modules: ['price', 'summaryDetail', 'defaultKeyStatistics']
      });

      return {
        symbol: asxSymbol,
        name: quote.price?.longName,
        price: quote.price?.regularMarketPrice,
        currency: quote.price?.currency,
        marketCap: quote.summaryDetail?.marketCap,
        volume: quote.price?.regularMarketVolume,
        avgVolume: quote.summaryDetail?.averageVolume,
        peRatio: quote.summaryDetail?.trailingPE,
        dividendYield: quote.summaryDetail?.dividendYield,
        beta: quote.defaultKeyStatistics?.beta
      };
    } catch (error) {
      console.error(`Error fetching stock info for ${symbol}:`, error);
      return null;
    }
  }

  // Clear cache (useful for testing or when you want fresh data)
  clearCache(): void {
    this.cache.clear();
    console.log('Price cache cleared');
  }

  // Get cache statistics
  getCacheStats(): { size: number; symbols: string[] } {
    return {
      size: this.cache.size,
      symbols: Array.from(this.cache.keys())
    };
  }
}

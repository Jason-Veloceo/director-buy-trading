import { TradingService } from './tradingService';

class TradingServiceSingleton {
  private static instance: TradingService | null = null;
  private static isInitializing = false;

  static async getInstance(): Promise<TradingService> {
    if (this.instance) {
      return this.instance;
    }

    // Prevent multiple simultaneous initializations
    if (this.isInitializing) {
      // Wait for initialization to complete
      while (this.isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (this.instance) {
        return this.instance;
      }
    }

    this.isInitializing = true;
    try {
      this.instance = new TradingService();
      await this.instance.initialize();
      return this.instance;
    } finally {
      this.isInitializing = false;
    }
  }

  static resetInstance(): void {
    this.instance = null;
  }
}

export default TradingServiceSingleton;


import puppeteer, { Browser, Page } from 'puppeteer';
import { query, insertOne } from '../db/postgres';

export interface DirectorBuyPost {
  postId: string;
  content: string;
  directorName?: string;
  sharesQuantity?: number;
  stockTicker?: string;
  totalHoldingValue?: number;
  ownershipPercentage?: number;
  postUrl: string;
  timestamp: Date;
}

export class XScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isRunning = false;

  constructor() {}

  async initialize(): Promise<void> {
    try {
      this.browser = await puppeteer.launch({
        headless: false, // Set to false to see the browser for login
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=VizDisplayCompositor',
          '--disable-web-security',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--user-data-dir=/Users/jason/Documents/Projects/director-buy-trading/x-session-data' // Use saved session data
        ]
      });

      this.page = await this.browser.newPage();
      
      // Set user agent to avoid detection
      await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Set viewport
      await this.page.setViewport({ width: 1366, height: 768 });

      // Remove webdriver property to avoid detection
      await this.page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
      });

      // Check if we need to login
      await this.ensureLoggedIn();

      console.log('X Scraper initialized successfully');
    } catch (error) {
      console.error('Failed to initialize X Scraper:', error);
      throw error;
    }
  }

  private async ensureLoggedIn(): Promise<void> {
    try {
      console.log('🔐 Checking X login status...');
      
      // Navigate directly to ASXinsiders page - if we're logged in, it will work
      // If not logged in, we'll be redirected to login page
      await this.page!.goto('https://x.com/ASXinsiders', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Check if we're logged in by looking at the URL
      const currentUrl = this.page!.url();
      
      // If we're redirected to login, throw an error
      if (currentUrl.includes('login')) {
        throw new Error('Not logged in to X. Please run: node manual-x-login.js');
      }
      
      // If we're on ASXinsiders page, we're logged in
      if (currentUrl.includes('ASXinsiders') || currentUrl.includes('x.com/')) {
        console.log('✅ X session verified - on ASXinsiders page');
        return;
      }
      
      console.log('✅ X session verified');
    } catch (error) {
      console.error('Error checking X login status:', error);
      throw new Error('X login check failed. Please run: node manual-x-login.js to re-login');
    }
  }

  async scrapeDirectorBuys(): Promise<DirectorBuyPost[]> {
    if (!this.page) {
      throw new Error('Scraper not initialized');
    }

    try {
      // Check if we're already on ASXinsiders page, if not navigate to it
      const currentUrl = this.page.url();
      if (!currentUrl.includes('ASXinsiders')) {
        console.log('📱 Navigating to ASXinsiders page...');
        await this.page.goto('https://x.com/ASXinsiders', { 
          waitUntil: 'networkidle2',
          timeout: 30000 
        });
      } else {
        console.log('📱 Already on ASXinsiders page, refreshing...');
        await this.page.reload({ waitUntil: 'networkidle2' });
      }

      // Wait for posts to load with multiple fallback selectors
      try {
        await this.page.waitForSelector('[data-testid="tweet"]', { timeout: 5000 });
      } catch (error) {
        console.log('Primary selector failed, trying fallback selectors...');
        try {
          await this.page.waitForSelector('article[data-testid="tweet"]', { timeout: 5000 });
        } catch (error2) {
          console.log('Fallback selector failed, trying article selector...');
          await this.page.waitForSelector('article', { timeout: 5000 });
        }
      }

      // Get all tweet elements with fallback selectors
      let tweets = await this.page.$$('[data-testid="tweet"]');
      if (tweets.length === 0) {
        console.log('No tweets found with primary selector, trying fallback...');
        tweets = await this.page.$$('article[data-testid="tweet"]');
      }
      if (tweets.length === 0) {
        console.log('No tweets found with fallback selector, trying article...');
        tweets = await this.page.$$('article');
      }
      
      console.log(`Found ${tweets.length} tweets to process`);
      const directorBuys: DirectorBuyPost[] = [];

      for (const tweet of tweets.slice(0, 10)) { // Check first 10 tweets
        try {
          const postData = await this.extractPostData(tweet);
          if (postData && this.isDirectorBuyPost(postData.content)) {
            const processedPost = await this.processDirectorBuyPost(postData);
            if (processedPost) {
              directorBuys.push(processedPost);
            }
          }
        } catch (error) {
          console.error('Error processing tweet:', error);
          continue;
        }
      }

      return directorBuys;
    } catch (error) {
      console.error('Error scraping director buys:', error);
      throw error;
    }
  }

  private async extractPostData(tweetElement: any): Promise<Partial<DirectorBuyPost> | null> {
    try {
      // Extract post content
      const contentElement = await tweetElement.$('[data-testid="tweetText"]');
      if (!contentElement) return null;

      const content = await this.page!.evaluate(el => el.textContent, contentElement);
      if (!content) return null;

      // Extract post URL
      const linkElement = await tweetElement.$('a[href*="/status/"]');
      const postUrl = linkElement ? 
        await this.page!.evaluate(el => el.href, linkElement) : '';

      // Extract timestamp
      const timeElement = await tweetElement.$('time');
      const timestamp = timeElement ? 
        await this.page!.evaluate(el => el.getAttribute('datetime'), timeElement) : 
        new Date().toISOString();

      return {
        content,
        postUrl,
        timestamp: new Date(timestamp)
      };
    } catch (error) {
      console.error('Error extracting post data:', error);
      return null;
    }
  }

  private isDirectorBuyPost(content: string): boolean {
    // Regex patterns to identify director buy posts
    const directorBuyPatterns = [
      /director\s+buys?\s+\d+[km]?\s+of\s+\$[a-z]+:asx/i,
      /director\s+purchases?\s+\d+[km]?\s+shares?\s+of\s+\$[a-z]+:asx/i,
      /director\s+acquires?\s+\d+[km]?\s+of\s+\$[a-z]+:asx/i
    ];

    return directorBuyPatterns.some(pattern => pattern.test(content));
  }

  private async processDirectorBuyPost(postData: Partial<DirectorBuyPost>): Promise<DirectorBuyPost | null> {
    if (!postData.content || !postData.postUrl) return null;

    try {
      // Parse the post content to extract trading information
      const parsed = this.parseDirectorBuyContent(postData.content);
      
      if (!parsed) return null;

      // Check if we've already processed this post
      const existingPost = await query(
        'SELECT id FROM x_posts WHERE post_id = $1',
        [parsed.postId]
      );

      if (existingPost.rows.length > 0) {
        console.log(`Post ${parsed.postId} already processed`);
        return null;
      }

      // Save to database
      const savedPost = await insertOne('x_posts', {
        post_id: parsed.postId,
        content: postData.content,
        director_name: parsed.directorName,
        shares_quantity: parsed.sharesQuantity,
        stock_ticker: parsed.stockTicker,
        total_holding_value: parsed.totalHoldingValue,
        ownership_percentage: parsed.ownershipPercentage,
        post_url: postData.postUrl
      });

      console.log(`New director buy post processed: ${parsed.stockTicker} - ${parsed.sharesQuantity} shares`);

      return {
        postId: parsed.postId,
        content: postData.content,
        directorName: parsed.directorName,
        sharesQuantity: parsed.sharesQuantity,
        stockTicker: parsed.stockTicker,
        totalHoldingValue: parsed.totalHoldingValue,
        ownershipPercentage: parsed.ownershipPercentage,
        postUrl: postData.postUrl,
        timestamp: postData.timestamp || new Date()
      };
    } catch (error) {
      console.error('Error processing director buy post:', error);
      return null;
    }
  }

  private parseDirectorBuyContent(content: string): Partial<DirectorBuyPost> | null {
    try {
      // Extract post ID from content or generate one
      const postId = this.generatePostId(content);

      // Parse director buy information
      // Example: "Director buys 19K of $MMI:ASX giving them a total holding of ~$1.7M (~0.38% of the company)"
      
      // Extract shares quantity
      const sharesMatch = content.match(/(\d+)([km]?)\s+of/i);
      let sharesQuantity: number | undefined;
      if (sharesMatch) {
        const quantity = parseInt(sharesMatch[1]);
        const multiplier = sharesMatch[2].toLowerCase() === 'k' ? 1000 : 
                         sharesMatch[2].toLowerCase() === 'm' ? 1000000 : 1;
        sharesQuantity = quantity * multiplier;
      }

      // Extract stock ticker (keep ASX format for Interactive Brokers)
      const tickerMatch = content.match(/\$([a-z]+):asx/i);
      const stockTicker = tickerMatch ? tickerMatch[1] + '.ASX' : undefined;

      // Extract total holding value
      const holdingMatch = content.match(/~?\$([\d.]+[km]?)/i);
      let totalHoldingValue: number | undefined;
      if (holdingMatch) {
        const value = parseFloat(holdingMatch[1]);
        const multiplier = holdingMatch[1].toLowerCase().includes('k') ? 1000 : 
                          holdingMatch[1].toLowerCase().includes('m') ? 1000000 : 1;
        totalHoldingValue = value * multiplier;
      }

      // Extract ownership percentage
      const ownershipMatch = content.match(/~?(\d+\.?\d*)% of the company/i);
      const ownershipPercentage = ownershipMatch ? parseFloat(ownershipMatch[1]) : undefined;

      return {
        postId,
        sharesQuantity,
        stockTicker,
        totalHoldingValue,
        ownershipPercentage
      };
    } catch (error) {
      console.error('Error parsing director buy content:', error);
      return null;
    }
  }

  private generatePostId(content: string): string {
    // Generate a unique ID based on content hash
    const crypto = require('crypto');
    return crypto.createHash('md5').update(content).digest('hex').substring(0, 16);
  }

  async startMonitoring(intervalMinutes: number = 5): Promise<void> {
    if (this.isRunning) {
      console.log('Monitoring already running');
      return;
    }

    this.isRunning = true;
    console.log(`Starting X monitoring every ${intervalMinutes} minutes`);

    const monitor = async () => {
      try {
        console.log('Checking for new director buys...');
        const directorBuys = await this.scrapeDirectorBuys();
        
        if (directorBuys.length > 0) {
          console.log(`Found ${directorBuys.length} new director buy posts`);
          // Trigger trading signal analysis for each post
          for (const post of directorBuys) {
            await this.triggerTradingSignal(post);
          }
        } else {
          console.log('No new director buy posts found');
        }
      } catch (error) {
        console.error('Error in monitoring cycle:', error);
      }
    };

    // Run immediately
    await monitor();

    // Set up interval
    setInterval(monitor, intervalMinutes * 60 * 1000);
  }

  private async triggerTradingSignal(post: DirectorBuyPost): Promise<void> {
    // This will be implemented when we create the trading engine
    console.log(`Trading signal triggered for ${post.stockTicker}: ${post.sharesQuantity} shares`);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
    console.log('X Scraper stopped');
  }
}

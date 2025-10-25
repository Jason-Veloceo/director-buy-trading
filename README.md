# Director Buy Trading System

An automated trading system that monitors ASX director share purchases and executes trades based on configurable rules.

## Overview

This system monitors the [@ASXinsiders](https://x.com/ASXinsiders) X (Twitter) account for posts about director share purchases. When a director buys shares in their own company above a configurable threshold, the system automatically places trades in an Interactive Brokers paper trading account.

## Features

- 🔍 **X Scraping**: Monitors @ASXinsiders for director buy posts
- 💰 **Price Fetching**: Real-time ASX stock prices via Yahoo Finance
- 📊 **Position Sizing**: Risk-based position sizing (5% of account per trade)
- 🤖 **Automated Trading**: Places orders in Interactive Brokers TWS
- 📈 **Risk Management**: Configurable take profit, stop loss, and trailing stop
- 🕐 **Market Hours**: Only trades during ASX market hours (10 AM - 4 PM AEST)
- 💾 **Database Logging**: PostgreSQL database for all posts, signals, and trades
- 📱 **Dashboard**: Real-time monitoring dashboard

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Node.js, TypeScript
- **Database**: PostgreSQL (AWS RDS)
- **Scraping**: Puppeteer
- **Trading**: Interactive Brokers TWS API (@stoqey/ib)
- **Price Data**: Yahoo Finance API

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (local or AWS RDS)
- Interactive Brokers TWS or IB Gateway
- X (Twitter) account (for scraping)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/Jason-Veloceo/director-buy-trading.git
cd director-buy-trading
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env.local` file:
```env
# Database Configuration
POSTGRES_USER=your_username
POSTGRES_PASSWORD=your_password
POSTGRES_HOST=your_host
POSTGRES_PORT=5432
POSTGRES_DATABASE=director-buy-trade
POSTGRES_SSL=true

# Interactive Brokers Configuration
IB_HOST=127.0.0.1
IB_PORT=7497
IB_CLIENT_ID=1

# Trading Configuration
EFFECTIVE_ACCOUNT_SIZE=20000
RISK_PER_TRADE=0.05
MIN_PURCHASE_THRESHOLD=20000
DEFAULT_TAKE_PROFIT=20
DEFAULT_STOP_LOSS=10
```

4. Set up the database:
```bash
psql -h your_host -U your_username -d director-buy-trade -f src/lib/db/schema.sql
```

## Configuration

### Interactive Brokers TWS Setup

1. Open TWS and log in to your paper trading account
2. Go to: **File → Global Configuration → API → Settings**
3. Configure:
   - ✅ Enable "Enable ActiveX and Socket Clients"
   - ✅ Set Socket port to **7497**
   - ✅ Uncheck "Read-Only API"
   - ✅ Check "Allow connections from localhost only"
   - ✅ Check "Download open orders on connection"
4. Click **Apply** and **OK**
5. Restart TWS

### X (Twitter) Login

Before running the system, you need to log in to X:

```bash
node manual-x-login.js
```

Follow the prompts to log in manually. The session will be saved for future use.

## Usage

### Start the Development Server

```bash
npm run dev
```

The dashboard will be available at `http://localhost:3000/trading`

### Start Monitoring

1. Open the dashboard at `http://localhost:3000/trading`
2. Click **"Start Monitoring"**
3. The system will:
   - Open a browser to @ASXinsiders
   - Scrape for director buy posts every 5 minutes
   - Evaluate trades based on your rules
   - Place orders in TWS when conditions are met

### Stop Monitoring

Click **"Stop Monitoring"** in the dashboard to stop the system and close the browser.

## Trading Rules

The system uses the following default rules (configurable in `.env.local`):

- **Minimum Purchase Threshold**: $20,000 (director's purchase value)
- **Account Size**: $20,000 (simulated account)
- **Risk Per Trade**: 5% ($1,000 max risk)
- **Take Profit**: 20%
- **Stop Loss**: 10%
- **Position Sizing**: Based on stop loss distance

### Example Trade Calculation

If a director buys $50,000 worth of stock at $0.50/share:
- Meets threshold: ✅ ($50,000 > $20,000)
- Max risk: $1,000 (5% of $20,000)
- Stop loss: 10% = $0.05
- Position size: $1,000 / $0.05 = 20,000 shares
- Position value: 20,000 × $0.50 = $10,000
- Take profit: $0.60 (20% gain)
- Stop loss: $0.45 (10% loss)

## Database Schema

The system uses the following main tables:

- `x_posts`: Scraped director buy posts
- `trading_rules`: Configurable trading rules
- `trade_signals`: Generated trade signals
- `trades`: Executed trades
- `trade_performance`: Trade performance metrics

## Project Structure

```
director-buy-trading/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── trading/        # API routes
│   │   └── trading/            # Dashboard page
│   ├── components/
│   │   └── ui/                 # UI components
│   └── lib/
│       ├── db/                 # Database utilities
│       └── trading/            # Trading system
│           ├── xScraper.ts     # X scraping
│           ├── priceFetcher.ts # Price fetching
│           ├── tradingEngine.ts # Trading logic
│           ├── ibClient.ts     # IB API client
│           └── tradingService.ts # Main service
├── .env.local                  # Environment variables
├── package.json
└── README.md
```

## API Endpoints

- `POST /api/trading/start` - Start monitoring
- `POST /api/trading/stop` - Stop monitoring
- `GET /api/trading/status` - Get system status
- `GET /api/trading/trades` - Get trade history

## Development

### Testing Components

Test X scraping:
```bash
node test-x-asxinsiders.js
```

Test IB connection:
```bash
node test-ib-detailed.js
```

Test order placement:
```bash
node place-real-order.js
```

Test full process:
```bash
node test-full-process.js
```

## Security Notes

- Never commit `.env.local` to version control
- Use paper trading account for testing
- Review all trades before switching to live trading
- Keep TWS API credentials secure
- Use SSL for database connections

## Troubleshooting

### X Scraping Issues

If X login fails or session expires:
```bash
node manual-x-login.js
```

### IB Connection Issues

1. Verify TWS is running
2. Check API settings are enabled
3. Ensure port 7497 is correct
4. Try restarting TWS

### Database Connection Issues

1. Verify credentials in `.env.local`
2. Check SSL setting matches your database
3. Ensure database is accessible from your IP

## Disclaimer

This software is for educational purposes only. Trading stocks involves risk. Always test thoroughly with paper trading before using real money. The authors are not responsible for any financial losses.

## License

MIT

## Author

Jason Paizes

## Repository

https://github.com/Jason-Veloceo/director-buy-trading

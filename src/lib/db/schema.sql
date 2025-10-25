-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create media table
CREATE TABLE IF NOT EXISTS media (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  media_type VARCHAR(50) NOT NULL, -- 'image', 'video', 'audio'
  media_url TEXT NOT NULL,
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create likes table
CREATE TABLE IF NOT EXISTS likes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT like_type_check CHECK (
    (post_id IS NOT NULL AND comment_id IS NULL) OR
    (post_id IS NULL AND comment_id IS NOT NULL)
  ),
  UNIQUE(user_id, post_id, comment_id)
);

-- Create chats table
CREATE TABLE IF NOT EXISTS chats (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255),
  model VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL, -- 'user', 'assistant'
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create transcriptions table
CREATE TABLE IF NOT EXISTS transcriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  audio_url TEXT NOT NULL,
  transcript TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create images table
CREATE TABLE IF NOT EXISTS images (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  image_url TEXT NOT NULL,
  model VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trading-specific tables
CREATE TABLE IF NOT EXISTS x_posts (
  id SERIAL PRIMARY KEY,
  post_id VARCHAR(255) UNIQUE NOT NULL,
  content TEXT NOT NULL,
  director_name VARCHAR(255),
  shares_quantity INTEGER,
  stock_ticker VARCHAR(20),
  total_holding_value DECIMAL(15,2),
  ownership_percentage DECIMAL(5,2),
  post_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trading_rules (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  min_purchase_threshold DECIMAL(15,2) DEFAULT 20000,
  take_profit_percentage DECIMAL(5,2) DEFAULT 20.0,
  stop_loss_percentage DECIMAL(5,2) DEFAULT 10.0,
  use_trailing_stop BOOLEAN DEFAULT false,
  trailing_stop_percentage DECIMAL(5,2) DEFAULT 5.0,
  max_position_size DECIMAL(15,2),
  max_concurrent_positions INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trade_signals (
  id SERIAL PRIMARY KEY,
  x_post_id INTEGER REFERENCES x_posts(id),
  stock_ticker VARCHAR(20) NOT NULL,
  shares_quantity INTEGER NOT NULL,
  current_price DECIMAL(10,4),
  total_value DECIMAL(15,2),
  meets_threshold BOOLEAN NOT NULL,
  trading_rule_id INTEGER REFERENCES trading_rules(id),
  signal_generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trades (
  id SERIAL PRIMARY KEY,
  signal_id INTEGER REFERENCES trade_signals(id),
  stock_ticker VARCHAR(20) NOT NULL,
  action VARCHAR(10) NOT NULL, -- 'BUY', 'SELL'
  quantity INTEGER NOT NULL,
  price DECIMAL(10,4) NOT NULL,
  order_id VARCHAR(255),
  status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'FILLED', 'CANCELLED'
  take_profit_price DECIMAL(10,4),
  stop_loss_price DECIMAL(10,4),
  trailing_stop_active BOOLEAN DEFAULT false,
  executed_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,
  pnl DECIMAL(15,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trade_performance (
  id SERIAL PRIMARY KEY,
  trade_id INTEGER REFERENCES trades(id),
  max_profit DECIMAL(15,2),
  max_drawdown DECIMAL(15,2),
  days_held INTEGER,
  exit_reason VARCHAR(50), -- 'TAKE_PROFIT', 'STOP_LOSS', 'TRAILING_STOP', 'MANUAL'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_media_user_id ON media(user_id);
CREATE INDEX IF NOT EXISTS idx_media_post_id ON media(post_id);
CREATE INDEX IF NOT EXISTS idx_transcriptions_user_id ON transcriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_images_user_id ON images(user_id);

-- Trading-specific indexes
CREATE INDEX IF NOT EXISTS idx_x_posts_post_id ON x_posts(post_id);
CREATE INDEX IF NOT EXISTS idx_x_posts_stock_ticker ON x_posts(stock_ticker);
CREATE INDEX IF NOT EXISTS idx_trade_signals_stock_ticker ON trade_signals(stock_ticker);
CREATE INDEX IF NOT EXISTS idx_trade_signals_generated_at ON trade_signals(signal_generated_at);
CREATE INDEX IF NOT EXISTS idx_trades_stock_ticker ON trades(stock_ticker);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at); 
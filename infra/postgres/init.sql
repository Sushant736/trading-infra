-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================
-- TIER 1: SUPER ADMINS
-- ================================
CREATE TABLE super_admins (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email varchar(255) UNIQUE NOT NULL,
  password_hash varchar(255) NOT NULL,
  full_name varchar(255) NOT NULL,
  is_active boolean DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

-- ================================
-- TIER 2: FIRMS
-- ================================
CREATE TABLE firms (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name varchar(255) UNIQUE NOT NULL,
  slug varchar(100) UNIQUE NOT NULL,
  logo_url varchar(500),
  timezone varchar(100) DEFAULT 'UTC',
  currency char(3) DEFAULT 'USD',
  max_traders integer DEFAULT 10,
  subscription_tier varchar(50) DEFAULT 'basic',
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE firm_admins (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  email varchar(255) UNIQUE NOT NULL,
  password_hash varchar(255) NOT NULL,
  full_name varchar(255) NOT NULL,
  is_active boolean DEFAULT true,
  permissions jsonb DEFAULT '{}',
  last_login_at timestamptz,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE firm_risk_rules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  max_daily_loss_pct numeric(5,2) DEFAULT 5.00,
  max_drawdown_pct numeric(5,2) DEFAULT 10.00,
  max_position_size numeric(15,2) DEFAULT 1.00,
  max_open_trades integer DEFAULT 5,
  allowed_symbols text[] DEFAULT '{}',
  news_filter_enabled boolean DEFAULT true,
  session_filter jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT NOW(),
  UNIQUE(firm_id)
);

-- ================================
-- TIER 3: TRADERS
-- ================================
CREATE TABLE traders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  email varchar(255) UNIQUE NOT NULL,
  password_hash varchar(255) NOT NULL,
  full_name varchar(255) NOT NULL,
  phone varchar(50),
  trader_code varchar(50) UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  kyc_status varchar(50) DEFAULT 'pending',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

-- ================================
-- TIER 4: TRADING ACCOUNTS
-- ================================
CREATE TABLE trading_accounts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  trader_id uuid NOT NULL REFERENCES traders(id) ON DELETE CASCADE,
  firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  broker_account_id varchar(100) UNIQUE NOT NULL,
  broker_name varchar(100) NOT NULL,
  fix_session_id varchar(100),
  server_host varchar(255),
  server_port integer,
  fix_version varchar(20) DEFAULT 'FIX.4.4',
  account_type varchar(50) DEFAULT 'live',
  currency char(3) DEFAULT 'USD',
  initial_balance numeric(20,2) DEFAULT 0,
  current_balance numeric(20,2) DEFAULT 0,
  equity numeric(20,2) DEFAULT 0,
  margin numeric(20,2) DEFAULT 0,
  free_margin numeric(20,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  is_connected boolean DEFAULT false,
  last_heartbeat_at timestamptz,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE account_snapshots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES trading_accounts(id) ON DELETE CASCADE,
  balance numeric(20,2) NOT NULL,
  equity numeric(20,2) NOT NULL,
  floating_pnl numeric(20,2) DEFAULT 0,
  daily_pnl numeric(20,2) DEFAULT 0,
  daily_drawdown_pct numeric(8,4) DEFAULT 0,
  peak_equity numeric(20,2) DEFAULT 0,
  max_drawdown_pct numeric(8,4) DEFAULT 0,
  open_trades integer DEFAULT 0,
  snapshot_at timestamptz DEFAULT NOW()
);

-- ================================
-- TIER 5: STRATEGIES & SIGNALS
-- ================================
CREATE TABLE strategies (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  firm_id uuid NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  description text,
  params jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE signals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  strategy_id uuid REFERENCES strategies(id),
  account_id uuid NOT NULL REFERENCES trading_accounts(id),
  symbol varchar(20) NOT NULL,
  side varchar(10) NOT NULL CHECK (side IN ('BUY','SELL')),
  volume numeric(15,2) NOT NULL,
  sl_price numeric(15,5),
  tp_price numeric(15,5),
  source varchar(100),
  redis_stream_id varchar(255),
  status varchar(50) DEFAULT 'pending',
  received_at timestamptz DEFAULT NOW(),
  processed_at timestamptz
);

-- ================================
-- TIER 6: EXECUTION
-- ================================
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES trading_accounts(id),
  signal_id uuid REFERENCES signals(id),
  client_order_id varchar(100) UNIQUE NOT NULL,
  broker_order_id varchar(100),
  symbol varchar(20) NOT NULL,
  side varchar(10) NOT NULL CHECK (side IN ('BUY','SELL')),
  order_type varchar(50) NOT NULL,
  volume numeric(15,2) NOT NULL,
  price numeric(15,5),
  sl_price numeric(15,5),
  tp_price numeric(15,5),
  status varchar(50) DEFAULT 'pending',
  reject_reason text,
  submitted_at timestamptz,
  filled_at timestamptz,
  created_at timestamptz DEFAULT NOW()
);

CREATE TABLE positions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES trading_accounts(id),
  order_id uuid REFERENCES orders(id),
  broker_position_id varchar(100),
  symbol varchar(20) NOT NULL,
  side varchar(10) NOT NULL,
  volume numeric(15,2) NOT NULL,
  open_price numeric(15,5) NOT NULL,
  current_price numeric(15,5),
  sl_price numeric(15,5),
  tp_price numeric(15,5),
  floating_pnl numeric(20,2) DEFAULT 0,
  swap numeric(20,2) DEFAULT 0,
  commission numeric(20,2) DEFAULT 0,
  status varchar(50) DEFAULT 'OPEN',
  opened_at timestamptz DEFAULT NOW(),
  closed_at timestamptz
);

CREATE TABLE executions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id uuid NOT NULL REFERENCES orders(id),
  position_id uuid REFERENCES positions(id),
  exec_type varchar(50) NOT NULL,
  exec_price numeric(15,5) NOT NULL,
  exec_volume numeric(15,2) NOT NULL,
  slippage_pips numeric(10,4),
  spread_at_exec numeric(10,4),
  latency_ms integer,
  fix_msg_seq integer,
  raw_fix_msg text,
  executed_at timestamptz DEFAULT NOW()
);

-- ================================
-- TIER 7: RISK & AUDIT
-- ================================
CREATE TABLE risk_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES trading_accounts(id),
  firm_id uuid NOT NULL REFERENCES firms(id),
  event_type varchar(100) NOT NULL,
  severity varchar(50) DEFAULT 'WARN' CHECK (severity IN ('WARN','BREACH','CRITICAL')),
  rule_triggered varchar(100),
  value_at_trigger numeric(20,4),
  threshold numeric(20,4),
  action_taken varchar(255),
  resolved_at timestamptz,
  created_at timestamptz DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_type varchar(50) NOT NULL CHECK (actor_type IN ('SUPER_ADMIN','FIRM_ADMIN','TRADER')),
  actor_id uuid NOT NULL,
  firm_id uuid REFERENCES firms(id),
  action varchar(255) NOT NULL,
  resource_type varchar(100),
  resource_id uuid,
  payload jsonb DEFAULT '{}',
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT NOW()
);

CREATE TABLE latency_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES trading_accounts(id),
  event_type varchar(100),
  signal_ts timestamptz,
  redis_enqueue_ts timestamptz,
  risk_check_ts timestamptz,
  fix_send_ts timestamptz,
  fix_ack_ts timestamptz,
  total_latency_ms integer,
  vps_id varchar(100),
  created_at timestamptz DEFAULT NOW()
);

-- ================================
-- INDEXES
-- ================================
CREATE INDEX idx_firm_admins_firm ON firm_admins(firm_id);
CREATE INDEX idx_traders_firm ON traders(firm_id);
CREATE INDEX idx_accounts_trader ON trading_accounts(trader_id);
CREATE INDEX idx_accounts_firm ON trading_accounts(firm_id);
CREATE INDEX idx_snapshots_account ON account_snapshots(account_id);
CREATE INDEX idx_snapshots_time ON account_snapshots(snapshot_at DESC);
CREATE INDEX idx_signals_account ON signals(account_id);
CREATE INDEX idx_orders_account ON orders(account_id);
CREATE INDEX idx_positions_account ON positions(account_id);
CREATE INDEX idx_executions_order ON executions(order_id);
CREATE INDEX idx_risk_events_account ON risk_events(account_id);
CREATE INDEX idx_risk_events_firm ON risk_events(firm_id);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_firm ON audit_logs(firm_id);
CREATE INDEX idx_latency_account ON latency_logs(account_id);

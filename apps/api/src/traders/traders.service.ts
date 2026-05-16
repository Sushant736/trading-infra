import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class TradersService {
  constructor(@InjectDataSource() private db: DataSource) {}

  async getFirmDashboard(firmId: string) {
    const [firm] = await this.db.query(`SELECT * FROM firms WHERE id=$1`, [firmId]);
    const [rules] = await this.db.query(`SELECT * FROM firm_risk_rules WHERE firm_id=$1`, [firmId]);
    const [counts] = await this.db.query(`
      SELECT
        (SELECT COUNT(*) FROM traders WHERE firm_id=$1 AND is_active=true) as active_traders,
        (SELECT COUNT(*) FROM traders WHERE firm_id=$1) as total_traders,
        (SELECT COUNT(*) FROM trading_accounts WHERE firm_id=$1 AND is_active=true) as active_accounts,
        (SELECT COUNT(*) FROM positions p JOIN trading_accounts ta ON ta.id=p.account_id WHERE ta.firm_id=$1 AND p.status='OPEN') as open_positions,
        (SELECT COALESCE(SUM(p.floating_pnl),0) FROM positions p JOIN trading_accounts ta ON ta.id=p.account_id WHERE ta.firm_id=$1 AND p.status='OPEN') as total_floating_pnl,
        (SELECT COUNT(*) FROM risk_events WHERE firm_id=$1 AND created_at > NOW() - INTERVAL '24 hours') as breaches_today
    `, [firmId]);
    return { firm, rules, stats: counts };
  }

  async getFirmTraders(firmId: string) {
    return this.db.query(`
      SELECT t.*,
        ta.id as account_id, ta.broker_account_id, ta.current_balance, ta.equity, ta.initial_balance, ta.is_active as account_active,
        COALESCE((SELECT COUNT(*) FROM positions p WHERE p.account_id=ta.id AND p.status='OPEN'),0) as open_trades,
        COALESCE((SELECT SUM(floating_pnl) FROM positions p WHERE p.account_id=ta.id AND p.status='OPEN'),0) as floating_pnl,
        COALESCE((SELECT SUM(floating_pnl) FROM positions p WHERE p.account_id=ta.id AND p.status='CLOSED'),0) as realized_pnl,
        (SELECT COUNT(*) FROM risk_events re WHERE re.account_id=ta.id AND re.created_at > NOW() - INTERVAL '24 hours') as breaches_today
      FROM traders t
      LEFT JOIN trading_accounts ta ON ta.trader_id=t.id
      WHERE t.firm_id=$1 ORDER BY t.created_at DESC
    `, [firmId]);
  }

  async getTraderDetail(traderId: string, firmId: string) {
    const [trader] = await this.db.query(
      `SELECT t.*, ta.* FROM traders t LEFT JOIN trading_accounts ta ON ta.trader_id=t.id WHERE t.id=$1 AND t.firm_id=$2`,
      [traderId, firmId]);
    const positions = await this.db.query(
      `SELECT * FROM positions WHERE account_id=(SELECT id FROM trading_accounts WHERE trader_id=$1) ORDER BY opened_at DESC LIMIT 20`, [traderId]);
    const riskEvents = await this.db.query(
      `SELECT * FROM risk_events WHERE account_id=(SELECT id FROM trading_accounts WHERE trader_id=$1) ORDER BY created_at DESC LIMIT 10`, [traderId]);
    return { trader, positions, risk_events: riskEvents };
  }

  async createTrader(firmId: string, data: any) {
    const hash = await bcrypt.hash(data.password, 12);
    const code = 'TRD' + Date.now().toString().slice(-6);
    const [trader] = await this.db.query(`
      INSERT INTO traders (firm_id, email, password_hash, full_name, trader_code)
      VALUES ($1,$2,$3,$4,$5) RETURNING *
    `, [firmId, data.email, hash, data.full_name, code]);
    const [account] = await this.db.query(`
      INSERT INTO trading_accounts (trader_id, firm_id, broker_account_id, broker_name, currency, initial_balance, current_balance, equity)
      VALUES ($1,$2,$3,$4,$5,$6,$6,$6) RETURNING *
    `, [trader.id, firmId, code, 'PropScholar', data.currency || 'USD', data.balance || 10000]);
    return { trader, account, credentials: { email: data.email, password: data.password, server: data.server_name, account: code } };
  }

  async toggleTrader(traderId: string, firmId: string) {
    await this.db.query(`UPDATE traders SET is_active = NOT is_active WHERE id=$1 AND firm_id=$2`, [traderId, firmId]);
    return { success: true };
  }

  async getRiskRules(firmId: string) {
    const [rules] = await this.db.query(`SELECT * FROM firm_risk_rules WHERE firm_id=$1`, [firmId]);
    return rules;
  }

  async updateRiskRules(firmId: string, data: any) {
    await this.db.query(`
      UPDATE firm_risk_rules SET max_daily_loss_pct=$1, max_drawdown_pct=$2, max_position_size=$3, max_open_trades=$4, updated_at=NOW()
      WHERE firm_id=$5
    `, [data.max_daily_loss_pct, data.max_drawdown_pct, data.max_position_size, data.max_open_trades, firmId]);
    return { success: true };
  }

  async getRiskEvents(firmId: string) {
    return this.db.query(`
      SELECT re.*, t.full_name as trader_name, ta.broker_account_id
      FROM risk_events re
      JOIN trading_accounts ta ON ta.id=re.account_id
      JOIN traders t ON t.id=ta.trader_id
      WHERE re.firm_id=$1 ORDER BY re.created_at DESC LIMIT 50
    `, [firmId]);
  }

  async getWebhookInfo(firmId: string) {
    const [firm] = await this.db.query(
      `SELECT slug, server_name, webhook_secret FROM firms WHERE id=$1`, [firmId]);
    return {
      webhook_url: `http://35.200.170.189:3000/api/v1/webhooks/${firm.slug}`,
      secret: firm.webhook_secret,
      server: firm.server_name,
      docs: {
        create_challenge: { action: 'create_challenge', email: 'trader@example.com', full_name: 'John Doe', balance: 10000, challenge_type: 'phase1' },
        disable_trader: { action: 'disable_trader', email: 'trader@example.com' },
        get_trader: { action: 'get_trader', account_number: 'TRD123456' },
      }
    };
  }
}

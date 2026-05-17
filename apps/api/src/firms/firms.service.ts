import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class FirmsService {
  constructor(@InjectDataSource() private db: DataSource) {}

  async getAllFirms() {
    return this.db.query(`
      SELECT f.*,
        (SELECT COUNT(*) FROM traders t WHERE t.firm_id = f.id) as trader_count,
        (SELECT COUNT(*) FROM trading_accounts ta WHERE ta.firm_id = f.id) as account_count
      FROM firms f ORDER BY f.created_at DESC
    `);
  }

  async getStats() {
    const [firms] = await this.db.query(`SELECT COUNT(*) as total FROM firms WHERE is_active=true`);
    const [traders] = await this.db.query(`SELECT COUNT(*) as total FROM traders WHERE is_active=true`);
    const [accounts] = await this.db.query(`SELECT COUNT(*) as total FROM trading_accounts WHERE is_active=true`);
    const [positions] = await this.db.query(`SELECT COUNT(*) as total FROM positions WHERE status='OPEN'`);
    const [volume] = await this.db.query(`SELECT COALESCE(SUM(volume),0) as total FROM positions`);
    return {
      firms: parseInt(firms.total),
      traders: parseInt(traders.total),
      accounts: parseInt(accounts.total),
      open_positions: parseInt(positions.total),
      total_volume: parseFloat(volume.total),
    };
  }

  async getFirm(id: string) {
    const [firm] = await this.db.query(`SELECT * FROM firms WHERE id=$1`, [id]);
    const [rules] = await this.db.query(`SELECT * FROM firm_risk_rules WHERE firm_id=$1`, [id]);
    const admins = await this.db.query(`SELECT id, email, full_name, is_active, created_at FROM firm_admins WHERE firm_id=$1`, [id]);
    return { ...firm, risk_rules: rules, admins };
  }

  async getFirmTraders(firmId: string) {
    return this.db.query(`
      SELECT t.*,
        ta.id as account_id, ta.broker_account_id, ta.current_balance, ta.equity,
        (SELECT COUNT(*) FROM positions p WHERE p.account_id = ta.id AND p.status='OPEN') as open_trades,
        (SELECT COALESCE(SUM(floating_pnl),0) FROM positions p WHERE p.account_id = ta.id AND p.status='OPEN') as floating_pnl,
        (SELECT COUNT(*) FROM risk_events re WHERE re.account_id = ta.id AND re.created_at > NOW() - INTERVAL '24 hours') as breaches_today
      FROM traders t
      LEFT JOIN trading_accounts ta ON ta.trader_id = t.id
      WHERE t.firm_id=$1
      ORDER BY t.created_at DESC
    `, [firmId]);
  }

  async createFirm(data: any) {
    const slug = data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const [firm] = await this.db.query(`
      INSERT INTO firms (name, slug, currency, timezone, max_traders, subscription_tier)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [data.name, slug, data.currency || 'USD', data.timezone || 'UTC', data.max_traders || 10, data.subscription_tier || 'basic']);
    await this.db.query(`
      INSERT INTO firm_risk_rules (firm_id, max_daily_loss_pct, max_drawdown_pct, max_position_size, max_open_trades)
      VALUES ($1, $2, $3, $4, $5)
    `, [firm.id, data.max_daily_loss || 5, data.max_drawdown || 10, data.max_position_size || 1, data.max_open_trades || 5]);
    return firm;
  }

  async updateFirm(id: string, data: any) {
    await this.db.query(`
      UPDATE firms SET name=$1, max_traders=$2, is_active=$3, updated_at=NOW() WHERE id=$4
    `, [data.name, data.max_traders, data.is_active, id]);
    if (data.risk_rules) {
      await this.db.query(`
        UPDATE firm_risk_rules SET max_daily_loss_pct=$1, max_drawdown_pct=$2, max_position_size=$3, max_open_trades=$4
        WHERE firm_id=$5
      `, [data.risk_rules.max_daily_loss_pct, data.risk_rules.max_drawdown_pct, data.risk_rules.max_position_size, data.risk_rules.max_open_trades, id]);
    }
    return { success: true };
  }

  async createFirmAdmin(firmId: string, data: any) {
    const hash = await bcrypt.hash(data.password, 12);
    const [admin] = await this.db.query(`
      INSERT INTO firm_admins (firm_id, email, password_hash, full_name)
      VALUES ($1, $2, $3, $4) RETURNING id, email, full_name, created_at
    `, [firmId, data.email, hash, data.full_name]);
    return admin;
  }

  async createTrader(firmId: string, data: any) {
    const hash = await bcrypt.hash(data.password, 12);
    const code = 'TRD' + Date.now().toString().slice(-6);
    const [trader] = await this.db.query(`
      INSERT INTO traders (firm_id, email, password_hash, full_name, trader_code)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [firmId, data.email, hash, data.full_name, code]);
    const [account] = await this.db.query(`
      INSERT INTO trading_accounts (trader_id, firm_id, broker_account_id, broker_name, currency, initial_balance, current_balance, equity)
      VALUES ($1, $2, $3, $4, $5, $6, $6, $6) RETURNING *
    `, [trader.id, firmId, code, data.broker_name || 'PropScholar', data.currency || 'USD', data.balance || 10000]);
    return { trader, account };
  }

  async deactivateFirm(id: string) {
    await this.db.query(`UPDATE firms SET is_active=false WHERE id=$1`, [id]);
    return { success: true };
  }

  async getAllTraders() {
    return this.db.query(`
      SELECT t.*, f.name as firm_name,
        ta.current_balance, ta.equity, ta.broker_account_id,
        COALESCE((SELECT COUNT(*) FROM positions p WHERE p.account_id=ta.id AND p.status='OPEN'),0) as open_trades,
        COALESCE((SELECT SUM(floating_pnl) FROM positions p WHERE p.account_id=ta.id AND p.status='OPEN'),0) as floating_pnl
      FROM traders t
      JOIN firms f ON f.id=t.firm_id
      LEFT JOIN trading_accounts ta ON ta.trader_id=t.id
      ORDER BY t.created_at DESC
    `);
  }

  async getAllRiskEvents() {
    return this.db.query(`
      SELECT re.*, f.name as firm_name, t.full_name as trader_name, ta.broker_account_id
      FROM risk_events re
      JOIN firms f ON f.id=re.firm_id
      JOIN trading_accounts ta ON ta.id=re.account_id
      JOIN traders t ON t.id=ta.trader_id
      ORDER BY re.created_at DESC LIMIT 100
    `);
  }
}

import { Controller, Post, Body, Param, Headers, HttpCode } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';

@Controller('webhooks')
export class WebhookController {
  constructor(@InjectDataSource() private db: DataSource) {}

  @Post(':firm_slug')
  @HttpCode(200)
  async handleWebhook(
    @Param('firm_slug') firmSlug: string,
    @Headers('x-webhook-secret') secret: string,
    @Body() body: any,
  ) {
    // Validate firm + secret
    const [firm] = await this.db.query(
      `SELECT * FROM firms WHERE slug=$1 AND is_active=true`, [firmSlug]);
    if (!firm) return { error: 'Firm not found' };
    if (firm.webhook_secret !== secret) return { error: 'Invalid secret' };

    const action = body.action || 'create_challenge';

    if (action === 'create_challenge') {
      return this.createChallenge(firm, body);
    }
    if (action === 'disable_trader') {
      return this.disableTrader(firm, body);
    }
    if (action === 'get_trader') {
      return this.getTrader(firm, body);
    }

    return { error: 'Unknown action' };
  }

  private async createChallenge(firm: any, body: any) {
    // Required: email, full_name, balance, challenge_type
    const { email, full_name, balance, challenge_type, password } = body;
    if (!email || !full_name || !balance) {
      return { error: 'Missing required fields: email, full_name, balance' };
    }

    // Check if trader already exists
    const existing = await this.db.query(
      `SELECT * FROM traders WHERE email=$1 AND firm_id=$2`, [email, firm.id]);

    let trader: any;
    let account: any;
    const autoPassword = password || this.generatePassword();
    const hash = await bcrypt.hash(autoPassword, 12);
    const code = 'TRD' + Date.now().toString().slice(-6);

    if (existing.length) {
      trader = existing[0];
      // Create new account for existing trader
      const [acc] = await this.db.query(`
        INSERT INTO trading_accounts (trader_id, firm_id, broker_account_id, broker_name, currency, initial_balance, current_balance, equity)
        VALUES ($1,$2,$3,$4,$5,$6,$6,$6) RETURNING *
      `, [trader.id, firm.id, code, firm.name, firm.currency || 'USD', parseFloat(balance)]);
      account = acc;
    } else {
      // Create new trader
      const [t] = await this.db.query(`
        INSERT INTO traders (firm_id, email, password_hash, full_name, trader_code)
        VALUES ($1,$2,$3,$4,$5) RETURNING *
      `, [firm.id, email, hash, full_name, code]);
      trader = t;

      const [acc] = await this.db.query(`
        INSERT INTO trading_accounts (trader_id, firm_id, broker_account_id, broker_name, currency, initial_balance, current_balance, equity)
        VALUES ($1,$2,$3,$4,$5,$6,$6,$6) RETURNING *
      `, [trader.id, firm.id, code, firm.name, firm.currency || 'USD', parseFloat(balance)]);
      account = acc;
    }

    // Get firm risk rules
    const [rules] = await this.db.query(
      `SELECT * FROM firm_risk_rules WHERE firm_id=$1`, [firm.id]);

    return {
      success: true,
      action: 'create_challenge',
      credentials: {
        email: trader.email,
        password: autoPassword,
        server: firm.server_name,
        account_number: code,
        balance: parseFloat(balance),
        login_url: 'http://35.200.170.189:3001',
      },
      account: {
        id: account.id,
        account_number: code,
        balance: parseFloat(balance),
        challenge_type: challenge_type || 'standard',
      },
      risk_rules: rules ? {
        max_daily_loss: `${rules.max_daily_loss_pct}%`,
        max_drawdown: `${rules.max_drawdown_pct}%`,
        max_open_trades: rules.max_open_trades,
      } : null,
    };
  }

  private async disableTrader(firm: any, body: any) {
    const { email, account_number } = body;
    if (account_number) {
      await this.db.query(
        `UPDATE trading_accounts SET is_active=false WHERE broker_account_id=$1 AND firm_id=$2`,
        [account_number, firm.id]);
    } else if (email) {
      await this.db.query(
        `UPDATE traders SET is_active=false WHERE email=$1 AND firm_id=$2`, [email, firm.id]);
    }
    return { success: true, action: 'disable_trader' };
  }

  private async getTrader(firm: any, body: any) {
    const { email, account_number } = body;
    let trader: any;
    if (account_number) {
      const rows = await this.db.query(`
        SELECT t.*, ta.broker_account_id, ta.current_balance, ta.equity, ta.is_active as account_active
        FROM traders t JOIN trading_accounts ta ON ta.trader_id=t.id
        WHERE ta.broker_account_id=$1 AND t.firm_id=$2
      `, [account_number, firm.id]);
      trader = rows[0];
    } else if (email) {
      const rows = await this.db.query(`
        SELECT t.*, ta.broker_account_id, ta.current_balance, ta.equity, ta.is_active as account_active
        FROM traders t JOIN trading_accounts ta ON ta.trader_id=t.id
        WHERE t.email=$1 AND t.firm_id=$2
      `, [email, firm.id]);
      trader = rows[0];
    }
    if (!trader) return { error: 'Trader not found' };
    return { success: true, trader };
  }

  private generatePassword(): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
    let pwd = '';
    for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    return pwd;
  }
}

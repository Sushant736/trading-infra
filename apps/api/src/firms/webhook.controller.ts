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
    const [firm] = await this.db.query(`SELECT * FROM firms WHERE slug=$1 AND is_active=true`, [firmSlug]);
    if (!firm) return { error: 'Firm not found' };
    if (firm.webhook_secret !== secret) return { error: 'Invalid secret' };

    const action = body.action || 'create_challenge';
    if (action === 'create_challenge') return this.createChallenge(firm, body);
    if (action === 'disable_trader') return this.disableTrader(firm, body);
    if (action === 'disable_account') return this.disableAccount(firm, body);
    if (action === 'get_trader') return this.getTrader(firm, body);
    return { error: 'Unknown action' };
  }

  private async createChallenge(firm: any, body: any) {
    const { email, full_name, balance, program_id, leverage } = body;
    if (!email || !full_name || !balance) return { error: 'Missing: email, full_name, balance' };

    // Get program + first phase for rules
    let programPhase: any = null;
    let programName = body.challenge_type || 'Standard';
    let accountLeverage = leverage || 100;

    if (program_id) {
      const [prog] = await this.db.query(`SELECT * FROM challenge_programs WHERE id=$1 AND firm_id=$2`, [program_id, firm.id]);
      if (prog) {
        programName = prog.name;
        const phases = await this.db.query(`SELECT * FROM program_phases WHERE program_id=$1 ORDER BY phase_order LIMIT 1`, [program_id]);
        if (phases.length) {
          programPhase = phases[0];
          accountLeverage = programPhase.leverage || leverage || 100;
        }
      }
    }

    // Check if trader exists in this firm
    const existing = await this.db.query(`SELECT * FROM traders WHERE email=$1 AND firm_id=$2`, [email, firm.id]);

    let trader: any;
    let isNewTrader = false;
    const autoPassword = body.password || this.generatePassword();
    const code = 'TRD' + Date.now().toString().slice(-6);

    if (existing.length) {
      // Trader exists → create NEW account only (keep old ones)
      trader = existing[0];
      const [account] = await this.db.query(`
        INSERT INTO trading_accounts (trader_id, firm_id, broker_account_id, broker_name, currency, initial_balance, current_balance, equity, leverage)
        VALUES ($1,$2,$3,$4,$5,$6,$6,$6,$7) RETURNING *
      `, [trader.id, firm.id, code, firm.name, firm.currency||'USD', parseFloat(balance), accountLeverage]);

      return {
        success: true,
        action: 'create_challenge',
        is_new_trader: false,
        message: 'New account created for existing trader',
        credentials: {
          email: trader.email,
          password: '(use existing password)',
          server: firm.server_name,
          account_number: code,
          balance: parseFloat(balance),
          leverage: accountLeverage,
          program: programName,
          login_url: process.env.DASHBOARD_URL || 'https://trading-infra-psi.vercel.app',
        },
        account: { id: account.id, account_number: code, balance: parseFloat(balance), leverage: accountLeverage },
      };
    }

    // New trader → create trader + account
    const hash = await bcrypt.hash(autoPassword, 12);
    const [newTrader] = await this.db.query(`
      INSERT INTO traders (firm_id, email, password_hash, full_name, trader_code)
      VALUES ($1,$2,$3,$4,$5) RETURNING *
    `, [firm.id, email, hash, full_name, code]);
    trader = newTrader;
    isNewTrader = true;

    const [account] = await this.db.query(`
      INSERT INTO trading_accounts (trader_id, firm_id, broker_account_id, broker_name, currency, initial_balance, current_balance, equity, leverage)
      VALUES ($1,$2,$3,$4,$5,$6,$6,$6,$7) RETURNING *
    `, [trader.id, firm.id, code, firm.name, firm.currency||'USD', parseFloat(balance), accountLeverage]);

    // Get firm risk rules
    const [rules] = await this.db.query(`SELECT * FROM firm_risk_rules WHERE firm_id=$1`, [firm.id]);

    return {
      success: true,
      action: 'create_challenge',
      is_new_trader: isNewTrader,
      credentials: {
        email: trader.email,
        password: autoPassword,
        server: firm.server_name,
        account_number: code,
        balance: parseFloat(balance),
        leverage: accountLeverage,
        program: programName,
        login_url: process.env.DASHBOARD_URL || 'https://trading-infra-psi.vercel.app',
      },
      account: { id: account.id, account_number: code, balance: parseFloat(balance), leverage: accountLeverage },
      risk_rules: rules ? {
        max_daily_loss: `${rules.max_daily_loss_pct}%`,
        max_drawdown: `${rules.max_drawdown_pct}%`,
        max_open_trades: rules.max_open_trades,
      } : null,
      phase_rules: programPhase ? {
        profit_target: `${programPhase.profit_target_pct}%`,
        min_trading_days: programPhase.min_trading_days,
        consistency_rule: programPhase.consistency_rule_enabled,
      } : null,
    };
  }

  private async disableTrader(firm: any, body: any) {
    if (body.email) await this.db.query(`UPDATE traders SET is_active=false WHERE email=$1 AND firm_id=$2`, [body.email, firm.id]);
    return { success: true };
  }

  private async disableAccount(firm: any, body: any) {
    if (body.account_number) await this.db.query(`UPDATE trading_accounts SET is_active=false WHERE broker_account_id=$1 AND firm_id=$2`, [body.account_number, firm.id]);
    return { success: true };
  }

  private async getTrader(firm: any, body: any) {
    const { email, account_number } = body;
    let rows: any[];
    if (account_number) {
      rows = await this.db.query(`
        SELECT t.*, ta.broker_account_id, ta.current_balance, ta.equity, ta.leverage, ta.is_active as account_active,
          (SELECT COUNT(*) FROM positions p WHERE p.account_id=ta.id AND p.status='OPEN') as open_trades
        FROM traders t JOIN trading_accounts ta ON ta.trader_id=t.id
        WHERE ta.broker_account_id=$1 AND t.firm_id=$2
      `, [account_number, firm.id]);
    } else if (email) {
      rows = await this.db.query(`
        SELECT t.*, ta.broker_account_id, ta.current_balance, ta.equity, ta.leverage, ta.is_active as account_active,
          (SELECT COUNT(*) FROM positions p WHERE p.account_id=ta.id AND p.status='OPEN') as open_trades
        FROM traders t JOIN trading_accounts ta ON ta.trader_id=t.id
        WHERE t.email=$1 AND t.firm_id=$2
        ORDER BY ta.created_at DESC
      `, [email, firm.id]);
    } else { return { error: 'Provide email or account_number' }; }
    if (!rows.length) return { error: 'Trader not found' };
    return { success: true, accounts: rows };
  }

  private generatePassword(): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
    let pwd = '';
    for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    return pwd;
  }
}

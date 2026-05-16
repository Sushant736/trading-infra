import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { createClient } from 'redis';

@Injectable()
export class TradingService {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  async getCurrentPrice(symbol: string): Promise<number> {
    try {
      const client = createClient({ url: 'redis://:changeme@localhost:6379' });
      await client.connect();
      const msgs = await client.xRevRange(`feed:${symbol}`, '+', '-', { COUNT: 1 });
      await client.disconnect();
      if (!msgs.length) return 0;
      return JSON.parse(msgs[0].message.data as string).bid;
    } catch { return 0; }
  }

  async checkRiskRealtime(accountId: string): Promise<void> {
    try {
      const rows = await this.dataSource.query(`
        SELECT ta.equity, ta.current_balance, ta.initial_balance, ta.firm_id,
               frr.max_daily_loss_pct, frr.max_drawdown_pct, frr.max_open_trades
        FROM trading_accounts ta
        JOIN firm_risk_rules frr ON frr.firm_id = ta.firm_id
        WHERE ta.id=$1 AND ta.is_active=true
      `, [accountId]);
      if (!rows.length) return;
      const a = rows[0];
      const equity = parseFloat(a.equity);
      const balance = parseFloat(a.current_balance);
      const initial = parseFloat(a.initial_balance);

      const snapRows = await this.dataSource.query(
        `SELECT COALESCE(MAX(peak_equity), $1) as peak FROM account_snapshots WHERE account_id=$2`,
        [initial, accountId]);
      const peak = Math.max(parseFloat(snapRows[0]?.peak || initial), equity);

      const dailyLossPct = balance > 0 ? Math.max(0, (balance - equity) / balance * 100) : 0;
      const drawdownPct = peak > 0 ? Math.max(0, (peak - equity) / peak * 100) : 0;

      const [openCount] = await this.dataSource.query(
        `SELECT COUNT(*) as cnt FROM positions WHERE account_id=$1 AND status='OPEN'`, [accountId]);

      // Update peak snapshot
      await this.dataSource.query(`
        INSERT INTO account_snapshots (account_id, balance, equity, floating_pnl, daily_drawdown_pct, peak_equity)
        VALUES ($1, $2, $3,
          COALESCE((SELECT SUM(floating_pnl) FROM positions WHERE account_id=$1 AND status='OPEN'),0),
          $4, $5)
      `, [accountId, balance, equity, dailyLossPct, peak]);

      // Check breaches immediately
      if (dailyLossPct >= parseFloat(a.max_daily_loss_pct)) {
        await this.logBreach(accountId, a.firm_id, 'DAILY_LOSS_BREACH', dailyLossPct, parseFloat(a.max_daily_loss_pct));
      }
      if (drawdownPct >= parseFloat(a.max_drawdown_pct)) {
        await this.logBreach(accountId, a.firm_id, 'MAX_DRAWDOWN_BREACH', drawdownPct, parseFloat(a.max_drawdown_pct));
      }
      if (parseInt(openCount.cnt) > parseInt(a.max_open_trades)) {
        await this.logBreach(accountId, a.firm_id, 'MAX_TRADES_BREACH', parseInt(openCount.cnt), parseInt(a.max_open_trades));
      }
    } catch (e) { /* silent */ }
  }

  private async logBreach(accountId: string, firmId: string, eventType: string, value: number, threshold: number) {
    const [recent] = await this.dataSource.query(`
      SELECT COUNT(*) as cnt FROM risk_events
      WHERE account_id=$1 AND event_type=$2 AND created_at > NOW() - INTERVAL '5 minutes'
    `, [accountId, eventType]);
    if (parseInt(recent.cnt) > 0) return;
    const severity = value >= threshold * 1.5 ? 'CRITICAL' : 'BREACH';
    await this.dataSource.query(`
      INSERT INTO risk_events (account_id, firm_id, event_type, severity, rule_triggered, value_at_trigger, threshold, action_taken)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'ACCOUNT_FLAGGED')
    `, [accountId, firmId, eventType, severity, eventType, value, threshold]);
  }

  async getAccountByTraderId(traderId: string) {
    const result = await this.dataSource.query(
      `SELECT * FROM trading_accounts WHERE trader_id=$1 AND is_active=true LIMIT 1`, [traderId]);
    return result[0] || null;
  }

  async openTrade(accountId: string, symbol: string, side: string, volume: number, openPrice: number, sl?: number, tp?: number) {
    const result = await this.dataSource.query(`
      INSERT INTO positions (account_id, symbol, side, volume, open_price, current_price, sl_price, tp_price, floating_pnl, status)
      VALUES ($1,$2,$3,$4,$5,$5,$6,$7,0,'OPEN') RETURNING *
    `, [accountId, symbol, side, volume, openPrice, sl || null, tp || null]);
    await this.checkRiskRealtime(accountId);
    return result[0];
  }

  async closeTrade(tradeId: string, closePrice: number) {
    const trades = await this.dataSource.query(`SELECT * FROM positions WHERE id=$1`, [tradeId]);
    if (!trades.length) throw new Error('Trade not found');
    const trade = trades[0];
    const pipValue = 0.0001;
    const pips = trade.side === 'BUY'
      ? (closePrice - Number(trade.open_price)) / pipValue
      : (Number(trade.open_price) - closePrice) / pipValue;
    const pnl = pips * Number(trade.volume);
    await this.dataSource.query(
      `UPDATE positions SET status='CLOSED', current_price=$1, floating_pnl=$2, closed_at=NOW() WHERE id=$3`,
      [closePrice, pnl, tradeId]);
    // Update account balance after close
    await this.dataSource.query(
      `UPDATE trading_accounts SET current_balance=current_balance+$1 WHERE id=$2`,
      [pnl, trade.account_id]);
    await this.checkRiskRealtime(trade.account_id);
    return { ...trade, pnl, close_price: closePrice };
  }

  async updateSLTP(tradeId: string, sl?: number, tp?: number) {
    await this.dataSource.query(
      `UPDATE positions SET sl_price=$1, tp_price=$2 WHERE id=$3`, [sl||null, tp||null, tradeId]);
    return { success: true };
  }

  async getOpenTrades(accountId: string) {
    const trades = await this.dataSource.query(
      `SELECT * FROM positions WHERE account_id=$1 AND status='OPEN' ORDER BY opened_at DESC`, [accountId]);
    const pipValue = 0.0001;
    let totalFloating = 0;
    for (const trade of trades) {
      const currentPrice = await this.getCurrentPrice(trade.symbol);
      if (currentPrice > 0) {
        const pips = trade.side === 'BUY'
          ? (currentPrice - Number(trade.open_price)) / pipValue
          : (Number(trade.open_price) - currentPrice) / pipValue;
        const pnl = pips * Number(trade.volume);
        trade.floating_pnl = pnl.toFixed(2);
        trade.current_price = currentPrice;
        totalFloating += pnl;
        await this.dataSource.query(
          `UPDATE positions SET current_price=$1, floating_pnl=$2 WHERE id=$3`, [currentPrice, pnl, trade.id]);
      }
    }
    // Update equity with floating PnL
    if (trades.length > 0) {
      await this.dataSource.query(
        `UPDATE trading_accounts SET equity=current_balance+$1 WHERE id=$2`, [totalFloating, accountId]);
      await this.checkRiskRealtime(accountId);
    }
    return trades;
  }

  async getTradeHistory(accountId: string) {
    return this.dataSource.query(
      `SELECT * FROM positions WHERE account_id=$1 AND status='CLOSED' ORDER BY closed_at DESC`, [accountId]);
  }

  async getRiskMetrics(accountId: string) {
    const rows = await this.dataSource.query(`
      SELECT ta.*, frr.max_daily_loss_pct, frr.max_drawdown_pct, frr.max_open_trades
      FROM trading_accounts ta
      JOIN firm_risk_rules frr ON frr.firm_id=ta.firm_id
      WHERE ta.id=$1`, [accountId]);
    if (!rows.length) return null;
    const account = rows[0];
    const snapRows = await this.dataSource.query(
      `SELECT COALESCE(MAX(peak_equity),$1) as peak FROM account_snapshots WHERE account_id=$2`,
      [account.initial_balance, accountId]);
    const openRows = await this.dataSource.query(
      `SELECT COUNT(*) as cnt FROM positions WHERE account_id=$1 AND status='OPEN'`, [accountId]);
    const equity = parseFloat(account.equity);
    const balance = parseFloat(account.current_balance);
    const peak = parseFloat(snapRows[0]?.peak || account.initial_balance);
    const dailyLossPct = balance > 0 ? Math.max(0, (balance - equity) / balance * 100) : 0;
    const drawdownPct = peak > 0 ? Math.max(0, (peak - equity) / peak * 100) : 0;
    const breached = dailyLossPct >= parseFloat(account.max_daily_loss_pct) || drawdownPct >= parseFloat(account.max_drawdown_pct);
    return {
      daily_loss_pct: dailyLossPct.toFixed(4),
      max_daily_loss_pct: account.max_daily_loss_pct,
      drawdown_pct: drawdownPct.toFixed(4),
      max_drawdown_pct: account.max_drawdown_pct,
      open_trades: parseInt(openRows[0].cnt),
      max_open_trades: account.max_open_trades,
      balance: account.current_balance,
      equity: account.equity,
      initial_balance: account.initial_balance,
      status: breached ? 'BREACHED' : 'ACTIVE',
    };
  }
}

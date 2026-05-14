import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { createClient } from 'redis';

@Injectable()
export class TradingService {
  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  async getCurrentPrice(symbol: string): Promise<number> {
    try {
      const client = createClient({ url: 'redis://:changeme@localhost:6379' });
      await client.connect();
      const msgs = await client.xRevRange(`feed:${symbol}`, '+', '-', { COUNT: 1 });
      await client.disconnect();
      if (!msgs.length) return 0;
      const data = JSON.parse(msgs[0].message.data as string);
      return data.bid;
    } catch { return 0; }
  }

  async openTrade(accountId: string, symbol: string, side: string, volume: number, openPrice: number, sl?: number, tp?: number) {
    const result = await this.dataSource.query(`
      INSERT INTO positions (account_id, symbol, side, volume, open_price, current_price, sl_price, tp_price, floating_pnl, status)
      VALUES ($1, $2, $3, $4, $5, $5, $6, $7, 0, 'OPEN')
      RETURNING *
    `, [accountId, symbol, side, volume, openPrice, sl || null, tp || null]);
    return result[0];
  }

  async closeTrade(tradeId: string, closePrice: number) {
    const trades = await this.dataSource.query(`SELECT * FROM positions WHERE id = $1`, [tradeId]);
    if (!trades.length) throw new Error('Trade not found');
    const trade = trades[0];
    const pipValue = 0.0001;
    const pips = trade.side === 'BUY'
      ? (closePrice - Number(trade.open_price)) / pipValue
      : (Number(trade.open_price) - closePrice) / pipValue;
    const pnl = pips * Number(trade.volume);
    await this.dataSource.query(`
      UPDATE positions SET status='CLOSED', current_price=$1, floating_pnl=$2, closed_at=NOW() WHERE id=$3
    `, [closePrice, pnl, tradeId]);
    return { ...trade, pnl, close_price: closePrice };
  }

  async getOpenTrades(accountId: string) {
    const trades = await this.dataSource.query(
      `SELECT * FROM positions WHERE account_id=$1 AND status='OPEN' ORDER BY opened_at DESC`,
      [accountId]
    );
    const pipValue = 0.0001;
    for (const trade of trades) {
      const currentPrice = await this.getCurrentPrice(trade.symbol);
      if (currentPrice > 0) {
        const pips = trade.side === 'BUY'
          ? (currentPrice - Number(trade.open_price)) / pipValue
          : (Number(trade.open_price) - currentPrice) / pipValue;
        const pnl = pips * Number(trade.volume);
        trade.floating_pnl = pnl.toFixed(2);
        trade.current_price = currentPrice;
        await this.dataSource.query(
          `UPDATE positions SET current_price=$1, floating_pnl=$2 WHERE id=$3`,
          [currentPrice, pnl, trade.id]
        );
      }
    }
    return trades;
  }

  async getTradeHistory(accountId: string) {
    return this.dataSource.query(
      `SELECT * FROM positions WHERE account_id=$1 AND status='CLOSED' ORDER BY closed_at DESC`,
      [accountId]
    );
  }
}

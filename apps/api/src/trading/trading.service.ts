import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trade } from './trade.entity';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class TradingService {
  constructor(
    @InjectRepository(Trade)
    private tradeRepo: Repository<Trade>,
  ) {}

  async openTrade(accountId: string, symbol: string, side: string, volume: number, openPrice: number, sl?: number, tp?: number) {
    const trade = this.tradeRepo.create({
      account_id: accountId,
      symbol,
      side,
      volume,
      open_price: openPrice,
      current_price: openPrice,
      sl_price: sl,
      tp_price: tp,
      floating_pnl: 0,
      status: 'OPEN',
    });
    return this.tradeRepo.save(trade);
  }

  async closeTrade(tradeId: string, closePrice: number) {
    const trade = await this.tradeRepo.findOne({ where: { id: tradeId } });
    if (!trade) throw new Error('Trade not found');
    const pipValue = 0.0001;
    const pips = trade.side === 'BUY'
      ? (closePrice - trade.open_price) / pipValue
      : (trade.open_price - closePrice) / pipValue;
    const pnl = pips * trade.volume * 1;
    await this.tradeRepo.update(tradeId, {
      status: 'CLOSED',
      current_price: closePrice,
      floating_pnl: pnl,
      closed_at: new Date(),
    });
    return { ...trade, pnl, close_price: closePrice };
  }

  async getOpenTrades(accountId: string) {
    return this.tradeRepo.find({ where: { account_id: accountId, status: 'OPEN' } });
  }

  async getTradeHistory(accountId: string) {
    return this.tradeRepo.find({ where: { account_id: accountId, status: 'CLOSED' } });
  }

  async updatePnL(tradeId: string, currentPrice: number, openPrice: number, side: string, volume: number) {
    const pipValue = 0.0001;
    const pips = side === 'BUY'
      ? (currentPrice - openPrice) / pipValue
      : (openPrice - currentPrice) / pipValue;
    const pnl = pips * volume * 1;
    await this.tradeRepo.update(tradeId, { current_price: currentPrice, floating_pnl: pnl });
    return pnl;
  }
}

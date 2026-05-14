import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { TradingService } from './trading.service';
import { CandleService } from './candle.service';
import { createClient } from 'redis';

@Controller('trading')
export class TradingController {
  constructor(
    private tradingService: TradingService,
    private candleService: CandleService,
  ) {}

  @Get('price/:symbol')
  async getPrice(@Param('symbol') symbol: string) {
    const client = createClient({ url: 'redis://:changeme@localhost:6379' });
    await client.connect();
    const msgs = await client.xRevRange(`feed:${symbol}`, '+', '-', { COUNT: 1 });
    await client.disconnect();
    if (!msgs.length) return { bid: 0, ask: 0, spread: 0 };
    const data = JSON.parse(msgs[0].message.data as string);
    return { bid: data.bid, ask: data.ask, spread: data.spread };
  }

  @Get('candles/:symbol')
  async getCandles(
    @Param('symbol') symbol: string,
    @Query('tf') tf: string,
    @Query('limit') limit: string,
  ) {
    return this.candleService.getCandles(symbol, parseInt(tf || '1'), parseInt(limit || '100'));
  }

  @Post('open')
  openTrade(@Body() body: any) {
    return this.tradingService.openTrade(
      body.account_id, body.symbol, body.side,
      body.volume, body.open_price, body.sl_price, body.tp_price
    );
  }

  @Post('close/:id')
  closeTrade(@Param('id') id: string, @Body() body: any) {
    return this.tradingService.closeTrade(id, body.close_price);
  }

  @Get('open/:accountId')
  getOpenTrades(@Param('accountId') accountId: string) {
    return this.tradingService.getOpenTrades(accountId);
  }

  @Get('history/:accountId')
  getHistory(@Param('accountId') accountId: string) {
    return this.tradingService.getTradeHistory(accountId);
  }
}

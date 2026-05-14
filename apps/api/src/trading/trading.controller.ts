import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { TradingService } from './trading.service';
import { createClient } from 'redis';

class OpenTradeDto {
  account_id: string;
  symbol: string;
  side: string;
  volume: number;
  open_price: number;
  sl_price?: number;
  tp_price?: number;
}

class CloseTradeDto {
  close_price: number;
}

@Controller('trading')
export class TradingController {
  constructor(private tradingService: TradingService) {}

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

  @Post('open')
  openTrade(@Body() dto: OpenTradeDto) {
    return this.tradingService.openTrade(
      dto.account_id, dto.symbol, dto.side,
      dto.volume, dto.open_price, dto.sl_price, dto.tp_price
    );
  }

  @Post('close/:id')
  closeTrade(@Param('id') id: string, @Body() dto: CloseTradeDto) {
    return this.tradingService.closeTrade(id, dto.close_price);
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

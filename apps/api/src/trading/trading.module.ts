import { Module } from '@nestjs/common';
import { TradingController } from './trading.controller';
import { TradingService } from './trading.service';
import { CandleService } from './candle.service';

@Module({
  controllers: [TradingController],
  providers: [TradingService, CandleService],
  exports: [TradingService, CandleService],
})
export class TradingModule {}

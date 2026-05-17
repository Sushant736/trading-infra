import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TradingController } from './trading.controller';
import { TradingService } from './trading.service';
import { CandleService } from './candle.service';
import { EmbedController } from './embed.controller';

@Module({
  imports: [JwtModule.register({ secret: process.env.JWT_SECRET || 'changeme_super_secret' })],
  controllers: [TradingController, EmbedController],
  providers: [TradingService, CandleService],
  exports: [TradingService, CandleService],
})
export class TradingModule {}

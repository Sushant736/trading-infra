import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradingController } from './trading.controller';
import { TradingService } from './trading.service';
import { Trade } from './trade.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Trade])],
  controllers: [TradingController],
  providers: [TradingService],
  exports: [TradingService],
})
export class TradingModule {}

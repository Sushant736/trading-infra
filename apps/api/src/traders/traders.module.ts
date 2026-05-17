import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TradersController } from './traders.controller';
import { TradersService } from './traders.service';
import { ChallengesService } from '../firms/challenges.service';
import { ProgramsService } from '../firms/programs.service';

@Module({
  imports: [JwtModule.register({ secret: process.env.JWT_SECRET || 'changeme_super_secret' })],
  controllers: [TradersController],
  providers: [TradersService, ChallengesService, ProgramsService],
})
export class TradersModule {}

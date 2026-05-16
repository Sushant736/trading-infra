import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { FirmsModule } from './firms/firms.module';
import { TradersModule } from './traders/traders.module';
import { AccountsModule } from './accounts/accounts.module';
import { TradingModule } from './trading/trading.module';
import { GatewayModule } from './gateway/gateway.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    FirmsModule,
    TradersModule,
    AccountsModule,
    TradingModule,
    GatewayModule,
  ],
})
export class AppModule {}

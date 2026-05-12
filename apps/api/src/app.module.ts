import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { FirmsModule } from './firms/firms.module';
import { TradersModule } from './traders/traders.module';
import { AccountsModule } from './accounts/accounts.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    FirmsModule,
    TradersModule,
    AccountsModule,
  ],
})
export class AppModule {}

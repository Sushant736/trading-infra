import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SuperAdmin } from '../users/super-admin.entity';
import { FirmAdmin } from '../firms/firm-admin.entity';
import { Trader } from '../traders/trader.entity';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'changeme_super_secret',
      signOptions: { expiresIn: '7d' },
    }),
    TypeOrmModule.forFeature([SuperAdmin, FirmAdmin, Trader]),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}

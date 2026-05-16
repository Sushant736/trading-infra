import { Module } from '@nestjs/common';
import { FirmsController } from './firms.controller';
import { FirmsService } from './firms.service';
import { WebhookController } from './webhook.controller';

@Module({
  controllers: [FirmsController, WebhookController],
  providers: [FirmsService],
})
export class FirmsModule {}

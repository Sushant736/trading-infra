import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: false, transform: true }));
  app.enableCors({
    origin: [
      'http://localhost:3001',
      'http://localhost:3002',
      'http://35.200.170.189:3001',
      'http://35.200.170.189:3002',
      /\.vercel\.app$/,
      /\.propscholars\.com$/,
    ],
    credentials: true,
  });
  await app.listen(process.env.API_PORT || 3000);
  console.log(`API running on port ${process.env.API_PORT || 3000}`);
}
bootstrap();

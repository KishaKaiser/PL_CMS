import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  // If you're behind a reverse proxy / load balancer (common in production),
  // trust proxy headers so throttling + IP-based logic work correctly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (app as any).set?.('trust proxy', 1);

  const config = app.get(ConfigService);
  const corsOrigin =
    config.get<string>('CORS_ORIGIN') ??
    config.get<string>('WEB_BASE_URL') ??
    'http://localhost:3000';

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`🚀 API running on http://localhost:${port}/api`);
}

bootstrap();

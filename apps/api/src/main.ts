import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import type { IncomingMessage, ServerResponse } from 'http';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  const rawBodySaver = (req: IncomingMessage, _res: ServerResponse, buffer: Buffer) => {
    (req as IncomingMessage & { rawBody?: Buffer }).rawBody = buffer;
  };

  app.use(json({ limit: '100mb', verify: rawBodySaver }));
  app.use(urlencoded({ extended: true, limit: '100mb', verify: rawBodySaver }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.setGlobalPrefix('api');
  app.enableCors();

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`🚀 API running on http://localhost:${port}/api`);
}

bootstrap();

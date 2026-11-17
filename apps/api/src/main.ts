import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import type { IncomingMessage, ServerResponse } from 'http';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });

  // Express 5 reads query strings the simple way by default (a[b]=1 stays one flat key); keep the Express 4 behaviour.
  app.set('query parser', 'extended');

  const rawBodySaver = (req: IncomingMessage, _res: ServerResponse, buffer: Buffer) => {
    (req as IncomingMessage & { rawBody?: Buffer }).rawBody = buffer;
  };

  app.use(json({ limit: '100mb', verify: rawBodySaver }));
  app.use(urlencoded({ extended: true, limit: '100mb', verify: rawBodySaver }));
  // Express 5 leaves req.body undefined when a request has no body; handlers were written for Express 4's empty object.
  app.use((req: { body?: unknown }, _res: unknown, next: () => void) => {
    if (req.body === undefined) req.body = {};
    next();
  });

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

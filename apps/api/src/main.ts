import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { serve } from 'inngest/express';
import * as express from 'express';
import { AppModule } from './app.module';
import type { AppConfig } from './config/configuration';
import { PrismaService } from './prisma/prisma.service';
import { inngest } from './inngest/client';
import { createFlowcraftFunctions } from './inngest/functions';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService<AppConfig, true>);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: config.get('webOrigin', { infer: true }), credentials: true });
  app.enableShutdownHooks();

  // Mount the Inngest serve endpoint. The dev server (or Inngest Cloud) calls this
  // URL to discover functions and drive step execution. Functions get Prisma via
  // closure since they run outside Nest's request scope.
  const prisma = app.get(PrismaService);
  // express.json() must run before the serve handler — Nest's global body parser
  // is applied too late for this manually-mounted route, causing "missing body".
  app.use(
    '/api/inngest',
    express.json(),
    serve({ client: inngest, functions: createFlowcraftFunctions(prisma) }),
  );

  const port = config.get('port', { infer: true });
  await app.listen(port);
  Logger.log(`Flowcraft API on http://localhost:${port}/api (Inngest at /api/inngest)`, 'Bootstrap');
}

void bootstrap();

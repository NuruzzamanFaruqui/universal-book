import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { LOCAL_UPLOAD_DIR, LOCAL_UPLOAD_PREFIX } from './storage/storage.service';

function assertRequiredEnv() {
  // A missing JWT_SECRET in production would silently fall back to the dev
  // default in auth.module.ts, making every token forgeable. Refuse to boot.
  const required = ['JWT_SECRET', 'DATABASE_URL'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length && process.env.NODE_ENV === 'production') {
    throw new Error(`Refusing to start: missing required env vars: ${missing.join(', ')}`);
  }
  if (missing.length) {
    console.warn(`⚠️  Missing env vars (dev defaults in use): ${missing.join(', ')}`);
  }
}

async function bootstrap() {
  assertRequiredEnv();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  // Local development only: StorageService falls back to disk when GCS_BUCKET
  // is unset, and these are the files it wrote. Production always uses GCS.
  if (process.env.NODE_ENV !== 'production') {
    app.useStaticAssets(LOCAL_UPLOAD_DIR, { prefix: LOCAL_UPLOAD_PREFIX });
  }

  app.enableCors({
    origin: [
      'https://universal-book.com',
      'https://www.universal-book.com',
      'https://dev.universal-book.com',
      'https://universal-book-web-73444175926.us-central1.run.app',
      'https://universal-book-web-lkb47uauda-uc.a.run.app',
      'https://universal-book-web-dev-73444175926.us-central1.run.app',
      'https://universal-book-web-dev-lkb47uauda-uc.a.run.app',
      ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000']),
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization,Accept',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  app.setGlobalPrefix('api');

  const port = process.env.PORT || 8080;
  await app.listen(port);
  console.log(`🚀 Universal Book API running on port ${port}`);
}

bootstrap();

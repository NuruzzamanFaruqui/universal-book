import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.enableCors({
    origin: [
      'https://universal-book.com',
      'https://www.universal-book.com',
      'https://universal-book-web-73444175926.us-central1.run.app',
      'https://universal-book-web-lkb47uauda-uc.a.run.app',
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

import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const isProduction = process.env.NODE_ENV === 'production';
  const corsOrigins = parseCorsOrigins(process.env.CORS_ORIGINS);

  app.use(json({ limit: process.env.JSON_BODY_LIMIT ?? '80mb' }));
  app.use(urlencoded({ extended: true, limit: process.env.JSON_BODY_LIMIT ?? '80mb' }));
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: corsOrigins ?? (isProduction ? false : true),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
}

void bootstrap();

function parseCorsOrigins(value: string | undefined) {
  if (!value) return undefined;
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

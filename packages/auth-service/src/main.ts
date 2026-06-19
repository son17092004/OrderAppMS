import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { join } from 'path';
import { AuthModule } from './auth.module';
import { AllExceptionsFilter, LoggingInterceptor, JsonLogger } from '@food-ordering/common';

async function bootstrap() {
  // ─── Hybrid App: HTTP + gRPC ──────────────────────────────────────────────
  const app = await NestFactory.create(AuthModule);

  const logger = app.get(JsonLogger);
  app.useLogger(logger);

  // Connect gRPC microservice transport
  const grpcPort = process.env.GRPC_PORT || '50051';
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'auth',
      protoPath: join(__dirname, 'proto/auth.proto'),
      url: `0.0.0.0:${grpcPort}`,
      loader: {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      },
    },
  });

  // ─── HTTP Configuration ───────────────────────────────────────────────────
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  });

  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalInterceptors(new LoggingInterceptor(logger));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));

  // ─── Swagger ──────────────────────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('Auth Service')
    .setDescription('Authentication, Authorization & Keycloak Integration API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, document);

  // ─── Start ────────────────────────────────────────────────────────────────
  await app.startAllMicroservices();
  const port = process.env.PORT || 3001;
  await app.listen(port);

  Logger.log(`Auth Service HTTP listening on port ${port}`, 'Bootstrap');
  Logger.log(`Auth Service gRPC listening on port ${grpcPort}`, 'Bootstrap');
}

bootstrap();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AuthModule } from './auth.module';
import { AllExceptionsFilter, LoggingInterceptor, JsonLogger } from '@food-ordering/common';

async function bootstrap() {
  const app = await NestFactory.create(AuthModule);

  const logger = app.get(JsonLogger);
  app.useLogger(logger);

  app.enableCors();

  app.enableVersioning({
    type: VersioningType.URI,
  });

  app.useGlobalInterceptors(new LoggingInterceptor(logger));

  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));

  const config = new DocumentBuilder()
    .setTitle('Auth Service')
    .setDescription('The Authentication and User Management microservice API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`Auth Service listening on port ${port}`, 'Bootstrap');
}
bootstrap();

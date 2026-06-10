import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { CartModule } from './cart.module';
import { AllExceptionsFilter, LoggingInterceptor, JsonLogger } from '@food-ordering/common';

async function bootstrap() {
  const app = await NestFactory.create(CartModule);

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
    .setTitle('Cart Service')
    .setDescription('The Shopping Cart microservice API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, document);

  const port = process.env.PORT || 3003;
  await app.listen(port);
  logger.log(`Cart Service listening on port ${port}`, 'Bootstrap');
}
bootstrap();

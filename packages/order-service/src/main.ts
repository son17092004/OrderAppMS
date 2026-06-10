import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { OrderModule } from './order.module';
import { AllExceptionsFilter, LoggingInterceptor, JsonLogger } from '@food-ordering/common';

async function bootstrap() {
  const app = await NestFactory.create(OrderModule);

  const logger = app.get(JsonLogger);
  app.useLogger(logger);

  app.enableCors();

  app.enableVersioning({
    type: VersioningType.URI,
  });

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: [process.env.KAFKA_BROKERS || 'localhost:9092'],
      },
      consumer: {
        groupId: 'order-consumer',
      },
    },
  });

  app.useGlobalInterceptors(new LoggingInterceptor(logger));

  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));

  const config = new DocumentBuilder()
    .setTitle('Order Service')
    .setDescription('The Order Processing and Saga management microservice API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, document);

  await app.startAllMicroservices();
  logger.log('Order Service Kafka microservice listener started', 'Bootstrap');

  const port = process.env.PORT || 3004;
  await app.listen(port);
  logger.log(`Order Service HTTP listening on port ${port}`, 'Bootstrap');
}
bootstrap();

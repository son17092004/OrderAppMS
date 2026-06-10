import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { GatewayModule } from './gateway.module';
import { AllExceptionsFilter, LoggingInterceptor, JsonLogger } from '@food-ordering/common';

async function bootstrap() {
  const app = await NestFactory.create(GatewayModule, { bodyParser: false });

  // Re-enable JSON body parsing for non-multipart routes
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use((req: any, res: any, next: any) => {
    const ct: string = req.headers['content-type'] ?? '';
    if (ct.includes('multipart/form-data')) return next();
    require('express').json({ limit: '10mb' })(req, res, next);
  });
  expressApp.use((req: any, res: any, next: any) => {
    const ct: string = req.headers['content-type'] ?? '';
    if (ct.includes('multipart/form-data')) return next();
    require('express').urlencoded({ extended: true })(req, res, next);
  });

  const logger = app.get(JsonLogger);
  app.useLogger(logger);

  app.enableCors();

  app.useGlobalInterceptors(new LoggingInterceptor(logger));

  app.useGlobalFilters(new AllExceptionsFilter());

  // Define the base spec metadata for Swagger
  const config = new DocumentBuilder()
    .setTitle('Food Ordering Microservices API')
    .setDescription('Unified Swagger API Documentation for all backend microservices')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Setup Swagger UI to fetch the spec dynamically from our combined /swagger-combined-json endpoint
  SwaggerModule.setup('swagger', app, document, {
    swaggerOptions: {
      url: '/swagger-combined-json',
      spec: null as any, // Forces Swagger UI to fetch from the url instead of using the local document
    },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`API Gateway listening on port ${port}`, 'Bootstrap');
}
bootstrap();

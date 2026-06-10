import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller()
export class SwaggerController {
  private readonly services: Record<string, string>;

  constructor(private readonly configService: ConfigService) {
    this.services = {
      auth: this.configService.get<string>('AUTH_SERVICE_URL', 'http://localhost:3001'),
      restaurants: this.configService.get<string>('RESTAURANT_SERVICE_URL', 'http://localhost:3002'),
      cart: this.configService.get<string>('CART_SERVICE_URL', 'http://localhost:3003'),
      orders: this.configService.get<string>('ORDER_SERVICE_URL', 'http://localhost:3004'),
      payments: this.configService.get<string>('PAYMENT_SERVICE_URL', 'http://localhost:3005'),
      notifications: this.configService.get<string>('NOTIFICATION_SERVICE_URL', 'http://localhost:3006'),
    };
  }

  @Get('swagger-combined-json')
  async getCombinedSwagger() {
    const baseSwagger = {
      openapi: '3.0.0',
      info: {
        title: 'Food Ordering Microservices API',
        description: 'Unified Swagger API Documentation for all backend microservices',
        version: '1.0',
      },
      paths: {} as Record<string, any>,
      components: {
        securitySchemes: {
          bearer: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
        schemas: {} as Record<string, any>,
      },
    };

    for (const [name, url] of Object.entries(this.services)) {
      try {
        const res = await fetch(`${url}/swagger-json`);
        if (!res.ok) continue;
        const spec = await res.json();

        // Merge paths
        if (spec.paths) {
          for (const [path, methods] of Object.entries(spec.paths)) {
            // Exclude common health / metrics endpoints from cluttering the main API docs
            if (path === '/health' || path === '/metrics') {
              continue;
            }
            baseSwagger.paths[path] = methods;
          }
        }

        // Merge schemas
        if (spec.components && spec.components.schemas) {
          for (const [schemaName, schemaValue] of Object.entries(spec.components.schemas)) {
            baseSwagger.components.schemas[schemaName] = schemaValue;
          }
        }
      } catch (err) {
        console.error(`Error fetching swagger from service ${name} at ${url}:`, err instanceof Error ? err.message : String(err));
      }
    }

    return baseSwagger;
  }
}

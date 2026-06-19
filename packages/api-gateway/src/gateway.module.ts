import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';
import { GatewayController } from './gateway.controller';
import { SwaggerController } from './swagger.controller';
import { SecurityMiddleware } from './middleware/security.middleware';
import { JsonLogger } from '@food-ordering/common';

export const AUTH_GRPC_SERVICE = 'AUTH_GRPC_SERVICE';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // ─── gRPC Client → Auth Service ────────────────────────────────────────
    ClientsModule.registerAsync([
      {
        name: AUTH_GRPC_SERVICE,
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'auth',
            protoPath: join(__dirname, 'proto/auth.proto'),
            url: configService.get<string>('AUTH_SERVICE_GRPC_URL', 'localhost:50051'),
            loader: {
              keepCase: true,
              longs: String,
              enums: String,
              defaults: true,
              oneofs: true,
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),

    // ─── Rate Limiting ─────────────────────────────────────────────────────
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.get<number>('THROTTLE_TTL', 60) * 1000,
          limit: configService.get<number>('THROTTLE_LIMIT', 100),
        },
      ],
      inject: [ConfigService],
    }),
  ],
  controllers: [GatewayController, SwaggerController],
  providers: [JsonLogger],
})
export class GatewayModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SecurityMiddleware).forRoutes('*');
  }
}

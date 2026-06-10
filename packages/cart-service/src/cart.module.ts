import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CartController } from './cart.controller';
import { HealthController } from './health.controller';
import { CartService } from './cart.service';
import { JsonLogger } from '@food-ordering/common';
import { Reflector } from '@nestjs/core';
import Redis from 'ioredis';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [CartController, HealthController],
  providers: [
    CartService,
    JsonLogger,
    Reflector,
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        return new Redis({
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [CartService],
})
export class CartModule {}

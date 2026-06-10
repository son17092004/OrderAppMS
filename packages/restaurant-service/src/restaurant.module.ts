import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RestaurantController } from './restaurant.controller';
import { HealthController } from './health.controller';
import { RestaurantService } from './restaurant.service';
import { RestaurantRepository } from './repositories/restaurant.repository';
import { CloudinaryService } from './cloudinary.service';
import { Restaurant } from './entities/restaurant.entity';
import { Category } from './entities/category.entity';
import { FoodItem } from './entities/food-item.entity';
import { JsonLogger } from '@food-ordering/common';
import { Reflector } from '@nestjs/core';
import Redis from 'ioredis';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5433),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'postgres'),
        database: configService.get<string>('DB_NAME', 'restaurant_db'),
        entities: [Restaurant, Category, FoodItem],
        synchronize: true,
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([Restaurant, Category, FoodItem]),
  ],
  controllers: [RestaurantController, HealthController],
  providers: [
    RestaurantService,
    RestaurantRepository,
    CloudinaryService,
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
  exports: [RestaurantService, CloudinaryService],
})
export class RestaurantModule {}

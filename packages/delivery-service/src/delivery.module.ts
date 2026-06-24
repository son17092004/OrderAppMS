import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { DeliveryController } from './delivery.controller';
import { HealthController } from './health.controller';
import { DeliveryService } from './delivery.service';
import { DeliveryRepository } from './repositories/delivery.repository';
import { Delivery } from './entities/delivery.entity';
import { JsonLogger } from '@food-ordering/common';
import { Reflector } from '@nestjs/core';

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
        database: configService.get<string>('DB_NAME', 'delivery_db'),
        entities: [Delivery],
        synchronize: true,
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([Delivery]),
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_CLIENT',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'delivery',
              brokers: [configService.get<string>('KAFKA_BROKERS', 'localhost:9092')],
            },
            consumer: {
              groupId: 'delivery-consumer',
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [DeliveryController, HealthController],
  providers: [
    DeliveryService,
    DeliveryRepository,
    JsonLogger,
    Reflector,
  ],
  exports: [DeliveryService],
})
export class DeliveryModule {}

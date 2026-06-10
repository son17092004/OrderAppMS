import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationController } from './notification.controller';
import { HealthController } from './health.controller';
import { NotificationService } from './notification.service';
import { NotificationRepository } from './repositories/notification.repository';
import { NotificationLog, NotificationLogSchema } from './schemas/notification.schema';
import { JsonLogger } from '@food-ordering/common';
import { Reflector } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI', 'mongodb://localhost:27019/notification_db'),
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: NotificationLog.name, schema: NotificationLogSchema },
    ]),
  ],
  controllers: [NotificationController, HealthController],
  providers: [
    NotificationService,
    NotificationRepository,
    JsonLogger,
    Reflector,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}

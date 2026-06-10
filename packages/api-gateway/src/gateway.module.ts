import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { GatewayController } from './gateway.controller';
import { SwaggerController } from './swagger.controller';
import { JsonLogger } from '@food-ordering/common';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): JwtModuleOptions => ({
        secret: configService.get<string>('JWT_SECRET', 'supersecretkey'),
        signOptions: {
          expiresIn: configService.get<number>('JWT_EXPIRES_IN') || 900
          
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [
    GatewayController,
    SwaggerController,
  ],
  providers: [
    JsonLogger,
  ],
})
export class GatewayModule {}

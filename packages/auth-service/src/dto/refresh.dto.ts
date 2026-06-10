import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshDto {
  @ApiProperty({ example: 'some-refresh-token-uuid-or-hex', description: 'The refresh token received upon login' })
  @IsString({ message: 'Refresh token must be a string' })
  refreshToken: string;
}

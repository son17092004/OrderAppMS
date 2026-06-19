export * from './dto/response.dto';
export * from './filters/http-exception.filter';
export * from './filters/rpc-exception.filter';
export * from './logger/logger.service';
export * from './logger/logging.interceptor';
export * from './decorators/user.decorator';
export * from './guards/auth.guard';
export * from './guards/roles.guard';
export * from './events/events';

// gRPC Auth types shared across services
export interface GrpcValidateTokenResponse {
  valid: boolean;
  user_id: string;
  email: string;
  role: string;
  keycloak_id: string;
  is_banned: boolean;
  error_message: string;
}

export type GrpcTokenType = 0 | 1; // 0=INTERNAL, 1=KEYCLOAK

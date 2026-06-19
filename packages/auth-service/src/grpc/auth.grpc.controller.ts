import { Controller, Logger } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AuthService } from '../auth.service';

// Matches TokenType enum in auth.proto: INTERNAL=0, KEYCLOAK=1
type ProtoTokenType = 0 | 1;

interface ValidateTokenRequest {
  token: string;
  token_type: ProtoTokenType;
}

interface GetUserProfileRequest {
  user_id: string;
}

@Controller()
export class AuthGrpcController {
  private readonly logger = new Logger(AuthGrpcController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * gRPC: ValidateToken
   * Called by API Gateway for every protected request.
   * Returns enriched user claims including role and ban status.
   */
  @GrpcMethod('AuthService', 'ValidateToken')
  async validateToken(data: any) {
    const rawType = data.token_type ?? data.tokenType;
    const tokenType: 'KEYCLOAK' | 'INTERNAL' =
      (rawType === 1 || rawType === 'KEYCLOAK') ? 'KEYCLOAK' : 'INTERNAL';

    this.logger.debug(`ValidateToken called [type=${tokenType}]`);

    const result = await this.authService.validateToken(data.token, tokenType);

    if (!result.valid) {
      this.logger.warn(`Token validation failed: ${result.error_message}`);
    }

    return result;
  }

  /**
   * gRPC: GetUserProfile
   * Fetch enriched profile by internal user ID.
   */
  @GrpcMethod('AuthService', 'GetUserProfile')
  async getUserProfile(data: GetUserProfileRequest) {
    this.logger.debug(`GetUserProfile called [userId=${data.user_id}]`);

    const user = await this.authService.findById(data.user_id);
    if (!user) {
      return {
        id: '',
        email: '',
        role: '',
        keycloak_id: '',
        is_banned: false,
      };
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      keycloak_id: user.keycloakId ?? '',
      is_banned: user.isBanned,
    };
  }
}

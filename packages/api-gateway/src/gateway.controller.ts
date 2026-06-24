import {
  Controller,
  All,
  Req,
  Res,
  Inject,
  OnModuleInit,
  Logger,
  UnauthorizedException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientGrpc } from '@nestjs/microservices';
import { Request, Response } from 'express';
import { firstValueFrom, Observable, timeout, catchError, throwError } from 'rxjs';

// ─── gRPC Client Interface ────────────────────────────────────────────────────
interface ValidateTokenRequest {
  token: string;
  token_type: 0 | 1; // 0=INTERNAL, 1=KEYCLOAK
}

interface ValidateTokenResponse {
  valid: boolean;
  user_id: string;
  email: string;
  role: string;
  keycloak_id: string;
  is_banned: boolean;
  error_message: string;
}

interface AuthGrpcService {
  validateToken(data: ValidateTokenRequest): Observable<ValidateTokenResponse>;
}

// ─── Public Route Definitions ─────────────────────────────────────────────────
const PUBLIC_ROUTES: Array<{ service: string; paths: RegExp[]; methods?: string[] }> = [
  {
    service: 'auth',
    paths: [/^\/login$/, /^\/register$/, /^\/refresh$/, /^\/logout$/],
  },
  {
    service: 'restaurants',
    paths: [/^(\/.*)?$/],   // All GET paths: /, /:id, /:id/menu, etc.
    methods: ['GET'],
  },
];

@Controller('v1')
export class GatewayController implements OnModuleInit {
  private readonly logger = new Logger(GatewayController.name);
  private authGrpcService: AuthGrpcService;
  private readonly services: Record<string, string>;

  constructor(
    @Inject('AUTH_GRPC_SERVICE') private readonly authGrpcClient: ClientGrpc,
    private readonly configService: ConfigService,
  ) {
    this.services = {
      auth:          configService.get('AUTH_SERVICE_URL',          'http://localhost:3001'),
      restaurants:   configService.get('RESTAURANT_SERVICE_URL',    'http://localhost:3002'),
      cart:          configService.get('CART_SERVICE_URL',          'http://localhost:3003'),
      orders:        configService.get('ORDER_SERVICE_URL',         'http://localhost:3004'),
      payments:      configService.get('PAYMENT_SERVICE_URL',       'http://localhost:3005'),
      notifications: configService.get('NOTIFICATION_SERVICE_URL',  'http://localhost:3006'),
      deliveries:    configService.get('DELIVERY_SERVICE_URL',      'http://localhost:3008'),
    };
  }

  onModuleInit() {
    this.authGrpcService = this.authGrpcClient.getService<AuthGrpcService>('AuthService');
  }

  @All('*')
  async proxy(@Req() req: Request, @Res() res: Response): Promise<void> {
    const originalUrl = req.url;
    const parts = originalUrl.split('/').filter(Boolean);

    if (parts.length < 2) {
      res.status(404).json({ success: false, message: 'Resource not found' }); return;
    }

    const serviceKey = parts[1];
    const targetBaseUrl = this.services[serviceKey];
    if (!targetBaseUrl) {
      res.status(404).json({ success: false, message: `Service '${serviceKey}' not found` }); return;
    }

    const pathAfterService = '/' + parts.slice(2).join('/');
    const method = req.method;
    const isPublic = this.isPublicRoute(serviceKey, pathAfterService, method);

    const forwardHeaders: Record<string, string> = {};

    // Always forward content-type when present
    if (req.headers['content-type']) {
      forwardHeaders['content-type'] = req.headers['content-type'] as string;
    }

    // Forward request ID for tracing
    if (req.headers['x-request-id']) {
      forwardHeaders['x-request-id'] = req.headers['x-request-id'] as string;
    }

    // ─── Authentication via gRPC ─────────────────────────────────────────────
    if (!isPublic) {
      const authHeader = req.headers['authorization'];
      if (!authHeader?.startsWith('Bearer ')) {
        throw new UnauthorizedException('Authentication token is missing');
      }

      const token = authHeader.split(' ')[1];
      const tokenType = this.detectTokenType(token);

      try {
        const result = await this.callValidateToken(token, tokenType);

        if (!result.valid) {
          if (result.is_banned) {
            throw new ForbiddenException('Your account has been suspended');
          }
          throw new UnauthorizedException(result.error_message || 'Invalid or expired token');
        }

        // Inject enriched user context into forwarded headers
        forwardHeaders['x-user-id']          = result.user_id;
        forwardHeaders['x-user-email']        = result.email;
        forwardHeaders['x-user-role']         = result.role;
        forwardHeaders['x-user-keycloak-id']  = result.keycloak_id || '';

        this.logger.debug(
          `[${req.headers['x-request-id']}] Authenticated: userId=${result.user_id} role=${result.role}`,
        );
      } catch (err) {
        if (err instanceof UnauthorizedException || err instanceof ForbiddenException) {
          throw err;
        }
        // gRPC transport failure — fail closed (do NOT fall back to local verify)
        this.logger.error(`gRPC auth service unreachable: ${(err as Error).message}`);
        throw new ServiceUnavailableException('Authentication service is currently unavailable');
      }
    }

    // ─── Proxy to Target Microservice ────────────────────────────────────────
    try {
      const isMultipart = (req.headers['content-type'] ?? '').includes('multipart/form-data');
      const targetPath = originalUrl.endsWith('/swagger-json')
        ? `${targetBaseUrl}/swagger-json`
        : `${targetBaseUrl}${originalUrl}`;

      const requestOptions: RequestInit = { method, headers: forwardHeaders };

      if (isMultipart) {
        requestOptions.body = req as any;
        forwardHeaders['content-type'] = req.headers['content-type'] as string;
        (requestOptions as any).duplex = 'half';
      } else if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && Object.keys(req.body || {}).length > 0) {
        requestOptions.body = JSON.stringify(req.body);
        forwardHeaders['content-type'] = 'application/json';
      }

      const response = await fetch(targetPath, requestOptions);
      const data = await response.text();

      res.status(response.status);
      const responseContentType = response.headers.get('content-type');
      if (responseContentType) res.set('content-type', responseContentType);
      res.send(data);
    } catch (err) {
      this.logger.error(`Proxy error for ${serviceKey}: ${(err as Error).message}`);
      res.status(502).json({
        success: false,
        message: 'Bad Gateway: upstream service unreachable',
        error: (err as Error).message,
      });
    }
  }

  // ─── gRPC Call with Timeout ──────────────────────────────────────────────────
  private async callValidateToken(token: string, tokenType: 0 | 1): Promise<ValidateTokenResponse> {
    return firstValueFrom(
      this.authGrpcService.validateToken({ token, token_type: tokenType }).pipe(
        timeout(5000), // 5 second circuit breaker
        catchError((err) => throwError(() => new Error(`gRPC timeout or error: ${err.message}`))),
      ),
    );
  }

  // ─── Token Type Detection ────────────────────────────────────────────────────
  private detectTokenType(token: string): 0 | 1 {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        this.logger.warn('Token does not have 3 parts');
        return 0;
      }
      // Decode base64url robustly across all Node.js versions
      let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) {
        base64 += '=';
      }
      const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
      const iss: string = payload.iss ?? '';
      
      this.logger.debug(`Token issuer detected: "${iss}"`);
      
      if (iss.includes('/realms/') || iss.includes('keycloak')) {
        return 1; // KEYCLOAK
      }
      return 0; // INTERNAL
    } catch (err) {
      this.logger.error(`Error in detectTokenType parsing: ${(err as Error).message}`);
      return 0; // INTERNAL (safe default)
    }
  }

  // ─── Public Route Check ──────────────────────────────────────────────────────
  private isPublicRoute(serviceKey: string, path: string, method: string): boolean {
    if (path.endsWith('/swagger-json') || path.endsWith('/swagger')) {
      return true;
    }

    const rule = PUBLIC_ROUTES.find((r) => r.service === serviceKey);
    if (!rule) return false;

    const pathMatches = rule.paths.some((regex) => regex.test(path));
    if (!pathMatches) return false;

    if (rule.methods) {
      return rule.methods.includes(method.toUpperCase());
    }
    return true;
  }
}

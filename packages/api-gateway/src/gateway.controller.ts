import { Controller, All, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';

@Controller('v1')
export class GatewayController {
  private readonly services: Record<string, string>;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    this.services = {
      auth: this.configService.get<string>('AUTH_SERVICE_URL', 'http://localhost:3001'),
      restaurants: this.configService.get<string>('RESTAURANT_SERVICE_URL', 'http://localhost:3002'),
      cart: this.configService.get<string>('CART_SERVICE_URL', 'http://localhost:3003'),
      orders: this.configService.get<string>('ORDER_SERVICE_URL', 'http://localhost:3004'),
      payments: this.configService.get<string>('PAYMENT_SERVICE_URL', 'http://localhost:3005'),
      notifications: this.configService.get<string>('NOTIFICATION_SERVICE_URL', 'http://localhost:3006'),
    };
  }

  @All('*')
  async proxy(@Req() req: Request, @Res() res: Response) {
    const originalUrl = req.url;
    const parts = originalUrl.split('/').filter(Boolean);

    if (parts.length < 2) {
      res.status(404).json({ success: false, message: 'Resource not found' });
      return;
    }

    const serviceKey = parts[1];
    const targetBaseUrl = this.services[serviceKey];

    if (!targetBaseUrl) {
      res.status(404).json({ success: false, message: 'Service not found' });
      return;
    }

    const pathAfterService = '/' + parts.slice(2).join('/');
    const method = req.method;
    const isPublic = this.checkIsPublic(serviceKey, pathAfterService, method);

    const headers: Record<string, string> = {};
    if (req.headers['content-type']) {
      headers['content-type'] = req.headers['content-type'] as string;
    }

    if (!isPublic) {
      const authHeader = req.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedException('Authentication token is missing');
      }

      const token = authHeader.split(' ')[1];
      try {
        const decoded = this.jwtService.verify(token);
        headers['x-user-id'] = decoded.sub;
        headers['x-user-email'] = decoded.email;
        headers['x-user-role'] = decoded.role;
      } catch (err) {
        throw new UnauthorizedException('Authentication token is invalid or expired');
      }
    }

    try {
      const isMultipart = (req.headers['content-type'] ?? '').includes('multipart/form-data');
      const queryString = req.url.includes('?') ? req.url.split('?').slice(1).join('?') : '';

      const targetPath = originalUrl.endsWith('/swagger-json')
        ? `${targetBaseUrl}/swagger-json`
        : `${targetBaseUrl}${originalUrl}`;

      const requestOptions: RequestInit = {
        method,
        headers,
      };

      if (isMultipart) {
        // Stream raw body bytes for file uploads — do NOT re-parse
        requestOptions.body = req as any;
        // Keep original content-type including boundary
        headers['content-type'] = req.headers['content-type'] as string;
        (requestOptions as any).duplex = 'half';
      } else if (['POST', 'PUT', 'PATCH'].includes(method) && Object.keys(req.body || {}).length > 0) {
        requestOptions.body = JSON.stringify(req.body);
        headers['content-type'] = 'application/json';
      }

      const response = await fetch(targetPath, requestOptions);
      const data = await response.text();

      res.status(response.status);
      const responseContentType = response.headers.get('content-type');
      if (responseContentType) {
        res.set('content-type', responseContentType);
      }
      res.send(data);
      return;
    } catch (err) {
      res.status(502).json({
        success: false,
        message: 'Bad Gateway: Microservice unreachable',
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }
  }

  private checkIsPublic(serviceKey: string, path: string, method: string): boolean {
    if (path.endsWith('/swagger-json')) {
      return true;
    }

    if (serviceKey === 'auth') {
      const publicAuthPaths = ['/login', '/register', '/refresh'];
      return publicAuthPaths.some(p => path.startsWith(p));
    }

    if (serviceKey === 'restaurants') {
      if (method === 'GET') {
        return true;
      }
    }

    return false;
  }
}

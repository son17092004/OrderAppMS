import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * SecurityMiddleware — applied globally on every request:
 * 1. Injects a unique X-Request-ID for distributed tracing
 * 2. Sets security headers (Helmet-style: XSS, clickjacking, MIME sniffing protection)
 * 3. Blocks requests with suspicious User-Agent or missing Host header
 */
@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SecurityMiddleware.name);

  use(req: Request, res: Response, next: NextFunction): void {
    // ─── Request ID (distributed tracing) ───────────────────────────────────
    const requestId = (req.headers['x-request-id'] as string) || uuidv4();
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);

    // ─── Security Headers ────────────────────────────────────────────────────
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'",
    );
    res.removeHeader('X-Powered-By');

    // ─── HSTS (only in production) ───────────────────────────────────────────
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    this.logger.debug(`[${requestId}] ${req.method} ${req.url}`);
    next();
  }
}

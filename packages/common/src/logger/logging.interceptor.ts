import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { JsonLogger } from './logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: JsonLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    
    if (!request) {
      const rpcCtx = context.switchToRpc();
      const data = rpcCtx.getData();
      this.logger.log({
        type: 'EVENT_CONSUMED',
        data,
      }, context.getClass().name);
      return next.handle().pipe(
        tap(() => {
          this.logger.log({
            type: 'EVENT_PROCESSED',
            data,
          }, context.getClass().name);
        })
      );
    }

    const { method, url, body } = request;
    const now = Date.now();

    this.logger.log({
      type: 'INCOMING_REQUEST',
      method,
      url,
      body: this.sanitizeBody(body),
    }, 'LoggingInterceptor');

    return next.handle().pipe(
      tap({
        next: (data) => {
          const response = ctx.getResponse();
          const statusCode = response.statusCode;
          this.logger.log({
            type: 'OUTGOING_RESPONSE',
            method,
            url,
            statusCode,
            duration: `${Date.now() - now}ms`,
            response: this.sanitizeBody(data),
          }, 'LoggingInterceptor');
        },
        error: (error) => {
          this.logger.error({
            type: 'REQUEST_ERROR',
            method,
            url,
            duration: `${Date.now() - now}ms`,
            error: error.message,
          }, error.stack, 'LoggingInterceptor');
        }
      })
    );
  }

  private sanitizeBody(body: any) {
    if (!body) return body;
    if (typeof body !== 'object') return body;
    const copy = { ...body };
    if (copy.password) copy.password = '********';
    if (copy.passwordHash) copy.passwordHash = '********';
    if (copy.token) copy.token = '********';
    return copy;
  }
}

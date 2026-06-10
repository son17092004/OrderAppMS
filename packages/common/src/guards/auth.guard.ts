import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class HttpAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const userId = request.headers['x-user-id'];
    const email = request.headers['x-user-email'];
    const role = request.headers['x-user-role'];

    if (!userId || !email || !role) {
      throw new UnauthorizedException('Missing authentication credentials');
    }

    request.user = {
      id: userId,
      email: email,
      role: role,
    };

    return true;
  }
}

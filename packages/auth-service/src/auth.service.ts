import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRepository } from './repositories/user.repository';
import { User, UserRole } from './entities/user.entity';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
  ) {}

  private hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  private verifyPassword(password: string, storedHash: string): boolean {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) return false;
    const checkHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return hash === checkHash;
  }

  async register(email: string, password: string, role?: UserRole): Promise<User> {
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Email address already in use');
    }

    const passwordHash = this.hashPassword(password);
    const userRole = role || UserRole.CUSTOMER;

    const user = await this.userRepository.createUser(email, passwordHash, userRole);
    
    const result = { ...user };
    delete (result as any).passwordHash;
    return result as any;
  }

  async login(email: string, password: string) {
    const user = await this.userRepository.findByEmail(email);
    if (!user || !this.verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.generateTokens(user);
  }

  async refresh(token: string) {
    const dbToken = await this.userRepository.findRefreshToken(token);
    if (!dbToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (new Date() > dbToken.expiresAt) {
      await this.userRepository.deleteRefreshToken(token);
      throw new UnauthorizedException('Refresh token has expired');
    }

    const user = await this.userRepository.findById(dbToken.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    await this.userRepository.deleteRefreshToken(token);
    return this.generateTokens(user);
  }

  private async generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    
    const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
    const refreshToken = crypto.randomBytes(40).toString('hex');
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.userRepository.saveRefreshToken(user.id, refreshToken, expiresAt);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }
}

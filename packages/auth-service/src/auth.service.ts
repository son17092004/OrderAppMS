import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRepository } from './repositories/user.repository';
import { User, UserRole } from './entities/user.entity';
import { KeycloakService } from './keycloak/keycloak.service';
import * as crypto from 'crypto';

export interface ValidateTokenResult {
  valid: boolean;
  user_id: string;
  email: string;
  role: string;
  keycloak_id: string;
  is_banned: boolean;
  error_message: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly keycloakService: KeycloakService,
  ) {}

  // ─── Local Auth ─────────────────────────────────────────────────────────────

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
    if (!user || !user.passwordHash || !this.verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.isBanned) {
      throw new ForbiddenException('Your account has been suspended');
    }
    await this.userRepository.updateLastLogin(user.id);
    return this.generateTokens(user);
  }

  async refresh(token: string) {
    const dbToken = await this.userRepository.findRefreshToken(token);
    if (!dbToken) throw new UnauthorizedException('Invalid refresh token');
    if (new Date() > dbToken.expiresAt) {
      await this.userRepository.deleteRefreshToken(token);
      throw new UnauthorizedException('Refresh token has expired');
    }
    const user = await this.userRepository.findById(dbToken.userId);
    if (!user) throw new UnauthorizedException('User not found');
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
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  // ─── Token Validation (gRPC) ─────────────────────────────────────────────

  async validateToken(token: string, type: 'KEYCLOAK' | 'INTERNAL'): Promise<ValidateTokenResult> {
    try {
      if (type === 'KEYCLOAK') {
        return await this.validateKeycloakToken(token);
      } else {
        return await this.validateInternalToken(token);
      }
    } catch (error) {
      this.logger.warn(`Token validation error: ${(error as Error).message}`);
      return this.invalidResult((error as Error).message);
    }
  }

  private async validateKeycloakToken(token: string): Promise<ValidateTokenResult> {
    // 1. Verify signature offline (fast)
    const claims = await this.keycloakService.verifyTokenSignature(token);

    // 2. Check session via Keycloak introspection (handles logout/revocation)
    const introspection = await this.keycloakService.introspectToken(token);
    if (!introspection.active) {
      return this.invalidResult('Token session has been revoked or expired in Keycloak');
    }

    // 3. Extract Keycloak user info and map role
    const { keycloakId, email, role } = this.keycloakService.extractUserInfo(claims);

    // 4. Sync user into local DB
    const user = await this.syncKeycloakUser(keycloakId, email, role);

    if (user.isBanned) {
      return this.invalidResult('User account has been suspended', {
        user_id: user.id,
        email: user.email,
        role: user.role,
        keycloak_id: keycloakId,
        is_banned: true,
      });
    }

    return {
      valid: true,
      user_id: user.id,
      email: user.email,
      role: user.role,
      keycloak_id: keycloakId,
      is_banned: false,
      error_message: '',
    };
  }

  private async validateInternalToken(token: string): Promise<ValidateTokenResult> {
    const decoded = this.jwtService.verify(token) as { sub: string; email: string; role: string };
    const user = await this.userRepository.findById(decoded.sub);
    if (!user) return this.invalidResult('User not found');
    if (user.isBanned) {
      return this.invalidResult('User account has been suspended', {
        user_id: user.id,
        email: user.email,
        role: user.role,
        keycloak_id: user.keycloakId ?? '',
        is_banned: true,
      });
    }
    return {
      valid: true,
      user_id: user.id,
      email: user.email,
      role: user.role,
      keycloak_id: user.keycloakId ?? '',
      is_banned: false,
      error_message: '',
    };
  }

  // ─── Keycloak Sync ──────────────────────────────────────────────────────────

  async syncKeycloakUser(keycloakId: string, email: string, role: UserRole): Promise<User> {
    let user = await this.userRepository.findByKeycloakId(keycloakId);
    if (!user) {
      user = await this.userRepository.findByEmail(email);
      if (user) {
        // Link existing local user to Keycloak account
        user = await this.userRepository.linkKeycloakId(user.id, keycloakId);
      } else {
        // First time Keycloak login — provision local user with Keycloak role
        user = await this.userRepository.createUserFromKeycloak(keycloakId, email, role);
      }
    }

    // Only sync role from Keycloak if local user is still CUSTOMER
    // (Never downgrade manually elevated ADMIN / RESTAURANT_OWNER roles)
    if (user.role === UserRole.CUSTOMER && user.role !== role) {
      user = await this.userRepository.updateUserRole(user.id, role);
    }

    await this.userRepository.updateLastLogin(user.id);
    return user;
  }

  // ─── Keycloak Logout ────────────────────────────────────────────────────────

  async logout(accessToken: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      // End Keycloak user session via backchannel logout
      await this.keycloakService.logout(refreshToken);
    } else {
      // Fallback: revoke access token
      await this.keycloakService.revokeToken(accessToken, 'access_token');
    }
  }

  async logoutLocal(refreshToken: string): Promise<void> {
    await this.userRepository.deleteRefreshToken(refreshToken);
  }

  // ─── Admin Operations ───────────────────────────────────────────────────────

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }

  async searchUsers(query: string): Promise<User[]> {
    return this.userRepository.searchUsers(query);
  }

  async listAllUsers(): Promise<User[]> {
    return this.userRepository.listAllUsers();
  }

  async assignOwnerRole(email: string): Promise<User> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) throw new NotFoundException('User with this email does not exist');
    if (user.role === UserRole.ADMIN) return user;
    return this.userRepository.updateUserRole(user.id, UserRole.RESTAURANT_OWNER);
  }

  async updateUserRole(userId: string, role: UserRole): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return this.userRepository.updateUserRole(userId, role);
  }

  async banUser(userId: string, isBanned: boolean): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return this.userRepository.setBanStatus(userId, isBanned);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private invalidResult(
    message: string,
    partial: Partial<ValidateTokenResult> = {},
  ): ValidateTokenResult {
    return {
      valid: false,
      user_id: '',
      email: '',
      role: '',
      keycloak_id: '',
      is_banned: false,
      error_message: message,
      ...partial,
    };
  }
}

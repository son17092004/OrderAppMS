import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jwksRsa = require('jwks-rsa') as typeof import('jwks-rsa');
import * as jwt from 'jsonwebtoken';
import { UserRole } from '../entities/user.entity';

export interface KeycloakTokenClaims {
  sub: string;
  email: string;
  email_verified: boolean;
  realm_access?: { roles: string[] };
  resource_access?: Record<string, { roles: string[] }>;
  iat: number;
  exp: number;
  jti?: string;
}

@Injectable()
export class KeycloakService {
  private readonly logger = new Logger(KeycloakService.name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly jwksClient: any;
  private readonly keycloakUrl: string;
  private readonly realm: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.keycloakUrl = configService.get<string>('KEYCLOAK_URL', 'http://localhost:8080');
    this.realm = configService.get<string>('KEYCLOAK_REALM', 'food-ordering');
    this.clientId = configService.get<string>('KEYCLOAK_CLIENT_ID', 'food-ordering-backend');
    this.clientSecret = configService.get<string>('KEYCLOAK_CLIENT_SECRET', '');

    this.jwksClient = jwksRsa({
      jwksUri: `${this.keycloakUrl}/realms/${this.realm}/protocol/openid-connect/certs`,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 600_000, // 10 minutes
    });
  }

  /**
   * Verify JWT signature using Keycloak JWKS endpoint (offline check)
   */
  async verifyTokenSignature(token: string): Promise<KeycloakTokenClaims> {
    return new Promise((resolve, reject) => {
      const decoded = jwt.decode(token, { complete: true }) as jwt.Jwt | null;
      if (!decoded?.header?.kid) {
        return reject(new Error('Invalid token: missing kid header'));
      }

      this.jwksClient.getSigningKey(decoded.header.kid, (err, key) => {
        if (err) {
          return reject(new Error(`JWKS key fetch failed: ${err.message}`));
        }
        const publicKey = key.getPublicKey();
        jwt.verify(token, publicKey, { algorithms: ['RS256'] }, (verifyErr, payload) => {
          if (verifyErr) {
            return reject(new Error(`Token signature invalid: ${verifyErr.message}`));
          }
          resolve(payload as KeycloakTokenClaims);
        });
      });
    });
  }

  /**
   * Introspect token against Keycloak — checks if session is still active
   */
  async introspectToken(token: string): Promise<{ active: boolean } & Record<string, unknown>> {
    try {
      this.logger.debug(`Introspecting token. URL: ${this.keycloakUrl}/realms/${this.realm}/protocol/openid-connect/token/introspect, ClientId: ${this.clientId}`);
      const response = await axios.post(
        `${this.keycloakUrl}/realms/${this.realm}/protocol/openid-connect/token/introspect`,
        new URLSearchParams({
          token,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 5000 },
      );
      this.logger.debug(`Introspection response: ${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error) {
      this.logger.warn(`Token introspection error: ${(error as Error).message}`);
      return { active: false };
    }
  }

  async revokeToken(token: string, hint: 'access_token' | 'refresh_token' = 'access_token'): Promise<void> {
    try {
      await axios.post(
        `${this.keycloakUrl}/realms/${this.realm}/protocol/openid-connect/revoke`,
        new URLSearchParams({
          token,
          token_type_hint: hint,
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 5000 },
      );
      this.logger.log(`Token revoked successfully (hint: ${hint})`);
    } catch (error) {
      this.logger.error(`Token revocation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Close Keycloak user session via backchannel logout using refresh token
   */
  async logout(refreshToken: string): Promise<void> {
    try {
      await axios.post(
        `${this.keycloakUrl}/realms/${this.realm}/protocol/openid-connect/logout`,
        new URLSearchParams({
          client_id: 'food-ordering-app',
          refresh_token: refreshToken,
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 5000 },
      );
      this.logger.log('Keycloak session closed successfully via backchannel logout');
    } catch (error) {
      this.logger.error(`Keycloak backchannel logout failed: ${(error as Error).message}`);
    }
  }

  /**
   * Extract standardized user info from Keycloak token claims, mapping Keycloak roles to app roles
   */
  extractUserInfo(claims: KeycloakTokenClaims): {
    keycloakId: string;
    email: string;
    role: UserRole;
  } {
    const realmRoles: string[] = claims.realm_access?.roles ?? [];
    let role = UserRole.CUSTOMER;

    if (realmRoles.includes('ADMIN')) {
      role = UserRole.ADMIN;
    } else if (realmRoles.includes('RESTAURANT_OWNER')) {
      role = UserRole.RESTAURANT_OWNER;
    } else if (realmRoles.includes('DRIVER')) {
      role = UserRole.DRIVER;
    }

    return {
      keycloakId: claims.sub,
      email: claims.email,
      role,
    };
  }

  /**
   * Detect if a given JWT was issued by Keycloak (checks the issuer claim)
   */
  isKeycloakToken(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as Record<string, unknown> | null;
      if (!decoded?.iss) return false;
      return String(decoded.iss).includes(this.keycloakUrl) ||
             String(decoded.iss).includes('/realms/');
    } catch {
      return false;
    }
  }
}

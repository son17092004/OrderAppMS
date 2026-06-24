import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { RefreshToken } from '../entities/refresh-token.entity';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(User)
    private readonly typeOrmUserRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly typeOrmRefreshTokenRepository: Repository<RefreshToken>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.typeOrmUserRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.typeOrmUserRepository.findOne({ where: { id } });
  }

  async findByKeycloakId(keycloakId: string): Promise<User | null> {
    return this.typeOrmUserRepository.findOne({ where: { keycloakId } });
  }

  async searchUsers(query: string): Promise<User[]> {
    return this.typeOrmUserRepository.find({
      where: { email: ILike(`%${query}%`) },
      select: {
        id: true,
        email: true,
        role: true,
        isBanned: true,
      },
      order: { email: 'ASC' },
      take: 20,
    });
  }

  async listAllUsers(): Promise<User[]> {
    return this.typeOrmUserRepository.find({
      select: {
        id: true,
        email: true,
        role: true,
        isBanned: true,
      },
      order: { email: 'ASC' },
    });
  }

  async createUser(email: string, passwordHash: string, role: UserRole): Promise<User> {
    const user = this.typeOrmUserRepository.create({ email, passwordHash, role, addresses: [] });
    return this.typeOrmUserRepository.save(user);
  }

  async createUserFromKeycloak(keycloakId: string, email: string, role: UserRole): Promise<User> {
    const user = this.typeOrmUserRepository.create({
      keycloakId,
      email,
      role,
      passwordHash: null,
      lastLoginAt: new Date(),
      addresses: [],
    });
    return this.typeOrmUserRepository.save(user);
  }

  async linkKeycloakId(userId: string, keycloakId: string): Promise<User> {
    await this.typeOrmUserRepository.update(userId, { keycloakId });
    return this.findById(userId);
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.typeOrmUserRepository.update(userId, { lastLoginAt: new Date() });
  }

  async updateUserRole(id: string, role: UserRole): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new Error('User not found');
    user.role = role;
    return this.typeOrmUserRepository.save(user);
  }

  async updateAddresses(id: string, addresses: string[]): Promise<User> {
    await this.typeOrmUserRepository.update(id, { addresses });
    const user = await this.findById(id);
    if (!user) throw new Error('User not found');
    return user;
  }

  async setBanStatus(id: string, isBanned: boolean): Promise<User> {
    await this.typeOrmUserRepository.update(id, { isBanned });
    return this.findById(id);
  }

  async saveRefreshToken(userId: string, token: string, expiresAt: Date): Promise<RefreshToken> {
    const refreshToken = this.typeOrmRefreshTokenRepository.create({ userId, token, expiresAt });
    return this.typeOrmRefreshTokenRepository.save(refreshToken);
  }

  async findRefreshToken(token: string): Promise<RefreshToken | null> {
    return this.typeOrmRefreshTokenRepository.findOne({ where: { token } });
  }

  async deleteRefreshToken(token: string): Promise<void> {
    await this.typeOrmRefreshTokenRepository.delete({ token });
  }
}

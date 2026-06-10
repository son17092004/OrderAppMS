import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
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

  async createUser(email: string, passwordHash: string, role: any): Promise<User> {
    const user = this.typeOrmUserRepository.create({
      email,
      passwordHash,
      role,
    });
    return this.typeOrmUserRepository.save(user);
  }

  async saveRefreshToken(userId: string, token: string, expiresAt: Date): Promise<RefreshToken> {
    const refreshToken = this.typeOrmRefreshTokenRepository.create({
      userId,
      token,
      expiresAt,
    });
    return this.typeOrmRefreshTokenRepository.save(refreshToken);
  }

  async findRefreshToken(token: string): Promise<RefreshToken | null> {
    return this.typeOrmRefreshTokenRepository.findOne({ where: { token } });
  }

  async deleteRefreshToken(token: string): Promise<void> {
    await this.typeOrmRefreshTokenRepository.delete({ token });
  }
}

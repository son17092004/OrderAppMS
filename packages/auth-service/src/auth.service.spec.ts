import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserRepository } from './repositories/user.repository';
import { JwtService } from '@nestjs/jwt';
import { JsonLogger } from '@food-ordering/common';
import { ConflictException } from '@nestjs/common';
import { UserRole } from './entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: any;
  let jwtService: any;

  beforeEach(async () => {
    userRepository = {
      findByEmail: (jest.fn() as any),
      createUser: (jest.fn() as any),
      findById: (jest.fn() as any),
      findRefreshToken: (jest.fn() as any),
      deleteRefreshToken: (jest.fn() as any),
      saveRefreshToken: (jest.fn() as any),
    };
    jwtService = {
      sign: (jest.fn() as any).mockReturnValue('mock-jwt-token'),
      verify: (jest.fn() as any),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserRepository, useValue: userRepository },
        { provide: JwtService, useValue: jwtService },
        {
          provide: JsonLogger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            setContext: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should throw ConflictException if user exists', async () => {
      userRepository.findByEmail.mockResolvedValue({ id: 'user-id' });
      await expect(
        service.register('test@example.com', 'password', UserRole.CUSTOMER)
      ).rejects.toThrow(ConflictException);
    });

    it('should register successfully', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.createUser.mockResolvedValue({
        id: 'new-user-id',
        email: 'test@example.com',
        role: UserRole.CUSTOMER,
      });

      const result = await service.register('test@example.com', 'password', UserRole.CUSTOMER);
      expect(result.id).toBe('new-user-id');
      expect(userRepository.createUser).toHaveBeenCalled();
    });
  });
});

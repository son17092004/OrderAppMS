import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { CartService } from './cart.service';
import { ConfigService } from '@nestjs/config';

describe('CartService', () => {
  let service: CartService;
  let redisClient: any;
  let configServiceMock: any;

  beforeEach(async () => {
    redisClient = {
      get: jest.fn() as any,
      set: (jest.fn() as any).mockResolvedValue('OK'),
      del: (jest.fn() as any).mockResolvedValue(1),
    };
    configServiceMock = {
      get: (jest.fn() as any).mockImplementation((key: string, defaultValue?: any) => defaultValue || 'http://localhost:3002'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: 'REDIS_CLIENT', useValue: redisClient },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCart', () => {
    it('should return empty cart when no cart in redis', async () => {
      redisClient.get.mockResolvedValue(null);
      const cart = await service.getCart('user-id');
      expect(cart.items).toHaveLength(0);
      expect(cart.totalPrice).toBe(0);
    });

    it('should return parsed cart when cart exists in redis', async () => {
      const mockCart = {
        userId: 'user-id',
        restaurantId: 'restaurant-id',
        items: [{ foodItemId: 'pizza', name: 'Pizza', price: 10, quantity: 2 }],
        totalPrice: 20,
      };
      redisClient.get.mockResolvedValue(JSON.stringify(mockCart));
      const cart = await service.getCart('user-id');
      expect(cart.restaurantId).toBe('restaurant-id');
      expect(cart.totalPrice).toBe(20);
    });
  });
});

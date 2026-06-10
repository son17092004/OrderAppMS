import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { RestaurantService } from './restaurant.service';
import { RestaurantRepository } from './repositories/restaurant.repository';
import { JsonLogger } from '@food-ordering/common';
import { NotFoundException } from '@nestjs/common';

describe('RestaurantService', () => {
  let service: RestaurantService;
  let restaurantRepository: any;
  let redisClient: any;

  beforeEach(async () => {
    restaurantRepository = {
      createRestaurant: jest.fn(),
      findAllActive: jest.fn(),
      findById: jest.fn(),
      createCategory: jest.fn(),
      createFoodItem: jest.fn(),
      findFoodItemById: jest.fn(),
      getRestaurantMenu: jest.fn(),
    };
    redisClient = {
      get: (jest.fn() as any).mockResolvedValue(null),
      set: (jest.fn() as any).mockResolvedValue('OK'),
      del: (jest.fn() as any).mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RestaurantService,
        { provide: RestaurantRepository, useValue: restaurantRepository },
        { provide: 'REDIS_CLIENT', useValue: redisClient },
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

    service = module.get<RestaurantService>(RestaurantService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createRestaurant', () => {
    it('should create a restaurant successfully', async () => {
      restaurantRepository.createRestaurant.mockResolvedValue({
        id: 'restaurant-id',
        name: 'Gourmet Place',
      });

      const result = await service.createRestaurant('Gourmet Place', 'owner-id', '123 Main St', '555-0100');
      expect(result.id).toBe('restaurant-id');
      expect(restaurantRepository.createRestaurant).toHaveBeenCalled();
    });
  });

  describe('findFoodItemById', () => {
    it('should throw NotFoundException if item not found', async () => {
      restaurantRepository.findFoodItemById.mockResolvedValue(null);
      await expect(service.findFoodItemById('invalid-id')).rejects.toThrow(NotFoundException);
    });

    it('should return item details if found', async () => {
      restaurantRepository.findFoodItemById.mockResolvedValue({
        id: 'item-id',
        name: 'Pizza',
        price: 15.00,
        category: { restaurantId: 'restaurant-id' },
      });

      const result = await service.findFoodItemById('item-id');
      expect(result.name).toBe('Pizza');
    });
  });
});

import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { RestaurantRepository } from './repositories/restaurant.repository';
import { Restaurant } from './entities/restaurant.entity';
import { Category } from './entities/category.entity';
import { FoodItem } from './entities/food-item.entity';
import Redis from 'ioredis';

@Injectable()
export class RestaurantService {
  constructor(
    private readonly restaurantRepository: RestaurantRepository,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  private readonly RESTAURANT_TTL = 300; 
  private readonly MENU_TTL = 600; 

  private async invalidateMenuCache(restaurantId: string) {
    await this.redis.del(`restaurant:menu:${restaurantId}`);
    await this.redis.del(`restaurant:details:${restaurantId}`);
  }

  async createRestaurant(name: string, ownerId: string, address: string, phone: string, images?: string[]): Promise<Restaurant> {
    return this.restaurantRepository.createRestaurant(name, ownerId, address, phone, images);
  }

  async findAllActive(): Promise<Restaurant[]> {
    return this.restaurantRepository.findAllActive();
  }

  async findById(id: string): Promise<Restaurant> {
    const cacheKey = `restaurant:details:${id}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const restaurant = await this.restaurantRepository.findById(id);
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    await this.redis.set(cacheKey, JSON.stringify(restaurant), 'EX', this.RESTAURANT_TTL);
    return restaurant;
  }

  async updateRestaurant(id: string, ownerId: string, isAdmin: boolean, updateData: Partial<Restaurant>): Promise<Restaurant> {
    const restaurant = await this.findById(id);
    if (!isAdmin && restaurant.ownerId !== ownerId) {
      throw new NotFoundException('You do not own this restaurant');
    }

    const updated = await this.restaurantRepository.updateRestaurant(id, updateData);
    await this.invalidateMenuCache(id);
    return updated!;
  }

  async deleteRestaurant(id: string, ownerId: string, isAdmin: boolean): Promise<void> {
    const restaurant = await this.findById(id);
    if (!isAdmin && restaurant.ownerId !== ownerId) {
      throw new NotFoundException('You do not own this restaurant');
    }

    await this.restaurantRepository.deleteRestaurant(id);
    await this.invalidateMenuCache(id);
  }

  async createCategory(restaurantId: string, ownerId: string, isAdmin: boolean, name: string): Promise<Category> {
    const restaurant = await this.findById(restaurantId);
    if (!isAdmin && restaurant.ownerId !== ownerId) {
      throw new NotFoundException('You do not own this restaurant');
    }

    const category = await this.restaurantRepository.createCategory(restaurantId, name);
    await this.invalidateMenuCache(restaurantId);
    return category;
  }

  async createFoodItem(restaurantId: string, categoryId: string, ownerId: string, isAdmin: boolean, name: string, description: string, price: number, images?: string[]): Promise<FoodItem> {
    const restaurant = await this.findById(restaurantId);
    if (!isAdmin && restaurant.ownerId !== ownerId) {
      throw new NotFoundException('You do not own this restaurant');
    }

    const category = await this.restaurantRepository.findCategoryById(categoryId);
    if (!category || category.restaurantId !== restaurantId) {
      throw new NotFoundException('Category not found in this restaurant');
    }

    const foodItem = await this.restaurantRepository.createFoodItem(categoryId, name, description, price, images);
    await this.invalidateMenuCache(restaurantId);
    return foodItem;
  }

  async getMenu(restaurantId: string): Promise<Restaurant> {
    const cacheKey = `restaurant:menu:${restaurantId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const menu = await this.restaurantRepository.getRestaurantMenu(restaurantId);
    if (!menu) {
      throw new NotFoundException('Restaurant menu not found');
    }

    await this.redis.set(cacheKey, JSON.stringify(menu), 'EX', this.MENU_TTL);
    return menu;
  }

  async findFoodItemById(id: string): Promise<FoodItem> {
    const foodItem = await this.restaurantRepository.findFoodItemById(id);
    if (!foodItem) {
      throw new NotFoundException('Food item not found');
    }
    return foodItem;
  }

  async deleteFoodItem(itemId: string, ownerId: string, isAdmin: boolean): Promise<void> {
    const foodItem = await this.findFoodItemById(itemId);
    const restaurant = await this.findById(foodItem.category.restaurantId);
    if (!isAdmin && restaurant.ownerId !== ownerId) {
      throw new NotFoundException('You do not own this restaurant');
    }
    await this.restaurantRepository.deleteFoodItem(itemId);
    await this.invalidateMenuCache(restaurant.id);
  }

  async updateFoodItemImages(id: string, images: string[]): Promise<FoodItem> {
    const foodItem = await this.findFoodItemById(id);
    const updated = await this.restaurantRepository.updateFoodItemImages(id, images);
    await this.invalidateMenuCache(foodItem.category.restaurantId);
    return updated;
  }

  async updateFoodItemAvailability(itemId: string, isAvailable: boolean, ownerId: string, isAdmin: boolean): Promise<FoodItem> {
    const foodItem = await this.findFoodItemById(itemId);
    const restaurant = await this.findById(foodItem.category.restaurantId);
    if (!isAdmin && restaurant.ownerId !== ownerId) {
      throw new NotFoundException('You do not own this restaurant');
    }
    const updated = await this.restaurantRepository.updateFoodItemAvailability(itemId, isAvailable);
    await this.invalidateMenuCache(restaurant.id);
    return updated;
  }
}


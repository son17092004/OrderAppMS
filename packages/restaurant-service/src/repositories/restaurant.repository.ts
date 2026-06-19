import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Restaurant } from '../entities/restaurant.entity';
import { Category } from '../entities/category.entity';
import { FoodItem } from '../entities/food-item.entity';

@Injectable()
export class RestaurantRepository {
  constructor(
    @InjectRepository(Restaurant)
    private readonly typeOrmRestaurantRepository: Repository<Restaurant>,
    @InjectRepository(Category)
    private readonly typeOrmCategoryRepository: Repository<Category>,
    @InjectRepository(FoodItem)
    private readonly typeOrmFoodItemRepository: Repository<FoodItem>,
  ) {}

  async createRestaurant(name: string, ownerId: string, address: string, phone: string, images?: string[]): Promise<Restaurant> {
    const restaurant = this.typeOrmRestaurantRepository.create({
      name,
      ownerId,
      address,
      phone,
      images,
    });
    return this.typeOrmRestaurantRepository.save(restaurant);
  }

  async findAllActive(): Promise<Restaurant[]> {
    return this.typeOrmRestaurantRepository.find({ where: { isActive: true } });
  }

  async findById(id: string): Promise<Restaurant | null> {
    return this.typeOrmRestaurantRepository.findOne({ where: { id } });
  }

  async updateRestaurant(id: string, updateData: Partial<Restaurant>): Promise<Restaurant | null> {
    await this.typeOrmRestaurantRepository.update(id, updateData);
    return this.findById(id);
  }

  async deleteRestaurant(id: string): Promise<void> {
    await this.typeOrmRestaurantRepository.delete(id);
  }

  async createCategory(restaurantId: string, name: string): Promise<Category> {
    const category = this.typeOrmCategoryRepository.create({
      restaurantId,
      name,
    });
    return this.typeOrmCategoryRepository.save(category);
  }

  async findCategoriesByRestaurant(restaurantId: string): Promise<Category[]> {
    return this.typeOrmCategoryRepository.find({ where: { restaurantId } });
  }

  async findCategoryById(id: string): Promise<Category | null> {
    return this.typeOrmCategoryRepository.findOne({ where: { id } });
  }

  async createFoodItem(categoryId: string, name: string, description: string, price: number, images?: string[]): Promise<FoodItem> {
    const foodItem = this.typeOrmFoodItemRepository.create({
      categoryId,
      name,
      description,
      price,
      images,
    });
    return this.typeOrmFoodItemRepository.save(foodItem);
  }

  async findFoodItemById(id: string): Promise<FoodItem | null> {
    return this.typeOrmFoodItemRepository.findOne({ where: { id }, relations: { category: true } });
  }

  async updateFoodItemImages(id: string, images: string[]): Promise<FoodItem> {
    await this.typeOrmFoodItemRepository.update(id, { images });
    return this.typeOrmFoodItemRepository.findOne({ where: { id }, relations: { category: true } }) as Promise<FoodItem>;
  }

  async deleteFoodItem(id: string): Promise<void> {
    await this.typeOrmFoodItemRepository.delete(id);
  }

  async updateFoodItemAvailability(id: string, isAvailable: boolean): Promise<FoodItem> {
    await this.typeOrmFoodItemRepository.update(id, { isAvailable });
    return this.typeOrmFoodItemRepository.findOne({ where: { id }, relations: { category: true } }) as Promise<FoodItem>;
  }

  async getRestaurantMenu(restaurantId: string): Promise<Restaurant | null> {
    return this.typeOrmRestaurantRepository.findOne({
      where: { id: restaurantId },
      relations: {
        categories: {
          foodItems: true,
        },
      },
    });
  }
}

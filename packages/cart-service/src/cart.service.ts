import { Injectable, Inject, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface CartItem {
  foodItemId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Cart {
  restaurantId: string;
  items: CartItem[];
  totalPrice: number;
}

@Injectable()
export class CartService {
  private readonly restaurantServiceUrl: string;

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {
    this.restaurantServiceUrl = this.configService.get<string>('RESTAURANT_SERVICE_URL', 'http://localhost:3002');
  }

  private getCartKey(userId: string): string {
    return `cart:${userId}`;
  }

  async getCart(userId: string): Promise<Cart> {
    const key = this.getCartKey(userId);
    const cached = await this.redis.get(key);
    if (!cached) {
      return { restaurantId: '', items: [], totalPrice: 0 };
    }
    return JSON.parse(cached);
  }

  async addItem(userId: string, foodItemId: string, quantity: number): Promise<Cart> {
    let foodItem;
    try {
      const res = await fetch(`${this.restaurantServiceUrl}/v1/restaurants/internal/items/${foodItemId}`);
      if (!res.ok) {
        throw new NotFoundException('Food item not found in restaurant service');
      }
      foodItem = await res.json();
    } catch (err) {
      throw new BadRequestException(`Failed to verify food item: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!foodItem || !foodItem.isAvailable) {
      throw new BadRequestException('Food item is currently not available');
    }

    const { name, price, category } = foodItem;
    const restaurantId = category.restaurantId;

    const cart = await this.getCart(userId);

    if (cart.restaurantId && cart.restaurantId !== restaurantId) {
      throw new ConflictException('Cannot add items from a different restaurant. Clear the cart first.');
    }

    if (!cart.restaurantId) {
      cart.restaurantId = restaurantId;
    }

    const existingIndex = cart.items.findIndex(item => item.foodItemId === foodItemId);
    if (existingIndex > -1) {
      cart.items[existingIndex].quantity += quantity;
    } else {
      cart.items.push({
        foodItemId,
        name,
        price,
        quantity,
      });
    }

    cart.totalPrice = this.calculateTotal(cart.items);

    await this.redis.set(this.getCartKey(userId), JSON.stringify(cart));
    return cart;
  }

  async updateItemQuantity(userId: string, foodItemId: string, quantity: number): Promise<Cart> {
    const cart = await this.getCart(userId);
    if (!cart.restaurantId) {
      throw new NotFoundException('Cart is empty');
    }

    const itemIndex = cart.items.findIndex(item => item.foodItemId === foodItemId);
    if (itemIndex === -1) {
      throw new NotFoundException('Item not found in cart');
    }

    cart.items[itemIndex].quantity = quantity;
    if (cart.items[itemIndex].quantity <= 0) {
      cart.items.splice(itemIndex, 1);
    }

    if (cart.items.length === 0) {
      return this.clearCart(userId);
    }

    cart.totalPrice = this.calculateTotal(cart.items);
    await this.redis.set(this.getCartKey(userId), JSON.stringify(cart));
    return cart;
  }

  async removeItem(userId: string, foodItemId: string): Promise<Cart> {
    const cart = await this.getCart(userId);
    if (!cart.restaurantId) {
      throw new NotFoundException('Cart is empty');
    }

    const itemIndex = cart.items.findIndex(item => item.foodItemId === foodItemId);
    if (itemIndex === -1) {
      throw new NotFoundException('Item not found in cart');
    }

    cart.items.splice(itemIndex, 1);

    if (cart.items.length === 0) {
      return this.clearCart(userId);
    }

    cart.totalPrice = this.calculateTotal(cart.items);
    await this.redis.set(this.getCartKey(userId), JSON.stringify(cart));
    return cart;
  }

  async clearCart(userId: string): Promise<Cart> {
    const key = this.getCartKey(userId);
    await this.redis.del(key);
    return { restaurantId: '', items: [], totalPrice: 0 };
  }

  private calculateTotal(items: CartItem[]): number {
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return Math.round(total * 100) / 100;
  }
}

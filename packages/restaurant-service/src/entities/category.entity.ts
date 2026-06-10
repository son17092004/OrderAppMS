import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Restaurant } from './restaurant.entity';
import { FoodItem } from './food-item.entity';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'restaurant_id' })
  restaurantId: string;

  @Column()
  name: string;

  @ManyToOne(() => Restaurant, (restaurant) => restaurant.categories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: Restaurant;

  @OneToMany(() => FoodItem, (foodItem) => foodItem.category)
  foodItems: FoodItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

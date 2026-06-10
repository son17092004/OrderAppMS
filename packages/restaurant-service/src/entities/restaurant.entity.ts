import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Category } from './category.entity';

@Entity('restaurants')
export class Restaurant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ name: 'owner_id' })
  ownerId: string;

  @Column()
  address: string;

  @Column()
  phone: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column('simple-array', { nullable: true })
  images: string[];

  @OneToMany(() => Category, (category) => category.restaurant)
  categories: Category[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

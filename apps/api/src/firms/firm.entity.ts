import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('firms')
export class Firm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ nullable: true })
  logo_url: string;

  @Column({ default: 'UTC' })
  timezone: string;

  @Column({ default: 'USD', length: 3 })
  currency: string;

  @Column({ default: 10 })
  max_traders: number;

  @Column({ default: 'basic' })
  subscription_tier: string;

  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'jsonb', default: {} })
  metadata: object;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

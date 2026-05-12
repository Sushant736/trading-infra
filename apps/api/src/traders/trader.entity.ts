import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('traders')
export class Trader {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  firm_id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password_hash: string;

  @Column()
  full_name: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ unique: true })
  trader_code: string;

  @Column({ default: true })
  is_active: boolean;

  @Column({ default: 'pending' })
  kyc_status: string;

  @Column({ type: 'jsonb', default: {} })
  metadata: object;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

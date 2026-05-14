import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('positions')
export class Trade {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  account_id: string;

  @Column()
  symbol: string;

  @Column()
  side: string;

  @Column({ type: 'numeric' })
  volume: number;

  @Column({ type: 'numeric' })
  open_price: number;

  @Column({ type: 'numeric', nullable: true })
  current_price: number;

  @Column({ type: 'numeric', nullable: true })
  sl_price: number;

  @Column({ type: 'numeric', nullable: true })
  tp_price: number;

  @Column({ type: 'numeric', default: 0 })
  floating_pnl: number;

  @Column({ default: 'OPEN' })
  status: string;

  @CreateDateColumn()
  opened_at: Date;

  @Column({ nullable: true })
  closed_at: Date;
}

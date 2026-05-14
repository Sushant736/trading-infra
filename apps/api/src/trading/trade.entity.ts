import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('positions')
export class Trade {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'account_id', type: 'uuid' })
  account_id: string;

  @Column({ name: 'symbol', type: 'varchar' })
  symbol: string;

  @Column({ name: 'side', type: 'varchar' })
  side: string;

  @Column({ name: 'volume', type: 'numeric' })
  volume: number;

  @Column({ name: 'open_price', type: 'numeric' })
  open_price: number;

  @Column({ name: 'current_price', type: 'numeric', nullable: true })
  current_price: number;

  @Column({ name: 'sl_price', type: 'numeric', nullable: true })
  sl_price: number;

  @Column({ name: 'tp_price', type: 'numeric', nullable: true })
  tp_price: number;

  @Column({ name: 'floating_pnl', type: 'numeric', default: 0 })
  floating_pnl: number;

  @Column({ name: 'status', type: 'varchar', default: 'OPEN' })
  status: string;

  @CreateDateColumn({ name: 'opened_at' })
  opened_at: Date;

  @Column({ name: 'closed_at', nullable: true })
  closed_at: Date;
}

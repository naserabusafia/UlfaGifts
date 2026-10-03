import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { NfcItem } from '../../nfc-items/entities/nfc-item.entity';

export enum OrderStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
}

export enum OrderSource {
  ADMIN = 'ADMIN',
  MERCHANT_PORTAL = 'MERCHANT_PORTAL',
  EXTERNAL_API = 'EXTERNAL_API',
}

@Entity('orders')
@Index(['merchantId', 'idempotencyKey'], { unique: true })
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'external_order_id', nullable: true })
  externalOrderId?: string;

  @Column({ name: 'customer_name' })
  customerName: string;

  @Index('IDX_orders_customer_phone')
  @Column({ name: 'customer_phone', nullable: true, length: 16 })
  customerPhone?: string;

  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  @Column({
    name: 'source',
    type: 'varchar',
    default: OrderSource.ADMIN,
  })
  source: OrderSource;

  @Column({ name: 'idempotency_key', nullable: true, length: 128 })
  idempotencyKey?: string;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id' })
  merchant?: User;

  @OneToMany(() => NfcItem, (nfcItem) => nfcItem.order)
  nfcItems?: NfcItem[];
}

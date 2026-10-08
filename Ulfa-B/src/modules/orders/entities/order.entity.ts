import {
  Column,
  CreateDateColumn,
  Entity,
  Generated,
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
  // The links are switched off and their quota is refunded. Until the
  // retention window passes the order can be restored (quota charged again);
  // after it, what the buyer uploaded is deleted and the order stays cancelled.
  CANCELLED = 'CANCELLED',
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

  // Short human-facing number, used as the prefix of the item links.
  @Column({ name: 'order_number', unique: true })
  @Generated('increment')
  orderNumber: number;

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

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt?: Date | null;

  // Set once the buyer's photos, recordings and letters have been deleted.
  @Column({ name: 'content_purged_at', type: 'timestamptz', nullable: true })
  contentPurgedAt?: Date | null;

  @ManyToOne(() => User, (user) => user.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id' })
  merchant?: User;

  @OneToMany(() => NfcItem, (nfcItem) => nfcItem.order)
  nfcItems?: NfcItem[];
}

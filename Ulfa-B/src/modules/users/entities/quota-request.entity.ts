import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum QuotaRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  // Withdrawn by the merchant before an admin answered.
  CANCELLED = 'CANCELLED',
}

/**
 * A merchant on a limited quota asking the admins for more links. An admin
 * approves it (with the amount asked for, or a different one) or rejects it;
 * either side can leave a reason.
 */
@Entity('quota_requests')
@Index('IDX_quota_requests_status_created_at', ['status', 'createdAt'])
export class QuotaRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_quota_requests_merchant_id')
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id' })
  merchant?: User;

  @Column({ name: 'requested_amount', type: 'int' })
  requestedAmount: number;

  // What was actually added; may differ from the request when an admin changes it.
  @Column({ name: 'approved_amount', type: 'int', nullable: true })
  approvedAmount?: number | null;

  @Column({ type: 'varchar', length: 20, default: QuotaRequestStatus.PENDING })
  status: QuotaRequestStatus;

  @Column({
    name: 'merchant_reason',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  merchantReason?: string | null;

  @Column({
    name: 'admin_reason',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  adminReason?: string | null;

  @Column({ name: 'reviewed_by_id', type: 'uuid', nullable: true })
  reviewedById?: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reviewed_by_id' })
  reviewedBy?: User | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

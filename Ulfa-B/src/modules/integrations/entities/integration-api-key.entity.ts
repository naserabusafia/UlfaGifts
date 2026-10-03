import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('integration_api_keys')
export class IntegrationApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 80 })
  label: string;

  @Index({ unique: true })
  @Column({ name: 'key_hash', length: 64, unique: true, select: false })
  keyHash: string;

  @Column({ name: 'key_prefix', length: 20 })
  keyPrefix: string;

  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id' })
  merchant: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt?: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date;
}


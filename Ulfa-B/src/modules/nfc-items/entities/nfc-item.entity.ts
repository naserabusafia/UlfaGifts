import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity';
import { ItemContent } from './item-content.entity';
import { ItemMedia } from './item-media.entity';
import { ItemSection } from './item-section.entity';
import { ThemeOccasion } from './theme-occasion.entity';

export enum ViewerAuthType {
  NONE = 'NONE',
  PIN = 'PIN',
  DATE = 'DATE',
  TEXT = 'TEXT',
}

export const DEFAULT_NFC_THEME = 'luxury';
export const DEFAULT_NFC_OCCASION = 'romantic';
export const DEFAULT_NFC_LANGUAGE = 'en';

@Entity('nfc_items')
export class NfcItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'product_name' })
  productName: string;

  @Index({ unique: true })
  @Column({ name: 'nfc_id', unique: true })
  nfcId: string;

  @Index({ unique: true })
  @Column({ name: 'edit_token', type: 'uuid', unique: true })
  editToken?: string;

  @Column({ name: 'creator_password_hash', nullable: true })
  creatorPasswordHash?: string;

  @Column({
    name: 'viewer_auth_type',
    type: 'enum',
    enum: ViewerAuthType,
    default: ViewerAuthType.NONE,
  })
  viewerAuthType: ViewerAuthType;

  @Column({ name: 'viewer_auth_prompt', nullable: true })
  viewerAuthPrompt?: string;

  @Column({ name: 'viewer_password_hash', nullable: true })
  viewerPasswordHash?: string;

  // Wrong viewer answers in a row; reaching the limit sets locked_until.
  @Column({ name: 'failed_attempts', type: 'integer', default: 0 })
  failedAttempts: number;

  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true })
  lockedUntil?: Date | null;

  // --- Setup / end-to-end encryption -------------------------------------
  // The browser encrypts everything with a random content key; the server
  // only stores that key wrapped by a key derived from the viewer answer
  // (PBKDF2, salt below) and by the recovery code. It never sees either.

  @Column({ name: 'key_salt', type: 'varchar', length: 64, nullable: true })
  keySalt?: string | null;

  @Column({ name: 'kdf_iterations', type: 'integer', nullable: true })
  kdfIterations?: number | null;

  @Column({ name: 'wrapped_key', type: 'varchar', length: 128, nullable: true })
  wrappedKey?: string | null;

  @Column({
    name: 'recovery_wrapped_key',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  recoveryWrappedKey?: string | null;

  // SHA-256 of a key derived from the 128-bit recovery code.
  @Column({
    name: 'recovery_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  recoveryHash?: string | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt?: Date | null;

  @Column({ name: 'is_locked', default: false })
  isLocked: boolean;

  // Optional note from the merchant, shown to the buyer and the recipient
  // while the item is locked. Cleared when it is unlocked.
  @Column({ name: 'lock_reason', type: 'varchar', length: 200, nullable: true })
  lockReason?: string | null;

  // How many physical gifts carry this item's link. Above 1 when the merchant
  // chose one shared link for several gifts in the same order.
  @Column({ name: 'gift_count', type: 'integer', default: 1 })
  giftCount: number;

  // Whether creating this item used one of the merchant's quota units, so
  // cancelling the order refunds exactly what was charged. Items an admin
  // attaches directly are not charged.
  @Column({ name: 'quota_charged', default: true })
  quotaCharged: boolean;

  // Locked by cancelling its order (not by the merchant), so restoring the
  // order unlocks exactly these and leaves the merchant's own locks alone.
  @Column({ name: 'locked_by_cancel', default: false })
  lockedByCancel: boolean;

  // The occasion (and through it the theme) and language describe the NFC
  // experience itself, including the viewer-auth screen shown before content.
  @Index('IDX_nfc_items_occasion_id')
  @Column({ name: 'occasion_id', type: 'uuid' })
  occasionId: string;

  @ManyToOne(() => ThemeOccasion, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'occasion_id',
    foreignKeyConstraintName: 'FK_nfc_items_occasion_id',
  })
  occasion?: ThemeOccasion;

  @Column({ type: 'varchar', length: 16, default: DEFAULT_NFC_LANGUAGE })
  language: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Order, (order) => order.nfcItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order?: Order;

  @OneToOne(() => ItemContent, (content) => content.nfcItem, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  content?: ItemContent;

  @OneToMany(() => ItemMedia, (media) => media.nfcItem, {
    cascade: true,
  })
  media?: ItemMedia[];

  @OneToMany(() => ItemSection, (itemSection) => itemSection.nfcItem, {
    cascade: true,
  })
  itemSections?: ItemSection[];
}

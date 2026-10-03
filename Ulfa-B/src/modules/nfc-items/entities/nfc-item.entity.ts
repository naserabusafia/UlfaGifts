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

export enum ViewerAuthType {
  NONE = 'NONE',
  PIN = 'PIN',
  DATE = 'DATE',
  TEXT = 'TEXT',
}

export const DEFAULT_NFC_THEME = 'romantic';
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

  @Column({ name: 'is_locked', default: false })
  isLocked: boolean;

  // Theme and language describe the NFC experience itself, including the
  // viewer-auth screen shown before item content is available.
  @Column({ type: 'varchar', length: 64, default: DEFAULT_NFC_THEME })
  theme: string;

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

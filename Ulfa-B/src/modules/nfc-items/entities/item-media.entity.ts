import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { NfcItem } from './nfc-item.entity';
import { Section } from './section.entity';

export enum MediaType {
  IMAGE = 'IMAGE',
  VIDEO_LINK = 'VIDEO_LINK',
  VOICE_NOTE = 'VOICE_NOTE',
  SPOTIFY_LINK = 'SPOTIFY_LINK',
  BACKGROUND_AUDIO = 'BACKGROUND_AUDIO',
}

export enum MediaStatus {
  PENDING = 'PENDING',
  READY = 'READY',
}

@Entity('item_media')
export class ItemMedia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'media_type',
    type: 'enum',
    enum: MediaType,
  })
  mediaType: MediaType;

  // Plain URL for legacy media and links; encrypted uploads use storage keys.
  @Column({ type: 'varchar', nullable: true })
  url?: string | null;

  @Column({ name: 'storage_key', type: 'varchar', length: 255, nullable: true })
  storageKey?: string | null;

  @Column({ name: 'thumb_key', type: 'varchar', length: 255, nullable: true })
  thumbKey?: string | null;

  // Type of the plaintext (e.g. image/webp, audio/webm); the object is ciphertext.
  @Column({ type: 'varchar', length: 100, nullable: true })
  mime?: string | null;

  @Column({ type: 'integer', nullable: true })
  bytes?: number | null;

  @Column({ name: 'thumb_bytes', type: 'integer', nullable: true })
  thumbBytes?: number | null;

  @Column({ type: 'varchar', length: 16, default: MediaStatus.READY })
  status: MediaStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'text', nullable: true })
  caption?: string;

  @Column({ name: 'display_order', type: 'integer' })
  displayOrder: number;

  // Day the photo belongs to (YYYY-MM-DD), used by the memory calendar.
  @Column({ name: 'memory_date', type: 'date', nullable: true })
  memoryDate?: string | null;

  @Column({ name: 'section_id', type: 'uuid', nullable: true })
  sectionId?: string | null;

  @ManyToOne(() => Section, (section) => section.media, {
    onDelete: 'RESTRICT',
    nullable: true,
  })
  @JoinColumn({ name: 'section_id' })
  section?: Section;

  @Column({ name: 'item_id', type: 'uuid', nullable: true })
  itemId?: string;

  @ManyToOne(() => NfcItem, (nfcItem) => nfcItem.media, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  nfcItem?: NfcItem;
}

import {
  Column,
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

  @Column()
  url: string;

  @Column({ type: 'text', nullable: true })
  caption?: string;

  @Column({ name: 'display_order', type: 'integer' })
  displayOrder: number;

  @Column({ name: 'section_id', type: 'uuid', nullable: true })
  sectionId?: string | null;

  @ManyToOne(() => Section, (section) => section.media, {
    onDelete: 'RESTRICT',
    nullable: true,
  })
  @JoinColumn({ name: 'section_id' })
  section?: Section;

  @ManyToOne(() => NfcItem, (nfcItem) => nfcItem.media, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  nfcItem?: NfcItem;
}

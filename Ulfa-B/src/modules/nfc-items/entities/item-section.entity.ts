import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { NfcItem } from './nfc-item.entity';
import { Section } from './section.entity';

@Entity('item_sections')
@Unique('UQ_item_sections_item_id_section_id', ['itemId', 'sectionId'])
@Index('IDX_item_sections_item_id_display_order', ['itemId', 'displayOrder'])
export class ItemSection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId: string;

  @Column({ name: 'section_id', type: 'uuid' })
  sectionId: string;

  @Column({ name: 'display_order', type: 'integer' })
  displayOrder: number;

  @Column({ name: 'is_visible', default: true })
  isVisible: boolean;

  @ManyToOne(() => NfcItem, (nfcItem) => nfcItem.itemSections, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'item_id' })
  nfcItem: NfcItem;

  @ManyToOne(() => Section, (section) => section.itemSections, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'section_id' })
  section: Section;
}

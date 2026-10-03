import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { NfcItem } from './nfc-item.entity';

@Entity('item_contents')
export class ItemContent {
  @PrimaryColumn({ name: 'item_id', type: 'uuid' })
  itemId: string;

  @Column({ name: 'template_name' })
  templateName: string;

  @Column({ nullable: true })
  title?: string;

  @Column({ type: 'text', nullable: true })
  message?: string;

  @Column({ type: 'varchar', nullable: true })
  signature?: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToOne(() => NfcItem, (nfcItem) => nfcItem.content, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  nfcItem?: NfcItem;
}

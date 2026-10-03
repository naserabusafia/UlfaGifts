import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ItemMedia } from './item-media.entity';
import { ItemSection } from './item-section.entity';
import { ThemeSectionContent } from './theme-section-content.entity';

@Entity('sections')
@Index('UQ_sections_key', ['key'], { unique: true })
export class Section {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  key: string;

  @Column()
  name: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => ItemSection, (itemSection) => itemSection.section)
  itemSections?: ItemSection[];

  @OneToMany(() => ItemMedia, (media) => media.section)
  media?: ItemMedia[];

  @OneToMany(() => ThemeSectionContent, (content) => content.section)
  themeContents?: ThemeSectionContent[];
}

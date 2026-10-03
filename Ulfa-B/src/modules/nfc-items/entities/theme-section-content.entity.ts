import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Section } from './section.entity';

@Entity('theme_section_contents')
@Unique('UQ_theme_section_contents_theme_language_section', [
  'theme',
  'language',
  'sectionId',
])
@Index('IDX_theme_section_contents_theme_language', ['theme', 'language'])
export class ThemeSectionContent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  theme: string;

  @Column({ type: 'varchar', length: 16 })
  language: string;

  @Column({ name: 'section_id', type: 'uuid' })
  sectionId: string;

  @Column({ nullable: true })
  title?: string;

  @Column({ type: 'text', nullable: true })
  message?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Section, (section) => section.themeContents, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'section_id' })
  section: Section;
}

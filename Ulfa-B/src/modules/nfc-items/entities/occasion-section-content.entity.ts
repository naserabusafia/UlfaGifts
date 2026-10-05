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
import { ThemeOccasion } from './theme-occasion.entity';

/** Section title/subtitle for one occasion in one language. */
@Entity('occasion_section_contents')
@Unique('UQ_occasion_section_contents_occasion_language_section', [
  'occasionId',
  'language',
  'sectionId',
])
@Index('IDX_occasion_section_contents_occasion_language', [
  'occasionId',
  'language',
])
export class OccasionSectionContent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'occasion_id', type: 'uuid' })
  occasionId: string;

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

  @ManyToOne(() => ThemeOccasion, (occasion) => occasion.contents, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'occasion_id',
    foreignKeyConstraintName: 'FK_occasion_section_contents_occasion_id',
  })
  occasion?: ThemeOccasion;

  @ManyToOne(() => Section, (section) => section.occasionContents, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'section_id',
    foreignKeyConstraintName: 'FK_occasion_section_contents_section_id',
  })
  section: Section;
}

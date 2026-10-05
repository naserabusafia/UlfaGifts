import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Section } from './section.entity';
import { ThemeOccasion } from './theme-occasion.entity';

/** A section a new item of this occasion starts with. */
@Entity('occasion_sections')
@Unique('UQ_occasion_sections_occasion_id_section_id', [
  'occasionId',
  'sectionId',
])
@Index('IDX_occasion_sections_occasion_id_display_order', [
  'occasionId',
  'displayOrder',
])
export class OccasionSection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'occasion_id', type: 'uuid' })
  occasionId: string;

  @Column({ name: 'section_id', type: 'uuid' })
  sectionId: string;

  @Column({ name: 'display_order', type: 'integer' })
  displayOrder: number;

  @ManyToOne(() => ThemeOccasion, (occasion) => occasion.defaultSections, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'occasion_id',
    foreignKeyConstraintName: 'FK_occasion_sections_occasion_id',
  })
  occasion?: ThemeOccasion;

  @ManyToOne(() => Section, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'section_id',
    foreignKeyConstraintName: 'FK_occasion_sections_section_id',
  })
  section?: Section;
}

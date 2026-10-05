import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { OccasionSection } from './occasion-section.entity';
import { OccasionSectionContent } from './occasion-section-content.entity';
import { Theme } from './theme.entity';

/** An occasion offered by a theme, e.g. luxury/romantic or casual/birthday. */
@Entity('theme_occasions')
@Unique('UQ_theme_occasions_theme_id_key', ['themeId', 'key'])
export class ThemeOccasion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'theme_id', type: 'uuid' })
  themeId: string;

  @Column({ type: 'varchar', length: 64 })
  key: string;

  @Column()
  name: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Theme, (theme) => theme.occasions, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'theme_id',
    foreignKeyConstraintName: 'FK_theme_occasions_theme_id',
  })
  theme?: Theme;

  @OneToMany(() => OccasionSection, (section) => section.occasion)
  defaultSections?: OccasionSection[];

  @OneToMany(() => OccasionSectionContent, (content) => content.occasion)
  contents?: OccasionSectionContent[];
}

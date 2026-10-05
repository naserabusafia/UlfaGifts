import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ThemeOccasion } from './theme-occasion.entity';

/** Visual style of the NFC experience, e.g. luxury or casual. */
@Entity('themes')
@Unique('UQ_themes_key', ['key'])
export class Theme {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @OneToMany(() => ThemeOccasion, (occasion) => occasion.theme)
  occasions?: ThemeOccasion[];
}

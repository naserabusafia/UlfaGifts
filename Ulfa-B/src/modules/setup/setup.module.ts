import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItemContent } from '../nfc-items/entities/item-content.entity';
import { ItemMedia } from '../nfc-items/entities/item-media.entity';
import { ItemSection } from '../nfc-items/entities/item-section.entity';
import { NfcItem } from '../nfc-items/entities/nfc-item.entity';
import { OccasionSectionContent } from '../nfc-items/entities/occasion-section-content.entity';
import { Section } from '../nfc-items/entities/section.entity';
import { NfcItemsModule } from '../nfc-items/nfc-items.module';
import { SetupSessionGuard } from './setup-session.guard';
import { SetupController } from './setup.controller';
import { SetupService } from './setup.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NfcItem,
      ItemContent,
      ItemMedia,
      ItemSection,
      Section,
      OccasionSectionContent,
    ]),
    // A separate secret: setup sessions must never pass as dashboard logins.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: `${config.get<string>('jwt.secret')}:nfc-setup`,
      }),
    }),
    NfcItemsModule,
  ],
  controllers: [SetupController],
  providers: [SetupService, SetupSessionGuard],
})
export class SetupModule {}

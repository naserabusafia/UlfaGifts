import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersModule } from '../orders/orders.module';
import { ItemContent } from './entities/item-content.entity';
import { ItemMedia } from './entities/item-media.entity';
import { ItemSection } from './entities/item-section.entity';
import { NfcItem } from './entities/nfc-item.entity';
import { Section } from './entities/section.entity';
import { OccasionSection } from './entities/occasion-section.entity';
import { OccasionSectionContent } from './entities/occasion-section-content.entity';
import { Theme } from './entities/theme.entity';
import { ThemeOccasion } from './entities/theme-occasion.entity';
import {
  NfcItemsController,
  PublicNfcItemsController,
} from './nfc-items.controller';
import { AuthModule } from '../auth/auth.module';
import { NfcItemsService } from './nfc-items.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NfcItem,
      ItemContent,
      ItemMedia,
      Section,
      ItemSection,
      Theme,
      ThemeOccasion,
      OccasionSection,
      OccasionSectionContent,
    ]),
    OrdersModule,
    AuthModule,
  ],
  controllers: [PublicNfcItemsController, NfcItemsController],
  providers: [NfcItemsService],
  exports: [NfcItemsService],
})
export class NfcItemsModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersModule } from '../orders/orders.module';
import { ItemContent } from './entities/item-content.entity';
import { ItemMedia } from './entities/item-media.entity';
import { ItemSection } from './entities/item-section.entity';
import { NfcItem } from './entities/nfc-item.entity';
import { Section } from './entities/section.entity';
import { ThemeSectionContent } from './entities/theme-section-content.entity';
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
      ThemeSectionContent,
    ]),
    OrdersModule,
    AuthModule,
  ],
  controllers: [PublicNfcItemsController, NfcItemsController],
  providers: [NfcItemsService],
  exports: [NfcItemsService],
})
export class NfcItemsModule {}

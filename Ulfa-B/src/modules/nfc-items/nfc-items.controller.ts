import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { CreateNfcItemDto } from './dto/create-nfc-item.dto';
import { UpdateNfcItemDto } from './dto/update-nfc-item.dto';
import { VerifyViewerPasswordDto } from './dto/verify-viewer-password.dto';
import { UpsertOccasionSectionContentDto } from './dto/upsert-occasion-section-content.dto';
import { MediaType } from './entities/item-media.entity';
import { NfcItemsService } from './nfc-items.service';

@Controller('nfc-items')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class NfcItemsController {
  constructor(private readonly nfcItemsService: NfcItemsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createNfcItemDto: CreateNfcItemDto) {
    return this.nfcItemsService.create(createNfcItemDto);
  }

  @Get()
  findAll(@Query() paginationDto: PaginationDto) {
    return this.nfcItemsService.findAll(paginationDto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.nfcItemsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateNfcItemDto: UpdateNfcItemDto,
  ) {
    return this.nfcItemsService.update(id, updateNfcItemDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.nfcItemsService.remove(id);
  }

  // --- Content & Media Sub-routes ---

  @Post(':id/content')
  @HttpCode(HttpStatus.OK)
  setOrUpdateContent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('templateName') templateName: string,
    @Body('title') title?: string,
    @Body('message') message?: string,
    @Body('signature') signature?: string,
  ) {
    return this.nfcItemsService.setOrUpdateContent(
      id,
      templateName,
      title,
      message,
      signature,
    );
  }

  @Put('occasion-section-contents')
  upsertOccasionSectionContent(@Body() dto: UpsertOccasionSectionContentDto) {
    return this.nfcItemsService.upsertOccasionSectionContent(dto);
  }

  @Post(':id/media')
  @HttpCode(HttpStatus.CREATED)
  addMedia(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('mediaType') mediaType: MediaType,
    @Body('url') url: string,
    @Body('displayOrder') displayOrder: number,
    @Body('sectionId', ParseUUIDPipe) sectionId: string,
    @Body('caption') caption?: string,
    @Body('memoryDate') memoryDate?: string,
  ) {
    return this.nfcItemsService.addMedia(
      id,
      mediaType,
      url,
      displayOrder,
      sectionId,
      caption,
      memoryDate,
    );
  }

  @Delete('media/:mediaId')
  removeMedia(@Param('mediaId', ParseUUIDPipe) mediaId: string) {
    return this.nfcItemsService.removeMedia(mediaId);
  }
}

@Controller('nfc-items')
export class PublicNfcItemsController {
  constructor(private readonly nfcItemsService: NfcItemsService) {}

  // Declared before public/:nfcId so "themes" is not read as an NFC id.
  @Get('public/themes')
  findPublicThemes() {
    return this.nfcItemsService.findPublicThemes();
  }

  @Get('public/section-texts/:theme/:occasion/:language/:section')
  findPublicSectionText(
    @Param('theme') theme: string,
    @Param('occasion') occasion: string,
    @Param('language') language: string,
    @Param('section') section: string,
  ) {
    return this.nfcItemsService.findPublicSectionText(
      theme,
      occasion,
      language,
      section,
    );
  }

  @Get('public/:nfcId')
  findPublicByNfcId(@Param('nfcId') nfcId: string) {
    return this.nfcItemsService.findPublicChallenge(nfcId);
  }

  @Post('public/:nfcId/verify')
  @HttpCode(HttpStatus.OK)
  verifyViewerPassword(
    @Param('nfcId') nfcId: string,
    @Body() body: VerifyViewerPasswordDto,
  ) {
    return this.nfcItemsService.verifyViewerPassword(nfcId, body.answer);
  }
}

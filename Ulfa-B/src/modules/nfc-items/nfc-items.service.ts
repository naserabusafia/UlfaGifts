import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { In, Repository } from 'typeorm';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { OrdersService } from '../orders/orders.service';
import { CreateNfcItemDto } from './dto/create-nfc-item.dto';
import { UpdateNfcItemDto } from './dto/update-nfc-item.dto';
import { UpsertThemeSectionContentDto } from './dto/upsert-theme-section-content.dto';
import { ItemContent } from './entities/item-content.entity';
import { ItemMedia, MediaType } from './entities/item-media.entity';
import {
  DEFAULT_NFC_LANGUAGE,
  DEFAULT_NFC_THEME,
  NfcItem,
  ViewerAuthType,
} from './entities/nfc-item.entity';
import { Section } from './entities/section.entity';
import { ThemeSectionContent } from './entities/theme-section-content.entity';

@Injectable()
export class NfcItemsService {
  constructor(
    @InjectRepository(NfcItem)
    private readonly nfcItemRepository: Repository<NfcItem>,
    @InjectRepository(ItemContent)
    private readonly contentRepository: Repository<ItemContent>,
    @InjectRepository(ItemMedia)
    private readonly mediaRepository: Repository<ItemMedia>,
    @InjectRepository(Section)
    private readonly sectionRepository: Repository<Section>,
    @InjectRepository(ThemeSectionContent)
    private readonly themeSectionContentRepository: Repository<ThemeSectionContent>,
    private readonly ordersService: OrdersService,
  ) {}

  private hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  async create(createNfcItemDto: CreateNfcItemDto): Promise<NfcItem> {
    const { orderId, creatorPassword, viewerPassword, editToken, ...itemData } =
      createNfcItemDto;

    // Validate that order exists
    const order = await this.ordersService.findOne(orderId);

    // Check for unique nfc_id conflict
    const existingNfc = await this.nfcItemRepository.findOne({
      where: { nfcId: itemData.nfcId },
    });
    if (existingNfc) {
      throw new ConflictException('NFC item with this NFC ID already exists');
    }

    const itemEditToken = editToken || crypto.randomUUID();

    const creatorPasswordHash = creatorPassword
      ? this.hashPassword(creatorPassword)
      : undefined;

    const viewerPasswordHash = viewerPassword
      ? this.hashPassword(viewerPassword)
      : undefined;

    const nfcItem = this.nfcItemRepository.create({
      productName: itemData.productName,
      nfcId: itemData.nfcId,
      viewerAuthType: itemData.viewerAuthType ?? undefined,
      viewerAuthPrompt: itemData.viewerAuthPrompt ?? undefined,
      theme: itemData.theme ?? DEFAULT_NFC_THEME,
      language: itemData.language ?? DEFAULT_NFC_LANGUAGE,
      editToken: itemEditToken,
      creatorPasswordHash,
      viewerPasswordHash,
      order,
    });

    const savedItem = await this.nfcItemRepository.save(nfcItem);
    delete (savedItem as any).creatorPasswordHash;
    delete (savedItem as any).viewerPasswordHash;

    return savedItem;
  }

  async findAll(paginationDto: PaginationDto) {
    const { page = 1, limit = 10, search } = paginationDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.nfcItemRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.order', 'order')
      .leftJoinAndSelect('item.content', 'content')
      .leftJoinAndSelect('item.media', 'media');

    if (search) {
      queryBuilder.where(
        'item.productName ILIKE :search OR item.nfcId ILIKE :search OR order.customerPhone ILIKE :search',
        { search: `%${search}%` },
      );
    }

    queryBuilder.skip(skip).take(limit).orderBy('item.createdAt', 'DESC');

    const [items, total] = await queryBuilder.getManyAndCount();

    items.forEach((item) => {
      delete (item as any).creatorPasswordHash;
      delete (item as any).viewerPasswordHash;
      if (item.order && item.order.merchant) {
        delete (item.order.merchant as any).passwordHash;
      }
    });

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<NfcItem> {
    const item = await this.nfcItemRepository.findOne({
      where: { id },
      relations: { order: { merchant: true }, content: true, media: true },
    });

    if (!item) {
      throw new NotFoundException(`NFC Item with ID "${id}" not found`);
    }

    delete (item as any).creatorPasswordHash;
    delete (item as any).viewerPasswordHash;
    return item;
  }

  async findPublicChallenge(nfcId: string) {
    const item = await this.nfcItemRepository.findOne({
      where: { nfcId },
    });

    if (!item) {
      throw new NotFoundException(`NFC Item with NFC ID "${nfcId}" not found`);
    }

    if (item.isLocked) {
      throw new ForbiddenException('NFC_ITEM_INACTIVE');
    }

    return {
      nfcId: item.nfcId,
      viewerAuthType: item.viewerAuthType,
      viewerAuthPrompt: item.viewerAuthPrompt,
      theme: item.theme ?? DEFAULT_NFC_THEME,
      language: item.language ?? DEFAULT_NFC_LANGUAGE,
    };
  }

  async verifyViewerPassword(nfcId: string, answer: string) {
    const item = await this.nfcItemRepository.findOne({
      where: { nfcId },
      relations: {
        content: true,
        media: { section: true },
        itemSections: { section: true },
      },
    });

    if (!item) {
      throw new NotFoundException(`NFC Item with NFC ID "${nfcId}" not found`);
    }

    if (item.isLocked) {
      throw new ForbiddenException('NFC_ITEM_INACTIVE');
    }

    if (item.viewerAuthType !== ViewerAuthType.NONE) {
      if (!item.viewerPasswordHash) {
        throw new ForbiddenException('Viewer password is not configured');
      }
      const expected = Buffer.from(item.viewerPasswordHash, 'hex');
      const actual = Buffer.from(this.hashPassword(answer), 'hex');
      if (
        expected.length !== actual.length ||
        !crypto.timingSafeEqual(expected, actual)
      ) {
        throw new ForbiddenException('Incorrect password');
      }
    }

    delete item.creatorPasswordHash;
    delete item.viewerPasswordHash;
    delete item.editToken;

    // Visible sections in display order, each with its own media files.
    const media = [...(item.media ?? [])].sort(
      (a, b) => a.displayOrder - b.displayOrder,
    );
    const sections: {
      id: string;
      key: string;
      name: string;
      displayOrder?: number;
      media: ItemMedia[];
    }[] = [...(item.itemSections ?? [])]
      .filter((is) => is.isVisible && is.section?.isActive)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((is) => ({
        id: is.section.id,
        key: is.section.key,
        name: is.section.name,
        displayOrder: is.displayOrder,
        media: media.filter((m) => m.sectionId === is.sectionId),
      }));

    // Legacy/demo items may have wheel photos before an item_sections row.
    // An explicit hidden/inactive configuration must never be resurrected.
    const wheel = media.find(
      (m) =>
        m.mediaType === MediaType.IMAGE &&
        m.section?.key === 'photo_wheel' &&
        m.section.isActive,
    )?.section;
    if (
      wheel &&
      !(item.itemSections ?? []).some((s) => s.sectionId === wheel.id)
    ) {
      sections.push({
        id: wheel.id,
        key: wheel.key,
        name: wheel.name,
        displayOrder: undefined,
        media: media.filter((m) => m.sectionId === wheel.id),
      });
    }

    const texts = sections.length
      ? await this.themeSectionContentRepository.find({
          where: {
            theme: item.theme ?? DEFAULT_NFC_THEME,
            language: item.language ?? DEFAULT_NFC_LANGUAGE,
            sectionId: In(sections.map((s) => s.id)),
          },
        })
      : [];
    delete item.itemSections;

    return {
      ...item,
      sections: sections.map((section) => {
        const text = texts.find((t) => t.sectionId === section.id);
        return {
          ...section,
          title: text?.title ?? null,
          message: text?.message ?? null,
        };
      }),
    };
  }

  async findByEditToken(editToken: string): Promise<NfcItem> {
    const item = await this.nfcItemRepository.findOne({
      where: { editToken },
      relations: { content: true, media: true },
    });

    if (!item) {
      throw new NotFoundException('Invalid edit token');
    }

    if (item.isLocked) {
      throw new ForbiddenException('NFC_ITEM_INACTIVE');
    }

    delete (item as any).creatorPasswordHash;
    delete (item as any).viewerPasswordHash;

    return item;
  }

  async update(
    id: string,
    updateNfcItemDto: UpdateNfcItemDto,
  ): Promise<NfcItem> {
    const item = await this.nfcItemRepository.findOne({
      where: { id },
      relations: { order: true },
    });
    if (!item) {
      throw new NotFoundException(`NFC Item with ID "${id}" not found`);
    }

    if (item.isLocked) {
      throw new BadRequestException('Cannot edit a locked NFC item');
    }

    const { orderId, creatorPassword, viewerPassword, ...itemData } =
      updateNfcItemDto;

    if (orderId) {
      const order = await this.ordersService.findOne(orderId);
      item.order = order;
    }

    if (creatorPassword) {
      item.creatorPasswordHash = this.hashPassword(creatorPassword);
    }

    if (viewerPassword) {
      item.viewerPasswordHash = this.hashPassword(viewerPassword);
    }

    Object.assign(item, {
      productName: itemData.productName ?? item.productName,
      nfcId: itemData.nfcId ?? item.nfcId,
      viewerAuthType: itemData.viewerAuthType ?? item.viewerAuthType,
      viewerAuthPrompt: itemData.viewerAuthPrompt ?? item.viewerAuthPrompt,
      theme: itemData.theme ?? item.theme,
      language: itemData.language ?? item.language,
      isLocked: itemData.isLocked ?? item.isLocked,
    });

    const updated = await this.nfcItemRepository.save(item);

    delete (updated as any).creatorPasswordHash;
    delete (updated as any).viewerPasswordHash;
    return updated;
  }

  async remove(id: string): Promise<{ message: string }> {
    const item = await this.findOne(id);
    await this.nfcItemRepository.remove(item);
    return {
      message: `NFC Item with ID "${id}" has been deleted successfully`,
    };
  }

  // --- Item Content Management (One-to-One) ---

  async setOrUpdateContent(
    itemId: string,
    templateName: string,
    title?: string,
    message?: string,
    signature?: string,
  ): Promise<ItemContent> {
    const item = await this.findOne(itemId);

    if (item.isLocked) {
      throw new BadRequestException(
        'Cannot update content on a locked NFC item',
      );
    }

    let content = await this.contentRepository.findOne({
      where: { itemId },
    });

    if (!content) {
      content = this.contentRepository.create({
        itemId,
        templateName,
        title: title ?? undefined,
        message: message ?? undefined,
        signature: signature ?? undefined,
      });
    } else {
      content.templateName = templateName;
      content.title = title ?? content.title;
      content.message = message ?? content.message;
      content.signature = signature ?? content.signature;
    }

    return await this.contentRepository.save(content);
  }

  async upsertThemeSectionContent(
    dto: UpsertThemeSectionContentDto,
  ): Promise<ThemeSectionContent> {
    const section = await this.sectionRepository.findOneBy({
      id: dto.sectionId,
    });
    if (!section) {
      throw new NotFoundException(
        `Section with ID "${dto.sectionId}" not found`,
      );
    }

    let content = await this.themeSectionContentRepository.findOneBy({
      theme: dto.theme,
      language: dto.language,
      sectionId: dto.sectionId,
    });

    if (!content) {
      content = this.themeSectionContentRepository.create({
        ...dto,
        section,
      });
    } else {
      content.title = dto.title;
      content.message = dto.message;
    }

    return this.themeSectionContentRepository.save(content);
  }

  // --- Item Media Management (One-to-Many) ---

  async addMedia(
    itemId: string,
    mediaType: MediaType,
    url: string,
    displayOrder: number,
    sectionId: string,
    caption?: string,
  ): Promise<ItemMedia> {
    const item = await this.findOne(itemId);
    const section = await this.sectionRepository.findOneBy({ id: sectionId });
    if (!section) {
      throw new NotFoundException(`Section with ID "${sectionId}" not found`);
    }

    if (item.isLocked) {
      throw new BadRequestException('Cannot add media to a locked NFC item');
    }

    const media = this.mediaRepository.create({
      mediaType,
      url,
      displayOrder,
      caption: caption ?? undefined,
      section,
      nfcItem: item,
    });

    return await this.mediaRepository.save(media);
  }

  async removeMedia(mediaId: string): Promise<{ message: string }> {
    const media = await this.mediaRepository.findOne({
      where: { id: mediaId },
      relations: { nfcItem: true },
    });

    if (!media) {
      throw new NotFoundException(
        `Media attachment with ID "${mediaId}" not found`,
      );
    }

    if (media.nfcItem && media.nfcItem.isLocked) {
      throw new BadRequestException(
        'Cannot delete media from a locked NFC item',
      );
    }

    await this.mediaRepository.remove(media);
    return { message: 'Media attachment deleted successfully' };
  }
}

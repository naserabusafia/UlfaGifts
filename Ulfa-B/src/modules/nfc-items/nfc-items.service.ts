import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { In, Repository } from 'typeorm';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { OrdersService } from '../orders/orders.service';
import { CreateNfcItemDto } from './dto/create-nfc-item.dto';
import { UpdateNfcItemDto } from './dto/update-nfc-item.dto';
import { UpsertOccasionSectionContentDto } from './dto/upsert-occasion-section-content.dto';
import { ItemContent } from './entities/item-content.entity';
import {
  ItemMedia,
  MediaStatus,
  MediaType,
} from './entities/item-media.entity';
import {
  DEFAULT_NFC_LANGUAGE,
  DEFAULT_NFC_OCCASION,
  DEFAULT_NFC_THEME,
  NfcItem,
  ViewerAuthType,
} from './entities/nfc-item.entity';
import { Section } from './entities/section.entity';
import { OccasionSection } from './entities/occasion-section.entity';
import { OccasionSectionContent } from './entities/occasion-section-content.entity';
import { Theme } from './entities/theme.entity';
import { ThemeOccasion } from './entities/theme-occasion.entity';
import { StorageService } from '../storage/storage.service';
import {
  LOCKOUT_MINUTES,
  MAX_FAILED_ATTEMPTS,
  normalizeViewerSecret,
  viewerSecretProblem,
} from './utils/viewer-secret.util';

const BCRYPT_ROUNDS = 10;
const LEGACY_SHA256 = /^[0-9a-f]{64}$/;

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
    @InjectRepository(OccasionSectionContent)
    private readonly occasionContentRepository: Repository<OccasionSectionContent>,
    @InjectRepository(Theme)
    private readonly themeRepository: Repository<Theme>,
    @InjectRepository(ThemeOccasion)
    private readonly occasionRepository: Repository<ThemeOccasion>,
    @InjectRepository(OccasionSection)
    private readonly occasionSectionRepository: Repository<OccasionSection>,
    private readonly ordersService: OrdersService,
    private readonly storage: StorageService,
  ) {}

  private hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  /** Validates and hashes a new viewer answer in its canonical form. */
  private async hashViewerSecret(
    type: ViewerAuthType,
    answer: string,
  ): Promise<string> {
    const normalized = normalizeViewerSecret(type, answer);
    const problem = viewerSecretProblem(type, normalized);
    if (problem) {
      throw new BadRequestException(problem);
    }
    return this.hashPassword(normalized);
  }

  /**
   * Checks a viewer answer against the stored hash. Hashes written before
   * bcrypt are unsalted SHA-256 of the raw answer; they are upgraded in place
   * on the first correct answer.
   */
  private async matchesViewerSecret(
    item: NfcItem,
    answer: string,
  ): Promise<boolean> {
    const stored = item.viewerPasswordHash!;
    // Encrypted items: the browser sends a key derived from the normalized
    // answer, never the answer itself.
    if (item.wrappedKey) {
      return bcrypt.compare(answer, stored);
    }
    const normalized = normalizeViewerSecret(item.viewerAuthType, answer);
    if (!LEGACY_SHA256.test(stored)) {
      return bcrypt.compare(normalized, stored);
    }
    const expected = Buffer.from(stored, 'hex');
    const matches = [answer, normalized].some((candidate) =>
      crypto.timingSafeEqual(
        expected,
        crypto.createHash('sha256').update(candidate).digest(),
      ),
    );
    if (matches) {
      await this.nfcItemRepository.update(item.id, {
        viewerPasswordHash: await this.hashPassword(normalized),
      });
    }
    return matches;
  }

  /**
   * Throws unless the answer matches. Five wrong answers in a row lock the
   * item for 15 minutes; viewer and setup share this counter.
   */
  async checkViewerAnswer(item: NfcItem, answer: string): Promise<void> {
    if (!item.viewerPasswordHash) {
      throw new ForbiddenException('Viewer password is not configured');
    }
    this.assertNotLockedOut(item);
    if (!(await this.matchesViewerSecret(item, answer))) {
      await this.recordFailedAttempt(item);
    }
    await this.clearFailedAttempts(item);
  }

  assertNotLockedOut(item: NfcItem): void {
    if (item.lockedUntil && item.lockedUntil.getTime() > Date.now()) {
      throw this.tooManyAttempts();
    }
  }

  /** Counts a wrong answer and throws 403, or 429 once the limit is hit. */
  async recordFailedAttempt(item: NfcItem): Promise<never> {
    // An expired lock starts a fresh count.
    const failed = (item.lockedUntil ? 0 : (item.failedAttempts ?? 0)) + 1;
    const lockedUntil =
      failed >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
        : null;
    await this.nfcItemRepository.update(item.id, {
      failedAttempts: failed,
      lockedUntil,
    });
    throw lockedUntil
      ? this.tooManyAttempts()
      : new ForbiddenException('Incorrect password');
  }

  async clearFailedAttempts(item: NfcItem): Promise<void> {
    if (item.failedAttempts || item.lockedUntil) {
      await this.nfcItemRepository.update(item.id, {
        failedAttempts: 0,
        lockedUntil: null,
      });
    }
  }

  /** The buyer has started setup but not published it yet. */
  isPreparing(item: NfcItem): boolean {
    return !!item.keySalt && !item.publishedAt;
  }

  /**
   * Media as the browser needs it: encrypted objects get short-lived signed
   * URLs (ciphertext, decrypted client-side); legacy media keep their URL.
   */
  async presentMedia(media: ItemMedia) {
    const encrypted = !!media.storageKey;
    const url = encrypted
      ? await this.storage.presignDownload(media.storageKey!)
      : (media.url ?? '');
    const thumbnailUrl =
      encrypted && media.thumbKey
        ? await this.storage.presignDownload(media.thumbKey)
        : null;
    return {
      id: media.id,
      mediaType: media.mediaType,
      url,
      fullUrl: url,
      thumbnailUrl,
      caption: media.caption ?? null,
      memoryDate: media.memoryDate ?? null,
      displayOrder: media.displayOrder,
      sectionId: media.sectionId ?? null,
      mime: media.mime ?? null,
      encrypted,
    };
  }

  private async resolveOccasion(
    themeKey: string,
    occasionKey: string,
  ): Promise<ThemeOccasion> {
    const occasion = await this.occasionRepository.findOne({
      where: {
        key: occasionKey,
        isActive: true,
        theme: { key: themeKey, isActive: true },
      },
      relations: { theme: true },
    });
    if (!occasion) {
      throw new BadRequestException(
        `Occasion "${occasionKey}" is not available for theme "${themeKey}"`,
      );
    }
    return occasion;
  }

  // Theme/occasion keys as the viewer sees them; the item stores only occasion_id.
  private appearance(item: NfcItem) {
    return {
      theme: item.occasion?.theme?.key ?? DEFAULT_NFC_THEME,
      occasion: item.occasion?.key ?? DEFAULT_NFC_OCCASION,
      language: item.language ?? DEFAULT_NFC_LANGUAGE,
    };
  }

  async findPublicThemes() {
    const themes = await this.themeRepository.find({
      where: { isActive: true },
      relations: { occasions: true },
      order: { key: 'ASC' },
    });
    return themes.map((theme) => ({
      key: theme.key,
      name: theme.name,
      occasions: (theme.occasions ?? [])
        .filter((occasion) => occasion.isActive)
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((occasion) => ({ key: occasion.key, name: occasion.name })),
    }));
  }

  async findPublicSectionText(
    theme: string,
    occasion: string,
    language: string,
    sectionKey: string,
  ) {
    const text = await this.occasionContentRepository.findOne({
      where: {
        language,
        section: { key: sectionKey, isActive: true },
        occasion: { key: occasion, theme: { key: theme } },
      },
    });
    return { title: text?.title ?? null, message: text?.message ?? null };
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
      ? await this.hashPassword(creatorPassword)
      : undefined;

    const viewerPasswordHash = viewerPassword
      ? await this.hashViewerSecret(
          itemData.viewerAuthType ?? ViewerAuthType.NONE,
          viewerPassword,
        )
      : undefined;

    const occasion = await this.resolveOccasion(
      itemData.theme ?? DEFAULT_NFC_THEME,
      itemData.occasion ?? DEFAULT_NFC_OCCASION,
    );
    // A new item starts with its occasion's default sections.
    const defaultSections = await this.occasionSectionRepository.find({
      where: { occasionId: occasion.id },
      order: { displayOrder: 'ASC' },
    });

    const nfcItem = this.nfcItemRepository.create({
      productName: itemData.productName,
      nfcId: itemData.nfcId,
      viewerAuthType: itemData.viewerAuthType ?? undefined,
      viewerAuthPrompt: itemData.viewerAuthPrompt ?? undefined,
      occasion,
      language: itemData.language ?? DEFAULT_NFC_LANGUAGE,
      itemSections: defaultSections.map((section) => ({
        sectionId: section.sectionId,
        displayOrder: section.displayOrder,
        isVisible: true,
      })),
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
      relations: { occasion: { theme: true } },
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
      preparing: this.isPreparing(item),
      // Needed before verifying: the browser derives its auth key from it.
      encryption: item.keySalt
        ? { keySalt: item.keySalt, kdfIterations: item.kdfIterations }
        : null,
      ...this.appearance(item),
    };
  }

  async verifyViewerPassword(nfcId: string, answer: string) {
    const item = await this.nfcItemRepository.findOne({
      where: { nfcId },
      relations: {
        content: true,
        media: { section: true },
        itemSections: { section: true },
        occasion: { theme: true },
      },
    });

    if (!item) {
      throw new NotFoundException(`NFC Item with NFC ID "${nfcId}" not found`);
    }

    if (item.isLocked) {
      throw new ForbiddenException('NFC_ITEM_INACTIVE');
    }

    if (this.isPreparing(item)) {
      throw new ForbiddenException('NFC_ITEM_PREPARING');
    }

    if (item.viewerAuthType !== ViewerAuthType.NONE) {
      await this.checkViewerAnswer(item, answer);
    }

    delete item.creatorPasswordHash;
    delete item.viewerPasswordHash;
    delete item.editToken;
    delete (item as Partial<NfcItem>).failedAttempts;
    delete item.lockedUntil;
    delete item.recoveryHash;
    delete item.recoveryWrappedKey;

    // Visible sections in display order, each with its own media files.
    const media = (item.media ?? [])
      .filter((m) => m.status !== MediaStatus.PENDING)
      .sort((a, b) => a.displayOrder - b.displayOrder);
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

    const texts =
      sections.length && item.occasionId
        ? await this.occasionContentRepository.find({
            where: {
              occasionId: item.occasionId,
              language: item.language ?? DEFAULT_NFC_LANGUAGE,
              sectionId: In(sections.map((s) => s.id)),
            },
          })
        : [];
    const appearance = this.appearance(item);
    delete item.itemSections;
    delete item.occasion;
    delete item.media;

    return {
      ...item,
      ...appearance,
      sections: await Promise.all(
        sections.map(async (section) => {
          const text = texts.find((t) => t.sectionId === section.id);
          return {
            ...section,
            media: await Promise.all(
              section.media.map((m) => this.presentMedia(m)),
            ),
            title: text?.title ?? null,
            message: text?.message ?? null,
          };
        }),
      ),
    };
  }

  async update(
    id: string,
    updateNfcItemDto: UpdateNfcItemDto,
  ): Promise<NfcItem> {
    const item = await this.nfcItemRepository.findOne({
      where: { id },
      relations: { order: true, occasion: { theme: true } },
    });
    if (!item) {
      throw new NotFoundException(`NFC Item with ID "${id}" not found`);
    }

    if (item.isLocked) {
      throw new BadRequestException('Cannot edit a locked NFC item');
    }

    if (updateNfcItemDto.theme || updateNfcItemDto.occasion) {
      const occasion = await this.resolveOccasion(
        updateNfcItemDto.theme ??
          item.occasion?.theme?.key ??
          DEFAULT_NFC_THEME,
        updateNfcItemDto.occasion ?? item.occasion?.key ?? DEFAULT_NFC_OCCASION,
      );
      item.occasion = occasion;
      item.occasionId = occasion.id;
    }

    const { orderId, creatorPassword, viewerPassword, ...itemData } =
      updateNfcItemDto;

    if (orderId) {
      const order = await this.ordersService.findOne(orderId);
      item.order = order;
    }

    if (creatorPassword) {
      item.creatorPasswordHash = await this.hashPassword(creatorPassword);
    }

    if (viewerPassword) {
      item.viewerPasswordHash = await this.hashViewerSecret(
        itemData.viewerAuthType ?? item.viewerAuthType,
        viewerPassword,
      );
      item.failedAttempts = 0;
      item.lockedUntil = null;
    }

    Object.assign(item, {
      productName: itemData.productName ?? item.productName,
      nfcId: itemData.nfcId ?? item.nfcId,
      viewerAuthType: itemData.viewerAuthType ?? item.viewerAuthType,
      viewerAuthPrompt: itemData.viewerAuthPrompt ?? item.viewerAuthPrompt,
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
    // The database cascade cannot reach storage: delete the files first.
    await this.storage.deleteMany(
      (item.media ?? []).flatMap((m) => [m.storageKey, m.thumbKey] as string[]),
    );
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

  async upsertOccasionSectionContent(
    dto: UpsertOccasionSectionContentDto,
  ): Promise<OccasionSectionContent> {
    const occasion = await this.occasionRepository.findOneBy({
      id: dto.occasionId,
    });
    if (!occasion) {
      throw new NotFoundException(
        `Occasion with ID "${dto.occasionId}" not found`,
      );
    }
    const section = await this.sectionRepository.findOneBy({
      id: dto.sectionId,
    });
    if (!section) {
      throw new NotFoundException(
        `Section with ID "${dto.sectionId}" not found`,
      );
    }

    let content = await this.occasionContentRepository.findOneBy({
      occasionId: dto.occasionId,
      language: dto.language,
      sectionId: dto.sectionId,
    });

    if (!content) {
      content = this.occasionContentRepository.create({
        ...dto,
        section,
        occasion,
      });
    } else {
      content.title = dto.title;
      content.message = dto.message;
    }

    return this.occasionContentRepository.save(content);
  }

  // --- Item Media Management (One-to-Many) ---

  async addMedia(
    itemId: string,
    mediaType: MediaType,
    url: string,
    displayOrder: number,
    sectionId: string,
    caption?: string,
    memoryDate?: string,
  ): Promise<ItemMedia> {
    if (
      memoryDate &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(memoryDate) ||
        Number.isNaN(Date.parse(`${memoryDate}T00:00:00Z`)))
    ) {
      throw new BadRequestException('memoryDate must be a YYYY-MM-DD date');
    }

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
      memoryDate: memoryDate ?? null,
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

    await this.storage.deleteMany(
      [media.storageKey, media.thumbKey].filter(Boolean) as string[],
    );
    await this.mediaRepository.remove(media);
    return { message: 'Media attachment deleted successfully' };
  }

  private tooManyAttempts(): HttpException {
    return new HttpException('TOO_MANY_ATTEMPTS', HttpStatus.TOO_MANY_REQUESTS);
  }
}

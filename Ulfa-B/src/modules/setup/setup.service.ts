import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { In, LessThan, Repository } from 'typeorm';
import { ItemContent } from '../nfc-items/entities/item-content.entity';
import {
  ItemMedia,
  MediaStatus,
  MediaType,
} from '../nfc-items/entities/item-media.entity';
import { ItemSection } from '../nfc-items/entities/item-section.entity';
import {
  DEFAULT_NFC_LANGUAGE,
  NfcItem,
  ViewerAuthType,
} from '../nfc-items/entities/nfc-item.entity';
import { OccasionSectionContent } from '../nfc-items/entities/occasion-section-content.entity';
import { Section } from '../nfc-items/entities/section.entity';
import { NfcItemsService } from '../nfc-items/nfc-items.service';
import { StorageService } from '../storage/storage.service';
import {
  ContentDto,
  CreateMediaDto,
  LockDto,
  MediaOrderDto,
  SectionsDto,
  SettingsDto,
  UpdateMediaDto,
} from './dto/setup.dto';
import type { SetupSession } from './setup-session.guard';

/** Sections the buyer can add after the (always first) message. */
export const SETUP_SECTIONS: Record<
  string,
  { mediaType: MediaType; maxItems: number; maxBytes: number }
> = {
  photo_wheel: { mediaType: MediaType.IMAGE, maxItems: 500, maxBytes: 6 << 20 },
  voice_note: {
    mediaType: MediaType.VOICE_NOTE,
    maxItems: 5,
    maxBytes: 16 << 20,
  },
  memory_calendar: {
    mediaType: MediaType.IMAGE,
    maxItems: 366,
    maxBytes: 6 << 20,
  },
  film_strip: { mediaType: MediaType.IMAGE, maxItems: 200, maxBytes: 6 << 20 },
};
const MAX_THUMB_BYTES = 1 << 20;
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_TTL = '2h';

const sha256 = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex');

@Injectable()
export class SetupService {
  constructor(
    @InjectRepository(NfcItem)
    private readonly items: Repository<NfcItem>,
    @InjectRepository(ItemContent)
    private readonly contents: Repository<ItemContent>,
    @InjectRepository(ItemMedia)
    private readonly media: Repository<ItemMedia>,
    @InjectRepository(Section)
    private readonly sections: Repository<Section>,
    @InjectRepository(ItemSection)
    private readonly itemSections: Repository<ItemSection>,
    @InjectRepository(OccasionSectionContent)
    private readonly texts: Repository<OccasionSectionContent>,
    private readonly nfcItems: NfcItemsService,
    private readonly storage: StorageService,
    private readonly jwt: JwtService,
  ) {}

  private async item(token: string): Promise<NfcItem> {
    const item = await this.items.findOne({
      where: { editToken: token },
      relations: { occasion: { theme: true } },
    });
    if (!item) throw new NotFoundException('Invalid setup link');
    if (item.isLocked) throw new ForbiddenException('NFC_ITEM_INACTIVE');
    return item;
  }

  private sessionFor(item: NfcItem) {
    return this.jwt.sign(
      {
        sub: item.id,
        tok: item.editToken!,
        typ: 'setup',
      } satisfies SetupSession,
      { expiresIn: SESSION_TTL },
    );
  }

  private state(item: NfcItem) {
    return {
      productName: item.productName,
      nfcId: item.nfcId,
      hasSecret: !!item.keySalt,
      viewerAuthType: item.keySalt ? item.viewerAuthType : null,
      viewerAuthPrompt: item.keySalt ? (item.viewerAuthPrompt ?? null) : null,
      encryption: item.keySalt
        ? { keySalt: item.keySalt, kdfIterations: item.kdfIterations }
        : null,
      published: !!item.publishedAt,
      theme: item.occasion?.theme?.key ?? null,
      occasion: item.occasion?.key ?? null,
      language: item.language ?? DEFAULT_NFC_LANGUAGE,
    };
  }

  // --- access ----------------------------------------------------------------

  async getState(token: string) {
    return this.state(await this.item(token));
  }

  /**
   * Sets the answer the recipient must know. The first time anyone with the
   * link may do it; afterwards it needs a setup session.
   */
  async lock(token: string, dto: LockDto, session: SetupSession | null) {
    const item = await this.item(token);
    const first = !item.keySalt;
    if (!first && session?.sub !== item.id) {
      throw new ForbiddenException('SETUP_SESSION_REQUIRED');
    }
    const prompt = dto.viewerAuthPrompt?.trim() || null;
    if (dto.viewerAuthType === ViewerAuthType.TEXT && !prompt) {
      throw new BadRequestException('A question is required for a text answer');
    }
    if (first && (!dto.recoveryWrappedKey || !dto.recoveryAuthKey)) {
      throw new BadRequestException('A recovery code is required');
    }
    Object.assign(item, {
      viewerAuthType: dto.viewerAuthType,
      viewerAuthPrompt: prompt,
      viewerPasswordHash: await bcrypt.hash(dto.authKey, 10),
      keySalt: dto.keySalt,
      kdfIterations: dto.kdfIterations,
      wrappedKey: dto.wrappedKey,
      failedAttempts: 0,
      lockedUntil: null,
    });
    if (dto.recoveryWrappedKey && dto.recoveryAuthKey) {
      item.recoveryWrappedKey = dto.recoveryWrappedKey;
      item.recoveryHash = sha256(dto.recoveryAuthKey);
    }
    await this.items.save(item);
    return { ...this.state(item), session: this.sessionFor(item) };
  }

  async openSession(token: string, authKey: string) {
    const item = await this.item(token);
    if (!item.keySalt || !item.viewerPasswordHash) {
      throw new BadRequestException('SETUP_NOT_LOCKED');
    }
    this.nfcItems.assertNotLockedOut(item);
    if (!(await bcrypt.compare(authKey, item.viewerPasswordHash))) {
      await this.nfcItems.recordFailedAttempt(item);
    }
    await this.nfcItems.clearFailedAttempts(item);
    await this.removeStalePending(item.id);
    return {
      session: this.sessionFor(item),
      wrappedKey: item.wrappedKey,
    };
  }

  async recover(token: string, recoveryAuthKey: string) {
    const item = await this.item(token);
    if (!item.recoveryHash) throw new BadRequestException('SETUP_NOT_LOCKED');
    this.nfcItems.assertNotLockedOut(item);
    const expected = Buffer.from(item.recoveryHash, 'hex');
    const actual = Buffer.from(sha256(recoveryAuthKey), 'hex');
    if (!crypto.timingSafeEqual(expected, actual)) {
      await this.nfcItems.recordFailedAttempt(item);
    }
    await this.nfcItems.clearFailedAttempts(item);
    return {
      session: this.sessionFor(item),
      recoveryWrappedKey: item.recoveryWrappedKey,
    };
  }

  // --- draft -------------------------------------------------------------------

  async draft(token: string) {
    const item = await this.item(token);
    const [content, catalog, chosen, media] = await Promise.all([
      this.contents.findOneBy({ itemId: item.id }),
      this.catalog(),
      this.itemSections.find({ where: { itemId: item.id } }),
      this.media.find({
        where: { itemId: item.id, status: MediaStatus.READY },
        relations: { section: true },
        order: { displayOrder: 'ASC' },
      }),
    ]);
    const texts = catalog.length
      ? await this.texts.find({
          where: {
            occasionId: item.occasionId,
            language: item.language ?? DEFAULT_NFC_LANGUAGE,
            sectionId: In(catalog.map((s) => s.id)),
          },
        })
      : [];
    const sections = catalog
      .map((section, index) => {
        const row = chosen.find((c) => c.sectionId === section.id);
        const text = texts.find((t) => t.sectionId === section.id);
        return {
          id: section.id,
          key: section.key,
          name: section.name,
          title: text?.title ?? null,
          message: text?.message ?? null,
          isVisible: row?.isVisible ?? false,
          displayOrder: row?.displayOrder ?? 100 + index,
        };
      })
      .sort((a, b) => a.displayOrder - b.displayOrder);
    return {
      ...this.state(item),
      content: content
        ? {
            title: content.title ?? null,
            message: content.message ?? null,
            signature: content.signature ?? null,
            isEncrypted: content.isEncrypted,
          }
        : null,
      sections,
      media: await Promise.all(
        media.map(async (m) => ({
          ...(await this.nfcItems.presentMedia(m)),
          sectionKey: m.section?.key ?? null,
        })),
      ),
    };
  }

  private catalog(): Promise<Section[]> {
    return this.sections.find({
      where: { key: In(Object.keys(SETUP_SECTIONS)), isActive: true },
      order: { createdAt: 'ASC' },
    });
  }

  async updateSettings(token: string, dto: SettingsDto) {
    const item = await this.item(token);
    item.language = dto.language;
    await this.items.save(item);
    return this.draft(token);
  }

  /** Order and visibility; the message is implicit and always first. */
  async updateSections(token: string, dto: SectionsDto) {
    const item = await this.item(token);
    const catalog = await this.catalog();
    const keys = dto.sections.map((s) => s.key);
    if (new Set(keys).size !== keys.length) {
      throw new BadRequestException('Duplicate section');
    }
    const rows = dto.sections.map((choice, index) => {
      const section = catalog.find((s) => s.key === choice.key);
      if (!section) {
        throw new BadRequestException(`Unknown section "${choice.key}"`);
      }
      return {
        itemId: item.id,
        sectionId: section.id,
        displayOrder: index + 1,
        isVisible: choice.isVisible,
      };
    });
    if (rows.length) {
      await this.itemSections.upsert(rows, ['itemId', 'sectionId']);
    }
    return this.draft(token);
  }

  async updateContent(token: string, dto: ContentDto) {
    const item = await this.item(token);
    const content =
      (await this.contents.findOneBy({ itemId: item.id })) ??
      this.contents.create({ itemId: item.id, templateName: 'default' });
    Object.assign(content, {
      title: dto.title ?? null,
      message: dto.message,
      signature: dto.signature ?? null,
      isEncrypted: true,
    });
    await this.contents.save(content);
    return { saved: true };
  }

  async publish(token: string) {
    const item = await this.item(token);
    const content = await this.contents.findOneBy({ itemId: item.id });
    if (!content?.message) {
      throw new BadRequestException(
        'The message is required before publishing',
      );
    }
    if (!item.publishedAt) {
      item.publishedAt = new Date();
      await this.items.save(item);
    }
    return this.state(item);
  }

  // --- media -------------------------------------------------------------------

  /**
   * Reserves a media row and returns signed upload URLs. The row stays
   * PENDING (invisible to the recipient) until complete() checks the sizes.
   */
  async createMedia(token: string, dto: CreateMediaDto) {
    const item = await this.item(token);
    const rules = SETUP_SECTIONS[dto.sectionKey];
    const section = rules
      ? await this.sections.findOneBy({ key: dto.sectionKey, isActive: true })
      : null;
    if (!rules || !section) {
      throw new BadRequestException(`Unknown section "${dto.sectionKey}"`);
    }
    const isImage = rules.mediaType === MediaType.IMAGE;
    if (!dto.mime.startsWith(isImage ? 'image/' : 'audio/')) {
      throw new BadRequestException('Wrong media type for this section');
    }
    if (dto.bytes > rules.maxBytes)
      throw new BadRequestException('File is too large');
    if (isImage && (!dto.thumbBytes || dto.thumbBytes > MAX_THUMB_BYTES)) {
      throw new BadRequestException('A thumbnail is required');
    }
    if (
      dto.memoryDate &&
      Number.isNaN(Date.parse(`${dto.memoryDate}T00:00:00Z`))
    ) {
      throw new BadRequestException('memoryDate must be a YYYY-MM-DD date');
    }
    const count = await this.media.countBy({
      itemId: item.id,
      sectionId: section.id,
    });
    if (count >= rules.maxItems) {
      throw new BadRequestException(
        `This section holds at most ${rules.maxItems} items`,
      );
    }

    const id = crypto.randomUUID();
    const base = `items/${item.id}/${id}`;
    const row = this.media.create({
      id,
      itemId: item.id,
      sectionId: section.id,
      mediaType: rules.mediaType,
      url: null,
      storageKey: `${base}/full`,
      thumbKey: isImage ? `${base}/thumb` : null,
      mime: dto.mime,
      bytes: dto.bytes,
      thumbBytes: isImage ? dto.thumbBytes : null,
      displayOrder: dto.displayOrder,
      caption: dto.caption ?? undefined,
      memoryDate: dto.memoryDate ?? null,
      status: MediaStatus.PENDING,
    });
    await this.media.insert(row);
    return {
      id,
      uploads: {
        full: await this.storage.presignUpload(row.storageKey!, dto.bytes),
        thumb: row.thumbKey
          ? await this.storage.presignUpload(row.thumbKey, dto.thumbBytes!)
          : null,
      },
    };
  }

  private async ownMedia(token: string, id: string) {
    const item = await this.item(token);
    const media = await this.media.findOne({
      where: { id, itemId: item.id },
      relations: { section: true },
    });
    if (!media) throw new NotFoundException('Media not found');
    return media;
  }

  private async present(media: ItemMedia) {
    return {
      ...(await this.nfcItems.presentMedia(media)),
      sectionKey: media.section?.key ?? null,
    };
  }

  async completeMedia(token: string, id: string) {
    const media = await this.ownMedia(token, id);
    if (media.status !== MediaStatus.READY) {
      const [full, thumb] = await Promise.all([
        this.storage.size(media.storageKey!),
        media.thumbKey ? this.storage.size(media.thumbKey) : null,
      ]);
      if (
        full !== media.bytes ||
        (media.thumbKey && thumb !== media.thumbBytes)
      ) {
        throw new BadRequestException('Upload is missing or incomplete');
      }
      media.status = MediaStatus.READY;
      await this.media.save(media);
    }
    return this.present(media);
  }

  async updateMedia(token: string, id: string, dto: UpdateMediaDto) {
    const media = await this.ownMedia(token, id);
    if (dto.caption !== undefined) media.caption = dto.caption ?? undefined;
    if (dto.displayOrder !== undefined) media.displayOrder = dto.displayOrder;
    if (dto.memoryDate !== undefined) media.memoryDate = dto.memoryDate;
    await this.media.save(media);
    return this.present(media);
  }

  async reorderMedia(token: string, dto: MediaOrderDto) {
    const item = await this.item(token);
    const section = await this.sections.findOneBy({ key: dto.sectionKey });
    if (!section) throw new BadRequestException('Unknown section');
    const rows = await this.media.findBy({
      itemId: item.id,
      sectionId: section.id,
      id: In(dto.ids),
    });
    if (rows.length !== dto.ids.length) {
      throw new BadRequestException('Unknown media in order');
    }
    await this.media.manager.transaction(async (manager) => {
      for (const [index, id] of dto.ids.entries()) {
        await manager.update(ItemMedia, { id }, { displayOrder: index });
      }
    });
    return { saved: true };
  }

  /** Storage first: the row is removed only once its files are gone. */
  async deleteMedia(token: string, id: string) {
    const media = await this.ownMedia(token, id);
    await this.storage.deleteMany(
      [media.storageKey, media.thumbKey].filter(Boolean) as string[],
    );
    await this.media.delete({ id: media.id });
    return { deleted: true };
  }

  /** Uploads that never completed (tab closed mid-way) are cleaned up. */
  private async removeStalePending(itemId: string) {
    const stale = await this.media.findBy({
      itemId,
      status: MediaStatus.PENDING,
      createdAt: LessThan(new Date(Date.now() - PENDING_TTL_MS)),
    });
    if (!stale.length) return;
    await this.storage.deleteMany(
      stale.flatMap((m) => [m.storageKey, m.thumbKey] as string[]),
    );
    await this.media.delete({ id: In(stale.map((m) => m.id)) });
  }
}

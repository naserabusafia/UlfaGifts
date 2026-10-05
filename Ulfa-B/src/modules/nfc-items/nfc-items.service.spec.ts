import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { validate } from 'class-validator';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { OrdersService } from '../orders/orders.service';
import { StorageService } from '../storage/storage.service';
import { ItemContent } from './entities/item-content.entity';
import { ItemMedia, MediaType } from './entities/item-media.entity';
import { Section } from './entities/section.entity';
import { OccasionSection } from './entities/occasion-section.entity';
import { OccasionSectionContent } from './entities/occasion-section-content.entity';
import { Theme } from './entities/theme.entity';
import { ThemeOccasion } from './entities/theme-occasion.entity';
import {
  DEFAULT_NFC_LANGUAGE,
  DEFAULT_NFC_OCCASION,
  DEFAULT_NFC_THEME,
  NfcItem,
  ViewerAuthType,
} from './entities/nfc-item.entity';
import { NfcItemsService } from './nfc-items.service';
import { VerifyViewerPasswordDto } from './dto/verify-viewer-password.dto';
import {
  normalizeViewerSecret,
  viewerSecretProblem,
} from './utils/viewer-secret.util';

describe('NfcItemsService public viewer access', () => {
  const storedItem = () =>
    ({
      id: 'item-1',
      nfcId: 'test-tag',
      viewerAuthType: ViewerAuthType.PIN,
      viewerAuthPrompt: 'Our date?',
      viewerPasswordHash: createHash('sha256').update('1234').digest('hex'),
      creatorPasswordHash: 'private',
      editToken: 'private',
      isLocked: false,
      content: { message: 'secret' },
      media: [],
    }) as unknown as NfcItem;

  const makeService = () => {
    const repository = {
      findOne: jest
        .fn()
        .mockImplementation(() => Promise.resolve(storedItem())),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const texts = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };
    const themes = { find: jest.fn().mockResolvedValue([]) };
    const occasions = { findOne: jest.fn().mockResolvedValue(null) };
    const occasionSections = { find: jest.fn().mockResolvedValue([]) };
    const orders = { findOne: jest.fn().mockResolvedValue({ id: 'order' }) };
    const storage = {
      presignDownload: jest.fn((key: string) =>
        Promise.resolve(`signed:${key}`),
      ),
      deleteMany: jest.fn().mockResolvedValue(undefined),
    };
    const service = new NfcItemsService(
      repository as unknown as Repository<NfcItem>,
      {} as Repository<ItemContent>,
      {} as Repository<ItemMedia>,
      {} as Repository<Section>,
      texts as unknown as Repository<OccasionSectionContent>,
      themes as unknown as Repository<Theme>,
      occasions as unknown as Repository<ThemeOccasion>,
      occasionSections as unknown as Repository<OccasionSection>,
      orders as unknown as OrdersService,
      storage as unknown as StorageService,
    );
    return {
      service,
      storage,
      repository,
      texts,
      themes,
      occasions,
      occasionSections,
    };
  };

  it('reads public section copy for the exact theme/occasion/language and active section only', async () => {
    const { service, texts } = makeService();
    texts.findOne.mockResolvedValue({
      title: 'DB heading',
      message: 'DB subtitle',
      id: 'private-id',
    });
    await expect(
      service.findPublicSectionText('luxury', 'romantic', 'ar', 'photo_wheel'),
    ).resolves.toEqual({ title: 'DB heading', message: 'DB subtitle' });
    expect(texts.findOne).toHaveBeenCalledWith({
      where: {
        language: 'ar',
        section: { key: 'photo_wheel', isActive: true },
        occasion: { key: 'romantic', theme: { key: 'luxury' } },
      },
    });
  });

  it('does not inject fallback text when a database translation is missing', async () => {
    const { service } = makeService();
    await expect(
      service.findPublicSectionText('luxury', 'romantic', 'en', 'voice_note'),
    ).resolves.toEqual({ title: null, message: null });
  });

  it('lists active themes with their active occasions only', async () => {
    const { service, themes } = makeService();
    themes.find.mockResolvedValue([
      {
        key: 'casual',
        name: 'Casual',
        occasions: [
          { key: 'friendship', name: 'Friendship', isActive: true },
          { key: 'birthday', name: 'Birthday', isActive: true },
          { key: 'retired', name: 'Retired', isActive: false },
        ],
      },
    ]);
    await expect(service.findPublicThemes()).resolves.toEqual([
      {
        key: 'casual',
        name: 'Casual',
        occasions: [
          { key: 'birthday', name: 'Birthday' },
          { key: 'friendship', name: 'Friendship' },
        ],
      },
    ]);
    expect(themes.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
  });

  it('creates an item on the requested occasion with its default sections', async () => {
    const { service, repository, occasions, occasionSections } = makeService();
    const occasion = {
      id: 'occ-birthday',
      key: 'birthday',
      theme: { key: 'casual' },
    };
    repository.findOne.mockResolvedValue(null);
    Object.assign(repository, {
      create: jest.fn((data: object) => data),
      save: jest.fn((data: object) => Promise.resolve({ ...data })),
    });
    occasions.findOne.mockResolvedValue(occasion);
    occasionSections.find.mockResolvedValue([
      { sectionId: 'wheel', displayOrder: 1 },
      { sectionId: 'film', displayOrder: 2 },
    ]);
    const saved = await service.create({
      orderId: 'order',
      productName: 'Card',
      nfcId: 'new-tag',
      theme: 'casual',
      occasion: 'birthday',
    } as never);
    expect(occasions.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          key: 'birthday',
          isActive: true,
          theme: { key: 'casual', isActive: true },
        },
      }),
    );
    expect(saved).toMatchObject({
      occasion,
      itemSections: [
        { sectionId: 'wheel', displayOrder: 1, isVisible: true },
        { sectionId: 'film', displayOrder: 2, isVisible: true },
      ],
    });
  });

  it('rejects an occasion that the theme does not offer', async () => {
    const { service, repository } = makeService();
    repository.findOne.mockResolvedValue(null);
    await expect(
      service.create({
        orderId: 'order',
        productName: 'Card',
        nfcId: 'new-tag',
        theme: 'casual',
        occasion: 'romantic',
      } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns the question, auth type, and safe appearance defaults without content', async () => {
    const { service } = makeService();
    await expect(service.findPublicChallenge('test-tag')).resolves.toEqual({
      nfcId: 'test-tag',
      viewerAuthType: ViewerAuthType.PIN,
      viewerAuthPrompt: 'Our date?',
      preparing: false,
      encryption: null,
      theme: DEFAULT_NFC_THEME,
      occasion: DEFAULT_NFC_OCCASION,
      language: DEFAULT_NFC_LANGUAGE,
    });
  });

  it('returns the content appearance chosen for the NFC item', async () => {
    const { service, repository } = makeService();
    repository.findOne.mockResolvedValue({
      ...storedItem(),
      occasion: { key: 'birthday', theme: { key: 'casual' } },
      language: 'ar',
    });

    await expect(
      service.findPublicChallenge('test-tag'),
    ).resolves.toMatchObject({
      theme: 'casual',
      occasion: 'birthday',
      language: 'ar',
    });
  });

  it('rejects a wrong answer', async () => {
    const { service } = makeService();
    await expect(
      service.verifyViewerPassword('test-tag', '0000'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns content only for a correct answer and removes secrets', async () => {
    const { service } = makeService();
    const result = await service.verifyViewerPassword('test-tag', '1234');
    expect(result.content?.message).toBe('secret');
    expect(result).not.toHaveProperty('viewerPasswordHash');
    expect(result).not.toHaveProperty('creatorPasswordHash');
    expect(result).not.toHaveProperty('editToken');
  });

  it.each([
    [ViewerAuthType.DATE, '2020-02-29'],
    [ViewerAuthType.TEXT, 'our secret'],
  ])(
    'loads the %s challenge and verifies its answer before returning the letter',
    async (type, answer) => {
      const { service, repository } = makeService();
      repository.findOne.mockImplementation(() =>
        Promise.resolve({
          ...storedItem(),
          viewerAuthType: type,
          viewerPasswordHash: createHash('sha256').update(answer).digest('hex'),
          language: 'ar',
          content: {
            title: 'عنوان الرسالة',
            message: 'نص الرسالة',
            signature: 'التوقيع',
          },
        }),
      );

      const challenge = await service.findPublicChallenge('test-tag');
      expect(challenge).toMatchObject({
        viewerAuthType: type,
        viewerAuthPrompt: 'Our date?',
        language: 'ar',
      });
      expect(challenge).not.toHaveProperty('content');
      expect(challenge).not.toHaveProperty('viewerPasswordHash');
      await expect(
        service.verifyViewerPassword('test-tag', 'wrong'),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.verifyViewerPassword('test-tag', answer),
      ).resolves.toMatchObject({
        content: {
          title: 'عنوان الرسالة',
          message: 'نص الرسالة',
          signature: 'التوقيع',
        },
      });
      expect(repository.findOne).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: { nfcId: 'test-tag' },
          relations: expect.objectContaining({ content: true }),
        }),
      );
    },
  );

  it('allows an empty answer for NONE through request validation and returns content', async () => {
    const dto = Object.assign(new VerifyViewerPasswordDto(), { answer: '' });
    expect(await validate(dto)).toHaveLength(0);
    expect(await validate(new VerifyViewerPasswordDto())).not.toHaveLength(0);
    const { service, repository } = makeService();
    repository.findOne.mockResolvedValue({
      ...storedItem(),
      viewerAuthType: ViewerAuthType.NONE,
      viewerPasswordHash: null,
    });
    await expect(
      service.verifyViewerPassword('test-tag', dto.answer),
    ).resolves.toMatchObject({ content: { message: 'secret' } });
  });

  it('rejects empty answers and unconfigured passwords for protected items', async () => {
    const { service, repository } = makeService();
    await expect(service.verifyViewerPassword('test-tag', '')).rejects.toThrow(
      ForbiddenException,
    );
    repository.findOne.mockResolvedValue({
      ...storedItem(),
      viewerPasswordHash: null,
    });
    await expect(
      service.verifyViewerPassword('test-tag', '1234'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects inactive and missing items at both public endpoints', async () => {
    const { service, repository } = makeService();
    repository.findOne.mockResolvedValue({ ...storedItem(), isLocked: true });
    await expect(service.findPublicChallenge('test-tag')).rejects.toThrow(
      ForbiddenException,
    );
    await expect(
      service.verifyViewerPassword('test-tag', '1234'),
    ).rejects.toThrow(ForbiddenException);
    repository.findOne.mockResolvedValue(null);
    await expect(service.findPublicChallenge('missing')).rejects.toThrow(
      NotFoundException,
    );
    await expect(
      service.verifyViewerPassword('missing', '1234'),
    ).rejects.toThrow(NotFoundException);
  });

  it('orders visible sections/photos and loads text for the exact item occasion and language', async () => {
    const { service, repository, texts } = makeService();
    const wheel = {
      id: 'wheel',
      key: 'photo_wheel',
      name: 'Photos',
      isActive: true,
    };
    const message = {
      id: 'message',
      key: 'message',
      name: 'Message',
      isActive: true,
    };
    repository.findOne.mockResolvedValue({
      ...storedItem(),
      occasionId: 'occ-romantic',
      occasion: { key: 'romantic', theme: { key: 'luxury' } },
      language: 'ar',
      itemSections: [
        {
          sectionId: 'wheel',
          section: wheel,
          displayOrder: 20,
          isVisible: true,
        },
        {
          sectionId: 'message',
          section: message,
          displayOrder: 10,
          isVisible: true,
        },
        {
          sectionId: 'hidden',
          section: { ...wheel, id: 'hidden' },
          displayOrder: 0,
          isVisible: false,
        },
        {
          sectionId: 'inactive',
          section: { ...wheel, id: 'inactive', isActive: false },
          displayOrder: 1,
          isVisible: true,
        },
      ],
      media: [
        {
          id: 'last',
          sectionId: 'wheel',
          mediaType: MediaType.IMAGE,
          url: '/last.jpg',
          displayOrder: 2,
        },
        {
          id: 'first',
          sectionId: 'wheel',
          mediaType: MediaType.IMAGE,
          url: '/first.jpg',
          caption: 'A memory',
          displayOrder: 1,
        },
        {
          id: 'other',
          sectionId: 'message',
          mediaType: MediaType.IMAGE,
          url: '/other.jpg',
          displayOrder: 0,
        },
      ],
    });
    texts.find.mockResolvedValue([
      { sectionId: 'wheel', title: 'DB heading', message: 'DB subtitle' },
    ]);
    const result = await service.verifyViewerPassword('test-tag', '1234');
    expect(result.sections.map((s) => s.key)).toEqual([
      'message',
      'photo_wheel',
    ]);
    expect(result.sections[1]).toMatchObject({
      displayOrder: 20,
      title: 'DB heading',
      message: 'DB subtitle',
    });
    expect(result.sections[1].media.map((m) => m.id)).toEqual([
      'first',
      'last',
    ]);
    expect(texts.find.mock.calls[0][0] as unknown).toMatchObject({
      where: { occasionId: 'occ-romantic', language: 'ar' },
    });
    expect(result).toMatchObject({ theme: 'luxury', occasion: 'romantic' });
  });

  it('exposes the legacy wheel without an order but never re-enables an explicitly hidden wheel', async () => {
    const { service, repository } = makeService();
    const wheel = {
      id: 'wheel',
      key: 'photo_wheel',
      name: 'Photos',
      isActive: true,
    };
    const item = {
      ...storedItem(),
      media: [
        {
          id: 'photo',
          sectionId: 'wheel',
          section: wheel,
          mediaType: MediaType.IMAGE,
          url: '/photo.jpg',
          displayOrder: 0,
        },
      ],
    };
    repository.findOne.mockResolvedValue(item);
    const result = await service.verifyViewerPassword('test-tag', '1234');
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]).toMatchObject({
      key: 'photo_wheel',
      displayOrder: undefined,
    });
    repository.findOne.mockResolvedValue({
      ...storedItem(),
      media: item.media,
      itemSections: [
        {
          sectionId: 'wheel',
          section: wheel,
          displayOrder: 1,
          isVisible: false,
        },
      ],
    });
    expect(
      (await service.verifyViewerPassword('test-tag', '1234')).sections,
    ).toHaveLength(0);
  });

  describe('viewer secrets', () => {
    const tooMany = expect.objectContaining({ status: 429 });

    it('checks bcrypt hashes against the normalized answer', async () => {
      const { service, repository } = makeService();
      repository.findOne.mockResolvedValue({
        ...storedItem(),
        viewerAuthType: ViewerAuthType.TEXT,
        viewerPasswordHash: await bcrypt.hash('اول لقاء في عمان', 4),
      });
      await expect(
        service.verifyViewerPassword('test-tag', '  أوّل   لقاء في عمّان '),
      ).resolves.toMatchObject({ content: { message: 'secret' } });
      await expect(
        service.verifyViewerPassword('test-tag', 'غلط'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('accepts Arabic-Indic digits for a PIN', async () => {
      const { service, repository } = makeService();
      repository.findOne.mockResolvedValue({
        ...storedItem(),
        viewerPasswordHash: await bcrypt.hash('482915', 4),
      });
      await expect(
        service.verifyViewerPassword('test-tag', '٤٨٢٩١٥'),
      ).resolves.toBeDefined();
    });

    it('upgrades a legacy SHA-256 hash to bcrypt on a correct answer', async () => {
      const { service, repository } = makeService();
      await service.verifyViewerPassword('test-tag', '1234');
      const [id, patch] = repository.update.mock.calls[0];
      expect(id).toBe('item-1');
      expect(await bcrypt.compare('1234', patch.viewerPasswordHash)).toBe(true);
    });

    it('locks the item after 5 wrong answers and resets after a correct one', async () => {
      const { service, repository } = makeService();
      repository.findOne.mockResolvedValue({
        ...storedItem(),
        failedAttempts: 4,
      });
      await expect(
        service.verifyViewerPassword('test-tag', '0000'),
      ).rejects.toEqual(tooMany);
      const patch = repository.update.mock.calls[0][1];
      expect(patch.failedAttempts).toBe(5);
      expect(patch.lockedUntil.getTime()).toBeGreaterThan(
        Date.now() + 14 * 60_000,
      );

      // Even the right answer is refused while locked.
      repository.findOne.mockResolvedValue({
        ...storedItem(),
        failedAttempts: 5,
        lockedUntil: patch.lockedUntil,
      });
      await expect(
        service.verifyViewerPassword('test-tag', '1234'),
      ).rejects.toEqual(tooMany);

      // After the lock expires the right answer works and clears the count.
      repository.update.mockClear();
      repository.findOne.mockResolvedValue({
        ...storedItem(),
        failedAttempts: 5,
        lockedUntil: new Date(Date.now() - 1000),
      });
      const result = await service.verifyViewerPassword('test-tag', '1234');
      expect(repository.update).toHaveBeenLastCalledWith('item-1', {
        failedAttempts: 0,
        lockedUntil: null,
      });
      expect(result).not.toHaveProperty('failedAttempts');
      expect(result).not.toHaveProperty('lockedUntil');
    });

    it('counts again from one after an expired lock', async () => {
      const { service, repository } = makeService();
      repository.findOne.mockResolvedValue({
        ...storedItem(),
        failedAttempts: 5,
        lockedUntil: new Date(Date.now() - 1000),
      });
      await expect(
        service.verifyViewerPassword('test-tag', '0000'),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.update.mock.calls[0][1]).toEqual({
        failedAttempts: 1,
        lockedUntil: null,
      });
    });

    it('stores new PINs as bcrypt and rejects short or obvious ones', async () => {
      const { service, repository, occasions } = makeService();
      repository.findOne.mockResolvedValue(null);
      Object.assign(repository, {
        create: jest.fn((data: object) => data),
        save: jest.fn((data: object) => Promise.resolve({ ...data })),
      });
      occasions.findOne.mockResolvedValue({ id: 'occ' });
      const create = (viewerPassword: string) =>
        service.create({
          orderId: 'order',
          productName: 'Card',
          nfcId: 'new-tag',
          viewerAuthType: ViewerAuthType.PIN,
          viewerPassword,
        } as never);

      for (const weak of ['1234', '000000', '123456', '987654']) {
        await expect(create(weak)).rejects.toThrow(BadRequestException);
      }
      await create('٤٨٢٩١٥');
      const saved = (repository as unknown as { create: jest.Mock }).create.mock
        .calls[0][0];
      expect(await bcrypt.compare('482915', saved.viewerPasswordHash)).toBe(
        true,
      );
    });

    it.each([
      [ViewerAuthType.DATE, '2020-2-9', '2020-02-09'],
      [ViewerAuthType.TEXT, 'Hello   WORLD', 'hello world'],
      [ViewerAuthType.TEXT, 'مدرسةُ الهُدى', 'مدرسه الهدي'],
      [ViewerAuthType.PIN, '١٢ ٣٤٥٧', '123457'],
    ])('normalizes %s "%s"', (type, raw, expected) => {
      expect(normalizeViewerSecret(type, raw)).toBe(expected);
    });

    it('rejects impossible dates', () => {
      expect(viewerSecretProblem(ViewerAuthType.DATE, '2021-02-29')).not.toBe(
        null,
      );
      expect(viewerSecretProblem(ViewerAuthType.DATE, '2020-02-29')).toBe(null);
    });
  });
});

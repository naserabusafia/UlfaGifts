import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { OrdersService } from '../orders/orders.service';
import { ItemContent } from './entities/item-content.entity';
import { ItemMedia, MediaType } from './entities/item-media.entity';
import { Section } from './entities/section.entity';
import { ThemeSectionContent } from './entities/theme-section-content.entity';
import {
  DEFAULT_NFC_LANGUAGE,
  DEFAULT_NFC_THEME,
  NfcItem,
  ViewerAuthType,
} from './entities/nfc-item.entity';
import { NfcItemsService } from './nfc-items.service';
import { VerifyViewerPasswordDto } from './dto/verify-viewer-password.dto';

describe('NfcItemsService public viewer access', () => {
  const storedItem = () =>
    ({
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
    };
    const texts = { find: jest.fn().mockResolvedValue([]) };
    const service = new NfcItemsService(
      repository as unknown as Repository<NfcItem>,
      {} as Repository<ItemContent>,
      {} as Repository<ItemMedia>,
      {} as Repository<Section>,
      texts as unknown as Repository<ThemeSectionContent>,
      {} as OrdersService,
    );
    return { service, repository, texts };
  };

  it('returns the question, auth type, and safe appearance defaults without content', async () => {
    const { service } = makeService();
    await expect(service.findPublicChallenge('test-tag')).resolves.toEqual({
      nfcId: 'test-tag',
      viewerAuthType: ViewerAuthType.PIN,
      viewerAuthPrompt: 'Our date?',
      theme: DEFAULT_NFC_THEME,
      language: DEFAULT_NFC_LANGUAGE,
    });
  });

  it('returns the content appearance chosen for the NFC item', async () => {
    const { service, repository } = makeService();
    repository.findOne.mockResolvedValue({
      ...storedItem(),
      theme: 'midnight',
      language: 'ar',
    });

    await expect(
      service.findPublicChallenge('test-tag'),
    ).resolves.toMatchObject({
      theme: 'midnight',
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
          theme: 'romantic',
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

  it('orders visible sections/photos and loads text for the exact item theme and language', async () => {
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
      theme: 'DEFAULT',
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
      where: { theme: 'DEFAULT', language: 'ar' },
    });
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
});

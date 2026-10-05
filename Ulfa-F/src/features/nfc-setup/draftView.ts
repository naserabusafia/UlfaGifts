import type { ExperienceMedia, ExperienceSection } from '../nfc-experience/types/experience';
import { SECTION_LIMITS } from './draftStore';
import type { DraftMedia, DraftState } from './draftStore';

/** Draft media in the shape the recipient components render. */
export function toExperienceMedia(items: DraftMedia[]): ExperienceMedia[] {
  return items.map((m, index) => ({
    id: m.key, mediaType: m.mediaType, url: m.url, fullUrl: m.url, thumbnailUrl: m.thumbnailUrl,
    caption: m.caption || null, memoryDate: m.memoryDate, displayOrder: index,
  }));
}

export function liveSectionFor(draft: DraftState, sectionKey: string): ExperienceSection {
  const meta = draft.sections.find((s) => s.key === sectionKey);
  return { id: sectionKey, key: sectionKey, title: meta?.title ?? null, message: meta?.message ?? null,
    media: toExperienceMedia(draft.media.filter((m) => m.sectionKey === sectionKey)) };
}

/** Whether a part has what it needs to be shown to the recipient. */
export function partReady(draft: DraftState, key: string): boolean {
  if (key === 'letter') return !!draft.letter.message.trim();
  const items = draft.media.filter((m) => m.sectionKey === key && (key !== 'memory_calendar' || m.memoryDate));
  return items.length >= (SECTION_LIMITS[key]?.min ?? 1);
}

/** The letter, then every visible section in the chosen order. */
export function fillParts(draft: DraftState): string[] {
  return ['letter', ...draft.sections.filter((s) => s.isVisible && SECTION_LIMITS[s.key]).map((s) => s.key)];
}

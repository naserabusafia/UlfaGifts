import type { ExperienceMedia, ExperienceSection } from '../types/experience';

export const SECTION_FALLBACK_AFTER: Record<string, string> = {
  photo_wheel: 'message',
  voice_note: 'photo_wheel',
  memory_calendar: 'voice_note',
  film_strip: 'memory_calendar',
};

export type MemoryDay = { year: number; month: number; day: number; key: string };

/** Parses a YYYY-MM-DD (or ISO timestamp) memory date; month is 0-based. */
export function parseMemoryDate(value?: string | null): MemoryDay | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
  const date = new Date(Date.UTC(year, month, day));
  if (date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;
  return { year, month, day, key: match[0] };
}

const isImage = (m: ExperienceMedia) => m.mediaType === 'IMAGE' && !!m.url;

// Media a section needs before it is worth rendering; sections not listed always render.
export const SECTION_MEDIA: Record<string, (m: ExperienceMedia) => boolean> = {
  photo_wheel: isImage,
  film_strip: isImage,
  memory_calendar: (m) => isImage(m) && parseMemoryDate(m.memoryDate) !== null,
  voice_note: (m) => m.mediaType === 'VOICE_NOTE' && !!m.url,
};

export function sectionMedia(section: ExperienceSection): ExperienceMedia[] {
  const accepts = SECTION_MEDIA[section.key];
  return [...(section.media ?? [])].filter((m) => !accepts || accepts(m))
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

export function sectionType(key: string) {
  const normalized = key.toLowerCase();
  return ['welcome_message', 'letter'].includes(normalized) ? 'message' : normalized;
}

export function orderedSections(sections: ExperienceSection[]): ExperienceSection[] {
  const configured = sections.map((s) => ({ ...s, key: sectionType(s.key) }));
  if (!configured.some((s) => s.key === 'message')) {
    configured.unshift({ id: 'legacy-message', key: 'message' });
  }
  const hasOrder = (s: ExperienceSection) => typeof s.displayOrder === 'number' && Number.isFinite(s.displayOrder);
  const result = configured.filter(hasOrder).sort((a, b) => a.displayOrder! - b.displayOrder!);
  // Legacy Message starts the page; only missing orders use the fallback config.
  for (const section of configured.filter((s) => !hasOrder(s))) {
    const after = SECTION_FALLBACK_AFTER[section.key];
    if (section.key === 'message') result.unshift(section);
    else {
      const index = result.findIndex((s) => s.key === after);
      result.splice(index < 0 ? result.length : index + 1, 0, section);
    }
  }
  return result.filter((s) => !SECTION_MEDIA[s.key] || s.media?.some(SECTION_MEDIA[s.key]));
}

import type { ExperienceSection } from '../types/experience';

export const SECTION_FALLBACK_AFTER: Record<string, string> = { photo_wheel: 'message' };

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
  return result.filter((s) => s.key !== 'photo_wheel' || s.media?.some((m) => m.mediaType === 'IMAGE' && m.url));
}

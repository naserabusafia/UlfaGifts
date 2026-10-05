export type SectionText = { title?: string | null; message?: string | null };
export type ExperienceMedia = {
  id: string;
  mediaType: string;
  url: string;
  thumbnailUrl?: string | null;
  fullUrl?: string | null;
  caption?: string | null;
  /** YYYY-MM-DD day used by the memory calendar. */
  memoryDate?: string | null;
  displayOrder: number;
};
export type ExperienceSection = SectionText & {
  id: string;
  key: string;
  displayOrder?: number | null;
  media?: ExperienceMedia[];
};
export type ExperienceContent = {
  title?: string | null;
  message?: string | null;
  signature?: string | null;
};
export type ExperienceResponse = {
  theme?: string;
  occasion?: string;
  language?: string;
  content?: ExperienceContent | null;
  sections?: ExperienceSection[];
};

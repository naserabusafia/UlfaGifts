import type { ExperienceSection } from '../types/experience';
import SectionOrnament from './SectionOrnament';

export default function SectionHeading({ section, id, language }: {
  section: ExperienceSection; id: string; language: 'ar' | 'en';
}) {
  return <header className="memory-section__heading" dir={language === 'ar' ? 'rtl' : 'ltr'}>
    {section.title && <h2 id={id}>{section.title}</h2>}
    {section.message && <p>{section.message}</p>}
    <SectionOrnament />
  </header>;
}

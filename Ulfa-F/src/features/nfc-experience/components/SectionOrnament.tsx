import { ULFA_PATH } from '../PulseLogo';

/** Divider under section headings: two hairlines with the Ulfa mark between them. */
export default function SectionOrnament({ className = '' }: { className?: string }) {
  return <svg className={`section-ornament ${className}`.trim()} viewBox="0 0 200 36" aria-hidden="true">
    <path d="M0 18h68M132 18h68" fill="none" stroke="currentColor" strokeWidth="1" />
    <path d={ULFA_PATH} fill="currentColor" transform="translate(78.5 3.75) scale(.33)" />
  </svg>;
}

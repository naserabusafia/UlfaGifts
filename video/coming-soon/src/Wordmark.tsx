import { loadFont as loadAmiri } from '@remotion/google-fonts/Amiri';
import { loadFont as loadCormorant } from '@remotion/google-fonts/CormorantGaramond';
import type React from 'react';
import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  type InteractivitySchema,
} from 'remotion';
import T from './timeline.json';

const { fontFamily: amiri } = loadAmiri('normal', { weights: ['400', '700'], subsets: ['arabic'] });
const { fontFamily: cormorant } = loadCormorant('normal', { weights: ['600'], subsets: ['latin'] });

type WordmarkProps = {
  readonly title: string;
  readonly subtitle: string;
  readonly latin: string;
  readonly gold: string;
  readonly style?: React.CSSProperties;
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const out = Easing.bezier(0.16, 1, 0.3, 1);

// Local timeline: the wordmark starts at WORD_IN seconds after its own `from`.
export const WORD_LEAD = 0.25;
const SUB = T.subIn - T.wordIn + WORD_LEAD;
const LATIN = T.latinIn - T.wordIn + WORD_LEAD;

const WordmarkInner: React.FC<WordmarkProps> = ({ title, subtitle, latin, gold, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const shine = interpolate(t, [WORD_LEAD + 1.0, WORD_LEAD + 2.2], [130, -30], { ...clamp, easing: Easing.bezier(0.65, 0, 0.35, 1) });
  const rule = interpolate(t, [SUB - 0.3, SUB + 0.6], [0, 1], { ...clamp, easing: out });

  return (
    <AbsoluteFill style={{ alignItems: 'center', ...style }}>
      <div
        style={{
          position: 'absolute',
          top: 620,
          fontFamily: amiri,
          fontWeight: 700,
          fontSize: 300,
          lineHeight: 1.4,
          direction: 'rtl',
          color: 'transparent',
          backgroundImage: `linear-gradient(100deg, ${gold} 0%, #fff4dc ${shine - 8}%, #ffffff ${shine}%, #fff4dc ${shine + 8}%, ${gold} 100%)`,
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          opacity: interpolate(t, [0, WORD_LEAD + 0.5], [0, 1], { ...clamp, easing: out }),
          filter: `blur(${interpolate(t, [0, WORD_LEAD + 0.9], [26, 0], { ...clamp, easing: out })}px) drop-shadow(0 0 30px rgba(242,201,138,0.35))`,
          scale: interpolate(t, [0, WORD_LEAD + 1.4], [1.14, 1], { ...clamp, easing: out }),
        }}
      >
        {title}
      </div>

      <div style={{ position: 'absolute', top: 1170, display: 'flex', alignItems: 'center', gap: 22 }}>
        <div style={{ width: 170 * rule, height: 2, background: `linear-gradient(90deg, transparent, ${gold})` }} />
        <div style={{ width: 12, height: 12, rotate: '45deg', background: gold, opacity: rule, scale: rule }} />
        <div style={{ width: 170 * rule, height: 2, background: `linear-gradient(90deg, ${gold}, transparent)` }} />
      </div>

      <div
        style={{
          position: 'absolute',
          top: 1210,
          fontFamily: amiri,
          fontWeight: 400,
          fontSize: 104,
          direction: 'rtl',
          color: '#f3eee3',
          opacity: interpolate(t, [SUB, SUB + 0.8], [0, 1], { ...clamp, easing: out }),
          translate: interpolate(t, [SUB, SUB + 1.0], ['0px 34px', '0px 0px'], { ...clamp, easing: out }),
          filter: `blur(${interpolate(t, [SUB, SUB + 0.7], [10, 0], clamp)}px)`,
        }}
      >
        {subtitle}
      </div>

      <div
        style={{
          position: 'absolute',
          top: 1400,
          fontFamily: cormorant,
          fontWeight: 600,
          fontSize: 46,
          letterSpacing: '0.42em',
          paddingLeft: '0.42em',
          color: gold,
          opacity: interpolate(t, [LATIN, LATIN + 0.9], [0, 0.9], { ...clamp, easing: out }),
          translate: interpolate(t, [LATIN, LATIN + 1.1], ['0px 20px', '0px 0px'], { ...clamp, easing: out }),
        }}
      >
        {latin}
      </div>
    </AbsoluteFill>
  );
};

const wordmarkSchema = {
  title: { type: 'text-content', default: 'ألفة', description: 'Wordmark' },
  subtitle: { type: 'text-content', default: 'قريباً', description: 'Arabic line' },
  latin: { type: 'text-content', default: 'COMING SOON', description: 'Latin line' },
  gold: { type: 'color', default: '#f2c98a', description: 'Gold' },
} as const satisfies InteractivitySchema;

export const Wordmark = Interactive.withSchema({
  Component: WordmarkInner,
  componentName: '<Wordmark>',
  schema: wordmarkSchema,
  wrapInSequence: true,
});

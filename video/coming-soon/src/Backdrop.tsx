import type React from 'react';
import { AbsoluteFill, Interactive, random, useCurrentFrame, useVideoConfig, type InteractivitySchema } from 'remotion';

type BackdropProps = {
  readonly glow: string;
  readonly deep: string;
  readonly style?: React.CSSProperties;
};

const DUST = Array.from({ length: 46 }, (_, i) => ({
  x: random(`x${i}`) * 1080,
  y: random(`y${i}`) * 1920,
  z: 0.35 + random(`z${i}`) * 0.9,
  ph: random(`p${i}`) * Math.PI * 2,
  big: random(`b${i}`) < 0.14,
}));

// Deep navy room, drifting gold dust, and a fine film grain.
const BackdropInner: React.FC<BackdropProps> = ({ glow, deep, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 85% 60% at 50% 46%, ${glow} 0%, #201f42 45%, ${deep} 100%)`, ...style }}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        {DUST.map((m, i) => {
          const x = (((m.x + Math.sin(t * 0.5 + m.ph) * 30 * m.z + t * 8 * m.z) % 1160) + 1160) % 1160 - 40;
          const y = (((m.y - t * 26 * m.z) % 2000) + 2000) % 2000 - 40;
          const tw = 0.55 + 0.45 * Math.sin(t * 2.1 + m.ph * 3);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={(m.big ? 16 : 2.6) * m.z}
              fill={`rgba(255,214,160,${(m.big ? 0.07 : 0.5) * tw})`}
            />
          );
        })}
      </svg>
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, mixBlendMode: 'overlay', opacity: 0.09 }}>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={frame % 7} />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 75% 65% at 50% 48%, transparent 55%, rgba(0,0,0,0.55) 100%)' }} />
    </AbsoluteFill>
  );
};

const backdropSchema = {
  glow: { type: 'color', default: '#34315f', description: 'Centre glow' },
  deep: { type: 'color', default: '#0c0b1d', description: 'Edges' },
} as const satisfies InteractivitySchema;

export const Backdrop = Interactive.withSchema({
  Component: BackdropInner,
  componentName: '<Backdrop>',
  schema: backdropSchema,
  wrapInSequence: true,
});

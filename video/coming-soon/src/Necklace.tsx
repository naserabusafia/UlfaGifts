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
import { monogram, NECK, pointAt, shapeAt, THREAD, toPath } from './geometry';
import T from './timeline.json';

type NecklaceProps = {
  readonly goldLight: string;
  readonly goldDeep: string;
  readonly style?: React.CSSProperties;
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const smooth = Easing.bezier(0.65, 0, 0.35, 1);

const PENDANT_R = 92;
const MONOGRAM = monogram(46);

// Thread → chain → pendant. Times come from timeline.json, which the music script also reads.
const NecklaceInner: React.FC<NecklaceProps> = ({ goldLight, goldDeep, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const drawn = interpolate(t, [T.drawStart, T.drawEnd], [0, 1], { ...clamp, easing: Easing.bezier(0.45, 0.05, 0.4, 1) });
  const morph = interpolate(t, [T.morphStart, T.morphEnd], [0, 1], { ...clamp, easing: smooth });
  const chain = interpolate(t, [T.chainStart, T.chainEnd], [0, 1], { ...clamp, easing: smooth });

  // the pendant falls, lands, and its weight pulls the chain down a little
  const fall = interpolate(t, [T.dropStart, T.land], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const sinceLand = Math.max(0, t - T.land);
  const landed = t >= T.land;
  const pull = landed ? 24 * (1 - Math.exp(-6 * sinceLand) * Math.cos(11 * sinceLand)) : 0;
  const omega = Math.PI / T.swingHalfPeriod;
  const settle = interpolate(t, [T.glint - 1.6, T.glint - 0.1], [1, 0], { ...clamp, easing: smooth });
  const swing = landed ? 13 * Math.exp(-0.8 * sinceLand) * Math.sin(omega * sinceLand) * settle : 0;
  const bounce = landed ? 10 * Math.exp(-7 * sinceLand) * Math.sin(16 * sinceLand) : 0;

  const pts = shapeAt(morph, pull);
  const d = toPath(pts);
  const tip = pointAt(THREAD, drawn);
  const bail = { x: NECK.cx, y: NECK.bottom + pull - 4 };
  const pendantY = interpolate(fall, [0, 1], [-110, 0]) + bounce;

  // the glint: a four-point star and a sheen sweeping across the disc
  const glint = interpolate(t, [T.glint - 0.05, T.glint + 0.18, T.glint + 0.9], [0, 1, 0.55], { ...clamp, easing: Easing.out(Easing.cubic) });
  const sheen = interpolate(t, [T.glint - 0.15, T.glint + 0.45], [-1.3, 1.3], { ...clamp, easing: smooth });
  const gone = interpolate(t, [T.bloomStart + 0.15, T.wordIn - 0.05], [1, 0], { ...clamp, easing: smooth });

  return (
    <AbsoluteFill style={{ ...style }}>
      <svg
        viewBox="0 0 1080 1920"
        width={1080}
        height={1920}
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'visible',
          opacity: gone,
          filter: `drop-shadow(0 0 ${interpolate(t, [T.drawStart, T.chainEnd, T.glint, T.glint + 0.4], [6, 9, 9, 22], clamp)}px rgba(242,201,138,0.55))`,
        }}
      >
        <defs>
          <linearGradient id="gold" gradientUnits="userSpaceOnUse" x1="0" y1="300" x2="1080" y2="1300">
            <stop offset="0" stopColor={goldDeep} />
            <stop offset="0.45" stopColor={goldLight} />
            <stop offset="0.6" stopColor="#fff4dc" />
            <stop offset="1" stopColor={goldDeep} />
          </linearGradient>
          <radialGradient id="disc" cx="0.38" cy="0.32" r="0.8">
            <stop offset="0" stopColor="#fff3d6" />
            <stop offset="0.35" stopColor={goldLight} />
            <stop offset="0.85" stopColor={goldDeep} />
            <stop offset="1" stopColor="#7d5523" />
          </radialGradient>
          <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0.35">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.85" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <clipPath id="discClip">
            <circle cx="0" cy={PENDANT_R + 34} r={PENDANT_R} />
          </clipPath>
        </defs>

        {/* the handwritten thread */}
        <path
          d={d}
          fill="none"
          stroke="url(#gold)"
          strokeWidth={interpolate(morph, [0, 1], [4.5, 3.5])}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={`${drawn} 2`}
          opacity={1 - chain}
        />

        {/* the chain: hollow oval links over the same path */}
        <g opacity={chain}>
          <path d={d} fill="none" stroke="url(#gold)" strokeWidth={9} strokeLinecap="round" strokeDasharray="15 7" />
          <path d={d} fill="none" stroke="#1b1a36" strokeWidth={3.2} strokeLinecap="round" strokeDasharray="7 15" strokeDashoffset={-4} />
        </g>
        {/* a glint running down both sides of the chain as the links form */}
        {[0, 1].map((side) => {
          const p = interpolate(t, [T.chainStart, T.chainEnd], side ? [0, 0.5] : [1, 0.5], { ...clamp, easing: smooth });
          const a = interpolate(t, [T.chainStart, T.chainStart + 0.15, T.chainEnd - 0.1, T.chainEnd + 0.2], [0, 1, 1, 0], clamp);
          return (
            <path
              key={side}
              d={d}
              fill="none"
              stroke="#fff6e2"
              strokeWidth={7}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray="0.025 2"
              strokeDashoffset={-p + 0.0125}
              opacity={a}
            />
          );
        })}

        {/* pen tip while writing */}
        {drawn > 0 && drawn < 1 ? (
          <g opacity={interpolate(t, [T.drawStart, T.drawStart + 0.2, T.drawEnd - 0.2, T.drawEnd], [0, 1, 1, 0], clamp)}>
            <circle cx={tip[0]} cy={tip[1]} r={26} fill="rgba(255,226,170,0.18)" />
            <circle cx={tip[0]} cy={tip[1]} r={6} fill="#fff6e2" />
          </g>
        ) : null}

        {/* pendant */}
        {t >= T.dropStart ? (
          <g
            transform={`translate(${bail.x} ${bail.y + pendantY}) rotate(${swing})`}
            opacity={interpolate(t, [T.dropStart, T.dropStart + 0.12], [0, 1], clamp)}
          >
            <ellipse cx={0} cy={16} rx={13} ry={18} fill="none" stroke="url(#gold)" strokeWidth={6} />
            <circle cx={0} cy={PENDANT_R + 34} r={PENDANT_R} fill="url(#disc)" />
            <circle cx={0} cy={PENDANT_R + 34} r={PENDANT_R - 10} fill="none" stroke="rgba(110,72,28,0.55)" strokeWidth={2.5} />
            <circle cx={0} cy={PENDANT_R + 34} r={PENDANT_R - 1.5} fill="none" stroke="rgba(255,244,214,0.7)" strokeWidth={2} />
            <g transform={`translate(0 ${PENDANT_R + 34}) rotate(-38)`}>
              <path d={MONOGRAM} fill="none" stroke="rgba(255,246,222,0.6)" strokeWidth={6} transform="translate(1.5 2)" />
              <path d={MONOGRAM} fill="none" stroke="#7a5222" strokeWidth={5} strokeLinejoin="round" />
            </g>
            <g clipPath="url(#discClip)">
              <rect
                x={-PENDANT_R * 0.6 + sheen * PENDANT_R * 1.6}
                y={0}
                width={PENDANT_R * 1.2}
                height={PENDANT_R * 2 + 40}
                fill="url(#sheen)"
                opacity={0.9}
                transform={`rotate(-24 0 ${PENDANT_R + 34})`}
              />
            </g>
          </g>
        ) : null}
      </svg>

      {/* the star of the glint sits outside the svg glow so it stays crisp */}
      <svg
        viewBox="-60 -60 120 120"
        width={240}
        height={240}
        style={{
          position: 'absolute',
          left: bail.x + PENDANT_R * 0.55 - 120,
          top: bail.y + PENDANT_R + 34 - PENDANT_R * 0.6 - 120,
          opacity: glint * gone,
          scale: interpolate(glint, [0, 1], [0.2, 1]),
          rotate: `${interpolate(t, [T.glint - 0.05, T.glint + 1.2], [-30, 25], clamp)}deg`,
        }}
      >
        <path d="M0,-58 C4,-8 8,-4 58,0 C8,4 4,8 0,58 C-4,8 -8,4 -58,0 C-8,-4 -4,-8 0,-58 Z" fill="#fffaf0" />
        <circle r={10} fill="#fff" />
        <circle r={34} fill="rgba(255,230,180,0.25)" />
      </svg>
    </AbsoluteFill>
  );
};

const necklaceSchema = {
  goldLight: { type: 'color', default: '#f2c98a', description: 'Gold highlight' },
  goldDeep: { type: 'color', default: '#b07d3a', description: 'Gold shadow' },
} as const satisfies InteractivitySchema;

export const Necklace = Interactive.withSchema({
  Component: NecklaceInner,
  componentName: '<Necklace>',
  schema: necklaceSchema,
  wrapInSequence: true,
});

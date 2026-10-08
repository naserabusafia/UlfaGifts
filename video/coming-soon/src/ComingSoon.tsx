import { Audio } from '@remotion/media';
import { AbsoluteFill, Easing, Interactive, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Backdrop } from './Backdrop';
import { Necklace } from './Necklace';
import T from './timeline.json';
import { Wordmark, WORD_LEAD } from './Wordmark';

// Ulfa — coming soon. A gold thread writes itself, becomes a necklace, a pendant drops and swings,
// glints once on the last note, and the glint opens into the wordmark.
export const ComingSoon = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: '#0c0b1d' }}>
      <Backdrop name="Backdrop" glow="#34315f" deep="#0c0b1d" premountFor={fps} />

      <Necklace
        name="Necklace"
        goldLight="#f2c98a"
        goldDeep="#b07d3a"
        premountFor={fps}
        style={{
          scale: interpolate(frame, [0, T.bloomStart * fps], [1.04, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.33, 0, 0.2, 1),
            output: 'perceptual-scale',
          }),
        }}
      />

      {/* the glint swells into light, drifts to centre and settles behind the word */}
      <Interactive.Div
        name="Bloom"
        from={Math.round(T.glint * fps)}
        premountFor={fps}
        style={{
          position: 'absolute',
          left: -460,
          top: -60,
          width: 2000,
          height: 2000,
          background: 'radial-gradient(circle, rgba(255,246,226,0.95) 0%, rgba(255,220,160,0.55) 18%, rgba(242,201,138,0.18) 38%, transparent 62%)',
          mixBlendMode: 'screen',
          translate: interpolate(frame, [T.bloomStart * fps, T.wordIn * fps], ['50px -10px', '0px -100px'], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.65, 0, 0.35, 1),
          }),
          scale: interpolate(frame, [T.glint * fps, T.bloomStart * fps, T.wordIn * fps, (T.wordIn + 1.2) * fps], [0.04, 0.1, 1, 0.75], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.65, 0, 0.35, 1),
            output: 'perceptual-scale',
          }),
          opacity: interpolate(frame, [T.glint * fps, T.bloomStart * fps, T.wordIn * fps, (T.wordIn + 1.4) * fps], [0, 0.5, 1, 0.22], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      />

      <Wordmark
        name="Wordmark"
        from={Math.round((T.wordIn - WORD_LEAD) * fps)}
        premountFor={fps}
        title="ألفة"
        subtitle="قريباً"
        latin="COMING SOON"
        gold="#f2c98a"
      />

      <Interactive.Div
        name="Fade out"
        from={Math.round(T.fadeOut * fps)}
        premountFor={fps}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: '#0c0b1d',
          opacity: interpolate(frame, [T.fadeOut * fps, T.duration * fps], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.45, 0, 0.55, 1),
          }),
        }}
      />

      <Audio name="Music box" src={staticFile('music.wav')} premountFor={fps} />
    </AbsoluteFill>
  );
};

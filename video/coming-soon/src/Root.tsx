import { Composition, Folder } from 'remotion';
import { Backdrop } from './Backdrop';
import { ComingSoon } from './ComingSoon';
import { Necklace } from './Necklace';
import { Wordmark } from './Wordmark';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="ComingSoon" component={ComingSoon} durationInFrames={450} fps={30} width={1080} height={1920} />
      <Folder name="Parts">
        <Composition
          id="Necklace"
          component={Necklace}
          durationInFrames={330}
          fps={30}
          width={1080}
          height={1920}
          defaultProps={{ goldLight: '#f2c98a', goldDeep: '#b07d3a' }}
        />
        <Composition
          id="Wordmark"
          component={Wordmark}
          durationInFrames={120}
          fps={30}
          width={1080}
          height={1920}
          defaultProps={{ title: 'ألفة', subtitle: 'قريباً', latin: 'COMING SOON', gold: '#f2c98a' }}
        />
        <Composition
          id="Backdrop"
          component={Backdrop}
          durationInFrames={150}
          fps={30}
          width={1080}
          height={1920}
          defaultProps={{ glow: '#34315f', deep: '#0c0b1d' }}
        />
      </Folder>
    </>
  );
};

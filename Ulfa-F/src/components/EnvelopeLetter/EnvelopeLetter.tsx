import { useState, useRef, useEffect, useId } from "react";
import type { CSSProperties } from "react";
import { motion, AnimatePresence, MotionConfig, LayoutGroup } from "framer-motion";
import SEAL from "./seal.png";
import TEXTURE from "./envelope-texture.jpg";
import PAPER from "./letter-paper.webp";
import "./EnvelopeLetter.css";

export interface EnvelopeLetterProps {
  greeting?: string;
  body?: string | readonly string[];
  sign?: string;
  lang?: 'ar' | 'en';
  theme?: string;
  onOpened?: () => void;
  onCompleted?: (reason: 'advance' | 'leave') => void;
}

type LetterText = { greeting: string; body: readonly string[]; sign: string };
type LetterStage = 'closed' | 'flap' | 'raised' | 'reading';
type EnvelopeStyle = CSSProperties & { '--tex'?: string; '--paper-img'?: string };

const LETTER: LetterText = {
  greeting: "عزيزي،",
  body: [
    "كتبتُ لك هذه الكلمات على مهل، وطويتُها بعناية، وانتظرتُ اللحظة التي تفتحها فيها.",
    "أردتُ أن أقول لك شكراً على كل شيء جميل تركته في أيامي، وأن مكانك محفوظ دائماً.",
  ],
  sign: "مع كل المحبة",
};

function LetterContent({ big = false, allowPageScroll = false, letter }: { big?: boolean; allowPageScroll?: boolean; letter: LetterText }) {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!big || !el) return;
    const update = () => setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", update); ro.disconnect(); };
  }, [big, letter]);

  return (
    <>
      <div ref={ref} tabIndex={big ? 0 : undefined} style={allowPageScroll ? { overscrollBehavior: 'auto' } : undefined}
        className={big ? `el-content el-big-c${more ? " el-more" : ""}` : "el-content el-small-c"}>
        <p className="el-greet">{letter.greeting}</p>
        {letter.body.map((t, i) => <p key={i}>{t}</p>)}
        <p className="el-sign">{letter.sign}</p>
        {big && <img className="el-mini-seal" src={SEAL} alt="" />}
      </div>
      {big && (
        <span className={`el-scroll-hint${more ? " is-on" : ""}`} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        </span>
      )}
    </>
  );
}

const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];

function EnvelopeLetter({
  greeting = LETTER.greeting,
  body = LETTER.body,
  sign = LETTER.sign,
  lang = 'ar',
  theme = 'romantic',
  onOpened,
  onCompleted,
}: EnvelopeLetterProps = {}) {
  const letter: LetterText = { greeting, body: typeof body === 'string' ? body.split(/\n\s*\n/) : body, sign };
  const layoutGroupId = useId();
  // closed → flap → raised → reading
  const [stage, setStage] = useState<LetterStage>("closed");
  const [flapBehind, setFlapBehind] = useState(false);
  const [hasAdvanced, setHasAdvanced] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stageNode = useRef<HTMLElement>(null);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => {
    const pendingTimers = timers.current;
    return () => pendingTimers.forEach(clearTimeout);
  }, []);

  const open = () => {
    if (stage !== "closed") return;
    setStage("flap");
    later(() => setFlapBehind(true), 700);
    later(() => setStage("raised"), 800);
    later(() => setStage("reading"), 1350);
  };

  useEffect(() => {
    if (stage === 'reading') onOpened?.();
  }, [stage, onOpened]);

  useEffect(() => {
    if (stage !== 'reading' || hasAdvanced) return;
    const node = stageNode.current;
    const content = node?.querySelector<HTMLElement>('.el-big-c');
    if (!node || !content) return;
    let finished = false;
    let touch: { x: number; y: number } | null = null;
    const finish = (reason: 'advance' | 'leave') => {
      if (finished) return;
      finished = true;
      // Keep the unfolded letter in its section when the reader moves on.
      setHasAdvanced(true);
      onCompleted?.(reason);
    };
    const hasMore = () => content.scrollHeight - content.scrollTop - content.clientHeight > 4;
    const insideText = (target: EventTarget | null) => target instanceof Node && content.contains(target);
    const wheel = (event: WheelEvent) => {
      if (finished || event.deltaY <= 0 || Math.abs(event.deltaX) > event.deltaY) return;
      if (insideText(event.target) && hasMore()) return;
      event.preventDefault();
      finish('advance');
    };
    const touchStart = (event: TouchEvent) => {
      const point = event.touches[0];
      touch = point ? { x: point.clientX, y: point.clientY } : null;
    };
    const touchMove = (event: TouchEvent) => {
      const point = event.touches[0];
      if (finished || !touch || !point) return;
      const dy = touch.y - point.clientY;
      if (dy < 14 || dy < Math.abs(touch.x - point.clientX)) return;
      if (insideText(event.target) && hasMore()) return;
      if (event.cancelable) event.preventDefault();
      finish('advance');
    };
    const keyDown = (event: KeyboardEvent) => {
      if (finished || event.shiftKey || !['ArrowDown', 'PageDown', 'End', ' '].includes(event.key)) return;
      event.preventDefault();
      if (hasMore()) {
        const distance = event.key === 'ArrowDown' ? 40 : event.key === 'End' ? content.scrollHeight : content.clientHeight * .9;
        content.scrollBy({ top: distance, behavior: 'instant' });
      } else finish('advance');
    };
    const pageScroll = () => {
      if (node.getBoundingClientRect().top < -8) finish('leave');
    };
    content.focus({ preventScroll: true });
    window.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('touchstart', touchStart, { passive: true });
    window.addEventListener('touchmove', touchMove, { passive: false });
    window.addEventListener('keydown', keyDown);
    window.addEventListener('scroll', pageScroll, { passive: true });
    return () => {
      window.removeEventListener('wheel', wheel);
      window.removeEventListener('touchstart', touchStart);
      window.removeEventListener('touchmove', touchMove);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('scroll', pageScroll);
    };
  }, [stage, hasAdvanced, onCompleted]);

  const flapOpen = stage !== "closed";
  const letterUp = stage === "raised" || stage === "reading";
  const reading = stage === "reading";

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup id={layoutGroupId}>
        <main ref={stageNode} className={`el-stage el-stage--theme-${theme}`} data-theme={theme} lang={lang} dir={lang === "ar" ? "rtl" : "ltr"}>
          <motion.div
            className="el-envelope"
            style={{ "--tex": `url(${TEXTURE})`, "--paper-img": `url(${PAPER})` } as EnvelopeStyle}
            animate={reading ? { y: 110, scale: 0.88, opacity: 0.3 } : { y: 0, scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease }}
          >
            <div className="el-piece el-back" />

            {!reading && (
              <motion.div
                layoutId="letter"
                className="el-paper el-small"
                initial={false}
                animate={{ y: letterUp ? "-32%" : "0%" }}
                transition={{ duration: 0.5, ease }}
              >
                <LetterContent letter={letter} />
              </motion.div>
            )}

            <div className="el-fold el-sides"><div className="el-piece el-side-l" /><div className="el-piece el-side-r" /></div>
            <div className="el-fold el-bottom"><div className="el-piece el-bottom-p" /></div>

            <motion.div
              className="el-fold el-flap-wrap"
              style={{ zIndex: flapBehind ? 1 : 5 }}
              animate={{ rotateX: flapOpen ? 180 : 0 }}
              transition={{ duration: 0.7, ease: [0.65, 0, 0.35, 1], delay: flapOpen ? 0.25 : 0 }}
            >
              <div className="el-piece el-flap" />
            </motion.div>

            <motion.button
              className="el-seal"
              type="button"
              disabled={flapOpen}
              onClick={open}
              aria-label={lang === "ar" ? "افتح الرسالة" : "Open the letter"}
              animate={flapOpen ? { scale: 0.4, opacity: 0, rotate: -30, y: 30 } : { scale: 1, opacity: 1, rotate: 0, y: 0 }}
              whileHover={!flapOpen ? { scale: 1.06 } : undefined}
              whileTap={!flapOpen ? { scale: 0.93 } : undefined}
              transition={{ duration: 0.35 }}
            >
              <img src={SEAL} alt="" draggable="false" />
            </motion.button>
          </motion.div>

          <motion.p className="el-hint" animate={{ opacity: stage === "closed" ? 1 : 0 }}>
            {lang === "ar" ? "اضغط على الختم لفتح الرسالة" : "Click the seal to open the letter"}
          </motion.p>

          <AnimatePresence>
            {reading && (
              <motion.div className="el-overlay" style={{ "--paper-img": `url(${PAPER})` } as EnvelopeStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.article layoutId="letter" className="el-paper el-big"
                  transition={{ type: "spring", stiffness: 130, damping: 20 }}>
                  <LetterContent big allowPageScroll={hasAdvanced} letter={letter} />
                </motion.article>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </LayoutGroup>
    </MotionConfig>
  );
}

export default EnvelopeLetter;

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Pause, Play, RotateCcw } from 'lucide-react';

interface Exercise555ViewProps {
  personName?: string;
  onExit: () => void;
}

const PHASE_DURATION_MS = 5 * 60 * 1000; // 5 minutes per phase

const PHASES = [
  {
    step: 1,
    title: 'First 5 Minutes · Partner A Speaks',
    subtitle: 'One person shares uninterrupted while the other listens with curiosity.',
    guidance:
      'Pick one real topic on your mind—an expectation, a hope, or something you noticed recently. The listener reflects back what they heard before switching, without jumping to defend or solve.',
  },
  {
    step: 2,
    title: 'Second 5 Minutes · Partner B Speaks',
    subtitle: 'Switch roles—the second person shares uninterrupted while the first listens.',
    guidance:
      'Share your own perspective openly using "I feel" or "I’m hoping for" language. Focus on understanding each other’s viewpoint rather than winning a debate.',
  },
  {
    step: 3,
    title: 'Final 5 Minutes · Discuss Together',
    subtitle: 'Open mutual conversation to summarize what felt clear and what matters next.',
    guidance:
      'Name one thing you appreciated hearing from the other person, and agree on any gentle next step—or simply notice what you learned about each other.',
  },
] as const;

function playGentleChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(528, ctx.currentTime);
    gain.gain.setValueAtTime(0.07, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.2);
  } catch {
    // Gracefully ignore browser audio restrictions
  }
}

export function Exercise555View({ personName, onExit }: Exercise555ViewProps) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [remainingMs, setRemainingMs] = useState(PHASE_DURATION_MS);
  const [endAtMs, setEndAtMs] = useState<number | null>(null);
  const [completed, setCompleted] = useState(false);
  const chimePlayedRef = useRef(false);

  const isRunning = endAtMs !== null;

  useEffect(() => {
    if (!endAtMs) return;

    const syncTimer = () => {
      const left = Math.max(0, endAtMs - Date.now());
      setRemainingMs(left);
      if (left === 0) {
        setEndAtMs(null);
        if (!chimePlayedRef.current) {
          chimePlayedRef.current = true;
          playGentleChime();
        }
      }
    };

    syncTimer();
    const interval = window.setInterval(syncTimer, 250);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') syncTimer();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [endAtMs]);

  const resetPhaseTimer = () => {
    setEndAtMs(null);
    setRemainingMs(PHASE_DURATION_MS);
    chimePlayedRef.current = false;
  };

  const handleToggleRun = () => {
    if (isRunning) {
      setRemainingMs(Math.max(0, endAtMs - Date.now()));
      setEndAtMs(null);
    } else {
      const base = remainingMs <= 0 ? PHASE_DURATION_MS : remainingMs;
      chimePlayedRef.current = false;
      setRemainingMs(base);
      setEndAtMs(Date.now() + base);
    }
  };

  const handleNextPhase = () => {
    if (phaseIndex + 1 >= PHASES.length) {
      setEndAtMs(null);
      setCompleted(true);
    } else {
      setPhaseIndex((prev) => prev + 1);
      resetPhaseTimer();
    }
  };

  const handlePrevPhase = () => {
    if (phaseIndex > 0) {
      setPhaseIndex((prev) => prev - 1);
      resetPhaseTimer();
    }
  };

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const formattedTime = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const fraction = remainingMs / PHASE_DURATION_MS;
  const ringCircumference = 2 * Math.PI * 30;
  const phase = PHASES[phaseIndex]!;

  return (
    <div className="min-h-screen flex flex-col justify-between px-4 sm:px-6 py-6 sm:py-10 bg-[#FAF7F2]">
      <header className="mx-auto w-full max-w-xl flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onExit}
          className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-[#5C574F] hover:text-[#1F1D1A] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to Decks</span>
        </button>

        <div className="text-xs font-medium text-[#5C574F] tabular-nums">
          <span>5-5-5 Guided Listening</span>
          {personName && (
            <>
              <span aria-hidden="true" className="mx-1.5">·</span>
              <span>{personName}</span>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl my-auto py-8">
        {completed ? (
          <section className="animate-card-deal rounded-3xl border border-[#E6DFD5] bg-white p-8 sm:p-10 editorial-deck-shadow space-y-5 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#5E7461]/12 text-[#5E7461]">
              <Check className="h-6 w-6" aria-hidden="true" />
            </div>
            <h1 className="font-serif text-3xl font-normal text-[#1F1D1A]">
              5-5-5 Exercise Complete
            </h1>
            <p className="text-sm leading-relaxed text-[#5C574F] max-w-md mx-auto">
              Thank you for taking 15 unhurried minutes to listen and reflect together. Carry only
              what felt helpful—no pressure to solve everything in one sitting.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setCompleted(false);
                  setPhaseIndex(0);
                  resetPhaseTimer();
                }}
                className="min-h-[46px] rounded-xl border border-[#E6DFD5] bg-[#FAF7F2] px-5 py-2.5 text-sm font-medium text-[#1F1D1A] hover:bg-[#F3EEE6]"
              >
                Run Again
              </button>
              <button
                type="button"
                onClick={onExit}
                className="min-h-[46px] rounded-xl bg-[#1F1D1A] px-6 py-2.5 text-sm font-semibold text-[#FAF7F2] hover:bg-[#35322D]"
              >
                Return to Decks
              </button>
            </div>
          </section>
        ) : (
          <article className="animate-card-deal rounded-3xl border border-[#E6DFD5] bg-white p-7 sm:p-10 editorial-deck-shadow space-y-6">
            <div className="flex items-center justify-between text-xs font-medium text-[#5C574F]">
              <span>Phase {phase.step} of 3</span>
              <span className="font-mono tabular-nums">5-5-5 Method</span>
            </div>

            <div>
              <h1 className="font-serif text-2xl sm:text-3xl font-normal text-[#1F1D1A] leading-snug">
                {phase.title}
              </h1>
              <p className="mt-2 text-sm text-[#5E7461] font-medium">{phase.subtitle}</p>
              <p className="mt-3 text-sm sm:text-base leading-relaxed text-[#5C574F]">
                {phase.guidance}
              </p>
            </div>

            {/* Timestamp-accurate 5-minute countdown */}
            <div className="rounded-2xl border border-[#E6DFD5] bg-[#FAF7F2] p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <svg
                  width="68"
                  height="68"
                  viewBox="0 0 68 68"
                  aria-hidden="true"
                  className="-rotate-90 shrink-0"
                >
                  <circle cx="34" cy="34" r="30" fill="none" stroke="#E6DFD5" strokeWidth="4" />
                  <circle
                    cx="34"
                    cy="34"
                    r="30"
                    fill="none"
                    stroke="#5E7461"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringCircumference * (1 - fraction)}
                    className="transition-all duration-300"
                  />
                </svg>
                <div>
                  <div className="text-xs text-[#5C574F]">Phase Timer</div>
                  <div
                    role="timer"
                    aria-live="off"
                    className="mt-0.5 font-mono text-3xl font-medium tabular-nums text-[#1F1D1A]"
                  >
                    {formattedTime}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleRun}
                  className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[#C85A3F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#AE4830] transition-colors whitespace-nowrap"
                >
                  {isRunning ? (
                    <>
                      <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{remainingMs === PHASE_DURATION_MS ? 'Start 5m' : 'Resume'}</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={resetPhaseTimer}
                  aria-label="Reset 5-minute phase timer"
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E6DFD5] bg-white text-[#5C574F] hover:text-[#1F1D1A] transition-colors"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <p className="text-xs text-[#8A8378] leading-relaxed">
              This is a lightweight structured listening aid—not a validated standalone therapy
              protocol. Pause or skip anytime if a topic feels uncomfortable.
            </p>
          </article>
        )}
      </main>

      {!completed && (
        <footer className="mx-auto w-full max-w-xl flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handlePrevPhase}
            disabled={phaseIndex === 0}
            className="inline-flex min-h-[46px] items-center gap-1.5 rounded-xl border border-[#E6DFD5] bg-white px-4 py-2.5 text-sm font-medium text-[#1F1D1A] hover:bg-[#F3EEE6] disabled:opacity-40 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Previous</span>
          </button>

          <button
            type="button"
            onClick={handleNextPhase}
            className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-[#1F1D1A] px-5 py-2.5 text-sm font-semibold text-[#FAF7F2] hover:bg-[#35322D] transition-colors"
          >
            <span>{phaseIndex + 1 >= PHASES.length ? 'Finish Exercise' : 'Next Phase'}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </footer>
      )}
    </div>
  );
}

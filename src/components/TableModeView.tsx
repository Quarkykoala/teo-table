import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Lock,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Shuffle,
  SkipForward,
  Sparkles,
  X,
} from 'lucide-react';
import { DateCard, DateSession } from '../types';
import {
  countConversationPrompts,
  getBuiltInFollowUp,
  getPromptNumberAtIndex,
  PILLAR_LABELS,
  STAGE_META,
} from '../utils/blueprint';

interface TableModeViewProps {
  session: DateSession;
  cards: DateCard[];
  initialIndex?: number;
  aiEnabled: boolean;
  canSwapCard?: boolean;
  onSwapCard?: (index: number) => void;
  onIndexChange: (index: number) => void;
  onRecordCardShown: (cardId: string) => void;
  onToggleBookmark: (cardId: string) => void;
  onSkipCard: (cardId: string) => void;
  onSelectScenarioOption: (cardId: string, optionId: string) => void;
  onFinishSession: () => void;
  onExitToHome: () => void;
}

const PAUSE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

function playSoftChime() {
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
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.4);
  } catch {
    // Ignore audio errors if blocked by browser autoplay policy
  }
}

export function TableModeView({
  session,
  cards,
  initialIndex = 0,
  aiEnabled,
  canSwapCard = false,
  onSwapCard,
  onIndexChange,
  onRecordCardShown,
  onToggleBookmark,
  onSkipCard,
  onSelectScenarioOption,
  onFinishSession,
  onExitToHome,
}: TableModeViewProps) {
  const safeStart = Math.max(0, Math.min(cards.length - 1, initialIndex));
  const [currentIndex, setCurrentIndex] = useState(safeStart);
  const [deeperPrompt, setDeeperPrompt] = useState<{
    text: string;
    source: 'gemini' | 'local';
  } | null>(null);
  const [deeperError, setDeeperError] = useState<string | null>(null);
  const [isLoadingDeeper, setIsLoadingDeeper] = useState(false);
  const [stancePanelOpen, setStancePanelOpen] = useState(false);

  // Timestamp-accurate 10-minute pause timer state (survives backgrounding)
  const [remainingMs, setRemainingMs] = useState(PAUSE_DURATION_MS);
  const [timerEndAtMs, setTimerEndAtMs] = useState<number | null>(null);
  const chimePlayedRef = useRef(false);

  const currentCard = cards[currentIndex];
  const totalSlots = cards.length;
  const totalPrompts = countConversationPrompts(cards);
  const promptNumber = getPromptNumberAtIndex(cards, currentIndex);
  const isBookmarked = currentCard ? session.bookmarkedCardIds.includes(currentCard.id) : false;
  const selectedOptionId = currentCard ? session.userScenarioChoices[currentCard.id] : undefined;
  const timerRunning = timerEndAtMs !== null;

  useEffect(() => {
    onIndexChange(currentIndex);
  }, [currentIndex]);

  useEffect(() => {
    if (currentCard) {
      onRecordCardShown(currentCard.id);
    }
    setDeeperPrompt(null);
    setDeeperError(null);
    setStancePanelOpen(false);
    setTimerEndAtMs(null);
    setRemainingMs(PAUSE_DURATION_MS);
    chimePlayedRef.current = false;
  }, [currentIndex, currentCard?.id]);

  // Elapsed-timestamp countdown synced with visibilitychange
  useEffect(() => {
    if (!timerEndAtMs) return;

    const syncTimer = () => {
      const left = Math.max(0, timerEndAtMs - Date.now());
      setRemainingMs(left);
      if (left === 0) {
        setTimerEndAtMs(null);
        if (!chimePlayedRef.current) {
          chimePlayedRef.current = true;
          playSoftChime();
        }
      }
    };

    syncTimer();
    const interval = window.setInterval(syncTimer, 250);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncTimer();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [timerEndAtMs]);

  // Keyboard navigation (Left / Right arrows when not inside interactive controls)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setCurrentIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight' && currentIndex + 1 < totalSlots) {
        setCurrentIndex((prev) => Math.min(totalSlots - 1, prev + 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentIndex, totalSlots]);

  if (!currentCard) {
    return null;
  }

  const stageLabel =
    session.stage === 'movie'
      ? `Watch & Talk · ${session.movieTitle || 'Film Night'}`
      : STAGE_META[session.stage].title;

  const progressPercent = Math.round(((currentIndex + 1) / totalSlots) * 100);
  const cardsRemaining = totalSlots - currentIndex - 1;
  const isPauseCard = currentCard.type === 'pause';

  const goPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const goNext = () => {
    if (currentIndex + 1 >= totalSlots) {
      onFinishSession();
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleSkip = () => {
    if (!isPauseCard) {
      onSkipCard(currentCard.id);
    }
    goNext();
  };

  const handleToggleTimer = () => {
    if (timerRunning) {
      setRemainingMs(Math.max(0, timerEndAtMs - Date.now()));
      setTimerEndAtMs(null);
    } else {
      const base = remainingMs <= 0 ? PAUSE_DURATION_MS : remainingMs;
      chimePlayedRef.current = false;
      setRemainingMs(base);
      setTimerEndAtMs(Date.now() + base);
    }
  };

  const handleResetTimer = () => {
    setTimerEndAtMs(null);
    setRemainingMs(PAUSE_DURATION_MS);
    chimePlayedRef.current = false;
  };

  const handleUseBuiltInDeeper = () => {
    setDeeperError(null);
    setDeeperPrompt({
      text: getBuiltInFollowUp(currentCard.pillar, currentCard.id),
      source: 'local',
    });
  };

  const handleGoDeeper = async () => {
    if (!aiEnabled) {
      handleUseBuiltInDeeper();
      return;
    }

    setIsLoadingDeeper(true);
    setDeeperError(null);
    try {
      const res = await fetch('/api/gemini/go-deeper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardText: currentCard.text,
          pillar: currentCard.pillar,
          stage: session.stage,
        }),
      });
      const data = (await res.json()) as { followUp?: string; error?: string };
      if (!res.ok || !data.followUp) {
        setDeeperError(data.error || 'Could not generate a Gemini follow-up right now.');
        return;
      }
      setDeeperPrompt({ text: data.followUp, source: 'gemini' });
    } catch {
      setDeeperError('Network error reaching Gemini. You can retry or use a built-in prompt.');
    } finally {
      setIsLoadingDeeper(false);
    }
  };

  const secondsLeft = Math.ceil(remainingMs / 1000);
  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  const timerFraction = remainingMs / PAUSE_DURATION_MS;
  const ringCircumference = 2 * Math.PI * 22;

  return (
    <div className="min-h-screen flex flex-col justify-between px-4 sm:px-6 py-5 sm:py-8">
      {/* Minimal Distraction-Free Header */}
      <header className="mx-auto w-full max-w-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onExitToHome}
              className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-[#5C574F] hover:text-[#1F1D1A] transition-colors"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Pause &amp; Home</span>
            </button>
            <button
              type="button"
              onClick={onFinishSession}
              className="inline-flex min-h-[44px] items-center gap-1 text-xs font-medium text-[#5C574F] hover:text-[#C85A3F] transition-colors"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Wrap Up</span>
            </button>
          </div>

          <div className="text-xs font-medium text-[#5C574F] tabular-nums text-right">
            <span>{stageLabel}</span>
            <span aria-hidden="true" className="mx-1.5">·</span>
            <span>
              {isPauseCard
                ? 'Screen-Down Pause'
                : `Prompt ${promptNumber} of ${totalPrompts}`}
            </span>
          </div>
        </div>

        <div
          className="mt-3 h-1 w-full overflow-hidden rounded-full bg-[#E6DFD5]"
          role="progressbar"
          aria-label="Session progress"
          aria-valuenow={currentIndex + 1}
          aria-valuemin={1}
          aria-valuemax={totalSlots}
        >
          <div
            className="h-full bg-[#C85A3F] transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      {/* Main Centered Tactile Card Deck */}
      <main className="mx-auto w-full max-w-xl my-auto py-8">
        <div className="relative">
          {cardsRemaining >= 2 && !isPauseCard && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 translate-y-4 rotate-[1.4deg] rounded-3xl border border-[#E6DFD5] bg-[#F3EEE6] opacity-70"
            />
          )}
          {cardsRemaining >= 1 && !isPauseCard && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 translate-y-2 -rotate-[1.2deg] rounded-3xl border border-[#E6DFD5] bg-[#FAF7F2] opacity-90"
            />
          )}

          <article
            key={currentCard.id}
            className={`animate-card-deal relative overflow-hidden rounded-3xl p-7 sm:p-11 editorial-deck-shadow ${
              isPauseCard
                ? 'bg-[#5E7461] text-[#FAF7F2]'
                : 'border border-[#E6DFD5] bg-white text-[#1F1D1A]'
            }`}
          >
            {isPauseCard && (
              <div
                aria-hidden="true"
                className="animate-breathe pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-[#FAF7F2]/15 blur-2xl"
              />
            )}

            {!isPauseCard && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-3 rounded-[20px] border border-[#E6DFD5]/45"
              />
            )}

            <div className="relative">
              <div
                className={`flex items-center justify-between text-xs font-medium tracking-wide ${
                  isPauseCard ? 'text-[#FAF7F2]/85' : 'text-[#5C574F]'
                }`}
              >
                {isPauseCard ? (
                  <span>Screen-Down Pause · Human Connection First</span>
                ) : (
                  <span>
                    {PILLAR_LABELS[currentCard.pillar]} ·{' '}
                    {currentCard.type === 'scenario' ? 'Scenario Discussion' : 'Table Prompt'}
                  </span>
                )}
                <span className="font-mono tabular-nums opacity-75">
                  {isPauseCard
                    ? '10m'
                    : String(promptNumber || 1).padStart(2, '0')}
                </span>
              </div>

              <h1
                className={`mt-5 font-serif text-2xl sm:text-[32px] font-normal leading-[1.26] ${
                  isPauseCard ? 'text-[#FAF7F2]' : 'text-[#1F1D1A]'
                }`}
              >
                {currentCard.text}
              </h1>

              {currentCard.subtext && (
                <p
                  className={`mt-4 text-sm sm:text-base leading-relaxed ${
                    isPauseCard ? 'text-[#FAF7F2]/85' : 'text-[#5C574F]'
                  }`}
                >
                  {currentCard.subtext}
                </p>
              )}

              {/* Discreet, Optional Private Scenario Stance Drawer */}
              {currentCard.type === 'scenario' && currentCard.options && (
                <div className="mt-7 pt-5 border-t border-[#E6DFD5]">
                  <button
                    type="button"
                    onClick={() => setStancePanelOpen((open) => !open)}
                    aria-expanded={stancePanelOpen}
                    className="flex w-full min-h-[44px] items-center justify-between gap-3 rounded-xl bg-[#FAF7F2] px-4 py-2.5 text-left text-xs font-medium text-[#5C574F] hover:text-[#1F1D1A] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Lock className="h-3.5 w-3.5 text-[#5E7461]" aria-hidden="true" />
                      <span>
                        {selectedOptionId
                          ? 'Private personal stance recorded (tap to review or hide)'
                          : 'Optional: Record your own private stance for My Blueprint'}
                      </span>
                    </span>
                    {stancePanelOpen ? (
                      <ChevronUp className="h-4 w-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
                    )}
                  </button>

                  {stancePanelOpen && (
                    <div className="mt-3 space-y-2 animate-card-deal">
                      <p className="text-[11px] text-[#5C574F]">
                        Strictly for your own self-understanding—never scores or profiles your
                        date. You can skip this or change it later.
                      </p>
                      {currentCard.options.map((option, idx) => {
                        const isChosen = selectedOptionId === option.id;
                        const letter = String.fromCharCode(65 + idx);
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => onSelectScenarioOption(currentCard.id, option.id)}
                            aria-pressed={isChosen}
                            className={`flex w-full min-h-[50px] items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C85A3F] ${
                              isChosen
                                ? 'border-[#C85A3F] bg-[#C85A3F]/8 text-[#1F1D1A] font-medium'
                                : 'border-[#E6DFD5] bg-[#FAF7F2]/75 text-[#1F1D1A] hover:border-[#8A8378] hover:bg-[#FAF7F2]'
                            }`}
                          >
                            <span className="flex items-start gap-3">
                              <span
                                className={`mt-0.5 font-mono text-xs font-semibold ${
                                  isChosen ? 'text-[#C85A3F]' : 'text-[#8A8378]'
                                }`}
                              >
                                {letter}
                              </span>
                              <span>{option.label}</span>
                            </span>
                            {isChosen && (
                              <Check
                                className="h-4 w-4 shrink-0 text-[#C85A3F]"
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        );
                      })}
                      {selectedOptionId && (
                        <p className="pt-1 text-xs text-[#5E7461] font-medium">
                          Saved privately to your Dating Blueprint.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Pause & Connect Timestamp-Accurate 10-Minute Timer */}
              {isPauseCard && (
                <div className="mt-8 rounded-2xl bg-[#485B4B]/90 p-5 border border-[#FAF7F2]/15">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <svg
                        width="52"
                        height="52"
                        viewBox="0 0 52 52"
                        aria-hidden="true"
                        className="-rotate-90 shrink-0"
                      >
                        <circle
                          cx="26"
                          cy="26"
                          r="22"
                          fill="none"
                          stroke="rgba(250,247,242,0.2)"
                          strokeWidth="3"
                        />
                        <circle
                          cx="26"
                          cy="26"
                          r="22"
                          fill="none"
                          stroke="#FAF7F2"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeDasharray={ringCircumference}
                          strokeDashoffset={ringCircumference * (1 - timerFraction)}
                          className="transition-all duration-300"
                        />
                      </svg>
                      <div>
                        <div className="text-xs text-[#FAF7F2]/80">Optional 10-Minute Timer</div>
                        <div
                          role="timer"
                          aria-live="off"
                          className="mt-0.5 font-mono text-3xl font-medium tabular-nums text-[#FAF7F2]"
                        >
                          {formatTimer(secondsLeft)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleToggleTimer}
                        className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[#FAF7F2] px-4 py-2 text-xs font-semibold text-[#1F1D1A] hover:bg-white transition-colors whitespace-nowrap"
                      >
                        {timerRunning ? (
                          <>
                            <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Pause</span>
                          </>
                        ) : (
                          <>
                            <Play className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>
                              {remainingMs === PAUSE_DURATION_MS ? 'Start 10m' : 'Resume'}
                            </span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleResetTimer}
                        aria-label="Reset 10-minute timer"
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#FAF7F2]/25 text-[#FAF7F2] hover:bg-[#FAF7F2]/10 transition-colors"
                      >
                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Go Deeper Follow-Up (Gemini or Explicit Offline Fallback) */}
              {deeperPrompt && (
                <div className="mt-6 animate-card-deal rounded-2xl border border-[#E6DFD5] bg-[#FAF7F2] p-5">
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                    <span className="text-[#C85A3F]">Go Deeper Follow-Up</span>
                    <span className="text-[#5C574F] font-normal">
                      {deeperPrompt.source === 'gemini'
                        ? 'Generated by Gemini'
                        : 'Built-in prompt (no AI)'}
                    </span>
                  </div>
                  <p className="mt-1.5 font-serif text-lg text-[#1F1D1A] leading-snug">
                    {deeperPrompt.text}
                  </p>
                </div>
              )}

              {deeperError && (
                <div
                  role="alert"
                  className="mt-5 rounded-xl bg-[#C85A3F]/10 px-4 py-3 text-xs text-[#AE4830] space-y-2"
                >
                  <p>{deeperError}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleGoDeeper}
                      disabled={isLoadingDeeper}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-white border border-[#E6DFD5] px-3 py-1.5 font-semibold text-[#1F1D1A] hover:bg-[#FAF7F2]"
                    >
                      <RefreshCw className="h-3 w-3" aria-hidden="true" />
                      <span>Retry Gemini</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleUseBuiltInDeeper}
                      className="inline-flex min-h-[36px] items-center rounded-lg bg-[#1F1D1A] px-3 py-1.5 font-semibold text-[#FAF7F2] hover:bg-[#35322D]"
                    >
                      Use Built-in Follow-Up
                    </button>
                  </div>
                </div>
              )}
            </div>
          </article>
        </div>
      </main>

      {/* Bottom Card Actions */}
      <footer className="mx-auto w-full max-w-xl space-y-3">
        {!isPauseCard && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleBookmark(currentCard.id)}
              aria-pressed={isBookmarked}
              className={`flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                isBookmarked
                  ? 'border-[#C85A3F] bg-[#C85A3F]/10 text-[#C85A3F]'
                  : 'border-[#E6DFD5] bg-white text-[#5C574F] hover:text-[#1F1D1A]'
              }`}
            >
              <Bookmark
                className={`h-4 w-4 ${isBookmarked ? 'animate-bookmark-pop' : ''}`}
                fill={isBookmarked ? 'currentColor' : 'none'}
                aria-hidden="true"
              />
              <span>{isBookmarked ? 'Saved' : 'Bookmark'}</span>
            </button>

            <button
              type="button"
              onClick={handleGoDeeper}
              disabled={isLoadingDeeper}
              className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#E6DFD5] bg-white px-3.5 py-2 text-xs font-medium text-[#1F1D1A] hover:bg-[#F3EEE6] disabled:opacity-60 transition-colors whitespace-nowrap"
            >
              {isLoadingDeeper ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-[#C85A3F]" aria-hidden="true" />
              )}
              <span>{aiEnabled ? 'Go Deeper' : 'Go Deeper (Built-in)'}</span>
            </button>

            {canSwapCard && onSwapCard && (
              <button
                type="button"
                onClick={() => onSwapCard(currentIndex)}
                className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#E6DFD5] bg-white px-3 py-2 text-xs font-medium text-[#5C574F] hover:text-[#1F1D1A] hover:bg-[#F3EEE6] transition-colors whitespace-nowrap"
              >
                <Shuffle className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Swap</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSkip}
              className="flex min-h-[44px] items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium text-[#5C574F] hover:text-[#1F1D1A] transition-colors whitespace-nowrap"
            >
              <SkipForward className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Skip</span>
            </button>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={goPrevious}
            disabled={currentIndex === 0}
            className="inline-flex min-h-[48px] items-center gap-1.5 rounded-xl border border-[#E6DFD5] bg-white px-4 py-2.5 text-sm font-medium text-[#1F1D1A] hover:bg-[#F3EEE6] disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Previous</span>
          </button>

          {isPauseCard && (
            <button
              type="button"
              onClick={goNext}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium text-[#5C574F] hover:text-[#1F1D1A] transition-colors whitespace-nowrap"
            >
              <SkipForward className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Skip Pause</span>
            </button>
          )}

          <button
            type="button"
            onClick={goNext}
            className="group ml-auto flex min-h-[48px] items-center gap-2 rounded-xl bg-[#1F1D1A] px-5 py-3 text-sm font-semibold text-[#FAF7F2] hover:bg-[#35322D] active:scale-[0.99] transition-all whitespace-nowrap shrink-0"
          >
            <span>{currentIndex + 1 >= totalSlots ? 'Wrap Up Date' : 'Next Card'}</span>
            <ArrowRight
              className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </button>
        </div>
      </footer>
    </div>
  );
}

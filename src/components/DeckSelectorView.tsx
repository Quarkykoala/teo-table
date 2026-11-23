import { useState } from 'react';
import { ArrowLeft, ArrowRight, Clock, Film, Loader2, RefreshCw } from 'lucide-react';
import sparkCover from '../assets/images/deck_spark_cover_1794578285581.jpg';
import storyCover from '../assets/images/deck_story_cover_1794578286516.jpg';
import alignmentCover from '../assets/images/deck_alignment_cover_1794578286907.jpg';
import { buildFallbackMovieCards, SEED_CARDS } from '../data/seedCards';
import { DateCard, DatePerson, DeckStage } from '../types';
import { getStageCardStats, recommendNextStage, STAGE_META } from '../utils/blueprint';

interface DeckSelectorViewProps {
  person?: DatePerson;
  seenCardIds: Set<string>;
  aiEnabled: boolean;
  onBack: () => void;
  onOpenPrivacySettings: () => void;
  onStartStandardDeck: (stage: Exclude<DeckStage, 'movie'>, length: 5 | 10 | 15) => void;
  onStartMovieDeck: (
    movieTitle: string,
    cards: DateCard[],
    sourceMode: 'movie-ai' | 'movie-fallback',
  ) => void;
  onStartExercise555: () => void;
}

const STAGE_ORDER: Array<Exclude<DeckStage, 'movie'>> = ['spark', 'story', 'alignment'];

const STAGE_COVERS: Record<Exclude<DeckStage, 'movie'>, string> = {
  spark: sparkCover,
  story: storyCover,
  alignment: alignmentCover,
};

export function DeckSelectorView({
  person,
  seenCardIds,
  aiEnabled,
  onBack,
  onOpenPrivacySettings,
  onStartStandardDeck,
  onStartMovieDeck,
  onStartExercise555,
}: DeckSelectorViewProps) {
  const recommended = recommendNextStage(person);
  const [sessionLength, setSessionLength] = useState<5 | 10 | 15>(5);
  const [movieTitle, setMovieTitle] = useState('');
  const [movieStage, setMovieStage] = useState<Exclude<DeckStage, 'movie'>>(recommended);
  const [isGenerating, setIsGenerating] = useState(false);
  const [movieError, setMovieError] = useState('');

  const requestAiMovieCards = async () => {
    const cleaned = movieTitle.trim();
    if (!cleaned || cleaned.length < 2) {
      setMovieError('Enter a movie or series title (at least 2 characters).');
      return;
    }

    if (!aiEnabled) {
      setMovieError(
        'AI prompt generation is currently turned off in Privacy & Preferences. Enable Gemini or use the built-in Film & Series prompts below.',
      );
      return;
    }

    setMovieError('');
    setIsGenerating(true);

    try {
      const response = await fetch('/api/gemini/movie-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movieTitle: cleaned, stage: movieStage }),
      });
      const data = (await response.json()) as { cards?: DateCard[]; error?: string };

      if (!response.ok || !data.cards || data.cards.length === 0) {
        setMovieError(data.error || 'Unable to generate Watch & Talk cards right now.');
        return;
      }

      onStartMovieDeck(cleaned, data.cards, 'movie-ai');
    } catch {
      setMovieError(
        'Network error reaching the server. You can retry or launch the built-in Film & Series prompts.',
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateMovie = async (e: React.FormEvent) => {
    e.preventDefault();
    await requestAiMovieCards();
  };

  const handleUseFallbackMovieDeck = () => {
    const cleaned = movieTitle.trim();
    if (!cleaned || cleaned.length < 2) {
      setMovieError('Enter a movie or series title first.');
      return;
    }
    const fallbackCards = buildFallbackMovieCards(cleaned, movieStage);
    onStartMovieDeck(cleaned, fallbackCards, 'movie-fallback');
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-10">
      <div className="animate-editorial-up stagger-1 flex flex-wrap items-end justify-between gap-4 pb-6 border-b border-[#E6DFD5]">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-[#5C574F] hover:text-[#1F1D1A] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back</span>
          </button>
          <h1 className="mt-1 font-serif text-3xl sm:text-4xl font-normal text-[#1F1D1A]">
            {person ? `Choose a deck for ${person.nickname}` : 'Choose tonight’s deck'}
          </h1>
          <p className="mt-1.5 text-xs text-[#5C574F]">
            {person
              ? `${person.metVia ? `Met via ${person.metVia} · ` : ''}${person.datesCount} completed ${
                  person.datesCount === 1 ? 'date' : 'dates'
                } · Suggested: ${STAGE_META[recommended].title} (you can choose any stage)`
              : `${SEED_CARDS.length} curated prompts across 3 stages—fresh cards are always dealt first.`}
          </p>
        </div>

        {/* Session Length Segmented Control */}
        <div className="space-y-1">
          <div
            role="group"
            aria-label="Session length"
            className="inline-flex items-center gap-1 rounded-xl border border-[#E6DFD5] bg-[#F3EEE6] p-1"
          >
            {(
              [
                { value: 5 as const, label: 'Quick · 5' },
                { value: 10 as const, label: 'Full Date · 10' },
                { value: 15 as const, label: 'Deep · 15' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSessionLength(opt.value)}
                aria-pressed={sessionLength === opt.value}
                className={`min-h-[40px] rounded-lg px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap shrink-0 ${
                  sessionLength === opt.value
                    ? 'bg-white text-[#1F1D1A] shadow-xs'
                    : 'text-[#5C574F] hover:text-[#1F1D1A]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-[#5C574F] sm:text-right">
            Screen-down pause added after every 4th prompt.
          </p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        {/* Left: 3 Illustrated Progressive Decks */}
        <div className="lg:col-span-7 space-y-4">
          {STAGE_ORDER.map((stage, index) => {
            const meta = STAGE_META[stage];
            const stats = getStageCardStats(stage, SEED_CARDS, seenCardIds);
            const isRecommended = person && recommended === stage;
            const staggerClass =
              index === 0 ? 'stagger-2' : index === 1 ? 'stagger-3' : 'stagger-4';
            return (
              <button
                key={stage}
                type="button"
                onClick={() => onStartStandardDeck(stage, sessionLength)}
                className={`animate-editorial-up ${staggerClass} group flex w-full flex-col sm:flex-row items-stretch overflow-hidden rounded-2xl border bg-white text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[#C85A3F] editorial-card-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C85A3F] ${
                  isRecommended ? 'border-[#5E7461]' : 'border-[#E6DFD5]'
                }`}
              >
                <div className="relative h-36 sm:h-auto sm:w-44 shrink-0 overflow-hidden bg-[#F3EEE6]">
                  <img
                    src={STAGE_COVERS[stage]}
                    alt={`${meta.title} tactile paper deck`}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>

                <div className="flex flex-1 items-center justify-between gap-4 p-5 sm:p-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 text-xs text-[#5C574F]">
                      <span className="font-mono font-medium text-[#1F1D1A]">
                        0{index + 1}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{meta.dateRange}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {stats.unseen > 0
                          ? `${stats.total} cards · ${stats.unseen} fresh`
                          : `${stats.total} cards · all explored`}
                      </span>
                      {isRecommended && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-[#5E7461]">Suggested</span>
                        </>
                      )}
                    </div>
                    <h2 className="mt-1.5 font-serif text-xl sm:text-2xl font-normal text-[#1F1D1A] group-hover:text-[#C85A3F] transition-colors">
                      {meta.title}
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-[#5C574F]">
                      {meta.subtitle}
                    </p>
                  </div>
                  <ArrowRight
                    className="h-5 w-5 shrink-0 text-[#8A8378] group-hover:text-[#C85A3F] group-hover:translate-x-1 transition-all duration-200"
                    aria-hidden="true"
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Watch & Talk + Optional 5-5-5 Communication Exercise */}
        <div className="lg:col-span-5 space-y-5">
          <section className="animate-editorial-up stagger-3 rounded-3xl border border-[#E6DFD5] bg-[#F3EEE6]/85 p-6 sm:p-7 editorial-card-shadow">
            <div className="flex items-center gap-2 text-xs font-medium text-[#5C574F]">
              <Film className="h-4 w-4 text-[#C85A3F]" aria-hidden="true" />
              <span>Watch &amp; Talk · Film &amp; Series Debrief</span>
            </div>
            <h2 className="mt-2 font-serif text-2xl font-normal text-[#1F1D1A]">
              Movie or Show Debrief
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#5C574F]">
              Enter a film or series you watched together for 4 original prompts exploring choices,
              emotions, communication, and values.
            </p>

            <form onSubmit={handleGenerateMovie} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="movie-title-input"
                  className="block text-xs font-semibold text-[#1F1D1A] mb-1.5"
                >
                  Movie or Series Title
                </label>
                <input
                  id="movie-title-input"
                  type="text"
                  maxLength={120}
                  value={movieTitle}
                  onChange={(e) => {
                    setMovieTitle(e.target.value);
                    if (movieError) setMovieError('');
                  }}
                  placeholder="e.g. Before Sunrise, Past Lives, The Bear"
                  className="w-full min-h-[46px] rounded-xl border border-[#E6DFD5] bg-white px-3.5 py-2.5 text-sm text-[#1F1D1A] placeholder:text-[#8A8378] focus:border-[#C85A3F] focus:outline-none"
                />
              </div>

              <div>
                <span className="block text-xs font-semibold text-[#1F1D1A] mb-1.5">
                  Conversation Stage
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {STAGE_ORDER.map((stage) => {
                    const selected = movieStage === stage;
                    return (
                      <button
                        key={stage}
                        type="button"
                        onClick={() => setMovieStage(stage)}
                        aria-pressed={selected}
                        className={`min-h-[42px] rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                          selected
                            ? 'bg-[#1F1D1A] text-[#FAF7F2]'
                            : 'bg-white border border-[#E6DFD5] text-[#5C574F] hover:text-[#1F1D1A]'
                        }`}
                      >
                        {stage === 'spark'
                          ? 'Dates 1–2'
                          : stage === 'story'
                            ? 'Dates 3–4'
                            : 'Dates 5+'}
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className="text-[11px] leading-relaxed text-[#5C574F]">
                {aiEnabled
                  ? 'Sends only the title and selected stage to Gemini—no personal history or names.'
                  : 'AI generation is currently off. You can enable it in Privacy or use built-in prompts.'}
              </p>

              {movieError && (
                <div
                  role="alert"
                  className="rounded-xl bg-[#C85A3F]/10 px-3.5 py-3 text-xs text-[#AE4830] space-y-2.5"
                >
                  <p>{movieError}</p>
                  <div className="flex flex-wrap gap-2">
                    {aiEnabled ? (
                      <button
                        type="button"
                        onClick={requestAiMovieCards}
                        disabled={isGenerating}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#1F1D1A] border border-[#E6DFD5] hover:bg-[#FAF7F2]"
                      >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Retry Gemini</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onOpenPrivacySettings}
                        className="inline-flex min-h-[36px] items-center rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#1F1D1A] border border-[#E6DFD5] hover:bg-[#FAF7F2]"
                      >
                        Privacy &amp; AI Settings
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleUseFallbackMovieDeck}
                      className="inline-flex min-h-[36px] items-center rounded-lg bg-[#1F1D1A] px-3 py-1.5 text-xs font-semibold text-[#FAF7F2] hover:bg-[#35322D]"
                    >
                      Use Built-in Prompts
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <button
                  type="submit"
                  disabled={isGenerating}
                  className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#1F1D1A] px-4 py-3 text-sm font-semibold text-[#FAF7F2] hover:bg-[#35322D] disabled:opacity-60 transition-all"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      <span>Crafting 4 prompts...</span>
                    </>
                  ) : (
                    <>
                      <span>Generate 4 AI Movie Prompts</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleUseFallbackMovieDeck}
                  className="flex w-full min-h-[42px] items-center justify-center rounded-xl border border-[#E6DFD5] bg-white px-4 py-2 text-xs font-medium text-[#5C574F] hover:text-[#1F1D1A] hover:bg-[#FAF7F2] transition-colors"
                >
                  Play Built-in Film &amp; Series Prompts (No AI)
                </button>
              </div>
            </form>
          </section>

          {/* Optional 5-5-5 Communication Exercise */}
          <section className="animate-editorial-up stagger-4 rounded-2xl border border-[#E6DFD5] bg-white p-5 editorial-card-shadow">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-[#5E7461]">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Optional Communication Aid · 15 mins</span>
                </div>
                <h3 className="mt-1 font-serif text-lg font-medium text-[#1F1D1A]">
                  5-5-5 Guided Listening
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[#5C574F]">
                  Five minutes each for uninterrupted sharing, followed by five minutes of mutual
                  discussion.
                </p>
              </div>
              <button
                type="button"
                onClick={onStartExercise555}
                className="shrink-0 min-h-[44px] rounded-xl border border-[#E6DFD5] bg-[#FAF7F2] px-3.5 py-2 text-xs font-semibold text-[#1F1D1A] hover:border-[#C85A3F] hover:text-[#C85A3F] transition-colors whitespace-nowrap"
              >
                Open Timer
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

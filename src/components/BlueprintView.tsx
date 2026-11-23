import { useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import { SEED_CARDS } from '../data/seedCards';
import {
  AppPreferences,
  BlueprintSummary,
  DateSession,
  PostDatePulse,
  SpectrumTraitKey,
  UserBlueprint,
} from '../types';
import {
  aggregateBookmarkedPillars,
  buildDeterministicBlueprintSummary,
  describeSpectrumTendency,
  getSpectrumCitations,
} from '../utils/blueprint';

interface BlueprintViewProps {
  blueprint: UserBlueprint;
  preferences: AppPreferences;
  sessions: DateSession[];
  pulses: PostDatePulse[];
  onUpdateAiSummary: (summary: BlueprintSummary) => void;
  onUpdatePreferences: (updates: Partial<AppPreferences>) => void;
  onLoadDemoData: () => void;
  onStartDate: () => void;
}

interface SpectrumConfig {
  key: SpectrumTraitKey;
  title: string;
  leftLabel: string;
  rightLabel: string;
}

const SPECTRUMS: SpectrumConfig[] = [
  {
    key: 'spontaneityVsPlanning',
    title: 'Rhythm & Structure',
    leftLabel: 'Structured Planner',
    rightLabel: 'Spontaneous Explorer',
  },
  {
    key: 'familyInterdependence',
    title: 'Extended Family Boundaries',
    leftLabel: 'Independent Couple Unit',
    rightLabel: 'Family-Woven',
  },
  {
    key: 'conflictRepairSpeed',
    title: 'Conflict Repair Preferences',
    leftLabel: 'Reflect & Cool Down First',
    rightLabel: 'Resolve Immediately',
  },
  {
    key: 'careerVsRoots',
    title: 'Mobility & Roots',
    leftLabel: 'Deeply Rooted',
    rightLabel: 'Career & City Mobile',
  },
];

export function BlueprintView({
  blueprint,
  preferences,
  sessions,
  pulses,
  onUpdateAiSummary,
  onUpdatePreferences,
  onLoadDemoData,
  onStartDate,
}: BlueprintViewProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiError, setAiError] = useState('');
  const [expandedSpectrum, setExpandedSpectrum] = useState<SpectrumTraitKey | null>(null);

  const totalScenarioEvidence = Object.values(blueprint.dimensions.evidenceCounts).reduce(
    (a, b) => a + b,
    0,
  );
  const hasAnyData = sessions.length > 0 || pulses.length > 0;
  const hasEnoughEvidenceForAi = totalScenarioEvidence >= 2 || pulses.length >= 2;
  const ringCircumference = 2 * Math.PI * 26;
  const breakdown = blueprint.completenessBreakdown;

  const citationsByDomain = getSpectrumCitations(sessions, SEED_CARDS);
  const localSummary = buildDeterministicBlueprintSummary(
    blueprint.dimensions,
    sessions,
    pulses,
    SEED_CARDS,
  );

  const handleGenerateInsights = async () => {
    if (!preferences.allowBlueprintAi) {
      setAiError('Turn on the Blueprint AI opt-in toggle below before sending data to Gemini.');
      return;
    }
    if (!hasEnoughEvidenceForAi) {
      setAiError(
        'Record at least 2 scenario stances or 2 private reflections first so Gemini can ground insights in real observations.',
      );
      return;
    }

    setAiError('');
    setIsAnalyzing(true);
    try {
      const bookmarkedPillars = aggregateBookmarkedPillars(sessions, SEED_CARDS);
      const response = await fetch('/api/gemini/blueprint-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consentGranted: true,
          includePrivateNotes: preferences.includePrivateNotesInAi,
          dimensions: {
            spontaneityVsPlanning: blueprint.dimensions.spontaneityVsPlanning,
            familyInterdependence: blueprint.dimensions.familyInterdependence,
            conflictRepairSpeed: blueprint.dimensions.conflictRepairSpeed,
            careerVsRoots: blueprint.dimensions.careerVsRoots,
          },
          evidenceCounts: blueprint.dimensions.evidenceCounts,
          topicsExploredCount: blueprint.dimensions.topicsExploredCount,
          bookmarkedPillars,
          pulses: pulses.map((p) => ({
            energy: p.energy,
            perceivedResponsiveness: p.perceivedResponsiveness,
            nextDecision: p.nextDecision,
            tags: p.tags,
            ...(preferences.includePrivateNotesInAi && p.privateNote
              ? { privateNote: p.privateNote }
              : {}),
          })),
          sessionCount: sessions.length,
        }),
      });
      const data = (await response.json()) as {
        summary?: BlueprintSummary;
        error?: string;
      };
      if (!response.ok || !data.summary) {
        setAiError(data.error || 'Could not synthesize your Blueprint via Gemini right now.');
        return;
      }
      onUpdateAiSummary(data.summary);
    } catch {
      setAiError(
        'Network error reaching Gemini. Your on-device Local Pattern Summary below remains available.',
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-10 space-y-8">
      {/* Header + Transparent Participation Completeness */}
      <section className="animate-editorial-up stagger-1 rounded-3xl border border-[#E6DFD5] bg-white p-6 sm:p-8 editorial-card-shadow space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <p className="text-xs font-medium text-[#5E7461]">
              Personal Self-Understanding Profile · Private Vault
            </p>
            <h1 className="mt-1 font-serif text-3xl sm:text-4xl font-normal text-[#1F1D1A]">
              {preferences.userName
                ? `${preferences.userName}’s Dating Blueprint`
                : 'My Dating Blueprint'}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#5C574F] tabular-nums">
              <span>
                {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {pulses.length} {pulses.length === 1 ? 'reflection' : 'reflections'}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Conversation topics explored: {blueprint.dimensions.topicsExploredCount}/7 (
                {blueprint.dimensions.promptsExploredCount} prompts)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <svg
                width="64"
                height="64"
                viewBox="0 0 64 64"
                aria-hidden="true"
                className="-rotate-90"
              >
                <circle cx="32" cy="32" r="26" fill="none" stroke="#F3EEE6" strokeWidth="5" />
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  fill="none"
                  stroke="#5E7461"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={
                    ringCircumference * (1 - blueprint.completenessPercent / 100)
                  }
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <span className="absolute font-mono text-sm font-semibold tabular-nums text-[#1F1D1A]">
                {blueprint.completenessPercent}%
              </span>
            </div>
            <div className="text-xs text-[#5C574F]">
              <div className="font-semibold text-[#1F1D1A]">Participation</div>
              <div>Tracks recorded inputs</div>
            </div>
          </div>
        </div>

        {/* Transparent Completeness Breakdown */}
        <div className="pt-4 border-t border-[#E6DFD5] space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs tabular-nums">
            <div className="rounded-xl bg-[#FAF7F2] px-3.5 py-2.5">
              <div className="flex items-center justify-between text-[#1F1D1A] font-medium">
                <span>Scenario choices</span>
                <span>
                  {breakdown.scenarioCount}/{breakdown.scenarioTarget}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-[#5C574F]">
                Contributes {breakdown.scenarioPercent}% (of 45%)
              </div>
            </div>
            <div className="rounded-xl bg-[#FAF7F2] px-3.5 py-2.5">
              <div className="flex items-center justify-between text-[#1F1D1A] font-medium">
                <span>Private reflections</span>
                <span>
                  {breakdown.reflectionCount}/{breakdown.reflectionTarget}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-[#5C574F]">
                Contributes {breakdown.reflectionPercent}% (of 35%)
              </div>
            </div>
            <div className="rounded-xl bg-[#FAF7F2] px-3.5 py-2.5">
              <div className="flex items-center justify-between text-[#1F1D1A] font-medium">
                <span>Stages explored</span>
                <span>
                  {breakdown.stagesExploredCount}/{breakdown.stagesTarget}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-[#5C574F]">
                Contributes {breakdown.stagePercent}% (of 20%)
              </div>
            </div>
          </div>
          <p className="text-[11px] text-[#5C574F]">
            Completeness measures your participation across cards and reflections—never emotional
            maturity, relationship readiness, or compatibility.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Preference Spectrums (-10 to +10) with Evidence & Citations */}
        <section className="animate-editorial-up stagger-2 lg:col-span-6 rounded-3xl border border-[#E6DFD5] bg-white p-6 sm:p-7 editorial-card-shadow space-y-6">
          <div>
            <h2 className="font-serif text-2xl font-normal text-[#1F1D1A]">
              Preference Spectrums
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[#5C574F]">
              Mapped from -10 to +10 strictly from your own explicitly recorded Scenario choices.
              Preferences naturally evolve—never permanent personality labels.
            </p>
          </div>

          <div className="space-y-6">
            {SPECTRUMS.map((item) => {
              const count = blueprint.dimensions.evidenceCounts[item.key];
              const value = blueprint.dimensions[item.key];
              const markerLeftPercent = ((value + 10) / 20) * 100;
              const citations = citationsByDomain[item.key];
              const isExpanded = expandedSpectrum === item.key;

              return (
                <div key={item.key} className="space-y-2 pb-5 border-b border-[#E6DFD5]/70 last:border-b-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[#1F1D1A]">{item.title}</span>
                    <span className="font-mono text-[#5C574F] tabular-nums">
                      {count === 0
                        ? 'Limited evidence'
                        : `${value > 0 ? `+${value}` : value} · ${count} ${
                            count === 1 ? 'choice' : 'choices'
                          }`}
                    </span>
                  </div>

                  {count > 0 ? (
                    <div className="relative h-2.5 w-full rounded-full bg-[#F3EEE6]">
                      <div
                        aria-hidden="true"
                        className="absolute top-0 bottom-0 left-1/2 w-px bg-[#8A8378]/45"
                      />
                      <div
                        className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#C85A3F] shadow-sm transition-all duration-500 ease-out"
                        style={{ left: `${markerLeftPercent}%` }}
                      />
                    </div>
                  ) : (
                    <div className="h-2.5 w-full rounded-full border border-dashed border-[#8A8378]/40 bg-[#FAF7F2]" />
                  )}

                  <div className="flex items-center justify-between text-[11px] text-[#5C574F]">
                    <span>{item.leftLabel}</span>
                    <span>{item.rightLabel}</span>
                  </div>

                  <p className="text-xs leading-relaxed text-[#5C574F]">
                    {describeSpectrumTendency(item.key, value, count)}
                  </p>

                  {citations.length > 0 && (
                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedSpectrum(isExpanded ? null : item.key)
                        }
                        aria-expanded={isExpanded}
                        className="inline-flex min-h-[36px] items-center gap-1 text-[11px] font-medium text-[#5E7461] hover:text-[#485B4B]"
                      >
                        <span>
                          {isExpanded ? 'Hide recorded choices' : 'View recorded evidence'}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                      </button>

                      {isExpanded && (
                        <ul className="mt-2 space-y-2 rounded-xl bg-[#FAF7F2] p-3 text-xs text-[#5C574F]">
                          {citations.map((c) => (
                            <li key={c.cardId} className="space-y-0.5">
                              <div className="text-[#1F1D1A] font-medium">“{c.choiceLabel}”</div>
                              <div className="text-[11px] text-[#5C574F]">
                                On: {c.cardText}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {!hasAnyData && (
            <div className="rounded-2xl bg-[#FAF7F2] border border-[#E6DFD5] p-4 text-xs text-[#5C574F] flex flex-wrap items-center justify-between gap-3">
              <span>Play scenario cards or load example dates to populate your spectrums.</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onLoadDemoData}
                  className="min-h-[38px] rounded-lg border border-[#E6DFD5] bg-white px-3 py-1.5 font-medium text-[#1F1D1A] hover:bg-[#F3EEE6]"
                >
                  Load Example Data
                </button>
                <button
                  type="button"
                  onClick={onStartDate}
                  className="min-h-[38px] rounded-lg bg-[#C85A3F] px-3 py-1.5 font-medium text-white hover:bg-[#AE4830]"
                >
                  Play Deck
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Right: On-Device Local Summary + Opt-In Gemini Pattern Insights */}
        <div className="lg:col-span-6 space-y-6">
          {/* Deterministic On-Device Summary (Always Available Without AI) */}
          <section className="animate-editorial-up stagger-3 rounded-3xl border border-[#E6DFD5] bg-white p-6 sm:p-7 editorial-card-shadow space-y-4">
            <div>
              <p className="text-xs font-medium text-[#5E7461]">On-Device Summary · No AI</p>
              <h2 className="mt-1 font-serif text-2xl font-normal text-[#1F1D1A]">
                Local Pattern Summary
              </h2>
              <p className="mt-1 text-xs text-[#5C574F]">{localSummary.evidenceNote}</p>
            </div>

            <dl className="space-y-4 pt-3 border-t border-[#E6DFD5]">
              <div>
                <dt className="text-xs font-semibold text-[#5E7461]">Core Strength</dt>
                <dd className="mt-1 text-sm leading-relaxed text-[#1F1D1A]">
                  {localSummary.coreStrength}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-[#1F1D1A]">A Pattern Worth Exploring</dt>
                <dd className="mt-1 text-sm leading-relaxed text-[#1F1D1A]">
                  {localSummary.patternWorthExploring}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-[#C85A3F]">A Potential Blind Spot</dt>
                <dd className="mt-1 text-sm leading-relaxed text-[#1F1D1A]">
                  {localSummary.potentialBlindSpot}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-[#5C574F]">
                  Suggested Focus for Your Next Date
                </dt>
                <dd className="mt-1 text-sm leading-relaxed text-[#1F1D1A]">
                  {localSummary.nextRecommendedTopic}
                </dd>
              </div>
            </dl>
          </section>

          {/* Opt-In Gemini Pattern Insights */}
          <section className="animate-editorial-up stagger-4 rounded-3xl border border-[#E6DFD5] bg-[#F3EEE6]/85 p-6 sm:p-7 editorial-card-shadow space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-[#5C574F]">
                  <Sparkles className="h-3.5 w-3.5 text-[#C85A3F]" aria-hidden="true" />
                  <span>Optional External AI Synthesis (Gemini)</span>
                </div>
                <h2 className="mt-1 font-serif text-2xl font-normal text-[#1F1D1A]">
                  AI Pattern Insights
                </h2>
              </div>

              <button
                type="button"
                onClick={handleGenerateInsights}
                disabled={isAnalyzing || !preferences.allowBlueprintAi || !hasEnoughEvidenceForAi}
                className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[#1F1D1A] px-4 py-2 text-xs font-semibold text-[#FAF7F2] hover:bg-[#35322D] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    <span>Synthesizing...</span>
                  </>
                ) : (
                  <span>
                    {blueprint.aiSummary ? 'Refresh AI Insights' : 'Synthesize with Gemini'}
                  </span>
                )}
              </button>
            </div>

            {/* Transparent Opt-In Consent Toggle */}
            <div className="rounded-2xl border border-[#E6DFD5] bg-white p-4 space-y-2.5">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.allowBlueprintAi}
                  onChange={(e) => {
                    onUpdatePreferences({ allowBlueprintAi: e.target.checked });
                    setAiError('');
                  }}
                  className="mt-1 h-4 w-4 rounded accent-[#5E7461]"
                />
                <span className="text-xs leading-relaxed text-[#1F1D1A]">
                  <strong>Opt in to Blueprint AI synthesis:</strong> Allow TwoTable to send only
                  anonymized spectrum numbers, bookmarked theme counts, and reflection mood/tag
                  counts to Gemini when I click Synthesize. Connection names are always stripped,
                  and free-text private notes remain excluded unless separately enabled in Privacy
                  settings.
                </span>
              </label>
            </div>

            {aiError && (
              <p
                role="alert"
                className="rounded-xl bg-[#C85A3F]/10 px-3.5 py-2.5 text-xs text-[#AE4830]"
              >
                {aiError}
              </p>
            )}

            {blueprint.aiSummary ? (
              <div className="space-y-4 pt-3 border-t border-[#E6DFD5] animate-card-deal">
                <p className="text-[11px] text-[#5C574F]">{blueprint.aiSummary.evidenceNote}</p>
                <dl className="space-y-4">
                  <div>
                    <dt className="text-xs font-semibold text-[#5E7461]">Core Strength</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-[#1F1D1A]">
                      {blueprint.aiSummary.coreStrength}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-[#1F1D1A]">
                      A Pattern Worth Exploring
                    </dt>
                    <dd className="mt-1 text-sm leading-relaxed text-[#1F1D1A]">
                      {blueprint.aiSummary.patternWorthExploring}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-[#C85A3F]">A Potential Blind Spot</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-[#1F1D1A]">
                      {blueprint.aiSummary.potentialBlindSpot}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-[#5C574F]">
                      Suggested Focus for Your Next Date
                    </dt>
                    <dd className="mt-1 text-sm leading-relaxed text-[#1F1D1A]">
                      {blueprint.aiSummary.nextRecommendedTopic}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : (
              <p className="text-xs leading-relaxed text-[#5C574F]">
                {!hasEnoughEvidenceForAi
                  ? 'Evidence is still sparse. Record at least 2 scenario stances or 2 private reflections before requesting Gemini synthesis.'
                  : preferences.allowBlueprintAi
                    ? 'Ready when you are—tap "Synthesize with Gemini" for an exploratory reflection grounded strictly in your recorded choices.'
                    : 'Opt in above if you would like Gemini to synthesize these patterns, or rely solely on the on-device Local Pattern Summary.'}
              </p>
            )}

            <div className="pt-3 border-t border-[#E6DFD5] flex items-start gap-2 text-[11px] text-[#5C574F] leading-relaxed">
              <ShieldCheck className="h-4 w-4 shrink-0 text-[#5E7461] mt-0.5" aria-hidden="true" />
              <p>
                TwoTable supports self-reflection—it is not a psychological assessment, therapy
                service, or compatibility predictor. Your Private Vault remains local on this device
                and strictly separate from any future matchmaking features.
              </p>
            </div>
          </section>
        </div>
      </div>

      {/* Subtle Vault Separation Footer Note */}
      <div className="flex items-center gap-2 text-xs text-[#8A8378] pt-2">
        <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          Private Vault architecture: your reflections and history stay local on this browser and
          never construct partner profiles.
        </span>
      </div>
    </div>
  );
}

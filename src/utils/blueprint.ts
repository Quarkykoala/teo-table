import {
  BlueprintDimensions,
  BlueprintSummary,
  CardPillar,
  CompletenessBreakdown,
  DateCard,
  DatePerson,
  DateSession,
  DeckStage,
  PostDatePulse,
  SpectrumCitation,
  SpectrumTraitKey,
} from '../types';
import { FALLBACK_FOLLOWUPS_BY_PILLAR, PAUSE_CARD_TEMPLATE } from '../data/seedCards';

export const STAGE_META: Record<
  Exclude<DeckStage, 'movie'>,
  {
    title: string;
    subtitle: string;
    dateRange: string;
    researchNote: string;
  }
> = {
  spark: {
    title: 'Spark & Curiosity',
    subtitle: 'Playful curiosity and everyday delights without the interview vibe.',
    dateRange: 'Dates 1–2',
    researchNote: 'Reciprocal curiosity & lighthearted disclosure',
  },
  story: {
    title: 'Story & Depth',
    subtitle: 'Warm vulnerability, care styles, and the chapters that shaped you.',
    dateRange: 'Dates 3–4',
    researchNote: 'Gradual self-disclosure & perceived responsiveness',
  },
  alignment: {
    title: 'Life & Alignment',
    subtitle: 'Real-world tradeoffs on family, money, conflict, household life, and futures.',
    dateRange: 'Dates 5+',
    researchNote: 'Shared life values & intentional decisions',
  },
};

export const REFLECTION_TAGS = [
  'Shared humor',
  'Meaningful connection',
  'Similar values',
  'Questions about family expectations',
  'Different financial priorities',
  'Difficulty connecting emotionally',
  'Felt listened to',
  'Comfortable being myself',
] as const;

export const OPTIONAL_MILESTONES = [
  { id: '3-dates', label: '3 dates', group: '3-3-3 heuristic' },
  { id: '3-weeks', label: '3 weeks', group: '3-3-3 heuristic' },
  { id: '3-months', label: '3 months', group: '3-3-3 & 3-6-9 heuristic' },
  { id: '6-months', label: '6 months', group: '3-6-9 heuristic' },
  { id: '9-months', label: '9 months', group: '3-6-9 heuristic' },
] as const;

export const MAJOR_CITIES = [
  'Bangalore',
  'Mumbai',
  'Delhi NCR',
  'Hyderabad',
  'Pune',
  'Singapore',
  'New York',
  'San Francisco',
  'London',
] as const;

export const PILLAR_LABELS: Record<CardPillar, string> = {
  curiosity: 'Curiosity',
  empathy: 'Empathy & Care',
  conflict: 'Conflict Repair',
  money: 'Money Mindset',
  family: 'Family & Roots',
  lifestyle: 'Lifestyle & Rhythm',
  dreams: 'Shared Futures',
};

/**
 * Recommends a stage based on completed dates:
 * - Dates 1–2 (0 or 1 completed dates so far -> upcoming Date 1 or 2): Spark & Curiosity
 * - Dates 3–4 (2 or 3 completed dates so far -> upcoming Date 3 or 4): Story & Depth
 * - Date 5+ (4+ completed dates so far -> upcoming Date 5+): Life & Alignment
 */
export function recommendNextStage(person?: DatePerson): Exclude<DeckStage, 'movie'> {
  if (!person || person.datesCount <= 1) return 'spark';
  if (person.datesCount <= 3) return 'story';
  return 'alignment';
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export interface BuildDeckOptions {
  seenCardIds?: Iterable<string>;
  shuffle?: boolean;
  rng?: () => number;
}

function shuffleWithRng<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/**
 * Picks up to `count` cards from a pool while preferring a balanced mix of prompts and scenarios
 * and gently spacing scenarios apart so they don't cluster back-to-back.
 */
function pickBalancedFromPool(pool: DateCard[], count: number, desiredScenarios: number): DateCard[] {
  if (count <= 0 || pool.length === 0) return [];
  if (pool.length <= count) return pool.slice(0, count);

  const scenarios = pool.filter((c) => c.type === 'scenario');
  const prompts = pool.filter((c) => c.type !== 'scenario');

  const scenarioTake = Math.min(desiredScenarios, scenarios.length, count);
  const promptTake = Math.min(count - scenarioTake, prompts.length);
  const chosenScenarios = scenarios.slice(0, scenarioTake);
  const chosenPrompts = prompts.slice(0, promptTake);

  // If prompts ran short, top up from remaining scenarios
  const remainingNeeded = count - (chosenScenarios.length + chosenPrompts.length);
  if (remainingNeeded > 0) {
    chosenScenarios.push(...scenarios.slice(scenarioTake, scenarioTake + remainingNeeded));
  }

  // Interleave scenarios gently across the session (never opening cold with a scenario if prompts exist)
  if (chosenScenarios.length === 0) return chosenPrompts;
  if (chosenPrompts.length === 0) return chosenScenarios;

  const result: DateCard[] = [];
  const interval = Math.max(2, Math.floor((chosenPrompts.length + chosenScenarios.length) / (chosenScenarios.length + 1)));
  let pIdx = 0;
  let sIdx = 0;
  let sinceLastScenario = 0;

  while (pIdx < chosenPrompts.length || sIdx < chosenScenarios.length) {
    if (
      sIdx < chosenScenarios.length &&
      (sinceLastScenario >= interval || pIdx >= chosenPrompts.length)
    ) {
      result.push(chosenScenarios[sIdx++]!);
      sinceLastScenario = 0;
    } else if (pIdx < chosenPrompts.length) {
      result.push(chosenPrompts[pIdx++]!);
      sinceLastScenario += 1;
    }
  }

  return result;
}

/**
 * Collects card IDs already shown for a specific connection (or across non-demo Quick Start sessions).
 */
export function getSeenCardIdsForContext(
  sessions: DateSession[],
  personId?: string,
): Set<string> {
  const seen = new Set<string>();
  for (const session of sessions) {
    if (personId) {
      if (session.personId !== personId) continue;
    } else {
      if (session.personId || session.isDemo) continue;
    }
    for (const id of session.cardsShownIds) {
      if (!id.startsWith('pause-')) {
        seen.add(id);
      }
    }
  }
  return seen;
}

/**
 * Returns total, unseen (fresh), and seen counts for a standard deck stage.
 */
export function getStageCardStats(
  stage: Exclude<DeckStage, 'movie'>,
  allCards: DateCard[],
  seenCardIds: Set<string>,
): { total: number; unseen: number; seen: number } {
  const stageCards = allCards.filter((c) => c.type !== 'pause' && c.stage === stage);
  let seen = 0;
  for (const card of stageCards) {
    if (seenCardIds.has(card.id)) seen += 1;
  }
  return {
    total: stageCards.length,
    seen,
    unseen: Math.max(0, stageCards.length - seen),
  };
}

/**
 * Draws a fresh unused card from the same stage for in-session swapping.
 */
export function drawFreshCardFromStage(
  stage: Exclude<DeckStage, 'movie'>,
  allCards: DateCard[],
  excludeIds: Set<string>,
  seenCardIds?: Set<string>,
  rng: () => number = Math.random,
): DateCard | null {
  const stagePool = allCards.filter(
    (c) => c.type !== 'pause' && c.stage === stage && !excludeIds.has(c.id),
  );
  if (stagePool.length === 0) return null;

  const unseen = seenCardIds
    ? stagePool.filter((c) => !seenCardIds.has(c.id))
    : stagePool;
  const candidates = unseen.length > 0 ? unseen : stagePool;
  return candidates[Math.floor(rng() * candidates.length)] ?? null;
}

/**
 * Builds a playable card sequence for Table Mode.
 * - Quick (5): 5 distinct conversation prompts + 1 screen-down pause after prompt 4 (6 slots).
 * - Full (10): 10 distinct conversation prompts + 2 screen-down pauses after prompts 4 & 8 (12 slots).
 * - Deep Evening (15): 15 distinct conversation prompts + 3 screen-down pauses after prompts 4, 8 & 12 (18 slots).
 * - Movie (4): 4 movie prompts + 1 screen-down pause after prompt 4 (5 slots).
 * Strictly prioritizes unseen cards before repeating any seen card, and pause cards NEVER reduce prompt counts.
 */
export function buildSessionDeck(
  stage: DeckStage,
  length: 5 | 10 | 15,
  allCards: DateCard[],
  customMovieCards?: DateCard[],
  options?: BuildDeckOptions,
): DateCard[] {
  const nonPauseCards = allCards.filter((card) => card.type !== 'pause');
  let selectedPrompts: DateCard[] = [];

  if (stage === 'movie' && customMovieCards && customMovieCards.length > 0) {
    selectedPrompts = customMovieCards.filter((card) => card.type !== 'pause').slice(0, 4);
  } else {
    const primaryStage = stage === 'movie' ? 'spark' : stage;
    const primaryCards = nonPauseCards.filter((card) => card.stage === primaryStage);
    const seenSet = new Set(options?.seenCardIds ?? []);
    const shouldShuffle = options?.shuffle !== false;
    const rng = options?.rng ?? Math.random;

    const unseenPrimary = primaryCards.filter((c) => !seenSet.has(c.id));
    const seenPrimary = primaryCards.filter((c) => seenSet.has(c.id));

    const orderedUnseen = shouldShuffle ? shuffleWithRng(unseenPrimary, rng) : unseenPrimary;
    const orderedSeen = shouldShuffle ? shuffleWithRng(seenPrimary, rng) : seenPrimary;

    const desiredScenarios = length === 5 ? 1 : length === 10 ? 2 : 3;

    if (orderedUnseen.length >= length) {
      selectedPrompts = pickBalancedFromPool(orderedUnseen, length, desiredScenarios);
    } else {
      // Take all unseen cards first so fresh prompts are never skipped, then top up from seen primary
      const unseenScenarios = orderedUnseen.filter((c) => c.type === 'scenario').length;
      const remainingScenarios = Math.max(0, desiredScenarios - unseenScenarios);
      const topUp = pickBalancedFromPool(
        orderedSeen,
        length - orderedUnseen.length,
        remainingScenarios,
      );
      selectedPrompts = [...orderedUnseen, ...topUp];

      // Safety fallback if a tiny custom card library ever has fewer than `length` primary cards
      if (selectedPrompts.length < length) {
        const chosenIds = new Set(selectedPrompts.map((c) => c.id));
        const adjacentPool = nonPauseCards.filter((c) => !chosenIds.has(c.id));
        const extras = (shouldShuffle ? shuffleWithRng(adjacentPool, rng) : adjacentPool).slice(
          0,
          length - selectedPrompts.length,
        );
        selectedPrompts = [...selectedPrompts, ...extras];
      }
    }
  }

  // Insert an anti-phubbing Pause & Connect card after every 4th conversation prompt
  const deck: DateCard[] = [];
  selectedPrompts.forEach((card, index) => {
    deck.push(card);
    if ((index + 1) % 4 === 0) {
      deck.push({
        ...PAUSE_CARD_TEMPLATE,
        id: `pause-${stage}-${index + 1}`,
        stage,
      });
    }
  });

  return deck;
}

/**
 * Counts only conversation prompts (excluding Pause cards) in a deck.
 */
export function countConversationPrompts(cards: DateCard[]): number {
  return cards.filter((c) => c.type !== 'pause').length;
}

/**
 * Returns the 1-based conversation prompt index for a deck slot (or null if it's a pause card).
 */
export function getPromptNumberAtIndex(cards: DateCard[], index: number): number | null {
  const card = cards[index];
  if (!card || card.type === 'pause') return null;
  let promptNum = 0;
  for (let i = 0; i <= index; i++) {
    if (cards[i]?.type !== 'pause') {
      promptNum += 1;
    }
  }
  return promptNum;
}

/**
 * Computes the user's own preference spectrums strictly from explicitly recorded scenario choices.
 * Scale mapping: each scenario option carries traitValue in [-2, +2], multiplied by 5 to map onto [-10, +10],
 * then averaged across all distinct answered scenario cards for that domain.
 * Never scores or profiles the other person.
 */
export function calculateBlueprintDimensions(
  sessions: DateSession[],
  allCards: DateCard[],
): BlueprintDimensions {
  const cardById = new Map<string, DateCard>();
  allCards.forEach((c) => cardById.set(c.id, c));
  sessions.forEach((s) => s.customCards?.forEach((c) => cardById.set(c.id, c)));

  // Collect latest choice per scenario card so preferences can evolve over time cleanly
  const latestChoices = new Map<string, string>();
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
  );

  for (const session of sortedSessions) {
    for (const [cardId, optionId] of Object.entries(session.userScenarioChoices)) {
      latestChoices.set(cardId, optionId);
    }
  }

  const sums: Record<SpectrumTraitKey, number[]> = {
    spontaneityVsPlanning: [],
    familyInterdependence: [],
    conflictRepairSpeed: [],
    careerVsRoots: [],
  };

  for (const [cardId, optionId] of latestChoices.entries()) {
    const card = cardById.get(cardId);
    const option = card?.options?.find((o) => o.id === optionId);
    if (option) {
      sums[option.traitKey].push(option.traitValue * 5);
    }
  }

  const avg = (vals: number[]): number => {
    if (vals.length === 0) return 0;
    const total = vals.reduce((acc, v) => acc + v, 0);
    return Math.round(clamp(total / vals.length, -10, 10));
  };

  const exploredPillars = new Set<CardPillar>();
  const exploredPrompts = new Set<string>();

  for (const session of sessions) {
    for (const cardId of session.cardsShownIds) {
      if (cardId.startsWith('pause-')) continue;
      const card = cardById.get(cardId);
      if (card && card.type !== 'pause') {
        exploredPrompts.add(cardId);
        exploredPillars.add(card.pillar);
      }
    }
  }

  return {
    spontaneityVsPlanning: avg(sums.spontaneityVsPlanning),
    familyInterdependence: avg(sums.familyInterdependence),
    conflictRepairSpeed: avg(sums.conflictRepairSpeed),
    careerVsRoots: avg(sums.careerVsRoots),
    evidenceCounts: {
      spontaneityVsPlanning: sums.spontaneityVsPlanning.length,
      familyInterdependence: sums.familyInterdependence.length,
      conflictRepairSpeed: sums.conflictRepairSpeed.length,
      careerVsRoots: sums.careerVsRoots.length,
    },
    topicsExploredCount: exploredPillars.size,
    promptsExploredCount: exploredPrompts.size,
  };
}

/**
 * Collects the exact recorded scenario citations backing each spectrum domain.
 */
export function getSpectrumCitations(
  sessions: DateSession[],
  allCards: DateCard[],
): Record<SpectrumTraitKey, SpectrumCitation[]> {
  const cardById = new Map<string, DateCard>();
  allCards.forEach((c) => cardById.set(c.id, c));
  sessions.forEach((s) => s.customCards?.forEach((c) => cardById.set(c.id, c)));

  const latestChoices = new Map<string, string>();
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
  );
  for (const session of sortedSessions) {
    for (const [cardId, optionId] of Object.entries(session.userScenarioChoices)) {
      latestChoices.set(cardId, optionId);
    }
  }

  const citations: Record<SpectrumTraitKey, SpectrumCitation[]> = {
    spontaneityVsPlanning: [],
    familyInterdependence: [],
    conflictRepairSpeed: [],
    careerVsRoots: [],
  };

  for (const [cardId, optionId] of latestChoices.entries()) {
    const card = cardById.get(cardId);
    const option = card?.options?.find((o) => o.id === optionId);
    if (card && option) {
      citations[option.traitKey].push({
        cardId: card.id,
        cardText: card.text,
        choiceLabel: option.label,
        traitValue: option.traitValue * 5,
      });
    }
  }

  return citations;
}

/**
 * Nuanced, non-diagnostic description for each spectrum domain based on recorded choices.
 */
export function describeSpectrumTendency(
  key: SpectrumTraitKey,
  value: number,
  evidenceCount: number,
): string {
  if (evidenceCount === 0) {
    return 'No scenario choices recorded in this area yet. Tap a private stance on a Scenario card whenever you’d like to explore it.';
  }

  const qualifier =
    evidenceCount === 1
      ? 'Based on 1 choice so far, you currently lean toward'
      : `Based on ${evidenceCount} recorded choices, you currently seem to prefer`;

  switch (key) {
    case 'spontaneityVsPlanning':
      if (value >= 4) return `${qualifier} keeping plans open, flexible, and spontaneous.`;
      if (value <= -4) return `${qualifier} thoughtful planning, structure, and clear rhythms.`;
      return `${qualifier} balancing light structure with room for spontaneity.`;
    case 'familyInterdependence':
      if (value >= 4) return `${qualifier} keeping extended family closely woven into daily life and choices.`;
      if (value <= -4) return `${qualifier} preserving clear independence as a two-person household unit.`;
      return `${qualifier} warm family closeness paired with clear couple boundaries.`;
    case 'conflictRepairSpeed':
      if (value >= 4) return `${qualifier} talking disagreements through soon rather than letting them linger.`;
      if (value <= -4) return `${qualifier} taking calm space to reflect before discussing tense topics.`;
      return `${qualifier} offering quick reassurance first, then working through tension calmly.`;
    case 'careerVsRoots':
      if (value >= 4) return `${qualifier} staying open to relocation and new cities for career chapters.`;
      if (value <= -4) return `${qualifier} staying rooted near established family, friends, and community.`;
      return `${qualifier} weighing career moves and rootedness chapter by chapter.`;
  }
}

/**
 * Calculates transparent participation-based Blueprint completeness (0–100%).
 * Participation metric only—never emotional maturity, readiness, or compatibility.
 */
export function calculateCompletenessBreakdown(
  sessions: DateSession[],
  pulses: PostDatePulse[],
  allCards: DateCard[],
): CompletenessBreakdown {
  const scenarioCards = allCards.filter((c) => c.type === 'scenario');
  const answeredScenarios = new Set<string>();
  const stagesExplored = new Set<DeckStage>();

  for (const s of sessions) {
    stagesExplored.add(s.stage);
    Object.keys(s.userScenarioChoices).forEach((id) => answeredScenarios.add(id));
  }

  const scenarioTarget = Math.min(6, Math.max(1, scenarioCards.length));
  const reflectionTarget = 3;
  const stagesTarget = 3;

  const scenarioRatio = Math.min(1, answeredScenarios.size / scenarioTarget);
  const reflectionRatio = Math.min(1, pulses.length / reflectionTarget);
  const stageRatio = Math.min(1, stagesExplored.size / stagesTarget);

  const scenarioPercent = Math.round(scenarioRatio * 45);
  const reflectionPercent = Math.round(reflectionRatio * 35);
  const stagePercent = Math.round(stageRatio * 20);
  const totalPercent = clamp(scenarioPercent + reflectionPercent + stagePercent, 0, 100);

  return {
    totalPercent,
    scenarioCount: answeredScenarios.size,
    scenarioTarget,
    scenarioPercent,
    reflectionCount: pulses.length,
    reflectionTarget,
    reflectionPercent,
    stagesExploredCount: stagesExplored.size,
    stagesTarget,
    stagePercent,
  };
}

export function calculateCompletenessPercent(
  sessions: DateSession[],
  pulses: PostDatePulse[],
  allCards: DateCard[],
): number {
  return calculateCompletenessBreakdown(sessions, pulses, allCards).totalPercent;
}

export function aggregateBookmarkedPillars(
  sessions: DateSession[],
  allCards: DateCard[],
): Record<CardPillar, number> {
  const counts: Record<CardPillar, number> = {
    curiosity: 0,
    empathy: 0,
    conflict: 0,
    money: 0,
    family: 0,
    lifestyle: 0,
    dreams: 0,
  };

  const cardById = new Map<string, DateCard>();
  allCards.forEach((c) => cardById.set(c.id, c));
  sessions.forEach((s) => s.customCards?.forEach((c) => cardById.set(c.id, c)));

  for (const session of sessions) {
    for (const cardId of session.bookmarkedCardIds) {
      const card = cardById.get(cardId);
      if (card) {
        counts[card.pillar] += 1;
      }
    }
  }

  return counts;
}

/**
 * Deterministic, on-device local pattern summary (no AI required).
 * Uses tentative, evidence-referenced language and avoids diagnosing or profiling partners.
 */
export function buildDeterministicBlueprintSummary(
  dimensions: BlueprintDimensions,
  sessions: DateSession[],
  pulses: PostDatePulse[],
  allCards: DateCard[],
): BlueprintSummary {
  const totalScenarioEvidence = Object.values(dimensions.evidenceCounts).reduce((a, b) => a + b, 0);
  const bookmarkedPillars = aggregateBookmarkedPillars(sessions, allCards);
  const sortedPillars = (Object.entries(bookmarkedPillars) as Array<[CardPillar, number]>)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  const topPillar = sortedPillars[0]?.[0];
  const unexploredPillars = (Object.keys(PILLAR_LABELS) as CardPillar[]).filter(
    (p) => bookmarkedPillars[p] === 0,
  );

  const energizedOrCalmCount = pulses.filter(
    (p) => p.energy === 'energized' || p.energy === 'calm',
  ).length;
  const highRespCount = pulses.filter((p) => p.perceivedResponsiveness === 'high').length;

  const tagCounts = new Map<string, number>();
  for (const pulse of pulses) {
    for (const tag of pulse.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }
  const topTag = [...tagCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  const evidenceNote = `Derived locally from ${totalScenarioEvidence} scenario ${
    totalScenarioEvidence === 1 ? 'choice' : 'choices'
  }, ${pulses.length} private ${pulses.length === 1 ? 'reflection' : 'reflections'}, and ${
    dimensions.topicsExploredCount
  }/7 conversation topics explored.`;

  // Sparse data state: acknowledge limited evidence transparently
  if (totalScenarioEvidence < 2 && pulses.length < 2) {
    return {
      coreStrength:
        'You have started building a private record of what matters to you rather than leaving early dating on autopilot.',
      patternWorthExploring:
        'Evidence is still sparse—recording a couple of Scenario stances and 2–3 Morning-After Mirror entries will reveal clearer recurring themes.',
      potentialBlindSpot:
        'With limited entries so far, it is too early to spot consistent blind spots; stay curious about which conversations leave you feeling energized versus guarded.',
      nextRecommendedTopic:
        unexploredPillars.length > 0
          ? `Consider exploring ${PILLAR_LABELS[unexploredPillars[0]]} on an upcoming date when the timing feels natural.`
          : 'Try a 5-card Story & Depth deck on your next date and log a quick reflection afterward.',
      evidenceNote,
      updatedAt: new Date().toISOString(),
      source: 'local',
    };
  }

  const coreStrength = topPillar
    ? topPillar === 'curiosity'
      ? 'Your bookmarked prompts point toward playful, genuine curiosity, suggesting you value substance over surface-level small talk.'
      : `Your bookmarked prompts point toward genuine interest in ${PILLAR_LABELS[topPillar].toLowerCase()}, suggesting you value substance over surface-level small talk.`
    : 'You are taking time after dates to notice your own feelings and preferences clearly rather than rushing decisions.';

  let patternWorthExploring = '';
  if (pulses.length > 0) {
    patternWorthExploring = `Across ${pulses.length} recorded ${
      pulses.length === 1 ? 'reflection' : 'reflections'
    }, you felt energized or calm & safe after ${energizedOrCalmCount} of them and felt heard in ${highRespCount}.${
      topTag ? ` "${topTag}" has appeared most frequently in what stood out to you.` : ''
    }`;
  } else {
    patternWorthExploring = `You have recorded ${totalScenarioEvidence} scenario preferences so far—adding a few Morning-After Mirror check-ins will help connect your stated preferences to how dates actually feel.`;
  }

  const zeroEvidenceDomains = (
    Object.entries(dimensions.evidenceCounts) as Array<[SpectrumTraitKey, number]>
  )
    .filter(([, count]) => count === 0)
    .map(([key]) => {
      switch (key) {
        case 'spontaneityVsPlanning':
          return 'everyday rhythm & planning';
        case 'familyInterdependence':
          return 'extended family boundaries';
        case 'conflictRepairSpeed':
          return 'conflict repair pace';
        case 'careerVsRoots':
          return 'relocation & rootedness';
      }
    });

  const potentialBlindSpot =
    zeroEvidenceDomains.length > 0
      ? `You have not yet recorded scenario stances on ${zeroEvidenceDomains.slice(0, 2).join(' or ')}; important assumptions can go unspoken when a topic stays untested.`
      : 'Notice whether your stated scenario preferences match what actually leaves you feeling calm and understood in your post-date reflections.';

  const nextRecommendedTopic =
    unexploredPillars.length > 0
      ? `You haven’t bookmarked prompts in ${PILLAR_LABELS[unexploredPillars[0]]} yet—consider bringing one into a future conversation when it feels right.`
      : 'Revisit a Life & Alignment card on household rhythms, money habits, or conflict repair whenever you feel ready to go deeper.';

  return {
    coreStrength,
    patternWorthExploring,
    potentialBlindSpot,
    nextRecommendedTopic,
    evidenceNote,
    updatedAt: new Date().toISOString(),
    source: 'local',
  };
}

/**
 * Picks a deterministic built-in follow-up prompt when AI is off or unavailable.
 */
export function getBuiltInFollowUp(pillar: CardPillar, cardId: string): string {
  const options = FALLBACK_FOLLOWUPS_BY_PILLAR[pillar] || FALLBACK_FOLLOWUPS_BY_PILLAR.curiosity;
  const hash = cardId.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return options[hash % options.length]!;
}

/**
 * Formats keepsake share text strictly from public/bookmarked prompts.
 * NEVER includes private reflections, scenario choices, connection names, or AI insights.
 */
export function formatWhatsAppShareText(
  session: DateSession,
  bookmarkedCards: DateCard[],
  shareUrl: string,
): string {
  const stageLabel =
    session.stage === 'movie'
      ? `Watch & Talk: ${session.movieTitle || 'Movie Night'}`
      : STAGE_META[session.stage].title;

  const lines: string[] = [
    `Questions we loved talking through tonight (${stageLabel}):`,
    '',
  ];

  const nonPauseBookmarks = bookmarkedCards.filter((c) => c.type !== 'pause');
  if (nonPauseBookmarks.length > 0) {
    nonPauseBookmarks.slice(0, 3).forEach((card, idx) => {
      lines.push(`${idx + 1}. "${card.text}"`);
    });
  } else {
    const promptCount = session.cardsShownIds.filter((id) => !id.startsWith('pause-')).length;
    lines.push(
      `Put the phone down and explored ${promptCount || 1} conversation ${
        promptCount === 1 ? 'prompt' : 'prompts'
      } together.`,
    );
  }

  lines.push('');
  lines.push(`Date with curiosity. Choose with clarity — TwoTable: ${shareUrl}`);
  return lines.join('\n');
}

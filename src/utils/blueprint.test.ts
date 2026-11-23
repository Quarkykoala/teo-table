import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateBookmarkedPillars,
  buildDeterministicBlueprintSummary,
  buildSessionDeck,
  calculateBlueprintDimensions,
  calculateCompletenessBreakdown,
  calculateCompletenessPercent,
  countConversationPrompts,
  describeSpectrumTendency,
  drawFreshCardFromStage,
  formatWhatsAppShareText,
  getBuiltInFollowUp,
  getPromptNumberAtIndex,
  getSeenCardIdsForContext,
  getSpectrumCitations,
  getStageCardStats,
  recommendNextStage,
} from './blueprint';
import {
  buildFallbackMovieCards,
  DEMO_PULSES,
  DEMO_SESSIONS,
  FALLBACK_FOLLOWUPS_BY_PILLAR,
  SEED_CARDS,
} from '../data/seedCards';
import { DateCard, DatePerson, DateSession, SpectrumTraitKey } from '../types';

test('seed library contains 90 unique cards with 30 per stage and balanced scenario spectrums', () => {
  assert.equal(SEED_CARDS.length, 90);
  const ids = new Set(SEED_CARDS.map((c) => c.id));
  assert.equal(ids.size, 90);
  assert.equal(SEED_CARDS.filter((c) => c.stage === 'spark').length, 30);
  assert.equal(SEED_CARDS.filter((c) => c.stage === 'story').length, 30);
  assert.equal(SEED_CARDS.filter((c) => c.stage === 'alignment').length, 30);

  // All 21 legacy card IDs remain intact for backward-compatible saved sessions
  for (let i = 1; i <= 7; i++) {
    assert.ok(ids.has(`spark-${i}`));
    assert.ok(ids.has(`story-${i}`));
    assert.ok(ids.has(`align-${i}`));
  }

  // Scenario cards span all 4 Blueprint spectrums evenly (5 each = 20 total)
  const scenarioCards = SEED_CARDS.filter((c) => c.type === 'scenario');
  assert.equal(scenarioCards.length, 20);
  const traitCounts: Record<SpectrumTraitKey, number> = {
    spontaneityVsPlanning: 0,
    familyInterdependence: 0,
    conflictRepairSpeed: 0,
    careerVsRoots: 0,
  };
  for (const card of scenarioCards) {
    assert.ok(card.options && card.options.length === 3, `Expected 3 options on ${card.id}`);
    traitCounts[card.options[0]!.traitKey] += 1;
  }
  assert.equal(traitCounts.spontaneityVsPlanning, 5);
  assert.equal(traitCounts.familyInterdependence, 5);
  assert.equal(traitCounts.conflictRepairSpeed, 5);
  assert.equal(traitCounts.careerVsRoots, 5);

  // Built-in Go Deeper follow-ups provide 6 prompts per pillar
  for (const [pillar, prompts] of Object.entries(FALLBACK_FOLLOWUPS_BY_PILLAR)) {
    assert.ok(prompts.length >= 6, `Expected >=6 follow-ups for ${pillar}`);
  }
});

test('recommendNextStage progresses by completed datesCount', () => {
  const basePerson: DatePerson = {
    id: '1',
    nickname: 'Aarav',
    metVia: 'Hinge',
    datesCount: 0,
    createdAt: '2026-11-01T00:00:00.000Z',
    lastDateAt: '2026-11-10T00:00:00.000Z',
    status: 'active',
  };

  assert.equal(recommendNextStage(undefined), 'spark');
  assert.equal(recommendNextStage({ ...basePerson, datesCount: 0 }), 'spark');
  assert.equal(recommendNextStage({ ...basePerson, datesCount: 1 }), 'spark');
  assert.equal(recommendNextStage({ ...basePerson, datesCount: 2 }), 'story');
  assert.equal(recommendNextStage({ ...basePerson, datesCount: 3 }), 'story');
  assert.equal(recommendNextStage({ ...basePerson, datesCount: 4 }), 'alignment');
  assert.equal(recommendNextStage({ ...basePerson, datesCount: 7 }), 'alignment');
});

test('buildSessionDeck delivers exact 5, 10, and 15 unique stage-pure prompts with pauses after every 4th prompt', () => {
  // 5-prompt Quick deck: 5 prompts + 1 pause after prompt 4 = 6 slots
  const quickDeck = buildSessionDeck('spark', 5, SEED_CARDS, undefined, { rng: () => 0.42 });
  assert.equal(countConversationPrompts(quickDeck), 5);
  assert.equal(quickDeck.length, 6);
  assert.equal(quickDeck[4]?.type, 'pause');
  assert.equal(getPromptNumberAtIndex(quickDeck, 3), 4);
  assert.equal(getPromptNumberAtIndex(quickDeck, 4), null);
  assert.equal(getPromptNumberAtIndex(quickDeck, 5), 5);
  assert.ok(quickDeck.filter((c) => c.type !== 'pause').every((c) => c.stage === 'spark'));

  // 10-prompt Full & 15-prompt Deep decks across all stages stay stage-pure and duplicate-free
  for (const stage of ['spark', 'story', 'alignment'] as const) {
    const fullDeck = buildSessionDeck(stage, 10, SEED_CARDS, undefined, { rng: () => 0.31 });
    const fullPrompts = fullDeck.filter((c) => c.type !== 'pause');
    assert.equal(fullPrompts.length, 10, `Expected 10 prompts for ${stage}`);
    assert.equal(new Set(fullPrompts.map((c) => c.id)).size, 10, `Duplicate prompts in ${stage}`);
    assert.ok(fullPrompts.every((c) => c.stage === stage));
    assert.equal(fullDeck.length, 12);
    assert.equal(fullDeck[4]?.type, 'pause');
    assert.equal(fullDeck[9]?.type, 'pause');

    const deepDeck = buildSessionDeck(stage, 15, SEED_CARDS, undefined, { rng: () => 0.77 });
    const deepPrompts = deepDeck.filter((c) => c.type !== 'pause');
    assert.equal(deepPrompts.length, 15);
    assert.equal(new Set(deepPrompts.map((c) => c.id)).size, 15);
    assert.ok(deepPrompts.every((c) => c.stage === stage));
    assert.equal(deepDeck.length, 18);
    assert.equal(deepDeck[4]?.type, 'pause');
    assert.equal(deepDeck[9]?.type, 'pause');
    assert.equal(deepDeck[14]?.type, 'pause');
  }

  // Watch & Talk 4-prompt deck + pause after 4th prompt
  const movieCards: DateCard[] = buildFallbackMovieCards('Past Lives', 'story');
  const movieDeck = buildSessionDeck('movie', 5, SEED_CARDS, movieCards);
  assert.equal(countConversationPrompts(movieDeck), 4);
  assert.equal(movieDeck.length, 5);
  assert.equal(movieDeck[4]?.type, 'pause');
});

test('fresh-first deck dealing avoids repeats across 3 consecutive 10-card sessions and supports swapping', () => {
  const seen = new Set<string>();
  for (let round = 0; round < 3; round++) {
    const deck = buildSessionDeck('story', 10, SEED_CARDS, undefined, {
      seenCardIds: seen,
      rng: () => 0.25,
    });
    const prompts = deck.filter((c) => c.type !== 'pause');
    assert.equal(prompts.length, 10);
    for (const card of prompts) {
      assert.equal(seen.has(card.id), false, `Repeated card ${card.id} on round ${round + 1}`);
      seen.add(card.id);
    }
  }
  assert.equal(seen.size, 30);

  const statsDone = getStageCardStats('story', SEED_CARDS, seen);
  assert.equal(statsDone.total, 30);
  assert.equal(statsDone.unseen, 0);
  assert.equal(statsDone.seen, 30);

  // Scoped seen-card lookup separates connections from Quick Start
  const scoped = getSeenCardIdsForContext(DEMO_SESSIONS, 'demo-person-1');
  assert.equal(scoped.has('spark-1'), true);
  assert.equal(scoped.has('story-1'), false);

  // In-session swap draws an unused unseen card from the same stage
  const activeDeck = buildSessionDeck('spark', 5, SEED_CARDS, undefined, { rng: () => 0.5 });
  const activeIds = new Set(activeDeck.map((c) => c.id));
  const swapped = drawFreshCardFromStage('spark', SEED_CARDS, activeIds, scoped, () => 0.1);
  assert.ok(swapped);
  assert.equal(swapped.stage, 'spark');
  assert.equal(activeIds.has(swapped.id), false);
});

test('calculateBlueprintDimensions derives spectrum values, evidence counts, and allows evolution over time', () => {
  const earlier: DateSession = {
    id: 's1',
    stage: 'alignment',
    startedAt: '2026-11-01T18:00:00.000Z',
    durationMinutes: 60,
    cardsShownIds: ['align-1', 'align-2', 'align-4', 'spark-3'],
    bookmarkedCardIds: ['align-3'],
    skippedCardIds: [],
    userScenarioChoices: {
      'align-1': 'align-1-a', // careerVsRoots: +2 -> +10
      'align-2': 'align-2-c', // familyInterdependence: -2 -> -10
      'align-4': 'align-4-a', // conflictRepairSpeed: +2 -> +10
      'spark-3': 'spark-3-c', // spontaneityVsPlanning: -2 -> -10
    },
  };

  // Re-answering align-4 later updates preference rather than permanently locking it
  const later: DateSession = {
    id: 's2',
    stage: 'alignment',
    startedAt: '2026-11-12T18:00:00.000Z',
    durationMinutes: 45,
    cardsShownIds: ['align-4'],
    bookmarkedCardIds: [],
    skippedCardIds: [],
    userScenarioChoices: {
      'align-4': 'align-4-b', // conflictRepairSpeed: -2 -> -10
    },
  };

  const dims = calculateBlueprintDimensions([earlier, later], SEED_CARDS);
  assert.equal(dims.careerVsRoots, 10);
  assert.equal(dims.familyInterdependence, -10);
  assert.equal(dims.conflictRepairSpeed, -10);
  assert.equal(dims.spontaneityVsPlanning, -10);
  assert.equal(dims.evidenceCounts.conflictRepairSpeed, 1);
  assert.ok(dims.topicsExploredCount >= 3);
  assert.equal(dims.promptsExploredCount, 4);

  const citations = getSpectrumCitations([earlier, later], SEED_CARDS);
  assert.equal(citations.conflictRepairSpeed.length, 1);
  assert.match(citations.conflictRepairSpeed[0]!.choiceLabel, /Pause calmly/);
});

test('limited-evidence spectrum descriptions use nuanced non-diagnostic language', () => {
  const emptyDesc = describeSpectrumTendency('conflictRepairSpeed', 0, 0);
  assert.match(emptyDesc, /No scenario choices recorded/i);

  const singleDesc = describeSpectrumTendency('conflictRepairSpeed', -10, 1);
  assert.match(singleDesc, /Based on 1 choice so far/);
  assert.doesNotMatch(singleDesc, /avoidant|disorder|poor/i);
});

test('calculateCompletenessBreakdown tracks transparent participation criteria', () => {
  const empty = calculateCompletenessBreakdown([], [], SEED_CARDS);
  assert.equal(empty.totalPercent, 0);
  assert.equal(empty.scenarioCount, 0);
  assert.equal(empty.reflectionCount, 0);

  const demo = calculateCompletenessBreakdown(DEMO_SESSIONS, DEMO_PULSES, SEED_CARDS);
  assert.equal(demo.totalPercent, calculateCompletenessPercent(DEMO_SESSIONS, DEMO_PULSES, SEED_CARDS));
  assert.equal(demo.reflectionCount, 3);
  assert.equal(demo.reflectionPercent, 35);
  assert.equal(demo.stagesExploredCount, 3);
  assert.equal(demo.stagePercent, 20);
  assert.ok(demo.totalPercent >= 90);
});

test('deterministic Blueprint summary acknowledges sparse data and grounds populated data in evidence', () => {
  const emptyDims = calculateBlueprintDimensions([], SEED_CARDS);
  const sparse = buildDeterministicBlueprintSummary(emptyDims, [], [], SEED_CARDS);
  assert.equal(sparse.source, 'local');
  assert.match(sparse.patternWorthExploring, /sparse/i);

  const demoDims = calculateBlueprintDimensions(DEMO_SESSIONS, SEED_CARDS);
  const populated = buildDeterministicBlueprintSummary(
    demoDims,
    DEMO_SESSIONS,
    DEMO_PULSES,
    SEED_CARDS,
  );
  assert.match(populated.evidenceNote, /3 private reflections/);
  assert.doesNotMatch(
    JSON.stringify(populated),
    /Aarav|Kavya|Rohan|avoidant|anxious attachment|compatibility score/i,
  );
});

test('aggregateBookmarkedPillars and built-in follow-ups work cleanly offline', () => {
  const counts = aggregateBookmarkedPillars(DEMO_SESSIONS, SEED_CARDS);
  assert.equal(counts.curiosity, 1);
  assert.equal(counts.lifestyle, 1);
  assert.equal(counts.empathy, 1);
  assert.equal(counts.family, 1);
  assert.equal(counts.money, 1);
  assert.equal(counts.dreams, 1);

  const followUp = getBuiltInFollowUp('conflict', 'align-4');
  assert.ok(followUp.length > 15);
});

test('formatWhatsAppShareText includes up to 3 bookmarked prompts and leaks zero private info', () => {
  const session: DateSession = {
    ...DEMO_SESSIONS[0]!,
    bookmarkedCardIds: ['spark-1', 'spark-2', 'spark-4', 'spark-5'],
    userScenarioChoices: { 'spark-3': 'spark-3-c' },
  };
  const bookmarked = SEED_CARDS.filter((c) => session.bookmarkedCardIds.includes(c.id));
  const text = formatWhatsAppShareText(session, bookmarked, 'https://twotable.app');

  assert.match(text, /Spark & Curiosity/);
  assert.match(text, /1\./);
  assert.match(text, /3\./);
  assert.doesNotMatch(text, /4\./); // Caps at 3 bookmarked prompts
  assert.match(text, /https:\/\/twotable\.app/);
  // Must NEVER leak connection names, scenario stances, or private notes
  assert.doesNotMatch(text, /Aarav|Kavya|Rohan|spark-3-c|energized|private/i);
});

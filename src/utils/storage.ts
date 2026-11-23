import {
  DEMO_PEOPLE,
  DEMO_PULSES,
  DEMO_SESSIONS,
  SEED_CARDS,
} from '../data/seedCards';
import {
  AppPreferences,
  CARD_LIBRARY_VERSION,
  ConnectionStatus,
  DatePerson,
  DateSession,
  DeckStage,
  MetViaSource,
  PostDatePulse,
  SCHEMA_VERSION,
  TwoTableStore,
} from '../types';
import {
  calculateBlueprintDimensions,
  calculateCompletenessBreakdown,
} from './blueprint';

export const STORAGE_KEY_V2 = 'twotable_store_v2';
export const STORAGE_KEY_V1 = 'twotable_store_v1';

const VALID_STAGES = new Set<DeckStage>(['spark', 'story', 'alignment', 'movie']);
const VALID_MET_VIA = new Set<MetViaSource>([
  'Hinge',
  'Bumble',
  'Matrimony',
  'IRL',
  'Friends',
  'Other',
]);
const VALID_STATUSES = new Set<ConnectionStatus>([
  'active',
  'paused',
  'exclusive',
  'archived',
  'ended',
]);
const VALID_ENERGIES = new Set<PostDatePulse['energy']>([
  'energized',
  'calm',
  'guarded',
  'drained',
]);
const VALID_RESPONSIVENESS = new Set<PostDatePulse['perceivedResponsiveness']>([
  'high',
  'moderate',
  'low',
]);
const VALID_DECISIONS = new Set<PostDatePulse['nextDecision']>(['yes', 'unsure', 'no']);

export interface StorageResult {
  ok: boolean;
  error?: string;
}

export interface ImportValidationResult {
  ok: boolean;
  store?: TwoTableStore;
  error?: string;
}

export function createDefaultPreferences(): AppPreferences {
  return {
    userName: '',
    city: 'Bangalore',
    aiEnabled: true,
    allowBlueprintAi: false, // Explicit opt-in required before transmitting Blueprint/reflection data
    includePrivateNotesInAi: false, // Private free-text notes excluded by default
  };
}

export function createInitialStore(): TwoTableStore {
  const emptyDims = calculateBlueprintDimensions([], SEED_CARDS);
  const emptyBreakdown = calculateCompletenessBreakdown([], [], SEED_CARDS);
  return {
    schemaVersion: SCHEMA_VERSION,
    cardLibraryVersion: CARD_LIBRARY_VERSION,
    preferences: createDefaultPreferences(),
    people: [],
    sessions: [],
    pulses: [],
    blueprint: {
      dimensions: emptyDims,
      completenessPercent: emptyBreakdown.totalPercent,
      completenessBreakdown: emptyBreakdown,
    },
    activeSession: null,
    demoLoaded: false,
  };
}

export function recomputeStoreBlueprint(store: TwoTableStore): TwoTableStore {
  const dimensions = calculateBlueprintDimensions(store.sessions, SEED_CARDS);
  const completenessBreakdown = calculateCompletenessBreakdown(
    store.sessions,
    store.pulses,
    SEED_CARDS,
  );
  return {
    ...store,
    schemaVersion: SCHEMA_VERSION,
    cardLibraryVersion: CARD_LIBRARY_VERSION,
    blueprint: {
      ...store.blueprint,
      dimensions,
      completenessPercent: completenessBreakdown.totalPercent,
      completenessBreakdown,
    },
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidIsoString(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

/**
 * Safely migrates v1 or v2 parsed JSON into a validated v2 TwoTableStore.
 */
export function migrateAndValidateStore(rawInput: unknown): ImportValidationResult {
  if (!isPlainObject(rawInput)) {
    return { ok: false, error: 'Backup file must contain a valid JSON object.' };
  }

  // Reject clearly unrelated JSON objects
  const hasKnownKey =
    'people' in rawInput ||
    'sessions' in rawInput ||
    'pulses' in rawInput ||
    'preferences' in rawInput ||
    'blueprint' in rawInput ||
    'schemaVersion' in rawInput;

  if (!hasKnownKey) {
    return {
      ok: false,
      error: 'This JSON file does not match the TwoTable backup format.',
    };
  }

  if (
    'schemaVersion' in rawInput &&
    (typeof rawInput.schemaVersion !== 'number' || rawInput.schemaVersion > SCHEMA_VERSION)
  ) {
    return {
      ok: false,
      error: `Unsupported backup schema version (${String(rawInput.schemaVersion)}).`,
    };
  }

  // Validate arrays if present
  if ('people' in rawInput && !Array.isArray(rawInput.people)) {
    return { ok: false, error: 'Malformed backup: "people" must be a list.' };
  }
  if ('sessions' in rawInput && !Array.isArray(rawInput.sessions)) {
    return { ok: false, error: 'Malformed backup: "sessions" must be a list.' };
  }
  if ('pulses' in rawInput && !Array.isArray(rawInput.pulses)) {
    return { ok: false, error: 'Malformed backup: "pulses" must be a list.' };
  }

  const base = createInitialStore();

  // Preferences (supporting v1 migration where userName/city lived inside blueprint)
  const rawPrefs = isPlainObject(rawInput.preferences) ? rawInput.preferences : {};
  const rawBlueprint = isPlainObject(rawInput.blueprint) ? rawInput.blueprint : {};

  const preferences: AppPreferences = {
    userName:
      typeof rawPrefs.userName === 'string'
        ? rawPrefs.userName.slice(0, 80)
        : typeof rawBlueprint.userName === 'string'
          ? rawBlueprint.userName.slice(0, 80)
          : base.preferences.userName,
    city:
      typeof rawPrefs.city === 'string' && rawPrefs.city.trim()
        ? rawPrefs.city.slice(0, 80)
        : typeof rawBlueprint.city === 'string' && rawBlueprint.city.trim()
          ? rawBlueprint.city.slice(0, 80)
          : base.preferences.city,
    aiEnabled:
      typeof rawPrefs.aiEnabled === 'boolean' ? rawPrefs.aiEnabled : base.preferences.aiEnabled,
    allowBlueprintAi:
      typeof rawPrefs.allowBlueprintAi === 'boolean'
        ? rawPrefs.allowBlueprintAi
        : base.preferences.allowBlueprintAi,
    includePrivateNotesInAi:
      typeof rawPrefs.includePrivateNotesInAi === 'boolean'
        ? rawPrefs.includePrivateNotesInAi
        : base.preferences.includePrivateNotesInAi,
  };

  // Validate people
  const people: DatePerson[] = [];
  for (const item of (rawInput.people as unknown[]) || []) {
    if (!isPlainObject(item) || typeof item.id !== 'string' || typeof item.nickname !== 'string') {
      return { ok: false, error: 'Malformed backup: a connection record is missing id or nickname.' };
    }
    const nickname = item.nickname.trim().slice(0, 80);
    if (!nickname) {
      return { ok: false, error: 'Malformed backup: a connection has an empty nickname.' };
    }
    const metVia =
      typeof item.metVia === 'string' && VALID_MET_VIA.has(item.metVia as MetViaSource)
        ? (item.metVia as MetViaSource)
        : undefined;
    const status =
      typeof item.status === 'string' && VALID_STATUSES.has(item.status as ConnectionStatus)
        ? (item.status as ConnectionStatus)
        : 'active';
    const datesCount =
      typeof item.datesCount === 'number' && Number.isFinite(item.datesCount) && item.datesCount >= 0
        ? Math.floor(item.datesCount)
        : 0;
    const lastDateAt = isValidIsoString(item.lastDateAt)
      ? item.lastDateAt
      : new Date().toISOString();
    const createdAt = isValidIsoString(item.createdAt) ? item.createdAt : lastDateAt;

    const milestoneChecks: Record<string, boolean> = {};
    if (isPlainObject(item.milestoneChecks)) {
      for (const [k, v] of Object.entries(item.milestoneChecks)) {
        if (typeof v === 'boolean') milestoneChecks[k] = v;
      }
    }

    people.push({
      id: item.id,
      nickname,
      metVia,
      datesCount,
      createdAt,
      lastDateAt,
      updatedAt: isValidIsoString(item.updatedAt) ? item.updatedAt : undefined,
      status,
      milestoneChecks: Object.keys(milestoneChecks).length > 0 ? milestoneChecks : undefined,
      isDemo: Boolean(item.isDemo),
    });
  }

  // Validate sessions
  const sessions: DateSession[] = [];
  for (const item of (rawInput.sessions as unknown[]) || []) {
    if (
      !isPlainObject(item) ||
      typeof item.id !== 'string' ||
      !VALID_STAGES.has(item.stage as DeckStage)
    ) {
      return { ok: false, error: 'Malformed backup: a session record has an invalid id or stage.' };
    }

    const userScenarioChoices: Record<string, string> = {};
    if (isPlainObject(item.userScenarioChoices)) {
      for (const [k, v] of Object.entries(item.userScenarioChoices)) {
        if (typeof v === 'string') userScenarioChoices[k] = v;
      }
    }

    sessions.push({
      id: item.id,
      personId: typeof item.personId === 'string' ? item.personId : undefined,
      stage: item.stage as DeckStage,
      movieTitle: typeof item.movieTitle === 'string' ? item.movieTitle.slice(0, 120) : undefined,
      sourceMode:
        item.sourceMode === 'standard' ||
        item.sourceMode === 'movie-ai' ||
        item.sourceMode === 'movie-fallback'
          ? item.sourceMode
          : 'standard',
      startedAt: isValidIsoString(item.startedAt) ? item.startedAt : new Date().toISOString(),
      completedAt: isValidIsoString(item.completedAt) ? item.completedAt : undefined,
      updatedAt: isValidIsoString(item.updatedAt) ? item.updatedAt : undefined,
      durationMinutes:
        typeof item.durationMinutes === 'number' && Number.isFinite(item.durationMinutes)
          ? Math.max(0, Math.round(item.durationMinutes))
          : 0,
      cardsShownIds: Array.isArray(item.cardsShownIds)
        ? item.cardsShownIds.filter((x): x is string => typeof x === 'string')
        : [],
      bookmarkedCardIds: Array.isArray(item.bookmarkedCardIds)
        ? item.bookmarkedCardIds.filter((x): x is string => typeof x === 'string')
        : [],
      skippedCardIds: Array.isArray(item.skippedCardIds)
        ? item.skippedCardIds.filter((x): x is string => typeof x === 'string')
        : [],
      userScenarioChoices,
      customCards: Array.isArray(item.customCards)
        ? (item.customCards.filter(
            (c): c is NonNullable<DateSession['customCards']>[number] =>
              isPlainObject(c) && typeof c.id === 'string' && typeof c.text === 'string',
          ) as DateSession['customCards'])
        : undefined,
      deckCardIds: Array.isArray(item.deckCardIds)
        ? item.deckCardIds.filter((x): x is string => typeof x === 'string')
        : undefined,
      currentCardIndex:
        typeof item.currentCardIndex === 'number' && item.currentCardIndex >= 0
          ? Math.floor(item.currentCardIndex)
          : undefined,
      countedAsDate: typeof item.countedAsDate === 'boolean' ? item.countedAsDate : undefined,
      isDemo: Boolean(item.isDemo),
    });
  }

  // Validate pulses
  const pulses: PostDatePulse[] = [];
  for (const item of (rawInput.pulses as unknown[]) || []) {
    if (
      !isPlainObject(item) ||
      typeof item.id !== 'string' ||
      !VALID_ENERGIES.has(item.energy as PostDatePulse['energy']) ||
      !VALID_RESPONSIVENESS.has(
        item.perceivedResponsiveness as PostDatePulse['perceivedResponsiveness'],
      ) ||
      !VALID_DECISIONS.has(item.nextDecision as PostDatePulse['nextDecision'])
    ) {
      return { ok: false, error: 'Malformed backup: a reflection entry has invalid fields.' };
    }

    pulses.push({
      id: item.id,
      sessionId: typeof item.sessionId === 'string' && item.sessionId ? item.sessionId : undefined,
      personId: typeof item.personId === 'string' && item.personId ? item.personId : undefined,
      createdAt: isValidIsoString(item.createdAt) ? item.createdAt : new Date().toISOString(),
      updatedAt: isValidIsoString(item.updatedAt) ? item.updatedAt : undefined,
      energy: item.energy as PostDatePulse['energy'],
      perceivedResponsiveness:
        item.perceivedResponsiveness as PostDatePulse['perceivedResponsiveness'],
      nextDecision: item.nextDecision as PostDatePulse['nextDecision'],
      tags: Array.isArray(item.tags)
        ? item.tags.filter((t): t is string => typeof t === 'string').slice(0, 15)
        : [],
      privateNote:
        typeof item.privateNote === 'string' && item.privateNote.trim()
          ? item.privateNote.slice(0, 1000)
          : undefined,
      isDemo: Boolean(item.isDemo),
    });
  }

  // Preserve valid AI summary (supporting v1 field names migration)
  let aiSummary = undefined;
  if (isPlainObject(rawBlueprint.aiSummary)) {
    const rawAi = rawBlueprint.aiSummary;
    const coreStrength = typeof rawAi.coreStrength === 'string' ? rawAi.coreStrength : '';
    const patternWorthExploring =
      typeof rawAi.patternWorthExploring === 'string'
        ? rawAi.patternWorthExploring
        : typeof rawAi.datingPattern === 'string'
          ? rawAi.datingPattern
          : '';
    const potentialBlindSpot =
      typeof rawAi.potentialBlindSpot === 'string'
        ? rawAi.potentialBlindSpot
        : typeof rawAi.blindSpotToWatch === 'string'
          ? rawAi.blindSpotToWatch
          : '';
    const nextRecommendedTopic =
      typeof rawAi.nextRecommendedTopic === 'string' ? rawAi.nextRecommendedTopic : '';

    if (coreStrength && patternWorthExploring && potentialBlindSpot && nextRecommendedTopic) {
      aiSummary = {
        coreStrength,
        patternWorthExploring,
        potentialBlindSpot,
        nextRecommendedTopic,
        evidenceNote:
          typeof rawAi.evidenceNote === 'string'
            ? rawAi.evidenceNote
            : 'Synthesized from recorded scenario choices and reflections.',
        updatedAt: isValidIsoString(rawAi.updatedAt)
          ? rawAi.updatedAt
          : new Date().toISOString(),
        source: rawAi.source === 'local' ? ('local' as const) : ('gemini' as const),
      };
    }
  }

  // Validate activeSession if present
  let activeSession = null;
  if (
    isPlainObject(rawInput.activeSession) &&
    typeof rawInput.activeSession.sessionId === 'string' &&
    Array.isArray(rawInput.activeSession.cards) &&
    typeof rawInput.activeSession.currentIndex === 'number'
  ) {
    const matchingSession = sessions.find(
      (s) => s.id === (rawInput.activeSession as Record<string, unknown>).sessionId,
    );
    if (matchingSession && !matchingSession.completedAt && rawInput.activeSession.cards.length > 0) {
      activeSession = {
        sessionId: matchingSession.id,
        cards: rawInput.activeSession.cards as TwoTableStore['activeSession'] extends null
          ? never
          : NonNullable<TwoTableStore['activeSession']>['cards'],
        currentIndex: Math.max(
          0,
          Math.min(
            rawInput.activeSession.cards.length - 1,
            Math.floor(rawInput.activeSession.currentIndex),
          ),
        ),
      };
    }
  }

  const demoLoaded =
    Boolean(rawInput.demoLoaded) ||
    people.some((p) => p.isDemo) ||
    sessions.some((s) => s.isDemo) ||
    pulses.some((p) => p.isDemo);

  const merged: TwoTableStore = {
    schemaVersion: SCHEMA_VERSION,
    cardLibraryVersion: CARD_LIBRARY_VERSION,
    preferences,
    people,
    sessions,
    pulses,
    blueprint: {
      ...base.blueprint,
      aiSummary,
    },
    activeSession,
    demoLoaded,
  };

  return { ok: true, store: recomputeStoreBlueprint(merged) };
}

export function loadStore(storage?: Pick<Storage, 'getItem' | 'setItem'>): TwoTableStore {
  try {
    const target = storage || (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!target) return createInitialStore();

    const rawV2 = target.getItem(STORAGE_KEY_V2);
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      const result = migrateAndValidateStore(parsed);
      if (result.ok && result.store) return result.store;
    }

    // Migrate cleanly from legacy v1 key without data loss
    const rawV1 = target.getItem(STORAGE_KEY_V1);
    if (rawV1) {
      const parsedV1 = JSON.parse(rawV1);
      const migrated = migrateAndValidateStore(parsedV1);
      if (migrated.ok && migrated.store) {
        try {
          target.setItem(STORAGE_KEY_V2, JSON.stringify(migrated.store));
        } catch {
          // Non-fatal if storage write fails during migration
        }
        return migrated.store;
      }
    }

    return createInitialStore();
  } catch {
    return createInitialStore();
  }
}

export function saveStore(
  store: TwoTableStore,
  storage?: Pick<Storage, 'setItem'>,
): StorageResult {
  try {
    const target = storage || (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!target) return { ok: false, error: 'Browser storage is unavailable.' };
    target.setItem(STORAGE_KEY_V2, JSON.stringify(store));
    return { ok: true };
  } catch (err) {
    const msg =
      err instanceof Error && err.name === 'QuotaExceededError'
        ? 'Browser storage is full. Export a JSON backup and clear older sessions to keep saving.'
        : 'Unable to save to browser localStorage (it may be disabled in private browsing).';
    return { ok: false, error: msg };
  }
}

export function clearStoredData(storage?: Pick<Storage, 'removeItem'>): void {
  try {
    const target = storage || (typeof window !== 'undefined' ? window.localStorage : undefined);
    target?.removeItem(STORAGE_KEY_V2);
    target?.removeItem(STORAGE_KEY_V1);
  } catch {
    // Ignore storage removal errors
  }
}

/**
 * Exports a versioned JSON backup string with metadata.
 */
export function exportStoreToJson(store: TwoTableStore): string {
  const payload = {
    exportedAt: new Date().toISOString(),
    app: 'TwoTable',
    warning:
      'This unencrypted JSON file contains your private dating reflections, connections, and preferences. Store it securely.',
    ...store,
    activeSession: null, // Do not export transient in-progress UI pointer
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Parses and validates an imported JSON backup string.
 */
export function importStoreFromJson(jsonText: string): ImportValidationResult {
  if (!jsonText || !jsonText.trim()) {
    return { ok: false, error: 'The selected file is empty.' };
  }
  if (jsonText.length > 2_000_000) {
    return { ok: false, error: 'Backup file exceeds the 2MB safety limit.' };
  }
  try {
    const parsed = JSON.parse(jsonText);
    return migrateAndValidateStore(parsed);
  } catch {
    return { ok: false, error: 'Invalid JSON file. Please choose a valid TwoTable JSON backup.' };
  }
}

/**
 * Loads the 3 example connections, 3 sessions, and 3 reflections clearly marked as isDemo,
 * keeping all existing real user records intact.
 */
export function buildDemoStore(existing: TwoTableStore): TwoTableStore {
  const existingPeopleIds = new Set(existing.people.map((p) => p.id));
  const existingSessionIds = new Set(existing.sessions.map((s) => s.id));
  const existingPulseIds = new Set(existing.pulses.map((p) => p.id));

  const merged: TwoTableStore = {
    ...existing,
    people: [
      ...existing.people,
      ...DEMO_PEOPLE.filter((p) => !existingPeopleIds.has(p.id)),
    ],
    sessions: [
      ...existing.sessions,
      ...DEMO_SESSIONS.filter((s) => !existingSessionIds.has(s.id)),
    ],
    pulses: [
      ...existing.pulses,
      ...DEMO_PULSES.filter((p) => !existingPulseIds.has(p.id)),
    ],
    demoLoaded: true,
  };

  return recomputeStoreBlueprint(merged);
}

/**
 * Removes ONLY example/demo records, leaving all real user data untouched.
 */
export function clearDemoDataOnly(existing: TwoTableStore): TwoTableStore {
  const demoIds = new Set([
    ...DEMO_PEOPLE.map((p) => p.id),
    ...DEMO_SESSIONS.map((s) => s.id),
    ...DEMO_PULSES.map((p) => p.id),
  ]);

  const people = existing.people.filter((p) => !p.isDemo && !demoIds.has(p.id));
  const sessions = existing.sessions.filter((s) => !s.isDemo && !demoIds.has(s.id));
  const pulses = existing.pulses.filter((p) => !p.isDemo && !demoIds.has(p.id));

  const activeStillExists =
    existing.activeSession && sessions.some((s) => s.id === existing.activeSession?.sessionId);

  return recomputeStoreBlueprint({
    ...existing,
    people,
    sessions,
    pulses,
    activeSession: activeStillExists ? existing.activeSession : null,
    demoLoaded: false,
  });
}

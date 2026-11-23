import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDemoStore,
  clearDemoDataOnly,
  clearStoredData,
  createInitialStore,
  exportStoreToJson,
  importStoreFromJson,
  loadStore,
  saveStore,
  STORAGE_KEY_V1,
  STORAGE_KEY_V2,
} from './storage';
import { SCHEMA_VERSION } from '../types';

function createMockStorage(initial: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    map,
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
  };
}

test('storage saves and reloads state cleanly across browser refreshes', () => {
  const mockStorage = createMockStorage();
  const initial = createInitialStore();
  initial.people.push({
    id: 'person-real-1',
    nickname: 'Meera',
    metVia: 'IRL',
    datesCount: 2,
    createdAt: '2026-11-05T10:00:00.000Z',
    lastDateAt: '2026-11-10T10:00:00.000Z',
    status: 'active',
  });
  initial.preferences.userName = 'Ananya';
  initial.preferences.allowBlueprintAi = true;

  const saved = saveStore(initial, mockStorage);
  assert.equal(saved.ok, true);

  const reloaded = loadStore(mockStorage);
  assert.equal(reloaded.schemaVersion, SCHEMA_VERSION);
  assert.equal(reloaded.people.length, 1);
  assert.equal(reloaded.people[0]?.nickname, 'Meera');
  assert.equal(reloaded.preferences.userName, 'Ananya');
  assert.equal(reloaded.preferences.allowBlueprintAi, true);
});

test('migrates legacy v1 localStorage schema cleanly without data loss', () => {
  const v1Payload = {
    people: [
      {
        id: 'p-v1',
        nickname: 'Dev',
        metVia: 'Hinge',
        datesCount: 3,
        lastDateAt: '2026-11-01T10:00:00.000Z',
        status: 'active',
      },
    ],
    sessions: [
      {
        id: 's-v1',
        personId: 'p-v1',
        stage: 'story',
        startedAt: '2026-11-01T10:00:00.000Z',
        durationMinutes: 45,
        cardsShownIds: ['story-1', 'story-3'],
        bookmarkedCardIds: ['story-1'],
        skippedCardIds: [],
        userScenarioChoices: { 'story-3': 'story-3-c' },
      },
    ],
    pulses: [
      {
        id: 'pulse-v1',
        sessionId: 's-v1',
        personId: 'p-v1',
        createdAt: '2026-11-02T08:00:00.000Z',
        energy: 'calm',
        perceivedResponsiveness: 'high',
        nextDecision: 'yes',
        tags: ['Felt listened to'],
        privateNote: 'Felt unhurried.',
      },
    ],
    blueprint: {
      userName: 'Priya',
      city: 'Mumbai',
      aiSummary: {
        coreStrength: 'Thoughtful listener.',
        datingPattern: 'Steady pace.',
        blindSpotToWatch: 'Money discussions.',
        nextRecommendedTopic: 'Financial habits.',
        updatedAt: '2026-11-02T09:00:00.000Z',
      },
    },
    demoLoaded: false,
  };

  const mockStorage = createMockStorage({
    [STORAGE_KEY_V1]: JSON.stringify(v1Payload),
  });

  const migrated = loadStore(mockStorage);
  assert.equal(migrated.schemaVersion, SCHEMA_VERSION);
  assert.equal(migrated.preferences.userName, 'Priya');
  assert.equal(migrated.preferences.city, 'Mumbai');
  assert.equal(migrated.preferences.allowBlueprintAi, false); // Opt-in defaults safely to false
  assert.equal(migrated.preferences.includePrivateNotesInAi, false);
  assert.equal(migrated.people[0]?.nickname, 'Dev');
  assert.equal(migrated.blueprint.dimensions.conflictRepairSpeed, -10);
  assert.equal(migrated.blueprint.aiSummary?.patternWorthExploring, 'Steady pace.');
  assert.ok(mockStorage.map.has(STORAGE_KEY_V2));
});

test('JSON export and import round-trip cleanly and reject malformed backups', () => {
  const store = buildDemoStore(createInitialStore());
  const exported = exportStoreToJson(store);
  assert.match(exported, /unencrypted JSON file/i);

  const imported = importStoreFromJson(exported);
  assert.equal(imported.ok, true);
  assert.equal(imported.store?.people.length, 3);
  assert.equal(imported.store?.sessions.length, 3);
  assert.equal(imported.store?.pulses.length, 3);

  // Reject malformed JSON
  assert.equal(importStoreFromJson('{bad json').ok, false);
  // Reject unrelated JSON object
  assert.equal(importStoreFromJson('{"foo":"bar"}').ok, false);
  // Reject wrong people type
  assert.equal(importStoreFromJson('{"schemaVersion":2,"people":"not-an-array"}').ok, false);
  // Reject invalid reflection enum
  assert.equal(
    importStoreFromJson(
      JSON.stringify({
        schemaVersion: 2,
        pulses: [
          {
            id: 'p1',
            energy: 'INVALID_MOOD',
            perceivedResponsiveness: 'high',
            nextDecision: 'yes',
          },
        ],
      }),
    ).ok,
    false,
  );
  // Reject unsupported future schema version
  assert.equal(importStoreFromJson('{"schemaVersion":99,"people":[]}').ok, false);
});

test('demo loading and clearDemoDataOnly preserve real user records', () => {
  const base = createInitialStore();
  base.people.push({
    id: 'real-1',
    nickname: 'Nisha',
    datesCount: 1,
    createdAt: '2026-11-15T10:00:00.000Z',
    lastDateAt: '2026-11-15T10:00:00.000Z',
    status: 'active',
    isDemo: false,
  });

  const withDemo = buildDemoStore(base);
  assert.equal(withDemo.demoLoaded, true);
  assert.equal(withDemo.people.length, 4);
  assert.equal(withDemo.sessions.length, 3);
  assert.equal(withDemo.pulses.length, 3);

  const cleaned = clearDemoDataOnly(withDemo);
  assert.equal(cleaned.demoLoaded, false);
  assert.equal(cleaned.people.length, 1);
  assert.equal(cleaned.people[0]?.nickname, 'Nisha');
  assert.equal(cleaned.sessions.length, 0);
  assert.equal(cleaned.pulses.length, 0);
});

test('saveStore handles QuotaExceededError gracefully and clearStoredData wipes keys', () => {
  const failingStorage = {
    setItem() {
      const err = new Error('Quota exceeded');
      err.name = 'QuotaExceededError';
      throw err;
    },
  };
  const res = saveStore(createInitialStore(), failingStorage);
  assert.equal(res.ok, false);
  assert.match(res.error || '', /storage is full/i);

  const mockStorage = createMockStorage({
    [STORAGE_KEY_V1]: '{}',
    [STORAGE_KEY_V2]: '{}',
  });
  clearStoredData(mockStorage);
  assert.equal(mockStorage.map.size, 0);
});

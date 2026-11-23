import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMinimizedBlueprintPayload,
  generateBlueprintInsights,
  generateGoDeeperPrompt,
  generateMovieCards,
  sanitizePlainText,
  SlidingWindowRateLimiter,
  type GeminiRunner,
} from './gemini';

test('sanitizePlainText strips HTML tags and control characters', () => {
  const dirty = '<script>alert(1)</script>Hello <b>world</b>\u0000!';
  assert.equal(sanitizePlainText(dirty, 100), 'alert(1)Hello world!');
});

test('SlidingWindowRateLimiter enforces request bounds and retry-after', () => {
  const limiter = new SlidingWindowRateLimiter(2, 10_000);
  assert.equal(limiter.check('1.2.3.4', 1000).allowed, true);
  assert.equal(limiter.check('1.2.3.4', 2000).allowed, true);
  const blocked = limiter.check('1.2.3.4', 3000);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds >= 7);
  // After window passes, requests succeed again
  assert.equal(limiter.check('1.2.3.4', 12_000).allowed, true);
});

test('Watch & Talk handles missing credentials, invalid JSON, timeout, and sanitized mock responses', async () => {
  // Missing API key -> 503 (never fabricates AI cards)
  const noKey = await generateMovieCards({ movieTitle: 'Past Lives', stage: 'story' }, null);
  assert.equal(noKey.status, 503);

  // Empty title -> 400
  const badInput = await generateMovieCards({ movieTitle: ' ', stage: 'spark' }, null);
  assert.equal(badInput.status, 400);

  // Invalid JSON from model -> 502
  const badJsonRunner: GeminiRunner = async () => 'not valid json';
  const badJson = await generateMovieCards({ movieTitle: 'Past Lives', stage: 'story' }, badJsonRunner);
  assert.equal(badJson.status, 502);

  // Timeout -> 504
  const slowRunner: GeminiRunner = () =>
    new Promise((resolve) => setTimeout(() => resolve('[]'), 200));
  const timedOut = await generateMovieCards(
    { movieTitle: 'Past Lives', stage: 'story' },
    slowRunner,
    25,
  );
  assert.equal(timedOut.status, 504);

  // Valid response with HTML stripped
  const okRunner: GeminiRunner = async () =>
    JSON.stringify([
      { pillar: 'empathy', text: '<b>What moment</b> in the film felt most honest to you?' },
      { pillar: 'dreams', text: 'Which choice felt hardest to make?' },
      { pillar: 'conflict', text: 'How would you have handled that silence?' },
      { pillar: 'invalid_pillar', text: 'What stayed with you after the credits rolled?' },
    ]);
  const ok = await generateMovieCards({ movieTitle: 'Past Lives', stage: 'story' }, okRunner);
  assert.equal(ok.status, 200);
  assert.equal(ok.data?.cards.length, 4);
  assert.equal(ok.data?.cards[0]?.text, 'What moment in the film felt most honest to you?');
  assert.equal(ok.data?.cards[3]?.pillar, 'empathy'); // Unknown pillar normalized safely
});

test('Go Deeper validates inputs, errors gracefully, and returns sanitized follow-up', async () => {
  const missing = await generateGoDeeperPrompt({ cardText: '' }, null);
  assert.equal(missing.status, 400);

  const noKey = await generateGoDeeperPrompt(
    { cardText: 'What makes a Sunday morning feel restorative?', pillar: 'lifestyle', stage: 'spark' },
    null,
  );
  assert.equal(noKey.status, 503);

  const mockRunner: GeminiRunner = async () =>
    JSON.stringify({ followUp: '<i>Has that changed</i> over the last few years?' });
  const ok = await generateGoDeeperPrompt(
    { cardText: 'What makes a Sunday morning feel restorative?', pillar: 'lifestyle', stage: 'spark' },
    mockRunner,
  );
  assert.equal(ok.status, 200);
  assert.equal(ok.data?.followUp, 'Has that changed over the last few years?');
});

test('Blueprint synthesis enforces explicit opt-in, sparse-data guard, and strict privacy minimization', async () => {
  const sampleBody = {
    consentGranted: false,
    dimensions: {
      spontaneityVsPlanning: -5,
      familyInterdependence: 0,
      conflictRepairSpeed: -10,
      careerVsRoots: 5,
    },
    evidenceCounts: {
      spontaneityVsPlanning: 2,
      familyInterdependence: 0,
      conflictRepairSpeed: 1,
      careerVsRoots: 1,
    },
    topicsExploredCount: 4,
    bookmarkedPillars: { empathy: 2, conflict: 1 },
    pulses: [
      {
        personId: 'secret-person-1',
        nickname: 'Aarav',
        energy: 'calm',
        perceivedResponsiveness: 'high',
        nextDecision: 'yes',
        tags: ['Felt listened to'],
        privateNote: 'Super private journal note that must not leak by default.',
      },
      {
        nickname: 'Kavya',
        energy: 'energized',
        perceivedResponsiveness: 'moderate',
        nextDecision: 'unsure',
        tags: ['Similar values'],
        privateNote: 'Another private journal note.',
      },
    ],
    sessionCount: 3,
  };

  // Without explicit opt-in -> 403
  const refused = await generateBlueprintInsights(sampleBody, async () => '{}');
  assert.equal(refused.status, 403);

  // Sparse data guard -> 422
  const sparse = await generateBlueprintInsights(
    {
      consentGranted: true,
      dimensions: {},
      evidenceCounts: {},
      pulses: [],
      sessionCount: 0,
    },
    async () => '{}',
  );
  assert.equal(sparse.status, 422);

  // Data minimization check: strips names/IDs and excludes privateNote by default
  const minimized = buildMinimizedBlueprintPayload(sampleBody);
  const serialized = JSON.stringify(minimized.payload);
  assert.doesNotMatch(serialized, /Aarav|Kavya|secret-person-1|Super private journal note/);
  // Unrecorded spectrum (familyInterdependence count=0) is omitted
  assert.equal('familyInterdependence' in minimized.payload.recordedSpectrums, false);

  // Opted-in with mock runner succeeds cleanly
  let capturedPrompt = '';
  const mockRunner: GeminiRunner = async ({ contents }) => {
    capturedPrompt = contents;
    return JSON.stringify({
      coreStrength: 'You reflect thoughtfully after dates.',
      patternWorthExploring: 'Calm conversations appear frequently in your recorded reflections.',
      potentialBlindSpot: 'Family boundaries have not been recorded yet.',
      nextRecommendedTopic: 'Explore family expectations when it feels natural.',
    });
  };

  const ok = await generateBlueprintInsights(
    { ...sampleBody, consentGranted: true, includePrivateNotes: false },
    mockRunner,
  );
  assert.equal(ok.status, 200);
  assert.doesNotMatch(capturedPrompt, /Aarav|Kavya|Super private journal note/);
  assert.match(ok.data?.summary.evidenceNote || '', /private notes excluded/i);
});

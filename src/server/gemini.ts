import { GoogleGenAI, Type, type Schema } from '@google/genai';

export const GEMINI_MODEL_NAME = 'gemini-4-hydrogen';
export const DEFAULT_GEMINI_TIMEOUT_MS = 15_000;

const VALID_STAGES = new Set(['spark', 'story', 'alignment'] as const);
const VALID_ALL_STAGES = new Set(['spark', 'story', 'alignment', 'movie'] as const);
const VALID_PILLARS = new Set([
  'curiosity',
  'empathy',
  'conflict',
  'money',
  'family',
  'lifestyle',
  'dreams',
] as const);
const VALID_ENERGIES = new Set(['energized', 'calm', 'guarded', 'drained'] as const);
const VALID_RESPONSIVENESS = new Set(['high', 'moderate', 'low'] as const);
const VALID_DECISIONS = new Set(['yes', 'unsure', 'no'] as const);

export interface GeminiCallParams {
  contents: string;
  systemInstruction: string;
  responseSchema: Schema;
}

export type GeminiRunner = (params: GeminiCallParams) => Promise<string>;

export interface ServiceResult<T> {
  status: number;
  data?: T;
  error?: string;
}

export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
  ) {}

  check(key: string, now = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
    const cutoff = now - this.windowMs;
    const prev = (this.hits.get(key) || []).filter((ts) => ts > cutoff);
    if (prev.length >= this.maxRequests) {
      const oldest = prev[0]!;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000));
      this.hits.set(key, prev);
      return { allowed: false, retryAfterSeconds };
    }
    prev.push(now);
    this.hits.set(key, prev);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

export function isGeminiConfigured(apiKey = process.env.GEMINI_API_KEY): boolean {
  const clean = (apiKey || '').trim();
  return Boolean(clean && clean !== 'MY_GEMINI_API_KEY');
}

export function createProductionGeminiRunner(
  apiKey = process.env.GEMINI_API_KEY,
): GeminiRunner | null {
  if (!isGeminiConfigured(apiKey)) {
    return null;
  }

  const ai = new GoogleGenAI({
    apiKey: apiKey!.trim(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  return async ({ contents, systemInstruction, responseSchema }) => {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL_NAME,
      contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema,
      },
    });
    return (response.text ?? '').trim();
  };
}

/**
 * Sanitizes untrusted model text into safe plain text (strips HTML tags and control characters).
 */
export function sanitizePlainText(input: unknown, maxLen: number): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

async function runWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function classifyProviderError(err: unknown): { status: number; error: string } {
  if (err instanceof Error && err.message === 'GEMINI_TIMEOUT') {
    return {
      status: 504,
      error: 'Gemini took too long to respond. Please try again or use the built-in offline option.',
    };
  }
  const msg = err instanceof Error ? err.message : '';
  if (/429|RESOURCE_EXHAUSTED/i.test(msg)) {
    return {
      status: 429,
      error: 'Gemini quota limit reached right now. Please try again shortly or use the offline option.',
    };
  }
  if (/403|401|API_KEY_INVALID|PERMISSION_DENIED/i.test(msg)) {
    return {
      status: 502,
      error: 'Gemini credentials could not be verified. Check GEMINI_API_KEY in server configuration.',
    };
  }
  return {
    status: 502,
    error: 'Unable to reach Gemini right now. Please try again or use the built-in offline option.',
  };
}

export async function generateMovieCards(
  body: unknown,
  runner: GeminiRunner | null,
  timeoutMs = DEFAULT_GEMINI_TIMEOUT_MS,
): Promise<
  ServiceResult<{
    cards: Array<{
      id: string;
      stage: 'movie';
      type: 'prompt';
      pillar: string;
      text: string;
      subtext?: string;
    }>;
  }>
> {
  if (!body || typeof body !== 'object') {
    return { status: 400, error: 'Invalid request body.' };
  }
  const { movieTitle, stage } = body as Record<string, unknown>;
  const cleanTitle = sanitizePlainText(movieTitle, 120);
  if (!cleanTitle || cleanTitle.length < 2) {
    return { status: 400, error: 'Please enter a movie or series title (at least 2 characters).' };
  }

  const normalizedStage =
    typeof stage === 'string' && VALID_STAGES.has(stage as 'spark' | 'story' | 'alignment')
      ? (stage as 'spark' | 'story' | 'alignment')
      : 'spark';

  if (!runner) {
    return {
      status: 503,
      error:
        'Gemini AI is not configured on this server. You can still play using the built-in Film & Series prompts below.',
    };
  }

  const stageDescription =
    normalizedStage === 'alignment'
      ? 'Dates 5+ (long-term partnership values, family expectations, money habits, boundaries, and life tradeoffs)'
      : normalizedStage === 'story'
        ? 'Dates 3–4 (emotional depth, care styles, choices under pressure, and personal values)'
        : 'Dates 1–2 (light curiosity, playful perspective, everyday tastes, and warm observation)';

  try {
    const raw = await runWithTimeout(
      runner({
        contents: `Film or Television Series: "${cleanTitle}"\nConversation Stage: ${stageDescription}\nGenerate 4 original conversation prompts.`,
        systemInstruction:
          'You design warm, perceptive date conversation cards inspired by relationship-cinema discussion methods. Given a film or TV series title and a conversation stage, generate exactly 4 original, non-cheesy conversation prompts connecting emotions, character choices, communication, values, or relationship dynamics to real-life dating perspectives. CRITICAL: If you are uncertain about specific plot details or the title is obscure, focus on universal themes, character choices, and emotional reactions—NEVER invent specific plot events. Never sound clinical or like a quiz. Keep each prompt under 30 words and return plain text only (no HTML or markdown).',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              pillar: {
                type: Type.STRING,
                description: 'One of: curiosity, empathy, conflict, money, family, lifestyle, dreams',
              },
              text: {
                type: Type.STRING,
                description: 'Original conversation prompt under 30 words.',
              },
              subtext: {
                type: Type.STRING,
                description: 'Optional short framing note under 14 words.',
              },
            },
            required: ['pillar', 'text'],
          },
        },
      }),
      timeoutMs,
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { status: 502, error: 'Gemini returned an unreadable response. Please retry.' };
    }

    if (!Array.isArray(parsed)) {
      return { status: 502, error: 'Gemini returned an unexpected card format. Please retry.' };
    }

    const timestamp = Date.now();
    const cards = parsed
      .slice(0, 4)
      .map((item, idx) => {
        if (!item || typeof item !== 'object') return null;
        const rec = item as Record<string, unknown>;
        const text = sanitizePlainText(rec.text, 240);
        if (text.length < 8) return null;
        const subtext = sanitizePlainText(rec.subtext, 140) || undefined;
        const rawPillar = typeof rec.pillar === 'string' ? rec.pillar.trim().toLowerCase() : '';
        const pillar = VALID_PILLARS.has(rawPillar as 'curiosity') ? rawPillar : 'empathy';
        return {
          id: `movie-${timestamp}-${idx + 1}`,
          stage: 'movie' as const,
          type: 'prompt' as const,
          pillar,
          text,
          subtext,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    if (cards.length < 2) {
      return {
        status: 502,
        error: 'Could not generate enough valid prompts for that title. Try again or use built-in prompts.',
      };
    }

    return { status: 200, data: { cards } };
  } catch (err) {
    return classifyProviderError(err);
  }
}

export async function generateGoDeeperPrompt(
  body: unknown,
  runner: GeminiRunner | null,
  timeoutMs = DEFAULT_GEMINI_TIMEOUT_MS,
): Promise<ServiceResult<{ followUp: string }>> {
  if (!body || typeof body !== 'object') {
    return { status: 400, error: 'Invalid request body.' };
  }

  const { cardText, pillar, stage } = body as Record<string, unknown>;
  const cleanCardText = sanitizePlainText(cardText, 320);
  if (!cleanCardText || cleanCardText.length < 5) {
    return { status: 400, error: 'Missing or invalid card prompt text.' };
  }

  const cleanPillar =
    typeof pillar === 'string' && VALID_PILLARS.has(pillar as 'curiosity') ? pillar : 'curiosity';
  const cleanStage =
    typeof stage === 'string' && VALID_ALL_STAGES.has(stage as 'spark') ? stage : 'spark';

  if (!runner) {
    return {
      status: 503,
      error:
        'Gemini AI is not configured on this server. You can use a built-in follow-up prompt instead.',
    };
  }

  try {
    const raw = await runWithTimeout(
      runner({
        contents: `Current table card (${cleanStage} · ${cleanPillar}): "${cleanCardText}"`,
        systemInstruction:
          'Generate 1 warm, natural, non-intrusive follow-up question two people on a date could ask right after discussing the card below. Never sound interrogative, clinical, or push for sensitive disclosures. Keep it under 24 words and plain text only (no HTML or markdown).',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            followUp: {
              type: Type.STRING,
              description: 'One warm follow-up question under 24 words.',
            },
          },
          required: ['followUp'],
        },
      }),
      timeoutMs,
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { status: 502, error: 'Gemini returned an unreadable follow-up. Please retry.' };
    }

    const followUp =
      parsed && typeof parsed === 'object'
        ? sanitizePlainText((parsed as Record<string, unknown>).followUp, 220)
        : '';

    if (followUp.length < 8) {
      return { status: 502, error: 'Gemini returned an empty follow-up. Please retry.' };
    }

    return { status: 200, data: { followUp } };
  } catch (err) {
    return classifyProviderError(err);
  }
}

/**
 * Sanitizes and minimizes Blueprint synthesis input strictly before calling Gemini.
 * Strips all connection identifiers and excludes private notes unless explicitly opted in.
 */
export function buildMinimizedBlueprintPayload(body: Record<string, unknown>) {
  const rawDims =
    body.dimensions && typeof body.dimensions === 'object'
      ? (body.dimensions as Record<string, unknown>)
      : {};
  const rawCounts =
    body.evidenceCounts && typeof body.evidenceCounts === 'object'
      ? (body.evidenceCounts as Record<string, unknown>)
      : {};

  const clampNum = (v: unknown, min: number, max: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : 0;

  const evidenceCounts = {
    spontaneityVsPlanning: clampNum(rawCounts.spontaneityVsPlanning, 0, 50),
    familyInterdependence: clampNum(rawCounts.familyInterdependence, 0, 50),
    conflictRepairSpeed: clampNum(rawCounts.conflictRepairSpeed, 0, 50),
    careerVsRoots: clampNum(rawCounts.careerVsRoots, 0, 50),
  };

  // Only transmit spectrum values that actually have recorded choices
  const recordedSpectrums: Record<string, { value: number; choicesCount: number }> = {};
  (Object.keys(evidenceCounts) as Array<keyof typeof evidenceCounts>).forEach((key) => {
    if (evidenceCounts[key] > 0) {
      recordedSpectrums[key] = {
        value: clampNum(rawDims[key], -10, 10),
        choicesCount: evidenceCounts[key],
      };
    }
  });

  const rawPillars =
    body.bookmarkedPillars && typeof body.bookmarkedPillars === 'object'
      ? (body.bookmarkedPillars as Record<string, unknown>)
      : {};
  const bookmarkedPillars: Record<string, number> = {};
  for (const pillar of VALID_PILLARS) {
    const val = clampNum(rawPillars[pillar], 0, 100);
    if (val > 0) bookmarkedPillars[pillar] = val;
  }

  const includePrivateNotes = body.includePrivateNotes === true;
  const rawPulses = Array.isArray(body.pulses) ? body.pulses.slice(-8) : [];
  const sanitizedReflections = rawPulses
    .map((p) => {
      if (!p || typeof p !== 'object') return null;
      const rec = p as Record<string, unknown>;
      if (
        !VALID_ENERGIES.has(rec.energy as 'calm') ||
        !VALID_RESPONSIVENESS.has(rec.perceivedResponsiveness as 'high') ||
        !VALID_DECISIONS.has(rec.nextDecision as 'yes')
      ) {
        return null;
      }
      const tags = Array.isArray(rec.tags)
        ? rec.tags
            .filter((t): t is string => typeof t === 'string')
            .map((t) => sanitizePlainText(t, 48))
            .filter(Boolean)
            .slice(0, 8)
        : [];
      const entry: Record<string, unknown> = {
        feelingAfterward: rec.energy,
        conversationFeel: rec.perceivedResponsiveness,
        nextStepIntention: rec.nextDecision,
        notableExperiences: tags,
      };
      if (includePrivateNotes && typeof rec.privateNote === 'string') {
        const cleanNote = sanitizePlainText(rec.privateNote, 160);
        if (cleanNote) entry.personalNoteExcerpt = cleanNote;
      }
      return entry;
    })
    .filter((x): x is Record<string, unknown> => x !== null);

  const totalScenarioChoices = Object.values(evidenceCounts).reduce((a, b) => a + b, 0);

  return {
    totalScenarioChoices,
    totalReflections: sanitizedReflections.length,
    payload: {
      sessionsLogged: clampNum(body.sessionCount, 0, 500),
      topicsExploredOutOf7: clampNum(body.topicsExploredCount, 0, 7),
      recordedSpectrums,
      bookmarkedThemes: bookmarkedPillars,
      reflections: sanitizedReflections,
    },
  };
}

export async function generateBlueprintInsights(
  body: unknown,
  runner: GeminiRunner | null,
  timeoutMs = DEFAULT_GEMINI_TIMEOUT_MS,
): Promise<
  ServiceResult<{
    summary: {
      coreStrength: string;
      patternWorthExploring: string;
      potentialBlindSpot: string;
      nextRecommendedTopic: string;
      evidenceNote: string;
      updatedAt: string;
      source: 'gemini';
    };
  }>
> {
  if (!body || typeof body !== 'object') {
    return { status: 400, error: 'Invalid request body.' };
  }

  const rec = body as Record<string, unknown>;
  if (rec.consentGranted !== true) {
    return {
      status: 403,
      error: 'Explicit opt-in is required before sending Blueprint data to Gemini.',
    };
  }

  const { totalScenarioChoices, totalReflections, payload } = buildMinimizedBlueprintPayload(rec);

  if (totalScenarioChoices < 2 && totalReflections < 2) {
    return {
      status: 422,
      error:
        'Not enough recorded evidence yet. Record at least 2 scenario stances or 2 private reflections before requesting AI synthesis.',
    };
  }

  if (!runner) {
    return {
      status: 503,
      error:
        'Gemini AI is not configured on this server. Your on-device Local Pattern Summary remains available.',
    };
  }

  try {
    const raw = await runWithTimeout(
      runner({
        contents: `Anonymized self-reflection data for one user (no partner identities):\n${JSON.stringify(payload)}`,
        systemInstruction:
          'You help one user reflect on their own recorded dating preferences and post-date reflections. STRICT RULES: (1) Base every sentence strictly on the provided numbers, themes, and reflections—never invent history or fill in missing data. (2) Distinguish observations ("Based on your recorded choices...") from possibilities ("You might explore..."). (3) Use tentative language when evidence is small. (4) NEVER diagnose attachment styles, trauma, personality disorders, or mental health conditions. (5) NEVER mention, infer, or profile any partner. (6) NEVER generate compatibility percentages or claim to predict romantic success. (7) Return plain text only (no HTML/markdown), 1–2 crisp empathetic sentences per field.',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            coreStrength: { type: Type.STRING },
            patternWorthExploring: { type: Type.STRING },
            potentialBlindSpot: { type: Type.STRING },
            nextRecommendedTopic: { type: Type.STRING },
          },
          required: [
            'coreStrength',
            'patternWorthExploring',
            'potentialBlindSpot',
            'nextRecommendedTopic',
          ],
        },
      }),
      timeoutMs,
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { status: 502, error: 'Gemini returned an unreadable Blueprint synthesis. Please retry.' };
    }

    if (!parsed || typeof parsed !== 'object') {
      return { status: 502, error: 'Gemini returned an invalid Blueprint format. Please retry.' };
    }

    const out = parsed as Record<string, unknown>;
    const coreStrength = sanitizePlainText(out.coreStrength, 420);
    const patternWorthExploring = sanitizePlainText(out.patternWorthExploring, 420);
    const potentialBlindSpot = sanitizePlainText(out.potentialBlindSpot, 420);
    const nextRecommendedTopic = sanitizePlainText(out.nextRecommendedTopic, 420);

    if (!coreStrength || !patternWorthExploring || !potentialBlindSpot || !nextRecommendedTopic) {
      return { status: 502, error: 'Gemini returned an incomplete Blueprint summary. Please retry.' };
    }

    return {
      status: 200,
      data: {
        summary: {
          coreStrength,
          patternWorthExploring,
          potentialBlindSpot,
          nextRecommendedTopic,
          evidenceNote: `Synthesized by Gemini from ${totalScenarioChoices} scenario ${
            totalScenarioChoices === 1 ? 'choice' : 'choices'
          }, ${totalReflections} anonymized ${
            totalReflections === 1 ? 'reflection' : 'reflections'
          }, and ${payload.topicsExploredOutOf7}/7 topics explored${
            rec.includePrivateNotes === true ? ' (including short note excerpts)' : ' (private notes excluded)'
          }.`,
          updatedAt: new Date().toISOString(),
          source: 'gemini',
        },
      },
    };
  } catch (err) {
    return classifyProviderError(err);
  }
}

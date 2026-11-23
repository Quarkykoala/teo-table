export const SCHEMA_VERSION = 2;
export const CARD_LIBRARY_VERSION = '1.0.0';

export type DeckStage = 'spark' | 'story' | 'alignment' | 'movie';

export type CardPillar =
  | 'curiosity'
  | 'empathy'
  | 'conflict'
  | 'money'
  | 'family'
  | 'lifestyle'
  | 'dreams';

export type SpectrumTraitKey =
  | 'spontaneityVsPlanning'
  | 'familyInterdependence'
  | 'conflictRepairSpeed'
  | 'careerVsRoots';

export interface BlueprintDimensions {
  spontaneityVsPlanning: number; // -10 (Structured Planner) to +10 (Spontaneous Explorer)
  familyInterdependence: number; // -10 (Independent Couple Unit) to +10 (Family-Woven)
  conflictRepairSpeed: number; // -10 (Reflect & Cool-Down First) to +10 (Resolve Immediately)
  careerVsRoots: number; // -10 (Deeply Rooted) to +10 (Career & City Mobile)
  evidenceCounts: Record<SpectrumTraitKey, number>;
  topicsExploredCount: number; // 0 to 7 distinct conversation pillars explored
  promptsExploredCount: number; // Total unique non-pause prompts explored
}

export interface SpectrumCitation {
  cardId: string;
  cardText: string;
  choiceLabel: string;
  traitValue: number;
}

export interface CompletenessBreakdown {
  totalPercent: number;
  scenarioCount: number;
  scenarioTarget: number;
  scenarioPercent: number;
  reflectionCount: number;
  reflectionTarget: number;
  reflectionPercent: number;
  stagesExploredCount: number;
  stagesTarget: number;
  stagePercent: number;
}

export interface CardOption {
  id: string;
  label: string;
  traitKey: SpectrumTraitKey;
  traitValue: number; // -2 to +2 scale mapped to -10 to +10
}

export interface DateCard {
  id: string;
  stage: DeckStage;
  type: 'prompt' | 'scenario' | 'pause';
  pillar: CardPillar;
  text: string;
  subtext?: string;
  options?: CardOption[]; // Only for 'scenario' cards
}

export type MetViaSource = 'Hinge' | 'Bumble' | 'Matrimony' | 'IRL' | 'Friends' | 'Other';

export type ConnectionStatus = 'active' | 'paused' | 'exclusive' | 'archived' | 'ended';

export interface DatePerson {
  id: string;
  nickname: string;
  metVia?: MetViaSource;
  datesCount: number;
  createdAt: string;
  lastDateAt: string;
  updatedAt?: string;
  status: ConnectionStatus;
  milestoneChecks?: Record<string, boolean>; // Optional 3-3-3 / 3-6-9 heuristic check-ins
  isDemo?: boolean;
}

export interface DateSession {
  id: string;
  personId?: string;
  stage: DeckStage;
  movieTitle?: string;
  sourceMode?: 'standard' | 'movie-ai' | 'movie-fallback';
  startedAt: string;
  completedAt?: string;
  updatedAt?: string;
  durationMinutes: number;
  cardsShownIds: string[];
  bookmarkedCardIds: string[];
  skippedCardIds: string[];
  // Strictly records ONLY the user's own optional stance on scenario cards
  userScenarioChoices: Record<string, string>; // cardId -> optionId
  customCards?: DateCard[]; // Stores generated/fallback movie cards for history & bookmarks
  deckCardIds?: string[]; // Ordered deck snapshot for clean resume
  currentCardIndex?: number;
  countedAsDate?: boolean; // Prevents double counting dates per session
  isDemo?: boolean;
}

export interface PostDatePulse {
  id: string;
  sessionId?: string;
  personId?: string;
  createdAt: string;
  updatedAt?: string;
  energy: 'energized' | 'calm' | 'guarded' | 'drained';
  perceivedResponsiveness: 'high' | 'moderate' | 'low';
  nextDecision: 'yes' | 'unsure' | 'no';
  tags: string[];
  privateNote?: string;
  isDemo?: boolean;
}

export interface BlueprintSummary {
  coreStrength: string;
  patternWorthExploring: string;
  potentialBlindSpot: string;
  nextRecommendedTopic: string;
  evidenceNote: string;
  updatedAt: string;
  source: 'gemini' | 'local';
}

export interface AppPreferences {
  userName: string;
  city: string;
  aiEnabled: boolean; // Enables interactive AI prompt features (Go Deeper, Watch & Talk)
  allowBlueprintAi: boolean; // Explicit opt-in for transmitting anonymized Blueprint/reflection summary to Gemini
  includePrivateNotesInAi: boolean; // Default false: excludes free-text private notes from Gemini
}

export interface UserBlueprint {
  dimensions: BlueprintDimensions;
  completenessPercent: number;
  completenessBreakdown: CompletenessBreakdown;
  aiSummary?: BlueprintSummary;
}

export interface ActiveSessionState {
  sessionId: string;
  cards: DateCard[];
  currentIndex: number;
}

/**
 * Private Vault store persisted locally in browser storage.
 * Strictly separated from any future Phase 2 Matchmaking Profile.
 */
export interface TwoTableStore {
  schemaVersion: number;
  cardLibraryVersion: string;
  preferences: AppPreferences;
  people: DatePerson[];
  sessions: DateSession[];
  pulses: PostDatePulse[];
  blueprint: UserBlueprint;
  activeSession: ActiveSessionState | null;
  demoLoaded: boolean;
}

export type ActiveTab = 'play' | 'reflections' | 'blueprint';

export type ActiveFlow =
  | { view: 'tab'; tab: ActiveTab }
  | { view: 'deck-selector'; personId?: string }
  | { view: 'table-mode'; sessionId: string; cards: DateCard[] }
  | { view: 'session-wrap'; sessionId: string; cards: DateCard[] }
  | { view: 'exercise-555'; personId?: string };

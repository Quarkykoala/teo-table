import { useEffect, useState } from 'react';
import { BottomNav } from './components/BottomNav';
import { BlueprintView } from './components/BlueprintView';
import { ConnectionDetailModal } from './components/ConnectionDetailModal';
import { DeckSelectorView } from './components/DeckSelectorView';
import { Exercise555View } from './components/Exercise555View';
import { HomeView } from './components/HomeView';
import { ReflectionsView } from './components/ReflectionsView';
import { SessionWrapView } from './components/SessionWrapView';
import { SettingsModal } from './components/SettingsModal';
import { TableModeView } from './components/TableModeView';
import { TopBar } from './components/TopBar';
import { SEED_CARDS } from './data/seedCards';
import {
  ActiveFlow,
  ActiveTab,
  AppPreferences,
  BlueprintSummary,
  DateCard,
  DatePerson,
  DateSession,
  DeckStage,
  MetViaSource,
  PostDatePulse,
  TwoTableStore,
} from './types';
import {
  buildSessionDeck,
  drawFreshCardFromStage,
  getSeenCardIdsForContext,
} from './utils/blueprint';
import {
  buildDemoStore,
  clearDemoDataOnly,
  clearStoredData,
  createInitialStore,
  exportStoreToJson,
  importStoreFromJson,
  loadStore,
  recomputeStoreBlueprint,
  saveStore,
} from './utils/storage';

export default function App() {
  const [store, setStore] = useState<TwoTableStore>(() => loadStore());
  const [flow, setFlow] = useState<ActiveFlow>({ view: 'tab', tab: 'play' });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inspectedPersonId, setInspectedPersonId] = useState<string | null>(null);
  const [preselectedMirrorSessionId, setPreselectedMirrorSessionId] = useState<string | undefined>(
    undefined,
  );
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  // Support ?autostart=1 for rapid verification or table shortcut
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      setFlow({ view: 'deck-selector' });
    }
  }, []);

  const currentFlowKey = flow.view === 'tab' ? `tab:${flow.tab}` : flow.view;
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [currentFlowKey]);

  useEffect(() => {
    const res = saveStore(store);
    if (!res.ok && res.error) {
      setStorageWarning(res.error);
    } else if (storageWarning) {
      setStorageWarning(null);
    }
  }, [store]);

  const updateStore = (updater: (prev: TwoTableStore) => TwoTableStore) => {
    setStore((prev) => recomputeStoreBlueprint(updater(prev)));
  };

  // =========================================================
  // Connection Management (Add, Edit, Archive, Delete)
  // =========================================================
  const handleAddPerson = (nickname: string, metVia?: MetViaSource) => {
    const now = new Date().toISOString();
    const newPerson: DatePerson = {
      id: `person-${Date.now()}`,
      nickname,
      metVia,
      datesCount: 0,
      createdAt: now,
      lastDateAt: now,
      status: 'active',
      isDemo: false,
    };
    updateStore((prev) => ({
      ...prev,
      people: [newPerson, ...prev.people],
    }));
  };

  const handleUpdatePerson = (
    personId: string,
    updates: Partial<
      Pick<DatePerson, 'nickname' | 'metVia' | 'status' | 'datesCount' | 'milestoneChecks'>
    >,
  ) => {
    const now = new Date().toISOString();
    updateStore((prev) => ({
      ...prev,
      people: prev.people.map((p) => {
        if (p.id !== personId) return p;
        const datesIncremented =
          typeof updates.datesCount === 'number' && updates.datesCount > p.datesCount;
        return {
          ...p,
          ...updates,
          updatedAt: now,
          lastDateAt: datesIncremented ? now : p.lastDateAt,
        };
      }),
    }));
  };

  const handleDeletePerson = (personId: string) => {
    updateStore((prev) => ({
      ...prev,
      people: prev.people.filter((p) => p.id !== personId),
      sessions: prev.sessions.map((s) =>
        s.personId === personId ? { ...s, personId: undefined } : s,
      ),
      pulses: prev.pulses.map((p) =>
        p.personId === personId ? { ...p, personId: undefined } : p,
      ),
    }));
    if (inspectedPersonId === personId) {
      setInspectedPersonId(null);
    }
  };

  // =========================================================
  // Session Lifecycle (Never auto-increments date count on open)
  // =========================================================
  const startSession = (
    stage: DeckStage,
    cards: DateCard[],
    personId?: string,
    movieTitle?: string,
    customCards?: DateCard[],
    sourceMode: DateSession['sourceMode'] = 'standard',
  ) => {
    const sessionId = `session-${Date.now()}`;
    const now = new Date().toISOString();
    const newSession: DateSession = {
      id: sessionId,
      personId,
      stage,
      movieTitle,
      sourceMode,
      startedAt: now,
      durationMinutes: 0,
      cardsShownIds: [],
      bookmarkedCardIds: [],
      skippedCardIds: [],
      userScenarioChoices: {},
      customCards,
      deckCardIds: cards.map((c) => c.id),
      currentCardIndex: 0,
      countedAsDate: false,
      isDemo: false,
    };

    updateStore((prev) => ({
      ...prev,
      sessions: [...prev.sessions, newSession],
      activeSession: {
        sessionId,
        cards,
        currentIndex: 0,
      },
    }));

    setFlow({ view: 'table-mode', sessionId, cards });
  };

  const handleStartStandardDeck = (
    stage: Exclude<DeckStage, 'movie'>,
    length: 5 | 10 | 15,
    personId?: string,
  ) => {
    const seenCardIds = getSeenCardIdsForContext(store.sessions, personId);
    const deck = buildSessionDeck(stage, length, SEED_CARDS, undefined, { seenCardIds });
    startSession(stage, deck, personId, undefined, undefined, 'standard');
  };

  const handleSwapCardInSession = (sessionId: string, cards: DateCard[], index: number) => {
    const session = store.sessions.find((s) => s.id === sessionId);
    const targetCard = cards[index];
    if (!session || session.stage === 'movie' || !targetCard || targetCard.type === 'pause') {
      return;
    }

    const seenCardIds = getSeenCardIdsForContext(store.sessions, session.personId);
    const excludeIds = new Set<string>([
      ...cards.map((c) => c.id),
      ...session.skippedCardIds,
    ]);

    const replacement = drawFreshCardFromStage(
      session.stage,
      SEED_CARDS,
      excludeIds,
      seenCardIds,
    );
    if (!replacement) return;

    const updatedCards = cards.map((c, idx) => (idx === index ? replacement : c));

    updateStore((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) => {
        if (s.id !== sessionId) return s;
        const skipped = s.skippedCardIds.includes(targetCard.id)
          ? s.skippedCardIds
          : [...s.skippedCardIds, targetCard.id];
        return {
          ...s,
          skippedCardIds: skipped,
          deckCardIds: updatedCards.map((c) => c.id),
          updatedAt: new Date().toISOString(),
        };
      }),
      activeSession:
        prev.activeSession && prev.activeSession.sessionId === sessionId
          ? { ...prev.activeSession, cards: updatedCards }
          : prev.activeSession,
    }));

    setFlow({ view: 'table-mode', sessionId, cards: updatedCards });
  };

  const handleStartMovieDeck = (
    movieTitle: string,
    generatedCards: DateCard[],
    sourceMode: 'movie-ai' | 'movie-fallback',
    personId?: string,
  ) => {
    const deck = buildSessionDeck('movie', 5, SEED_CARDS, generatedCards);
    startSession('movie', deck, personId, movieTitle, generatedCards, sourceMode);
  };

  const handleResumeSession = () => {
    if (!store.activeSession) return;
    const exists = store.sessions.some((s) => s.id === store.activeSession?.sessionId);
    if (!exists) {
      updateStore((prev) => ({ ...prev, activeSession: null }));
      return;
    }
    setFlow({
      view: 'table-mode',
      sessionId: store.activeSession.sessionId,
      cards: store.activeSession.cards,
    });
  };

  const handleDiscardActiveSession = () => {
    updateStore((prev) => ({ ...prev, activeSession: null }));
  };

  const handleSessionIndexChange = (sessionId: string, index: number) => {
    updateStore((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) =>
        s.id === sessionId ? { ...s, currentCardIndex: index, updatedAt: new Date().toISOString() } : s,
      ),
      activeSession:
        prev.activeSession && prev.activeSession.sessionId === sessionId
          ? { ...prev.activeSession, currentIndex: index }
          : prev.activeSession,
    }));
  };

  const handleRecordCardShown = (sessionId: string, cardId: string) => {
    updateStore((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) => {
        if (s.id !== sessionId) return s;
        if (s.cardsShownIds.includes(cardId)) return s;
        return { ...s, cardsShownIds: [...s.cardsShownIds, cardId] };
      }),
    }));
  };

  const handleToggleBookmark = (sessionId: string, cardId: string) => {
    updateStore((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) => {
        if (s.id !== sessionId) return s;
        const exists = s.bookmarkedCardIds.includes(cardId);
        return {
          ...s,
          bookmarkedCardIds: exists
            ? s.bookmarkedCardIds.filter((id) => id !== cardId)
            : [...s.bookmarkedCardIds, cardId],
        };
      }),
    }));
  };

  const handleSkipCard = (sessionId: string, cardId: string) => {
    updateStore((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) => {
        if (s.id !== sessionId) return s;
        if (s.skippedCardIds.includes(cardId)) return s;
        return { ...s, skippedCardIds: [...s.skippedCardIds, cardId] };
      }),
    }));
  };

  const handleSelectScenarioOption = (
    sessionId: string,
    cardId: string,
    optionId: string,
  ) => {
    updateStore((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) => {
        if (s.id !== sessionId) return s;
        return {
          ...s,
          userScenarioChoices: {
            ...s.userScenarioChoices,
            [cardId]: optionId,
          },
        };
      }),
    }));
  };

  const handleFinishSession = (sessionId: string, cards: DateCard[]) => {
    const now = new Date();
    updateStore((prev) => ({
      ...prev,
      activeSession:
        prev.activeSession?.sessionId === sessionId ? null : prev.activeSession,
      sessions: prev.sessions.map((s) => {
        if (s.id !== sessionId) return s;
        const mins = Math.max(
          1,
          Math.round((now.getTime() - new Date(s.startedAt).getTime()) / 60000),
        );
        return {
          ...s,
          completedAt: s.completedAt || now.toISOString(),
          updatedAt: now.toISOString(),
          durationMinutes: mins,
        };
      }),
    }));
    setFlow({ view: 'session-wrap', sessionId, cards });
  };

  const handleToggleCountedAsDate = (sessionId: string) => {
    const now = new Date().toISOString();
    updateStore((prev) => {
      const target = prev.sessions.find((s) => s.id === sessionId);
      if (!target || !target.personId) return prev;
      const nextCounted = !target.countedAsDate;
      const delta = nextCounted ? 1 : -1;
      return {
        ...prev,
        sessions: prev.sessions.map((s) =>
          s.id === sessionId ? { ...s, countedAsDate: nextCounted, updatedAt: now } : s,
        ),
        people: prev.people.map((p) =>
          p.id === target.personId
            ? {
                ...p,
                datesCount: Math.max(0, p.datesCount + delta),
                lastDateAt: nextCounted ? now : p.lastDateAt,
                updatedAt: now,
              }
            : p,
        ),
      };
    });
  };

  // =========================================================
  // Reflections (Create, Edit, Delete)
  // =========================================================
  const handleSavePulse = (pulseInput: Omit<PostDatePulse, 'id' | 'createdAt'>) => {
    const newPulse: PostDatePulse = {
      ...pulseInput,
      id: `pulse-${Date.now()}`,
      createdAt: new Date().toISOString(),
      isDemo: false,
    };
    updateStore((prev) => ({
      ...prev,
      pulses: [...prev.pulses, newPulse],
    }));
  };

  const handleUpdatePulse = (
    pulseId: string,
    updates: Omit<PostDatePulse, 'id' | 'createdAt' | 'isDemo'>,
  ) => {
    updateStore((prev) => ({
      ...prev,
      pulses: prev.pulses.map((p) =>
        p.id === pulseId ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p,
      ),
    }));
  };

  const handleDeletePulse = (pulseId: string) => {
    updateStore((prev) => ({
      ...prev,
      pulses: prev.pulses.filter((p) => p.id !== pulseId),
    }));
  };

  // =========================================================
  // Blueprint, Preferences, Backup, Demo & Reset
  // =========================================================
  const handleUpdateAiSummary = (summary: BlueprintSummary) => {
    updateStore((prev) => ({
      ...prev,
      blueprint: {
        ...prev.blueprint,
        aiSummary: summary,
      },
    }));
  };

  const handleUpdatePreferences = (updates: Partial<AppPreferences>) => {
    updateStore((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        ...updates,
      },
    }));
  };

  const handleExportBackup = () => {
    const json = exportStoreToJson(store);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateSlug = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `twotable-backup-${dateSlug}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (jsonText: string): { ok: boolean; error?: string } => {
    const result = importStoreFromJson(jsonText);
    if (!result.ok || !result.store) {
      return { ok: false, error: result.error };
    }
    setStore(result.store);
    return { ok: true };
  };

  const handleLoadDemoData = () => {
    setStore((prev) => buildDemoStore(prev));
  };

  const handleClearDemoData = () => {
    setStore((prev) => clearDemoDataOnly(prev));
  };

  const handleResetAllData = () => {
    clearStoredData();
    setStore(createInitialStore());
    setInspectedPersonId(null);
    setFlow({ view: 'tab', tab: 'play' });
  };

  const activeTab: ActiveTab = flow.view === 'tab' ? flow.tab : 'play';

  // Full-screen Table Mode
  if (flow.view === 'table-mode') {
    const activeSession = store.sessions.find((s) => s.id === flow.sessionId);
    if (activeSession) {
      const canSwapCard =
        activeSession.stage !== 'movie' &&
        SEED_CARDS.some(
          (c) =>
            c.stage === activeSession.stage &&
            !flow.cards.some((fc) => fc.id === c.id) &&
            !activeSession.skippedCardIds.includes(c.id),
        );
      return (
        <TableModeView
          session={activeSession}
          cards={flow.cards}
          initialIndex={activeSession.currentCardIndex ?? 0}
          aiEnabled={store.preferences.aiEnabled}
          canSwapCard={canSwapCard}
          onSwapCard={(idx) => handleSwapCardInSession(activeSession.id, flow.cards, idx)}
          onIndexChange={(idx) => handleSessionIndexChange(activeSession.id, idx)}
          onRecordCardShown={(cardId) => handleRecordCardShown(activeSession.id, cardId)}
          onToggleBookmark={(cardId) => handleToggleBookmark(activeSession.id, cardId)}
          onSkipCard={(cardId) => handleSkipCard(activeSession.id, cardId)}
          onSelectScenarioOption={(cardId, optionId) =>
            handleSelectScenarioOption(activeSession.id, cardId, optionId)
          }
          onFinishSession={() => handleFinishSession(activeSession.id, flow.cards)}
          onExitToHome={() => setFlow({ view: 'tab', tab: 'play' })}
        />
      );
    }
  }

  // Full-screen 5-5-5 Guided Listening Exercise
  if (flow.view === 'exercise-555') {
    const person = store.people.find((p) => p.id === flow.personId);
    return (
      <Exercise555View
        personName={person?.nickname}
        onExit={() => setFlow({ view: 'deck-selector', personId: flow.personId })}
      />
    );
  }

  // Full-screen Session Wrap & Keepsake Postcard
  if (flow.view === 'session-wrap') {
    const wrappedSession = store.sessions.find((s) => s.id === flow.sessionId);
    if (wrappedSession) {
      const person = store.people.find((p) => p.id === wrappedSession.personId);
      return (
        <SessionWrapView
          session={wrappedSession}
          cards={flow.cards}
          person={person}
          onToggleCountedAsDate={handleToggleCountedAsDate}
          onLogMirror={(sessionId) => {
            setPreselectedMirrorSessionId(sessionId);
            setFlow({ view: 'tab', tab: 'reflections' });
          }}
          onDoneHome={() => setFlow({ view: 'tab', tab: 'play' })}
        />
      );
    }
  }

  const inspectedPerson = inspectedPersonId
    ? store.people.find((p) => p.id === inspectedPersonId) || null
    : null;

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1F1D1A] flex flex-col pb-20 md:pb-10">
      <TopBar
        activeTab={activeTab}
        onSelectTab={(tab) => setFlow({ view: 'tab', tab })}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {storageWarning && (
        <div
          role="alert"
          className="bg-[#C85A3F]/10 border-b border-[#C85A3F]/30 px-4 py-2.5 text-center text-xs text-[#AE4830]"
        >
          {storageWarning}
        </div>
      )}

      <main className="flex-1">
        {flow.view === 'deck-selector' ? (
          <DeckSelectorView
            person={store.people.find((p) => p.id === flow.personId)}
            seenCardIds={getSeenCardIdsForContext(store.sessions, flow.personId)}
            aiEnabled={store.preferences.aiEnabled}
            onBack={() => setFlow({ view: 'tab', tab: 'play' })}
            onOpenPrivacySettings={() => setSettingsOpen(true)}
            onStartStandardDeck={(stage, length) =>
              handleStartStandardDeck(stage, length, flow.personId)
            }
            onStartMovieDeck={(title, cards, sourceMode) =>
              handleStartMovieDeck(title, cards, sourceMode, flow.personId)
            }
            onStartExercise555={() =>
              setFlow({ view: 'exercise-555', personId: flow.personId })
            }
          />
        ) : activeTab === 'play' ? (
          <HomeView
            people={store.people}
            sessionsCount={store.sessions.length}
            completenessPercent={store.blueprint.completenessPercent}
            demoLoaded={store.demoLoaded}
            activeSession={store.activeSession}
            onQuickStart={() => setFlow({ view: 'deck-selector' })}
            onResumeSession={handleResumeSession}
            onDiscardActiveSession={handleDiscardActiveSession}
            onSelectPersonForDeck={(personId) =>
              setFlow({ view: 'deck-selector', personId })
            }
            onInspectPerson={(personId) => setInspectedPersonId(personId)}
            onAddPerson={handleAddPerson}
            onLoadDemoData={handleLoadDemoData}
            onClearDemoData={handleClearDemoData}
            onOpenReflections={() => setFlow({ view: 'tab', tab: 'reflections' })}
          />
        ) : activeTab === 'reflections' ? (
          <ReflectionsView
            sessions={store.sessions}
            people={store.people}
            pulses={store.pulses}
            preselectedSessionId={preselectedMirrorSessionId}
            onSavePulse={handleSavePulse}
            onUpdatePulse={handleUpdatePulse}
            onDeletePulse={handleDeletePulse}
            onOpenBlueprint={() => setFlow({ view: 'tab', tab: 'blueprint' })}
          />
        ) : (
          <BlueprintView
            blueprint={store.blueprint}
            preferences={store.preferences}
            sessions={store.sessions}
            pulses={store.pulses}
            onUpdateAiSummary={handleUpdateAiSummary}
            onUpdatePreferences={handleUpdatePreferences}
            onLoadDemoData={handleLoadDemoData}
            onStartDate={() => setFlow({ view: 'deck-selector' })}
          />
        )}
      </main>

      <BottomNav
        activeTab={activeTab}
        onSelectTab={(tab) => setFlow({ view: 'tab', tab })}
      />

      <ConnectionDetailModal
        person={inspectedPerson}
        sessions={store.sessions}
        pulses={store.pulses}
        onClose={() => setInspectedPersonId(null)}
        onStartDeck={(personId) => setFlow({ view: 'deck-selector', personId })}
        onUpdatePerson={handleUpdatePerson}
        onDeletePerson={handleDeletePerson}
      />

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        preferences={store.preferences}
        demoLoaded={store.demoLoaded}
        onUpdatePreferences={handleUpdatePreferences}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
        onLoadDemoData={handleLoadDemoData}
        onClearDemoData={handleClearDemoData}
        onResetAllData={handleResetAllData}
      />
    </div>
  );
}

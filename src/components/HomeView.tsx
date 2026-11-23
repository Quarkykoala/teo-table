import { useState } from 'react';
import { ArrowRight, Play, Plus, SlidersHorizontal, Trash2, UserPlus, X } from 'lucide-react';
import heroCafePhoto from '../assets/images/hero_cafetable_editorial_1794578284914.jpg';
import { ActiveSessionState, DatePerson, MetViaSource } from '../types';
import { recommendNextStage, STAGE_META } from '../utils/blueprint';

interface HomeViewProps {
  people: DatePerson[];
  sessionsCount: number;
  completenessPercent: number;
  demoLoaded: boolean;
  activeSession: ActiveSessionState | null;
  onQuickStart: () => void;
  onResumeSession: () => void;
  onDiscardActiveSession: () => void;
  onSelectPersonForDeck: (personId: string) => void;
  onInspectPerson: (personId: string) => void;
  onAddPerson: (nickname: string, metVia?: MetViaSource) => void;
  onLoadDemoData: () => void;
  onClearDemoData: () => void;
  onOpenReflections: () => void;
}

const MET_VIA_OPTIONS: MetViaSource[] = ['Hinge', 'Bumble', 'Matrimony', 'IRL', 'Friends', 'Other'];

export function HomeView({
  people,
  sessionsCount,
  completenessPercent,
  demoLoaded,
  activeSession,
  onQuickStart,
  onResumeSession,
  onDiscardActiveSession,
  onSelectPersonForDeck,
  onInspectPerson,
  onAddPerson,
  onLoadDemoData,
  onClearDemoData,
  onOpenReflections,
}: HomeViewProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [nickname, setNickname] = useState('');
  const [metVia, setMetVia] = useState<MetViaSource | ''>('');
  const [formError, setFormError] = useState('');
  const [imgError, setImgError] = useState(false);
  const [connectionFilter, setConnectionFilter] = useState<'active' | 'archived'>('active');

  const activePeople = people.filter((p) => p.status !== 'archived' && p.status !== 'ended');
  const archivedPeople = people.filter((p) => p.status === 'archived' || p.status === 'ended');
  const displayedPeople = connectionFilter === 'active' ? activePeople : archivedPeople;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = nickname.trim();
    if (!cleaned) {
      setFormError('Enter a first name or nickname to track dates.');
      return;
    }
    onAddPerson(cleaned.slice(0, 80), metVia || undefined);
    setNickname('');
    setMetVia('');
    setFormError('');
    setShowAddForm(false);
    setConnectionFilter('active');
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-12 space-y-12">
      {/* Resume In-Progress Session Notice */}
      {activeSession && (
        <section
          aria-label="In-progress session"
          className="animate-card-deal rounded-2xl border border-[#5E7461]/45 bg-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 editorial-card-shadow"
        >
          <div className="text-sm text-[#1F1D1A]">
            <span className="font-semibold">You have an in-progress date session</span>
            <span className="ml-2 text-xs text-[#5C574F] tabular-nums">
              Card {activeSession.currentIndex + 1} of {activeSession.cards.length}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onResumeSession}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#5E7461] px-4 py-2 text-xs font-semibold text-white hover:bg-[#485B4B] transition-colors whitespace-nowrap"
            >
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Resume Session</span>
            </button>
            <button
              type="button"
              onClick={onDiscardActiveSession}
              className="inline-flex min-h-[44px] items-center rounded-xl border border-[#E6DFD5] bg-[#FAF7F2] px-3.5 py-2 text-xs font-medium text-[#5C574F] hover:text-[#1F1D1A] transition-colors whitespace-nowrap"
            >
              Dismiss
            </button>
          </div>
        </section>
      )}

      {/* Editorial Hero Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
        <div className="lg:col-span-6 flex flex-col justify-center py-2">
          <p className="animate-editorial-up stagger-1 text-xs font-medium tracking-wide text-[#5E7461]">
            Date with curiosity. Choose with clarity.
          </p>

          <h1 className="animate-editorial-up stagger-2 mt-3 font-serif text-4xl sm:text-[48px] font-normal leading-[1.08] tracking-[-0.015em] text-[#1F1D1A]">
            Bring this on your next date—
            <em className="italic font-normal text-[#C85A3F]">wherever you met.</em>
          </h1>

          <p className="animate-editorial-up stagger-3 mt-5 text-base sm:text-[17px] leading-relaxed text-[#5C574F] max-w-lg">
            Place one phone between two cups. Move naturally from playful curiosity to real-life
            alignment—with screen-down pauses built right into the deck.
          </p>

          <div className="animate-editorial-up stagger-4 mt-8 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={onQuickStart}
              className="group flex min-h-[50px] items-center justify-center gap-2.5 rounded-xl bg-[#C85A3F] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_-10px_rgba(200,90,63,0.55)] hover:bg-[#AE4830] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all duration-200 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C85A3F]"
            >
              <span>Start a Date Now</span>
              <ArrowRight
                className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </button>

            <button
              type="button"
              onClick={onOpenReflections}
              className="flex min-h-[50px] items-center justify-center rounded-xl border border-[#E6DFD5] bg-white/85 px-5 py-3 text-sm font-medium text-[#1F1D1A] hover:bg-white hover:border-[#8A8378]/50 transition-all duration-200 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C85A3F]"
            >
              Morning-After Mirror
            </button>
          </div>

          <div className="animate-editorial-up stagger-4 mt-8 pt-5 border-t border-[#E6DFD5] flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#5C574F] tabular-nums">
            <span>
              {sessionsCount} {sessionsCount === 1 ? 'session' : 'sessions'} logged
            </span>
            <span aria-hidden="true">·</span>
            <span>Blueprint participation {completenessPercent}%</span>
            <span aria-hidden="true">·</span>
            <span>Private &amp; local by default</span>
          </div>
        </div>

        {/* Right: Editorial Café Table Photography */}
        <div className="lg:col-span-6 animate-editorial-up stagger-2">
          <div className="relative h-full min-h-[280px] sm:min-h-[360px] overflow-hidden rounded-3xl border border-[#E6DFD5] bg-[#F3EEE6] editorial-card-shadow">
            {!imgError ? (
              <img
                src={heroCafePhoto}
                alt="Two people seated across a sunlit wooden café table with ceramic espresso cups and a linen-bound conversation deck"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="h-full w-full object-cover transition-transform duration-700 hover:scale-[1.02]"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#F3EEE6] to-[#E6DFD5] p-8 text-center">
                <p className="font-serif italic text-lg text-[#5C574F]">
                  Two cups, one quiet table, unhurried questions.
                </p>
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#1F1D1A]/80 via-[#1F1D1A]/35 to-transparent p-5 sm:p-6">
              <p className="font-serif text-base sm:text-lg text-[#FAF7F2] leading-snug">
                “Put the phone face down for 10 minutes. Enjoy the conversation.”
              </p>
              <p className="mt-1 text-xs text-[#FAF7F2]/80">
                Built-in screen-down pause after every fourth prompt.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Ongoing Connections */}
      <section className="pt-8 border-t border-[#E6DFD5] space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-2xl font-medium text-[#1F1D1A]">
              Ongoing Connections
            </h2>
            <p className="text-xs text-[#5C574F] mt-1">
              Optional private log to pace across stages and keep date reflections organized.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {archivedPeople.length > 0 && (
              <div
                role="group"
                aria-label="Filter connections"
                className="inline-flex items-center gap-1 rounded-xl border border-[#E6DFD5] bg-[#F3EEE6] p-1"
              >
                <button
                  type="button"
                  onClick={() => setConnectionFilter('active')}
                  aria-pressed={connectionFilter === 'active'}
                  className={`min-h-[36px] rounded-lg px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    connectionFilter === 'active'
                      ? 'bg-white text-[#1F1D1A] shadow-xs'
                      : 'text-[#5C574F] hover:text-[#1F1D1A]'
                  }`}
                >
                  Active ({activePeople.length})
                </button>
                <button
                  type="button"
                  onClick={() => setConnectionFilter('archived')}
                  aria-pressed={connectionFilter === 'archived'}
                  className={`min-h-[36px] rounded-lg px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    connectionFilter === 'archived'
                      ? 'bg-white text-[#1F1D1A] shadow-xs'
                      : 'text-[#5C574F] hover:text-[#1F1D1A]'
                  }`}
                >
                  Archived ({archivedPeople.length})
                </button>
              </div>
            )}

            {demoLoaded && (
              <button
                type="button"
                onClick={onClearDemoData}
                className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#E6DFD5] bg-[#FAF7F2] px-3.5 py-2 text-xs font-medium text-[#5C574F] hover:text-[#C85A3F] hover:border-[#C85A3F]/50 transition-colors whitespace-nowrap shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Clear Example Data</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setShowAddForm((prev) => !prev);
                setFormError('');
              }}
              aria-expanded={showAddForm}
              className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#E6DFD5] bg-white px-4 py-2 text-xs font-semibold text-[#1F1D1A] hover:bg-[#F3EEE6] transition-colors whitespace-nowrap shrink-0"
            >
              {showAddForm ? (
                <>
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Cancel</span>
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Add Person</span>
                </>
              )}
            </button>
          </div>
        </div>

        {showAddForm && (
          <form
            onSubmit={handleSubmit}
            className="animate-card-deal rounded-2xl border border-[#E6DFD5] bg-white p-5 sm:p-6 editorial-card-shadow space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="person-nickname"
                  className="block text-xs font-semibold text-[#1F1D1A] mb-1.5"
                >
                  First Name or Nickname
                </label>
                <input
                  id="person-nickname"
                  type="text"
                  value={nickname}
                  onChange={(e) => {
                    setNickname(e.target.value);
                    if (formError) setFormError('');
                  }}
                  placeholder="e.g. Meera"
                  className="w-full min-h-[44px] rounded-xl border border-[#E6DFD5] bg-[#FAF7F2] px-3.5 py-2 text-sm text-[#1F1D1A] placeholder:text-[#8A8378] focus:border-[#C85A3F] focus:bg-white focus:outline-none"
                />
                {formError && (
                  <p role="alert" className="mt-1.5 text-xs text-[#C85A3F]">
                    {formError}
                  </p>
                )}
              </div>

              <div>
                <span className="block text-xs font-semibold text-[#1F1D1A] mb-1.5">
                  Where You Met (Optional)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMetVia('')}
                    aria-pressed={metVia === ''}
                    className={`min-h-[40px] rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      metVia === ''
                        ? 'bg-[#1F1D1A] text-[#FAF7F2]'
                        : 'bg-[#F3EEE6] text-[#5C574F] hover:text-[#1F1D1A]'
                    }`}
                  >
                    Skip
                  </button>
                  {MET_VIA_OPTIONS.map((source) => {
                    const selected = metVia === source;
                    return (
                      <button
                        key={source}
                        type="button"
                        onClick={() => setMetVia(source)}
                        aria-pressed={selected}
                        className={`min-h-[40px] rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                          selected
                            ? 'bg-[#1F1D1A] text-[#FAF7F2]'
                            : 'bg-[#F3EEE6] text-[#5C574F] hover:text-[#1F1D1A]'
                        }`}
                      >
                        {source}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="min-h-[44px] rounded-xl bg-[#1F1D1A] px-6 py-2.5 text-sm font-medium text-[#FAF7F2] hover:bg-[#35322D] transition-colors"
              >
                Save Connection
              </button>
            </div>
          </form>
        )}

        {people.length === 0 ? (
          <div className="rounded-2xl border border-[#E6DFD5] bg-[#F3EEE6]/70 p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <UserPlus className="h-5 w-5 text-[#5E7461] shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <h3 className="text-sm font-semibold text-[#1F1D1A]">
                  No connections logged yet
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-[#5C574F] max-w-xl">
                  Launch a deck right away with Quick Start without tracking anyone—or add a first
                  name to keep session history, completed dates, and private reflections organized.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onLoadDemoData}
              className="min-h-[44px] rounded-xl border border-[#E6DFD5] bg-white px-4 py-2 text-xs font-semibold text-[#1F1D1A] hover:bg-[#FAF7F2] transition-colors whitespace-nowrap shrink-0"
            >
              Load 3 Example Dates to Explore
            </button>
          </div>
        ) : displayedPeople.length === 0 ? (
          <div className="rounded-2xl border border-[#E6DFD5] bg-[#F3EEE6]/60 p-6 text-xs text-[#5C574F]">
            No {connectionFilter} connections right now.
          </div>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedPeople.map((person) => {
              const nextStage = recommendNextStage(person);
              const stageInfo = STAGE_META[nextStage];
              const initial = person.nickname.slice(0, 1).toUpperCase();
              return (
                <li
                  key={person.id}
                  className="flex flex-col justify-between rounded-2xl border border-[#E6DFD5] bg-white p-5 hover:border-[#8A8378]/70 transition-all duration-200 editorial-card-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        aria-hidden="true"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F3EEE6] font-serif text-lg font-medium text-[#1F1D1A]"
                      >
                        {initial}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-semibold text-[#1F1D1A] truncate">
                            {person.nickname}
                          </span>
                          {person.isDemo && (
                            <span className="text-[11px] font-medium text-[#5E7461] shrink-0">
                              Example
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-[#5C574F] tabular-nums truncate">
                          {person.metVia ? `Met via ${person.metVia} · ` : ''}
                          {person.datesCount} {person.datesCount === 1 ? 'date' : 'dates'}
                        </div>
                        <div className="mt-1 text-xs font-medium text-[#5E7461] truncate">
                          Suggested: {stageInfo.title}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onInspectPerson(person.id)}
                      aria-label={`View history and edit ${person.nickname}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#5C574F] hover:bg-[#F3EEE6] hover:text-[#1F1D1A] transition-colors"
                    >
                      <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#E6DFD5]/80 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onInspectPerson(person.id)}
                      className="min-h-[40px] rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#5C574F] hover:bg-[#F3EEE6] hover:text-[#1F1D1A] transition-colors whitespace-nowrap"
                    >
                      History &amp; Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectPersonForDeck(person.id)}
                      className="group inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#FAF7F2] border border-[#E6DFD5] px-3 py-1.5 text-xs font-semibold text-[#1F1D1A] hover:border-[#C85A3F] hover:text-[#C85A3F] transition-colors whitespace-nowrap"
                    >
                      <span>Start Deck</span>
                      <ArrowRight
                        className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

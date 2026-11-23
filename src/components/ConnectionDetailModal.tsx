import { useEffect, useState } from 'react';
import {
  Archive,
  ArrowRight,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronUp,
  Edit3,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import {
  ConnectionStatus,
  DatePerson,
  DateSession,
  MetViaSource,
  PostDatePulse,
} from '../types';
import { OPTIONAL_MILESTONES, recommendNextStage, STAGE_META } from '../utils/blueprint';

interface ConnectionDetailModalProps {
  person: DatePerson | null;
  sessions: DateSession[];
  pulses: PostDatePulse[];
  onClose: () => void;
  onStartDeck: (personId: string) => void;
  onUpdatePerson: (
    personId: string,
    updates: Partial<Pick<DatePerson, 'nickname' | 'metVia' | 'status' | 'datesCount' | 'milestoneChecks'>>,
  ) => void;
  onDeletePerson: (personId: string) => void;
}

const MET_VIA_OPTIONS: Array<MetViaSource | ''> = [
  '',
  'Hinge',
  'Bumble',
  'Matrimony',
  'IRL',
  'Friends',
  'Other',
];

const STATUS_OPTIONS: Array<{ value: ConnectionStatus; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'exclusive', label: 'Exclusive' },
  { value: 'archived', label: 'Archived' },
  { value: 'ended', label: 'Ended' },
];

export function ConnectionDetailModal({
  person,
  sessions,
  pulses,
  onClose,
  onStartDeck,
  onUpdatePerson,
  onDeletePerson,
}: ConnectionDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftNickname, setDraftNickname] = useState('');
  const [draftMetVia, setDraftMetVia] = useState<MetViaSource | ''>('');
  const [draftStatus, setDraftStatus] = useState<ConnectionStatus>('active');
  const [draftDatesCount, setDraftDatesCount] = useState(0);
  const [editError, setEditError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showMilestones, setShowMilestones] = useState(false);

  useEffect(() => {
    if (person) {
      setDraftNickname(person.nickname);
      setDraftMetVia(person.metVia || '');
      setDraftStatus(person.status);
      setDraftDatesCount(person.datesCount);
      setIsEditing(false);
      setEditError('');
      setConfirmDelete(false);
    }
  }, [person?.id, person?.nickname, person?.metVia, person?.status, person?.datesCount]);

  useEffect(() => {
    if (!person) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [person, onClose]);

  if (!person) return null;

  const personSessions = [...sessions]
    .filter((s) => s.personId === person.id)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  const personPulses = [...pulses]
    .filter((p) => p.personId === person.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const nextStage = recommendNextStage(person);
  const isArchived = person.status === 'archived';

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = draftNickname.trim();
    if (!cleaned) {
      setEditError('Please enter a first name or nickname.');
      return;
    }
    onUpdatePerson(person.id, {
      nickname: cleaned.slice(0, 80),
      metVia: draftMetVia || undefined,
      status: draftStatus,
      datesCount: Math.max(0, Math.floor(draftDatesCount)),
    });
    setIsEditing(false);
    setEditError('');
  };

  const handleToggleMilestone = (milestoneId: string) => {
    const current = person.milestoneChecks || {};
    onUpdatePerson(person.id, {
      milestoneChecks: {
        ...current,
        [milestoneId]: !current[milestoneId],
      },
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#1F1D1A]/45 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="connection-modal-title"
    >
      <div className="w-full sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-[#FAF7F2] border border-[#E6DFD5] p-6 shadow-xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#E6DFD5]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-[#5C574F]">
              <span>{person.metVia ? `Met via ${person.metVia}` : 'Source not specified'}</span>
              <span aria-hidden="true">·</span>
              <span className="capitalize">{person.status}</span>
              {person.isDemo && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-[#5E7461]">Example record</span>
                </>
              )}
            </div>
            <h2
              id="connection-modal-title"
              className="mt-1 font-serif text-2xl font-medium text-[#1F1D1A] truncate"
            >
              {person.nickname}
            </h2>
            <p className="mt-1 text-xs text-[#5C574F] tabular-nums">
              {person.datesCount} completed {person.datesCount === 1 ? 'date' : 'dates'} · Suggested
              stage: {STAGE_META[nextStage].title}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={`Close details for ${person.nickname}`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#5C574F] hover:bg-[#F3EEE6] hover:text-[#1F1D1A] transition-colors"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Quick Actions */}
        {!isEditing && (
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => {
                onClose();
                onStartDeck(person.id);
              }}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#C85A3F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#AE4830] transition-colors whitespace-nowrap"
            >
              <span>Start Date Deck</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() =>
                onUpdatePerson(person.id, { datesCount: person.datesCount + 1 })
              }
              className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#E6DFD5] bg-white px-3.5 py-2 text-xs font-semibold text-[#1F1D1A] hover:bg-[#F3EEE6] transition-colors whitespace-nowrap"
            >
              <CalendarPlus className="h-4 w-4 text-[#5E7461]" aria-hidden="true" />
              <span>Log Completed Date</span>
            </button>

            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#E6DFD5] bg-white px-3.5 py-2 text-xs font-medium text-[#1F1D1A] hover:bg-[#F3EEE6] transition-colors whitespace-nowrap"
            >
              <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Edit</span>
            </button>
          </div>
        )}

        {/* Edit Form */}
        {isEditing && (
          <form
            onSubmit={handleSaveEdit}
            className="rounded-2xl border border-[#E6DFD5] bg-white p-5 space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="edit-connection-name"
                  className="block text-xs font-semibold text-[#1F1D1A] mb-1.5"
                >
                  First Name or Nickname
                </label>
                <input
                  id="edit-connection-name"
                  type="text"
                  value={draftNickname}
                  onChange={(e) => {
                    setDraftNickname(e.target.value);
                    if (editError) setEditError('');
                  }}
                  className="w-full min-h-[44px] rounded-xl border border-[#E6DFD5] bg-[#FAF7F2] px-3.5 py-2 text-sm text-[#1F1D1A] focus:border-[#C85A3F] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-connection-source"
                  className="block text-xs font-semibold text-[#1F1D1A] mb-1.5"
                >
                  Where You Met (Optional)
                </label>
                <select
                  id="edit-connection-source"
                  value={draftMetVia}
                  onChange={(e) => setDraftMetVia(e.target.value as MetViaSource | '')}
                  className="w-full min-h-[44px] rounded-xl border border-[#E6DFD5] bg-[#FAF7F2] px-3.5 py-2 text-sm text-[#1F1D1A] focus:border-[#C85A3F] focus:bg-white focus:outline-none"
                >
                  {MET_VIA_OPTIONS.map((opt) => (
                    <option key={opt || 'none'} value={opt}>
                      {opt || 'Not specified'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="edit-connection-status"
                  className="block text-xs font-semibold text-[#1F1D1A] mb-1.5"
                >
                  Status
                </label>
                <select
                  id="edit-connection-status"
                  value={draftStatus}
                  onChange={(e) => setDraftStatus(e.target.value as ConnectionStatus)}
                  className="w-full min-h-[44px] rounded-xl border border-[#E6DFD5] bg-[#FAF7F2] px-3.5 py-2 text-sm text-[#1F1D1A] focus:border-[#C85A3F] focus:bg-white focus:outline-none"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="edit-connection-dates"
                  className="block text-xs font-semibold text-[#1F1D1A] mb-1.5"
                >
                  Completed Dates
                </label>
                <input
                  id="edit-connection-dates"
                  type="number"
                  min={0}
                  max={200}
                  value={draftDatesCount}
                  onChange={(e) => setDraftDatesCount(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full min-h-[44px] rounded-xl border border-[#E6DFD5] bg-[#FAF7F2] px-3.5 py-2 text-sm text-[#1F1D1A] tabular-nums focus:border-[#C85A3F] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {editError && (
              <p role="alert" className="text-xs text-[#C85A3F]">
                {editError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="min-h-[44px] rounded-xl border border-[#E6DFD5] bg-white px-4 py-2 text-xs font-medium text-[#1F1D1A] hover:bg-[#F3EEE6]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[44px] rounded-xl bg-[#1F1D1A] px-5 py-2 text-xs font-semibold text-[#FAF7F2] hover:bg-[#35322D]"
              >
                Save Changes
              </button>
            </div>
          </form>
        )}

        {/* Session History */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[#1F1D1A]">
              Conversation Sessions ({personSessions.length})
            </h3>
          </div>
          {personSessions.length === 0 ? (
            <p className="rounded-xl border border-[#E6DFD5] bg-white/70 p-4 text-xs text-[#5C574F]">
              No table sessions logged with {person.nickname} yet. Opening a deck never increases
              your date count automatically—you choose when to record a completed date.
            </p>
          ) : (
            <ul className="space-y-2">
              {personSessions.map((session) => {
                const promptCount = session.cardsShownIds.filter(
                  (id) => !id.startsWith('pause-'),
                ).length;
                const stageTitle =
                  session.stage === 'movie'
                    ? `Watch & Talk: ${session.movieTitle || 'Film Night'}`
                    : STAGE_META[session.stage].title;
                const dateLabel = new Date(session.startedAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                });
                return (
                  <li
                    key={session.id}
                    className="rounded-xl border border-[#E6DFD5] bg-white px-4 py-3 text-xs text-[#5C574F]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-[#1F1D1A]">{stageTitle}</span>
                      <span className="tabular-nums">{dateLabel}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 tabular-nums">
                      <span>{promptCount} prompts explored</span>
                      <span aria-hidden="true">·</span>
                      <span>{session.bookmarkedCardIds.length} bookmarked</span>
                      {session.countedAsDate && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-medium text-[#5E7461]">Counted as a date</span>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Reflections Linked to Connection */}
        <section className="space-y-2.5">
          <h3 className="text-xs font-semibold text-[#1F1D1A]">
            Private Reflections ({personPulses.length})
          </h3>
          {personPulses.length === 0 ? (
            <p className="rounded-xl border border-[#E6DFD5] bg-white/70 p-4 text-xs text-[#5C574F]">
              No Morning-After Mirror reflections linked to {person.nickname} yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {personPulses.map((pulse) => {
                const dateLabel = new Date(pulse.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                });
                return (
                  <li
                    key={pulse.id}
                    className="rounded-xl border border-[#E6DFD5] bg-white px-4 py-3 text-xs space-y-1"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[#5C574F]">
                      <span className="font-semibold capitalize text-[#1F1D1A]">
                        {pulse.energy === 'calm' ? 'Calm & Safe' : pulse.energy}
                      </span>
                      <span className="tabular-nums">{dateLabel}</span>
                    </div>
                    {pulse.tags.length > 0 && (
                      <p className="text-[#5E7461]">{pulse.tags.join(' · ')}</p>
                    )}
                    {pulse.privateNote && (
                      <p className="font-serif italic text-sm text-[#1F1D1A]">
                        “{pulse.privateNote}”
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Optional 3-3-3 & 3-6-9 Reflection Milestones */}
        <section className="rounded-2xl border border-[#E6DFD5] bg-white p-4">
          <button
            type="button"
            onClick={() => setShowMilestones((v) => !v)}
            aria-expanded={showMilestones}
            className="flex w-full min-h-[40px] items-center justify-between gap-2 text-left text-xs font-semibold text-[#1F1D1A]"
          >
            <span>Optional Reflection Milestones (3-3-3 / 3-6-9 Heuristics)</span>
            {showMilestones ? (
              <ChevronUp className="h-4 w-4 text-[#5C574F]" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4 text-[#5C574F]" aria-hidden="true" />
            )}
          </button>

          {showMilestones && (
            <div className="mt-3 pt-3 border-t border-[#E6DFD5] space-y-3">
              <p className="text-xs leading-relaxed text-[#5C574F]">
                These are popular dating check-in heuristics—not scientific stages or compatibility
                deadlines. Use them only if you enjoy pausing to reflect at certain intervals.
              </p>
              <div className="flex flex-wrap gap-2">
                {OPTIONAL_MILESTONES.map((m) => {
                  const checked = Boolean(person.milestoneChecks?.[m.id]);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleToggleMilestone(m.id)}
                      aria-pressed={checked}
                      className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        checked
                          ? 'border-[#5E7461] bg-[#5E7461]/12 text-[#485B4B]'
                          : 'border-[#E6DFD5] bg-[#FAF7F2] text-[#5C574F] hover:text-[#1F1D1A]'
                      }`}
                    >
                      {checked && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Archive & Delete Controls */}
        <div className="pt-4 border-t border-[#E6DFD5] flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() =>
              onUpdatePerson(person.id, { status: isArchived ? 'active' : 'archived' })
            }
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#E6DFD5] bg-white px-3.5 py-2 text-xs font-medium text-[#1F1D1A] hover:bg-[#F3EEE6] transition-colors"
          >
            {isArchived ? (
              <>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Restore to Active</span>
              </>
            ) : (
              <>
                <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Archive Connection</span>
              </>
            )}
          </button>

          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#E6DFD5] bg-white px-3.5 py-2 text-xs font-medium text-[#C85A3F] hover:bg-[#C85A3F]/5 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Delete Connection</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#5C574F]">Remove {person.nickname}?</span>
              <button
                type="button"
                onClick={() => {
                  onDeletePerson(person.id);
                  onClose();
                }}
                className="min-h-[40px] rounded-lg bg-[#C85A3F] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#AE4830]"
              >
                Confirm Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="min-h-[40px] rounded-lg border border-[#E6DFD5] bg-white px-3 py-1.5 text-xs font-medium text-[#1F1D1A]"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

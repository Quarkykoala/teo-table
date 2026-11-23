import { useEffect, useState } from 'react';
import { Check, Edit3, Lock, Trash2, X } from 'lucide-react';
import { DatePerson, DateSession, PostDatePulse } from '../types';
import { REFLECTION_TAGS, STAGE_META } from '../utils/blueprint';

interface ReflectionsViewProps {
  sessions: DateSession[];
  people: DatePerson[];
  pulses: PostDatePulse[];
  preselectedSessionId?: string;
  onSavePulse: (pulse: Omit<PostDatePulse, 'id' | 'createdAt'>) => void;
  onUpdatePulse: (
    pulseId: string,
    updates: Omit<PostDatePulse, 'id' | 'createdAt' | 'isDemo'>,
  ) => void;
  onDeletePulse: (pulseId: string) => void;
  onOpenBlueprint: () => void;
}

const ENERGY_OPTIONS: Array<{ value: PostDatePulse['energy']; label: string }> = [
  { value: 'energized', label: 'Energized' },
  { value: 'calm', label: 'Calm & Safe' },
  { value: 'guarded', label: 'Guarded' },
  { value: 'drained', label: 'Drained' },
];

const RESPONSIVENESS_OPTIONS: Array<{
  value: PostDatePulse['perceivedResponsiveness'];
  label: string;
}> = [
  { value: 'high', label: 'I felt heard and understood.' },
  { value: 'moderate', label: 'It felt balanced.' },
  { value: 'low', label: 'I struggled to feel heard.' },
];

const DECISION_OPTIONS: Array<{ value: PostDatePulse['nextDecision']; label: string }> = [
  { value: 'yes', label: 'Yes, I’d like another date.' },
  { value: 'unsure', label: 'Curious, but I need more clarity.' },
  { value: 'no', label: 'I don’t feel aligned.' },
];

export function ReflectionsView({
  sessions,
  people,
  pulses,
  preselectedSessionId,
  onSavePulse,
  onUpdatePulse,
  onDeletePulse,
  onOpenBlueprint,
}: ReflectionsViewProps) {
  const preselectedSession = preselectedSessionId
    ? sessions.find((s) => s.id === preselectedSessionId)
    : undefined;

  const [editingPulseId, setEditingPulseId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string>(preselectedSession?.id || '');
  const [selectedPersonId, setSelectedPersonId] = useState<string>(
    preselectedSession?.personId || '',
  );
  const [energy, setEnergy] = useState<PostDatePulse['energy'] | ''>('');
  const [responsiveness, setResponsiveness] = useState<
    PostDatePulse['perceivedResponsiveness'] | ''
  >('');
  const [nextDecision, setNextDecision] = useState<PostDatePulse['nextDecision'] | ''>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [privateNote, setPrivateNote] = useState('');
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (preselectedSession && !editingPulseId) {
      setSelectedSessionId(preselectedSession.id);
      setSelectedPersonId(preselectedSession.personId || '');
    }
  }, [preselectedSessionId]);

  const resetForm = () => {
    setEditingPulseId(null);
    setSelectedSessionId('');
    setSelectedPersonId('');
    setEnergy('');
    setResponsiveness('');
    setNextDecision('');
    setSelectedTags([]);
    setPrivateNote('');
    setError('');
  };

  const handleSelectSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    const linked = sessions.find((s) => s.id === sessionId);
    if (linked?.personId) {
      setSelectedPersonId(linked.personId);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleStartEdit = (pulse: PostDatePulse) => {
    setEditingPulseId(pulse.id);
    setSelectedSessionId(pulse.sessionId || '');
    setSelectedPersonId(pulse.personId || '');
    setEnergy(pulse.energy);
    setResponsiveness(pulse.perceivedResponsiveness);
    setNextDecision(pulse.nextDecision);
    setSelectedTags([...pulse.tags]);
    setPrivateNote(pulse.privateNote || '');
    setError('');
    setStatusMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!energy || !responsiveness || !nextDecision) {
      setError('Please answer the first three questions before saving your reflection.');
      return;
    }

    const payload = {
      sessionId: selectedSessionId || undefined,
      personId: selectedPersonId || undefined,
      energy,
      perceivedResponsiveness: responsiveness,
      nextDecision,
      tags: selectedTags,
      privateNote: privateNote.trim() || undefined,
    };

    if (editingPulseId) {
      onUpdatePulse(editingPulseId, payload);
      setStatusMessage('Reflection updated.');
    } else {
      onSavePulse(payload);
      setStatusMessage('Reflection saved privately to your device.');
    }

    resetForm();
    window.setTimeout(() => setStatusMessage(''), 4000);
  };

  const getSessionLabel = (s: DateSession) => {
    const person = people.find((p) => p.id === s.personId);
    const stageName =
      s.stage === 'movie' ? `Watch & Talk: ${s.movieTitle || 'Film'}` : STAGE_META[s.stage].title;
    const dateStr = new Date(s.startedAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
    return `${person ? `${person.nickname} · ` : ''}${stageName} · ${dateStr}`;
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Morning-After Mirror Form */}
        <section className="animate-editorial-up stagger-1 lg:col-span-7 rounded-3xl border border-[#E6DFD5] bg-white p-6 sm:p-8 editorial-card-shadow">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-[#5C574F]">
              <Lock className="h-3.5 w-3.5 text-[#5E7461]" aria-hidden="true" />
              <span>Private &amp; local · Reflects your own experience, never scores your date</span>
            </div>
            {editingPulseId && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex min-h-[36px] items-center gap-1 text-xs font-medium text-[#5C574F] hover:text-[#1F1D1A]"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Cancel Edit</span>
              </button>
            )}
          </div>

          <h1 className="mt-2 font-serif text-3xl font-normal text-[#1F1D1A]">
            {editingPulseId ? 'Edit Reflection' : 'Morning-After Mirror'}
          </h1>
          <p className="mt-1.5 text-sm text-[#5C574F]">
            A quiet, private check-in after a date to notice how you felt and what stood out to you.
          </p>

          {statusMessage && (
            <div
              role="status"
              className="mt-4 animate-card-deal flex items-center justify-between gap-3 rounded-xl bg-[#5E7461]/12 px-4 py-3 text-xs font-medium text-[#485B4B]"
            >
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4" aria-hidden="true" />
                <span>{statusMessage}</span>
              </span>
              <button
                type="button"
                onClick={onOpenBlueprint}
                className="underline font-semibold whitespace-nowrap"
              >
                View Blueprint
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            {/* Optional Connection & Session Linking */}
            {(people.length > 0 || sessions.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {people.length > 0 && (
                  <div>
                    <label
                      htmlFor="mirror-person"
                      className="block text-xs font-semibold text-[#1F1D1A] mb-1.5"
                    >
                      Link to Connection (Optional)
                    </label>
                    <select
                      id="mirror-person"
                      value={selectedPersonId}
                      onChange={(e) => setSelectedPersonId(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-[#E6DFD5] bg-[#FAF7F2] px-3.5 py-2 text-sm text-[#1F1D1A] focus:border-[#C85A3F] focus:outline-none"
                    >
                      <option value="">Not linked to a person</option>
                      {people.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nickname}
                          {p.isDemo ? ' (Example)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {sessions.length > 0 && (
                  <div>
                    <label
                      htmlFor="mirror-session"
                      className="block text-xs font-semibold text-[#1F1D1A] mb-1.5"
                    >
                      Link to Date Session (Optional)
                    </label>
                    <select
                      id="mirror-session"
                      value={selectedSessionId}
                      onChange={(e) => handleSelectSession(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-[#E6DFD5] bg-[#FAF7F2] px-3.5 py-2 text-sm text-[#1F1D1A] focus:border-[#C85A3F] focus:outline-none"
                    >
                      <option value="">Standalone reflection</option>
                      {sessions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {getSessionLabel(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* 1. How did you feel afterward? */}
            <fieldset>
              <legend className="text-xs font-semibold text-[#1F1D1A] mb-2">
                1. How did you feel afterward?
              </legend>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ENERGY_OPTIONS.map((opt) => {
                  const active = energy === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setEnergy(opt.value);
                        if (error) setError('');
                      }}
                      aria-pressed={active}
                      className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-medium transition-all duration-150 active:scale-[0.98] ${
                        active
                          ? 'border-[#C85A3F] bg-[#C85A3F] text-white shadow-xs'
                          : 'border-[#E6DFD5] bg-[#FAF7F2] text-[#1F1D1A] hover:bg-[#F3EEE6]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* 2. How did the conversation feel? */}
            <fieldset>
              <legend className="text-xs font-semibold text-[#1F1D1A] mb-2">
                2. How did the conversation feel?
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {RESPONSIVENESS_OPTIONS.map((opt) => {
                  const active = responsiveness === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setResponsiveness(opt.value);
                        if (error) setError('');
                      }}
                      aria-pressed={active}
                      className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-medium text-left sm:text-center transition-all duration-150 active:scale-[0.98] ${
                        active
                          ? 'border-[#5E7461] bg-[#5E7461] text-white shadow-xs'
                          : 'border-[#E6DFD5] bg-[#FAF7F2] text-[#1F1D1A] hover:bg-[#F3EEE6]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* 3. What feels right as your next step? */}
            <fieldset>
              <legend className="text-xs font-semibold text-[#1F1D1A] mb-2">
                3. What feels right as your next step?
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {DECISION_OPTIONS.map((opt) => {
                  const active = nextDecision === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setNextDecision(opt.value);
                        if (error) setError('');
                      }}
                      aria-pressed={active}
                      className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-medium transition-all duration-150 active:scale-[0.98] ${
                        active
                          ? 'border-[#1F1D1A] bg-[#1F1D1A] text-[#FAF7F2] shadow-xs'
                          : 'border-[#E6DFD5] bg-[#FAF7F2] text-[#1F1D1A] hover:bg-[#F3EEE6]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* 4. Which experiences stood out? */}
            <fieldset>
              <legend className="text-xs font-semibold text-[#1F1D1A] mb-2">
                4. Which experiences stood out? (Select any that apply)
              </legend>
              <div className="flex flex-wrap gap-2">
                {REFLECTION_TAGS.map((tag) => {
                  const active = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      aria-pressed={active}
                      className={`min-h-[40px] rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                        active
                          ? 'border-[#C85A3F] bg-[#C85A3F]/10 text-[#C85A3F]'
                          : 'border-[#E6DFD5] bg-white text-[#5C574F] hover:text-[#1F1D1A]'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Optional Private Note */}
            <div>
              <label
                htmlFor="mirror-note"
                className="block text-xs font-semibold text-[#1F1D1A] mb-1.5"
              >
                Private Note to Self (Optional)
              </label>
              <textarea
                id="mirror-note"
                rows={2}
                maxLength={1000}
                value={privateNote}
                onChange={(e) => setPrivateNote(e.target.value)}
                placeholder="What surprised you, felt easy, or left you curious?"
                className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#1F1D1A] placeholder:text-[#8A8378] focus:border-[#C85A3F] focus:bg-white focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-[#5C574F]">
                Stored only in this browser. Excluded from shared keepsakes and excluded from AI by
                default.
              </p>
            </div>

            {error && (
              <p role="alert" className="text-xs text-[#C85A3F] font-medium">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full min-h-[48px] rounded-xl bg-[#1F1D1A] px-5 py-3 text-sm font-semibold text-[#FAF7F2] hover:bg-[#35322D] transition-colors"
            >
              {editingPulseId ? 'Save Updated Reflection' : 'Save Private Reflection'}
            </button>
          </form>
        </section>

        {/* Right: Chronological Reflection History with Edit & Delete */}
        <aside className="animate-editorial-up stagger-2 lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-2xl font-normal text-[#1F1D1A]">
              Reflection History
            </h2>
            <span className="text-xs text-[#5C574F] tabular-nums">
              {pulses.length} {pulses.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>

          {pulses.length === 0 ? (
            <div className="rounded-2xl border border-[#E6DFD5] bg-[#F3EEE6]/70 p-6 text-xs leading-relaxed text-[#5C574F]">
              No reflections logged yet. Logging 2–3 private reflections helps you notice recurring
              patterns in your Dating Blueprint.
            </div>
          ) : (
            <ul className="space-y-3">
              {[...pulses]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((pulse) => {
                  const energyLabel =
                    ENERGY_OPTIONS.find((e) => e.value === pulse.energy)?.label || pulse.energy;
                  const decisionLabel =
                    DECISION_OPTIONS.find((d) => d.value === pulse.nextDecision)?.label ||
                    pulse.nextDecision;
                  const linkedPerson = people.find((p) => p.id === pulse.personId);
                  const dateText = new Date(pulse.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <li
                      key={pulse.id}
                      className="rounded-2xl border border-[#E6DFD5] bg-white p-5 space-y-2.5 editorial-card-shadow"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-x-2 text-xs text-[#5C574F]">
                          <span className="font-semibold text-[#1F1D1A]">{energyLabel}</span>
                          {linkedPerson && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#1F1D1A]">{linkedPerson.nickname}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">{dateText}</span>
                          {pulse.isDemo && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-medium text-[#5E7461]">Example</span>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(pulse)}
                            aria-label={`Edit reflection from ${dateText}`}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#5C574F] hover:bg-[#F3EEE6] hover:text-[#1F1D1A] transition-colors"
                          >
                            <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(pulse.id)}
                            aria-label={`Delete reflection from ${dateText}`}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#5C574F] hover:bg-[#C85A3F]/10 hover:text-[#C85A3F] transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-[#5C574F]">{decisionLabel}</p>

                      {pulse.tags.length > 0 && (
                        <p className="text-xs text-[#5E7461] font-medium">
                          {pulse.tags.join(' · ')}
                        </p>
                      )}

                      {pulse.privateNote && (
                        <p className="font-serif italic text-base text-[#1F1D1A] leading-relaxed">
                          “{pulse.privateNote}”
                        </p>
                      )}

                      {confirmDeleteId === pulse.id && (
                        <div className="pt-2 border-t border-[#E6DFD5] flex items-center justify-between gap-2 text-xs">
                          <span className="text-[#5C574F]">Delete this reflection?</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                onDeletePulse(pulse.id);
                                setConfirmDeleteId(null);
                                if (editingPulseId === pulse.id) resetForm();
                              }}
                              className="min-h-[34px] rounded-lg bg-[#C85A3F] px-3 py-1 font-semibold text-white hover:bg-[#AE4830]"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="min-h-[34px] rounded-lg border border-[#E6DFD5] bg-[#FAF7F2] px-3 py-1 font-medium text-[#1F1D1A]"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { ArrowRight, CalendarCheck, Check, Copy, Share2 } from 'lucide-react';
import { DateCard, DatePerson, DateSession } from '../types';
import { formatWhatsAppShareText, STAGE_META } from '../utils/blueprint';

interface SessionWrapViewProps {
  session: DateSession;
  cards: DateCard[];
  person?: DatePerson;
  onToggleCountedAsDate: (sessionId: string) => void;
  onLogMirror: (sessionId: string) => void;
  onDoneHome: () => void;
}

export function SessionWrapView({
  session,
  cards,
  person,
  onToggleCountedAsDate,
  onLogMirror,
  onDoneHome,
}: SessionWrapViewProps) {
  const [copied, setCopied] = useState(false);

  const bookmarkedCards = cards.filter(
    (c) => c.type !== 'pause' && session.bookmarkedCardIds.includes(c.id),
  );
  const exploredPromptsCount =
    session.cardsShownIds.filter((id) => !id.startsWith('pause-')).length ||
    cards.filter((c) => c.type !== 'pause').length;

  const stageTitle =
    session.stage === 'movie'
      ? `Watch & Talk: ${session.movieTitle || 'Movie Night'}`
      : STAGE_META[session.stage].title;

  const shareUrl = typeof window !== 'undefined' ? window.location.origin : 'https://twotable.app';
  const shareText = formatWhatsAppShareText(session, bookmarkedCards, shareUrl);

  const copyShareText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2600);
    } catch {
      const el = document.createElement('textarea');
      el.value = shareText;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2600);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'TwoTable — Tonight’s Prompts',
          text: shareText,
        });
        return;
      } catch {
        // Fallback to clipboard if share sheet is dismissed or unsupported
      }
    }
    await copyShareText();
  };

  return (
    <div className="min-h-screen px-4 sm:px-6 py-10 flex items-center justify-center">
      <div className="w-full max-w-xl space-y-6">
        <div className="animate-editorial-up stagger-1 text-center sm:text-left">
          <p className="text-xs font-medium text-[#5E7461]">
            {person ? `Session complete · ${person.nickname}` : 'Session complete'} · {stageTitle}
          </p>
          <h1 className="mt-1.5 font-serif text-3xl sm:text-4xl font-normal text-[#1F1D1A]">
            Tonight’s Keepsake
          </h1>
          <p className="mt-2 text-sm text-[#5C574F] tabular-nums">
            {exploredPromptsCount} {exploredPromptsCount === 1 ? 'prompt' : 'prompts'} explored ·{' '}
            {bookmarkedCards.length} {bookmarkedCards.length === 1 ? 'bookmark' : 'bookmarks'} saved
          </p>
        </div>

        {/* Explicit Date Count Recording (Prevents Automatic Double-Counting) */}
        {person && (
          <section className="animate-editorial-up stagger-1 rounded-2xl border border-[#E6DFD5] bg-[#F3EEE6]/80 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-[#5C574F]">
              <div className="font-semibold text-[#1F1D1A] flex items-center gap-1.5">
                <CalendarCheck className="h-4 w-4 text-[#5E7461]" aria-hidden="true" />
                <span>
                  {session.countedAsDate
                    ? `Recorded in ${person.nickname}’s date count (${person.datesCount} total)`
                    : `Count this session as Date #${person.datesCount + 1} with ${person.nickname}?`}
                </span>
              </div>
              <p className="mt-1">
                Opening or replaying a deck never changes your date count automatically.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onToggleCountedAsDate(session.id)}
              className={`min-h-[44px] rounded-xl px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                session.countedAsDate
                  ? 'border border-[#E6DFD5] bg-white text-[#5C574F] hover:text-[#1F1D1A]'
                  : 'bg-[#5E7461] text-white hover:bg-[#485B4B]'
              }`}
            >
              {session.countedAsDate ? 'Undo Date Count' : `Record Date #${person.datesCount + 1}`}
            </button>
          </section>
        )}

        {/* Letterpress Keepsake Postcard */}
        <section className="animate-editorial-up stagger-2 relative overflow-hidden rounded-3xl border border-[#E6DFD5] bg-white p-7 sm:p-9 editorial-deck-shadow">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-3 rounded-[20px] border border-[#E6DFD5]/55"
          />

          <div className="relative">
            <div className="flex items-center justify-between pb-4 border-b border-[#E6DFD5]">
              <span className="font-serif text-lg font-medium text-[#1F1D1A]">TwoTable</span>
              <span className="text-xs text-[#5C574F]">{stageTitle}</span>
            </div>

            {bookmarkedCards.length > 0 ? (
              <div className="mt-6 space-y-4">
                <p className="text-xs font-medium text-[#C85A3F]">
                  Bookmarked prompts from tonight (up to 3 included when sharing)
                </p>
                <ul className="space-y-4">
                  {bookmarkedCards.slice(0, 3).map((card, i) => (
                    <li
                      key={card.id}
                      className="font-serif text-lg sm:text-xl leading-snug text-[#1F1D1A]"
                    >
                      <span className="mr-2 font-mono text-xs text-[#8A8378]">0{i + 1}.</span>
                      “{card.text}”
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="mt-6">
                <p className="font-serif text-xl leading-snug text-[#1F1D1A]">
                  We put the phones down and talked through {exploredPromptsCount} real{' '}
                  {exploredPromptsCount === 1 ? 'prompt' : 'prompts'} tonight.
                </p>
                <p className="mt-2 text-xs text-[#5C574F]">
                  Bookmark favorite prompts during Table Mode to feature them on your keepsake
                  postcard.
                </p>
              </div>
            )}

            <p className="mt-5 text-[11px] text-[#5C574F]">
              Shared text includes only your selected prompts—never private reflections, scenario
              choices, connection names, or Blueprint notes.
            </p>

            <div className="mt-5 pt-5 border-t border-[#E6DFD5] flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleShare}
                className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#C85A3F] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgba(200,90,63,0.55)] hover:bg-[#AE4830] transition-all"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" aria-hidden="true" />
                    <span>Copied Prompts</span>
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4" aria-hidden="true" />
                    <span>Share Tonight’s Prompts</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={copyShareText}
                aria-label="Copy formatted prompts text"
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#E6DFD5] bg-[#FAF7F2] px-4 py-3 text-xs font-medium text-[#1F1D1A] hover:bg-[#F3EEE6] transition-colors"
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
                <span>Copy Text</span>
              </button>
            </div>
          </div>
        </section>

        {/* Next Step: Optional Morning-After Mirror or Home */}
        <div className="animate-editorial-up stagger-3 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => onLogMirror(session.id)}
            className="group flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#1F1D1A] px-5 py-3 text-sm font-semibold text-[#FAF7F2] hover:bg-[#35322D] transition-colors"
          >
            <span>Open Morning-After Mirror</span>
            <ArrowRight
              className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </button>

          <button
            type="button"
            onClick={onDoneHome}
            className="flex min-h-[48px] items-center justify-center rounded-xl border border-[#E6DFD5] bg-white px-5 py-3 text-sm font-medium text-[#1F1D1A] hover:bg-[#F3EEE6] transition-colors"
          >
            Back to Play
          </button>
        </div>
      </div>
    </div>
  );
}

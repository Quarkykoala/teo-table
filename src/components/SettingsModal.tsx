import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Database,
  Download,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { AppPreferences } from '../types';
import { MAJOR_CITIES } from '../utils/blueprint';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: AppPreferences;
  demoLoaded: boolean;
  onUpdatePreferences: (updates: Partial<AppPreferences>) => void;
  onExportBackup: () => void;
  onImportBackup: (jsonText: string) => { ok: boolean; error?: string };
  onLoadDemoData: () => void;
  onClearDemoData: () => void;
  onResetAllData: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  preferences,
  demoLoaded,
  onUpdatePreferences,
  onExportBackup,
  onImportBackup,
  onLoadDemoData,
  onClearDemoData,
  onResetAllData,
}: SettingsModalProps) {
  const [draftName, setDraftName] = useState(preferences.userName);
  const [draftCity, setDraftCity] = useState(preferences.city);
  const [confirmReset, setConfirmReset] = useState(false);
  const [backupMessage, setBackupMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDraftName(preferences.userName);
      setDraftCity(preferences.city);
      setConfirmReset(false);
      setBackupMessage(null);
    }
  }, [isOpen, preferences.userName, preferences.city]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdatePreferences({
      userName: draftName.trim().slice(0, 80),
      city: draftCity.trim().slice(0, 80) || 'Bangalore',
    });
    setBackupMessage({ type: 'success', text: 'Preferences saved locally.' });
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const result = onImportBackup(text);
      if (result.ok) {
        setBackupMessage({
          type: 'success',
          text: 'Backup restored successfully.',
        });
      } else {
        setBackupMessage({
          type: 'error',
          text: result.error || 'Could not import that backup file.',
        });
      }
    } catch {
      setBackupMessage({
        type: 'error',
        text: 'Unable to read the selected file.',
      });
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#1F1D1A]/45 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-[#FAF7F2] border border-[#E6DFD5] p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-[#E6DFD5]">
          <h2 id="settings-title" className="font-serif text-xl font-medium text-[#1F1D1A]">
            Privacy, Preferences &amp; Data
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preferences and privacy settings"
            className="flex h-11 w-11 items-center justify-center rounded-full text-[#5C574F] hover:bg-[#F3EEE6] hover:text-[#1F1D1A] transition-colors"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {backupMessage && (
          <div
            role={backupMessage.type === 'error' ? 'alert' : 'status'}
            className={`rounded-xl px-4 py-3 text-xs font-medium flex items-center gap-2 ${
              backupMessage.type === 'success'
                ? 'bg-[#5E7461]/12 text-[#485B4B]'
                : 'bg-[#C85A3F]/10 text-[#AE4830]'
            }`}
          >
            {backupMessage.type === 'success' && <Check className="h-4 w-4 shrink-0" />}
            <span>{backupMessage.text}</span>
          </div>
        )}

        {/* Profile Preferences */}
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="pref-name" className="block text-xs font-semibold text-[#1F1D1A] mb-1.5">
                First Name (Optional)
              </label>
              <input
                id="pref-name"
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="e.g. Ananya"
                className="w-full min-h-[44px] rounded-xl border border-[#E6DFD5] bg-white px-3.5 py-2 text-sm text-[#1F1D1A] placeholder:text-[#8A8378] focus:border-[#C85A3F] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="pref-city" className="block text-xs font-semibold text-[#1F1D1A] mb-1.5">
                Your City (Optional)
              </label>
              <input
                id="pref-city"
                list="twotable-cities"
                type="text"
                value={draftCity}
                onChange={(e) => setDraftCity(e.target.value)}
                placeholder="Bangalore"
                className="w-full min-h-[44px] rounded-xl border border-[#E6DFD5] bg-white px-3.5 py-2 text-sm text-[#1F1D1A] placeholder:text-[#8A8378] focus:border-[#C85A3F] focus:outline-none"
              />
              <datalist id="twotable-cities">
                {MAJOR_CITIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <button
            type="submit"
            className="w-full min-h-[44px] rounded-xl bg-[#1F1D1A] px-4 py-2 text-xs font-semibold text-[#FAF7F2] hover:bg-[#35322D] transition-colors"
          >
            Save Preferences
          </button>
        </form>

        {/* Transparent AI & Privacy Controls */}
        <section className="pt-5 border-t border-[#E6DFD5] space-y-3">
          <h3 className="text-xs font-semibold text-[#1F1D1A]">AI Processing &amp; Consent</h3>

          <label className="flex items-start gap-3 rounded-xl border border-[#E6DFD5] bg-white p-3.5 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.aiEnabled}
              onChange={(e) => onUpdatePreferences({ aiEnabled: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded accent-[#5E7461]"
            />
            <span className="text-xs leading-relaxed text-[#1F1D1A]">
              <strong>Interactive AI Prompts (Watch &amp; Talk and Go Deeper)</strong>
              <span className="block text-[#5C574F] mt-0.5">
                When enabled and triggered, sends only the movie/show title or current card text and
                stage to Gemini. Turn off to use built-in offline prompts only.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-[#E6DFD5] bg-white p-3.5 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.allowBlueprintAi}
              onChange={(e) =>
                onUpdatePreferences({
                  allowBlueprintAi: e.target.checked,
                  ...(!e.target.checked ? { includePrivateNotesInAi: false } : {}),
                })
              }
              className="mt-0.5 h-4 w-4 rounded accent-[#5E7461]"
            />
            <span className="text-xs leading-relaxed text-[#1F1D1A]">
              <strong>Blueprint AI Synthesis (Opt-In)</strong>
              <span className="block text-[#5C574F] mt-0.5">
                Only when you click Synthesize in My Blueprint, sends anonymized spectrum values,
                bookmarked theme counts, and reflection mood/tag counts to Gemini. Connection names
                are always stripped.
              </span>
            </span>
          </label>

          <label
            className={`flex items-start gap-3 rounded-xl border border-[#E6DFD5] bg-white p-3.5 ${
              preferences.allowBlueprintAi ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'
            }`}
          >
            <input
              type="checkbox"
              disabled={!preferences.allowBlueprintAi}
              checked={preferences.includePrivateNotesInAi}
              onChange={(e) => onUpdatePreferences({ includePrivateNotesInAi: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded accent-[#5E7461]"
            />
            <span className="text-xs leading-relaxed text-[#1F1D1A]">
              <strong>Include Short Private Note Excerpts in Blueprint AI (Off by Default)</strong>
              <span className="block text-[#5C574F] mt-0.5">
                Keep off to ensure your free-text Morning-After Mirror notes never leave this
                device.
              </span>
            </span>
          </label>
        </section>

        {/* Local Data Backup, Example Data & Reset */}
        <section className="pt-5 border-t border-[#E6DFD5] space-y-3">
          <h3 className="text-xs font-semibold text-[#1F1D1A]">
            Local Backup, Example Data &amp; Deletion
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                onExportBackup();
                setBackupMessage({
                  type: 'success',
                  text: 'Unencrypted JSON backup downloaded. Store it securely.',
                });
              }}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#E6DFD5] bg-white px-3.5 py-2 text-xs font-semibold text-[#1F1D1A] hover:bg-[#F3EEE6] transition-colors"
            >
              <Download className="h-4 w-4 text-[#5E7461]" aria-hidden="true" />
              <span>Export JSON Backup</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#E6DFD5] bg-white px-3.5 py-2 text-xs font-semibold text-[#1F1D1A] hover:bg-[#F3EEE6] transition-colors"
            >
              <Upload className="h-4 w-4 text-[#5E7461]" aria-hidden="true" />
              <span>Import JSON Backup</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFileImport}
              aria-label="Import TwoTable JSON backup file"
              className="hidden"
            />
          </div>

          <p className="text-[11px] leading-relaxed text-[#5C574F]">
            Warning: Exported JSON backups are unencrypted and contain your personal reflections and
            connection history. Keep exported files private.
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => {
                onLoadDemoData();
                setBackupMessage({
                  type: 'success',
                  text: 'Loaded 3 example connections, 3 sessions, and 3 reflections.',
                });
              }}
              className="flex flex-1 min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#E6DFD5] bg-white px-3.5 py-2 text-xs font-medium text-[#1F1D1A] hover:bg-[#F3EEE6] transition-colors"
            >
              <Database className="h-4 w-4 text-[#5E7461]" aria-hidden="true" />
              <span>{demoLoaded ? 'Refresh Example Data' : 'Load Example Data'}</span>
            </button>

            {demoLoaded && (
              <button
                type="button"
                onClick={() => {
                  onClearDemoData();
                  setBackupMessage({
                    type: 'success',
                    text: 'Removed example records while keeping your real data.',
                  });
                }}
                className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#E6DFD5] bg-white px-3.5 py-2 text-xs font-medium text-[#5C574F] hover:text-[#1F1D1A] hover:bg-[#F3EEE6] transition-colors"
              >
                <span>Clear Examples Only</span>
              </button>
            )}
          </div>

          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#E6DFD5] bg-white px-4 py-2 text-xs font-semibold text-[#C85A3F] hover:bg-[#C85A3F]/5 transition-colors"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span>Delete All Local Data</span>
            </button>
          ) : (
            <div className="rounded-xl border border-[#C85A3F]/40 bg-[#C85A3F]/5 p-3.5 space-y-2.5">
              <p className="text-xs leading-relaxed text-[#1F1D1A]">
                This permanently erases all connections, sessions, scenario choices, and reflections
                saved in this browser. Deleting local data does not retroactively erase requests
                previously sent to Gemini.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onResetAllData();
                    setConfirmReset(false);
                    onClose();
                  }}
                  className="flex-1 min-h-[40px] rounded-lg bg-[#C85A3F] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#AE4830]"
                >
                  Confirm Delete Local Data
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="flex-1 min-h-[40px] rounded-lg border border-[#E6DFD5] bg-white px-3 py-1.5 text-xs font-medium text-[#1F1D1A]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Honest Privacy, Shared-Device & Safety Disclosures */}
        <section className="pt-4 border-t border-[#E6DFD5] space-y-2.5 text-[11px] leading-relaxed text-[#5C574F]">
          <div className="flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#5E7461] mt-0.5" aria-hidden="true" />
            <p>
              <strong>Local Storage Notice:</strong> Your data is stored locally in this browser’s{' '}
              <code>localStorage</code> and is not encrypted. Anyone with access to this device or
              browser profile could view it—avoid storing sensitive notes on shared devices.
            </p>
          </div>
          <p>
            <strong>What TwoTable Does Not Do:</strong> TwoTable never scores or profiles the other
            person, does not predict romantic compatibility, and is not a licensed therapy or mental
            health service.
          </p>
          <p>
            <strong>Safety &amp; Boundaries:</strong> Always move at your own pace. Never feel
            pressured to disclose sensitive personal information, reconcile, or stay in a
            conversation that feels uncomfortable or disrespectful.
          </p>
        </section>
      </div>
    </div>
  );
}

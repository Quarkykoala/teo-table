import { SlidersHorizontal } from 'lucide-react';
import { ActiveTab } from '../types';

interface TopBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenSettings: () => void;
}

export function TopBar({ activeTab, onSelectTab, onOpenSettings }: TopBarProps) {
  const navItems: { id: ActiveTab; label: string }[] = [
    { id: 'play', label: 'Play' },
    { id: 'reflections', label: 'Reflections' },
    { id: 'blueprint', label: 'My Blueprint' },
  ];

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-[#E6DFD5] bg-[#FAF7F2]/95 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-5xl items-center justify-between gap-8 px-4 sm:px-6">
        <button
          type="button"
          onClick={() => onSelectTab('play')}
          className="font-serif text-xl font-medium tracking-tight text-[#1F1D1A] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C85A3F]"
        >
          TwoTable
        </button>

        <nav
          aria-label="Primary"
          className="hidden md:flex items-center gap-8 text-sm font-medium"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-1 whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C85A3F] ${
                  isActive
                    ? 'text-[#1F1D1A] font-semibold'
                    : 'text-[#5C574F] hover:text-[#1F1D1A]'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[17px] h-0.5 bg-[#C85A3F]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Privacy, Preferences and Data"
          className="flex min-h-[44px] items-center gap-2 px-3 text-sm font-medium text-[#5C574F] hover:text-[#1F1D1A] transition-colors whitespace-nowrap shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C85A3F]"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Privacy &amp; Data</span>
        </button>
      </div>
    </header>
  );
}

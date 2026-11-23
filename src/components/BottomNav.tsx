import { BookOpen, Compass, Layers } from 'lucide-react';
import { ActiveTab } from '../types';

interface BottomNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
}

export function BottomNav({ activeTab, onSelectTab }: BottomNavProps) {
  const tabs: { id: ActiveTab; label: string; Icon: typeof Layers }[] = [
    { id: 'play', label: 'Play', Icon: Layers },
    { id: 'reflections', label: 'Reflections', Icon: BookOpen },
    { id: 'blueprint', label: 'My Blueprint', Icon: Compass },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[#E6DFD5] bg-[#FAF7F2]/95 backdrop-blur-md"
    >
      <div className="grid grid-cols-3 h-16">
        {tabs.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectTab(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-[44px] flex-col items-center justify-center gap-1 transition-colors focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#C85A3F] ${
                isActive ? 'text-[#C85A3F]' : 'text-[#5C574F] hover:text-[#1F1D1A]'
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2.2 : 1.75} aria-hidden="true" />
              <span className="text-[11px] font-medium tracking-tight whitespace-nowrap">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

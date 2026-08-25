import type { KeyboardEvent } from 'react';

interface CategoryTabsProps {
  activeWave: 1 | 2 | 3;
  onWaveChange: (wave: 1 | 2 | 3) => void;
}

const waves = [
  { id: 1 as const, title: 'Koor & Musik', desc: 'Paduan Suara, Organis, Pemazmur' },
  { id: 2 as const, title: 'Lektor & Misdinar', desc: 'Lektor, Misdinar, Prodiakon' },
  { id: 3 as const, title: 'Tatib & Altar', desc: 'Tatib, Hias Altar' },
];

export default function CategoryTabs({ activeWave, onWaveChange }: CategoryTabsProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIndex = (index + 1) % waves.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIndex = (index - 1 + waves.length) % waves.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = waves.length - 1;
    }
    
    if (nextIndex !== index) {
      onWaveChange(waves[nextIndex].id);
    }
  };

  return (
    <div 
      className="flex lg:flex-col overflow-x-auto lg:overflow-visible gap-2 pb-2 lg:pb-0 hide-scrollbar"
      role="tablist"
      aria-label="Kategori Jadwal"
    >
      {waves.map((wave, index) => {
        const isActive = activeWave === wave.id;
        return (
          <button
            key={wave.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onWaveChange(wave.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`flex flex-col text-left px-4 py-3 min-h-[44px] min-w-[200px] lg:min-w-0 whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 cursor-pointer ${
              isActive 
                ? 'bg-accent text-ink rounded-xl font-bold' 
                : 'text-ink-soft hover:bg-surface-muted rounded-xl hover:text-ink'
            }`}
          >
            <span className="font-display text-lg">{wave.title}</span>
            <span className="text-xs opacity-80">{wave.desc}</span>
          </button>
        );
      })}
    </div>
  );
}

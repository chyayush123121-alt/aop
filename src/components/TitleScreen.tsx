import React from 'react';
import { CHARACTER_PRESETS } from '../game/simulation';
import type { SaveGameData } from '../game/types';

interface TitleScreenProps {
  selectedCharacterId: string;
  onSelectCharacter: (id: string) => void;
  onStartNew: () => void;
  savedGame: SaveGameData | null;
  onContinueSave: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  selectedCharacterId,
  onSelectCharacter,
  onStartNew,
  savedGame,
  onContinueSave,
}) => {
  return (
    <div
      className="fixed inset-0 z-20 flex flex-col justify-between p-6 md:p-10 select-none pointer-events-none"
      style={{
        background:
          'linear-gradient(90deg, rgba(10,14,23,0.82) 0%, rgba(10,14,23,0.45) 48%, rgba(10,14,23,0.08) 100%)',
      }}
    >
      {/* Left/Upper Title Emblem & Character Selection over negative space */}
      <div className="max-w-lg pointer-events-auto mt-2 md:mt-6">
        {/* Bespoke Inline SVG Title Lockup */}
        <svg
          viewBox="0 0 460 128"
          className="w-full max-w-[420px] h-auto mb-5 drop-shadow-[0_4px_18px_rgba(0,0,0,0.75)]"
          aria-label="Indian City King Open World"
        >
          <path
            d="M8 14 L34 14 L26 24 L42 24 L30 34 L12 34 Z"
            fill="#f59e0b"
            stroke="#0f172a"
            strokeWidth="2"
          />
          <rect x="52" y="18" width="160" height="4" fill="#f97316" rx="2" />
          <text
            x="8"
            y="68"
            fill="#f8fafc"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontWeight="900"
            fontSize="44"
            letterSpacing="2"
            stroke="#0f172a"
            strokeWidth="5"
            paintOrder="stroke fill"
          >
            INDIAN CITY
          </text>
          <text
            x="10"
            y="112"
            fill="#f59e0b"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontWeight="900"
            fontSize="46"
            letterSpacing="4"
            stroke="#0f172a"
            strokeWidth="5"
            paintOrder="stroke fill"
          >
            KING
          </text>
          <text
            x="162"
            y="108"
            fill="#cbd5e1"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontWeight="700"
            fontSize="15"
            letterSpacing="3"
          >
            OPEN WORLD
          </text>
        </svg>

        {/* Playable Character Preset Selection */}
        <div className="mb-5">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-400 mb-2">
            Select Protagonist
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {CHARACTER_PRESETS.map((char) => {
              const active = char.id === selectedCharacterId;
              return (
                <button
                  key={char.id}
                  type="button"
                  onClick={() => onSelectCharacter(char.id)}
                  className="text-left p-2.5 rounded border transition-colors cursor-pointer"
                  style={{
                    backgroundColor: active ? 'rgba(245, 158, 11, 0.2)' : 'rgba(15, 23, 42, 0.85)',
                    borderColor: active ? '#f59e0b' : 'rgba(148, 163, 184, 0.28)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="inline-block w-3 h-3 rounded-sm border border-black/40"
                      style={{ backgroundColor: char.shirtColor }}
                    />
                    <span className="text-xs font-bold text-slate-100 truncate">{char.name}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">{char.title}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Primary Menu CTAs (<= 3 actions) */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-start="true"
            onClick={onStartNew}
            className="px-7 py-3.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg cursor-pointer transition-colors"
          >
            Enter Open World
          </button>
          {savedGame && (
            <button
              type="button"
              onClick={onContinueSave}
              className="px-5 py-3.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-100 border border-slate-600 font-bold text-sm uppercase tracking-wider cursor-pointer transition-colors"
            >
              Continue (₹{savedGame.cash})
            </button>
          )}
        </div>
      </div>

      {/* Single Flat Control Hint Line in Bottom Safe Margin */}
      <div className="text-xs font-medium tracking-wide text-slate-300/90">
        WASD Move &amp; Drive · Space Jump / Brake · F Enter Vehicle · Click / J Attack · Tab Missions · G Garage · Esc Pause
      </div>
    </div>
  );
};

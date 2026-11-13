import React, { useState } from 'react';
import { MISSION_LIST, OUTFIT_OPTIONS, VEHICLE_SPECS } from '../game/simulation';
import type { GameSettings, HudSnapshot, VehicleType } from '../game/types';

interface CityPhoneModalProps {
  initialTab: 'missions' | 'garage' | 'wardrobe';
  hud: HudSnapshot;
  onClose: () => void;
  onStartMission: (id: string) => void;
  onSpawnVehicle: (type: VehicleType, color: string) => void;
  onSelectOutfit: (id: string) => void;
}

const PAINT_SWATCHES = ['#e63946', '#f59e0b', '#0ea5e9', '#10b981', '#7c3aed', '#f8fafc', '#18181b'];

export const CityPhoneModal: React.FC<CityPhoneModalProps> = ({
  initialTab,
  hud,
  onClose,
  onStartMission,
  onSpawnVehicle,
  onSelectOutfit,
}) => {
  const [tab, setTab] = useState<'missions' | 'garage' | 'wardrobe'>(initialTab);
  const [selectedColor, setSelectedColor] = useState('#e63946');

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(6, 10, 18, 0.72)' }}
      role="dialog"
      aria-label="City King Hub"
    >
      <div
        className="w-full max-w-3xl max-h-[86vh] flex flex-col rounded-lg border border-amber-500/50 text-slate-100 shadow-2xl overflow-hidden"
        style={{ backgroundColor: '#0f172a' }}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            {(
              [
                { id: 'missions', label: 'Missions (8)' },
                { id: 'garage', label: 'Garage & Vehicles (10)' },
                { id: 'wardrobe', label: 'Style & Outfits' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className="px-3.5 py-1.5 rounded text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors"
                style={{
                  backgroundColor: tab === t.id ? '#f59e0b' : '#1e293b',
                  color: tab === t.id ? '#0f172a' : '#cbd5e1',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-black text-emerald-400 tabular-nums">₹{hud.cash}</span>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold cursor-pointer"
            >
              Close [Esc]
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto space-y-3">
          {tab === 'missions' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {MISSION_LIST.map((m) => {
                const done = hud.completedMissionIds.includes(m.id);
                const active = hud.activeMission?.def.id === m.id;
                return (
                  <div
                    key={m.id}
                    className="p-3.5 rounded border flex flex-col justify-between gap-2"
                    style={{
                      backgroundColor: '#1e293b',
                      borderColor: active ? '#f59e0b' : done ? '#10b981' : '#334155',
                    }}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                          {m.type.replace('_', ' ')}
                        </span>
                        <span className="text-xs font-black text-emerald-400 tabular-nums">
                          +₹{m.rewardCash}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white">{m.title}</h3>
                      <p className="text-xs text-slate-300 mt-1">{m.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onStartMission(m.id);
                        onClose();
                      }}
                      className="mt-1 w-full py-2 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider cursor-pointer"
                    >
                      {active ? 'Restart Mission' : done ? 'Replay Mission' : 'Start Mission'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'garage' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2 p-3 rounded bg-slate-800/80 border border-slate-700">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Custom Paint Finish
                </span>
                <div className="flex items-center gap-2">
                  {PAINT_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      aria-label={`Select paint ${hex}`}
                      onClick={() => setSelectedColor(hex)}
                      className="w-6 h-6 rounded-full border-2 cursor-pointer"
                      style={{
                        backgroundColor: hex,
                        borderColor: selectedColor === hex ? '#facc15' : '#475569',
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(Object.keys(VEHICLE_SPECS) as VehicleType[]).map((vKey) => {
                  const spec = VEHICLE_SPECS[vKey];
                  return (
                    <div
                      key={vKey}
                      className="p-3 rounded bg-slate-800/70 border border-slate-700 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-[10px] font-bold uppercase text-sky-400">
                          {spec.category}
                        </div>
                        <div className="text-sm font-bold text-white">{spec.label}</div>
                        <div className="text-[11px] text-slate-400 tabular-nums">
                          Top {Math.round(spec.topSpeed * 3.6)} km/h · Hull {spec.maxHp}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onSpawnVehicle(vKey, selectedColor);
                          onClose();
                        }}
                        className="px-3 py-2 rounded bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs uppercase cursor-pointer"
                      >
                        Deliver
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'wardrobe' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {OUTFIT_OPTIONS.map((o) => (
                <div
                  key={o.id}
                  className="p-3.5 rounded bg-slate-800/80 border border-slate-700 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded border border-slate-500"
                      style={{ backgroundColor: o.shirtColor }}
                    />
                    <div>
                      <div className="text-sm font-bold text-white">{o.name}</div>
                      <div className="text-xs text-amber-400 tabular-nums">
                        {o.price === 0 ? 'Owned' : `₹${o.price}`}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectOutfit(o.id)}
                    className="px-3.5 py-2 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase cursor-pointer"
                  >
                    Equip
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface PauseModalProps {
  settings: GameSettings;
  onUpdateSettings: (partial: Partial<GameSettings>) => void;
  onResume: () => void;
  onSaveGame: () => void;
  onLoadGame: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
  saveStatus: string | null;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  settings,
  onUpdateSettings,
  onResume,
  onSaveGame,
  onLoadGame,
  onRestart,
  onReturnTitle,
  saveStatus,
}) => {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(6, 10, 18, 0.78)' }}
      role="dialog"
      aria-label="Game Paused"
    >
      <div
        className="w-full max-w-md rounded-lg border border-amber-500/50 p-6 text-slate-100 shadow-2xl space-y-4"
        style={{ backgroundColor: '#0f172a' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black uppercase tracking-wider text-amber-400">Paused</h2>
          {saveStatus && <span className="text-xs font-bold text-emerald-400">{saveStatus}</span>}
        </div>

        {/* Graphics Quality */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Graphics Quality
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['low', 'medium', 'high'] as const).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onUpdateSettings({ graphics: q })}
                className="py-1.5 rounded text-xs font-bold uppercase cursor-pointer border"
                style={{
                  backgroundColor: settings.graphics === q ? '#f59e0b' : '#1e293b',
                  color: settings.graphics === q ? '#0f172a' : '#cbd5e1',
                  borderColor: settings.graphics === q ? '#f59e0b' : '#334155',
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Weather Presets */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Weather
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['clear', 'rain', 'storm'] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => onUpdateSettings({ weather: w })}
                className="py-1.5 rounded text-xs font-bold uppercase cursor-pointer border"
                style={{
                  backgroundColor: settings.weather === w ? '#38bdf8' : '#1e293b',
                  color: settings.weather === w ? '#0f172a' : '#cbd5e1',
                  borderColor: settings.weather === w ? '#38bdf8' : '#334155',
                }}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        {/* Time of Day Slider & Touch Toggle */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <span>Time of Day ({Math.floor(settings.timeOfDayHours)}:00)</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoCycleTime}
                onChange={(e) => onUpdateSettings({ autoCycleTime: e.target.checked })}
              />
              <span>Auto Cycle</span>
            </label>
          </div>
          <input
            type="range"
            min={0}
            max={23.5}
            step={0.5}
            value={settings.timeOfDayHours}
            onChange={(e) => onUpdateSettings({ timeOfDayHours: Number(e.target.value) })}
            className="w-full accent-amber-400"
          />

          <label className="flex items-center justify-between text-xs font-bold text-slate-200 pt-1 cursor-pointer">
            <span>Android On-Screen Touch Controls</span>
            <input
              type="checkbox"
              checked={settings.touchControls}
              onChange={(e) => onUpdateSettings({ touchControls: e.target.checked })}
            />
          </label>
        </div>

        {/* Save / Load & Primary Actions */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={onSaveGame}
            className="py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold uppercase cursor-pointer"
          >
            Save Game
          </button>
          <button
            type="button"
            onClick={onLoadGame}
            className="py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold uppercase cursor-pointer"
          >
            Load Save
          </button>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-2.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider cursor-pointer"
          >
            Resume Game
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onRestart}
              className="py-2 rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold uppercase cursor-pointer"
            >
              Restart
            </button>
            <button
              type="button"
              onClick={onReturnTitle}
              className="py-2 rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold uppercase cursor-pointer"
            >
              Title Screen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface GameOverModalProps {
  reason: 'wasted' | 'busted' | 'victory';
  hud: HudSnapshot;
  onRespawn: () => void;
  onReturnTitle: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  reason,
  hud,
  onRespawn,
  onReturnTitle,
}) => {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(6, 10, 18, 0.82)' }}
      role="dialog"
      aria-label="Game Over"
    >
      <div
        className="w-full max-w-md rounded-lg border border-red-500/60 p-6 text-slate-100 shadow-2xl text-center space-y-5"
        style={{ backgroundColor: '#0f172a' }}
      >
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-red-400">
            {reason === 'busted' ? 'Arrested by Police' : 'Down in Action'}
          </div>
          <h2 className="text-4xl font-black uppercase tracking-wider text-white mt-1">
            {reason === 'busted' ? 'BUSTED' : 'WASTED'}
          </h2>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="p-2.5 rounded bg-slate-800/80 border border-slate-700">
            <div className="text-[10px] uppercase text-slate-400">Cash</div>
            <div className="text-base font-black text-emerald-400 tabular-nums">₹{hud.cash}</div>
          </div>
          <div className="p-2.5 rounded bg-slate-800/80 border border-slate-700">
            <div className="text-[10px] uppercase text-slate-400">Missions</div>
            <div className="text-base font-black text-amber-400 tabular-nums">
              {hud.missionsDone}/8
            </div>
          </div>
          <div className="p-2.5 rounded bg-slate-800/80 border border-slate-700">
            <div className="text-[10px] uppercase text-slate-400">KOs</div>
            <div className="text-base font-black text-sky-400 tabular-nums">{hud.kills}</div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            data-start="true"
            onClick={onRespawn}
            className="w-full py-3 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider cursor-pointer"
          >
            Respawn at Apollo Hospital
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="w-full py-2 rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold uppercase cursor-pointer"
          >
            Return to Title
          </button>
        </div>
      </div>
    </div>
  );
};

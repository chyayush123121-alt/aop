import React, { useEffect, useRef } from 'react';
import type { OpenWorldEngine } from '../game/engine';
import type { HudSnapshot, WeaponId } from '../game/types';

interface GameHudProps {
  hud: HudSnapshot;
  engineRef: React.RefObject<OpenWorldEngine | null>;
  touchControls: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onOpenModal: (modal: 'missions' | 'garage' | 'wardrobe') => void;
  onSelectWeapon: (w: WeaponId) => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  engineRef,
  touchControls,
  muted,
  onToggleMute,
  onPause,
  onOpenModal,
  onSelectWeapon,
}) => {
  const minimapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const ghostHpRef = useRef(hud.hp);
  const joyStickRef = useRef<HTMLDivElement | null>(null);
  const joyKnobRef = useRef<HTMLDivElement | null>(null);
  const camDragRef = useRef<{ active: boolean; lastX: number; lastY: number }>({
    active: false,
    lastX: 0,
    lastY: 0,
  });

  // Trailing damage ghost decay
  if (ghostHpRef.current > hud.hp) {
    ghostHpRef.current = Math.max(hud.hp, ghostHpRef.current - 2.5);
  } else {
    ghostHpRef.current = hud.hp;
  }

  // Redraw canvas minimap cleanly whenever HUD ticks
  useEffect(() => {
    const canvas = minimapCanvasRef.current;
    const eng = engineRef.current;
    if (!canvas || !eng) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      eng.drawMinimap(ctx, canvas.width);
    }
  }, [hud, engineRef]);

  const hpPct = Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100));
  const ghostPct = Math.max(0, Math.min(100, (ghostHpRef.current / hud.maxHp) * 100));
  const armorPct = Math.max(0, Math.min(100, (hud.armor / hud.maxArmor) * 100));

  const formatTime = (hours: number) => {
    const h = Math.floor(hours) % 24;
    const m = Math.floor((hours - Math.floor(hours)) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  // Virtual Joystick Handlers
  const handleJoystickMove = (clientX: number, clientY: number) => {
    const el = joyStickRef.current;
    const eng = engineRef.current;
    if (!el || !eng) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.4;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    if (joyKnobRef.current) {
      joyKnobRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
    }
    eng.setTouchControlsInput({ moveX: dx / maxR, moveY: -dy / maxR });
  };

  const resetJoystick = () => {
    if (joyKnobRef.current) {
      joyKnobRef.current.style.transform = 'translate(0px, 0px)';
    }
    engineRef.current?.setTouchControlsInput({ moveX: 0, moveY: 0 });
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none overflow-hidden">
      {/* Critical Low HP Peripheral Vignette */}
      {hud.hp <= 28 && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 90px rgba(220, 38, 38, 0.55)',
          }}
        />
      )}

      {/* TOP-LEFT CLUSTER: Vitality, Armor, Wanted Stars, Cash, District */}
      <div className="fixed top-3 left-3 flex flex-col gap-1.5">
        <div
          className="px-3 py-2 rounded border border-slate-700/80 min-w-[250px]"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.82)' }}
        >
          {/* Cash & Respect Hero Readout */}
          <div className="flex items-baseline justify-between gap-4 mb-1.5">
            <div className="text-xl font-black text-emerald-400 tabular-nums leading-none">
              ₹{hud.cash}
            </div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 tabular-nums">
              REP {hud.respect}
            </div>
          </div>

          {/* Health Bar with Trailing Damage Ghost */}
          <div className="relative h-2.5 bg-slate-800 rounded-sm overflow-hidden mb-1">
            <div
              className="absolute inset-y-0 left-0 bg-amber-300/70 transition-all duration-150"
              style={{ width: `${ghostPct}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-emerald-500 transition-all duration-75"
              style={{ width: `${hpPct}%` }}
            />
          </div>

          {/* Armor Bar */}
          <div className="relative h-1.5 bg-slate-800 rounded-sm overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-sky-400 transition-all duration-75"
              style={{ width: `${armorPct}%` }}
            />
          </div>

          <div className="mt-1.5 flex items-center justify-between gap-4 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
            <span className="truncate">{hud.districtName}</span>
            <span className="tabular-nums shrink-0">
              {formatTime(hud.timeOfDayHours)} · {hud.weather}
            </span>
          </div>
        </div>

        {/* Wanted Stars */}
        {hud.wantedStars > 0 && (
          <div
            className="flex items-center gap-1 px-2.5 py-1 rounded border border-red-500/60 w-fit"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.85)' }}
            aria-label={`Wanted level ${hud.wantedStars} stars`}
          >
            {[1, 2, 3, 4, 5].map((star) => (
              <svg key={star} viewBox="0 0 24 24" className="w-4 h-4">
                <path
                  d="M12 2l2.9 6.2 6.8.9-5 4.8 1.2 6.8-5.9-3.2-5.9 3.2 1.2-6.8-5-4.8 6.8-.9z"
                  fill={star <= hud.wantedStars ? '#facc15' : '#334155'}
                  stroke="#0f172a"
                  strokeWidth="1.5"
                />
              </svg>
            ))}
            <span className="ml-1 text-[10px] font-bold uppercase text-red-400">Wanted</span>
          </div>
        )}
      </div>

      {/* TOP-RIGHT CLUSTER: Utility Buttons & Active Mission Tracker */}
      <div className="fixed top-3 right-3 flex flex-col items-end gap-2">
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenModal('missions');
            }}
            aria-label="Open Mission Board"
            className="h-9 px-2.5 rounded border border-slate-700 text-xs font-bold text-amber-300 hover:bg-slate-800 cursor-pointer flex items-center gap-1.5"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.85)' }}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
              <path d="M4 3h16v18l-8-4-8 4V3z" />
            </svg>
            <span>Missions [Tab]</span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenModal('garage');
            }}
            aria-label="Open Garage and Style"
            className="h-9 px-2.5 rounded border border-slate-700 text-xs font-bold text-sky-300 hover:bg-slate-800 cursor-pointer flex items-center gap-1.5"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.85)' }}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
              <path d="M5 11l1.5-4.5h11L19 11m-1.5 5a1.5 1.5 0 01-1.5-1.5 1.5 1.5 0 011.5-1.5 1.5 1.5 0 011.5 1.5 1.5 1.5 0 01-1.5 1.5m-11 0A1.5 1.5 0 015 14.5 1.5 1.5 0 016.5 13 1.5 1.5 0 018 14.5 1.5 1.5 0 016.5 16M18.9 6c-.2-.6-.8-1-1.4-1h-11c-.7 0-1.2.4-1.4 1L3 12v8c0 .5.4 1 1 1h1c.6 0 1-.5 1-1v-1h12v1c0 .5.4 1 1 1h1c.6 0 1-.5 1-1v-8l-2.1-6z" />
            </svg>
            <span>Garage [G]</span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
            className="w-9 h-9 rounded border border-slate-700 text-slate-200 hover:bg-slate-800 cursor-pointer flex items-center justify-center"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.85)' }}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
              {muted ? (
                <path d="M16.5 12c0-1.8-1-3.3-2.5-4v2.2l2.4 2.4c.1-.2.1-.4.1-.6zm2.5 0c0 .9-.2 1.8-.5 2.6l1.5 1.5c.7-1.2 1-2.6 1-4.1 0-4.3-3-7.9-7-8.8v2.1c2.9.9 5 3.5 5 6.7zM4.3 3L3 4.3 7.7 9H3v6h4l5 5v-6.7l4.2 4.2c-.7.5-1.4.9-2.2 1.2v2.1c1.4-.3 2.6-1 3.7-1.8l2 2 1.3-1.3-9-9L4.3 3zM12 4L9.9 6.1 12 8.2V4z" />
              ) : (
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.8-1-3.3-2.5-4v8c1.5-.7 2.5-2.2 2.5-4zM14 3.2v2.1c2.9.9 5 3.5 5 6.7s-2.1 5.8-5 6.7v2.1c4-.9 7-4.5 7-8.8s-3-7.9-7-8.8z" />
              )}
            </svg>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            aria-label="Pause Game"
            className="w-9 h-9 rounded border border-slate-700 text-slate-200 hover:bg-slate-800 cursor-pointer flex items-center justify-center"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.85)' }}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          </button>
        </div>

        {/* Active Mission Objective Card */}
        {hud.activeMission && (
          <div
            className="px-3 py-2 rounded border border-amber-500/70 max-w-[260px] text-right"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.84)' }}
          >
            <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
              Active Objective
            </div>
            <div className="text-xs font-bold text-slate-100 mt-0.5">
              {hud.activeMission.objectiveText}
            </div>
            {hud.activeMission.timeRemaining > 0 && (
              <div className="text-sm font-black text-amber-300 tabular-nums mt-0.5">
                {Math.ceil(hud.activeMission.timeRemaining)}s
              </div>
            )}
          </div>
        )}
      </div>

      {/* TOAST / INTERACTION PROMPT */}
      {(hud.toastText || hud.nearbyVehicleLabel || hud.nearbyInteractLabel) && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5">
          {hud.toastText && (
            <div
              className="px-4 py-1.5 rounded border border-amber-400/60 text-xs font-bold text-amber-200 tracking-wide"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)' }}
            >
              {hud.toastText}
            </div>
          )}
          {(hud.nearbyVehicleLabel || hud.nearbyInteractLabel) && (
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                engineRef.current?.setTouchControlsInput({ interactJustPressed: true });
              }}
              className="pointer-events-auto px-4 py-1.5 rounded border border-sky-400/70 text-xs font-bold text-sky-100 hover:bg-slate-800 cursor-pointer"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)' }}
            >
              {hud.nearbyVehicleLabel
                ? `Press [F] to Drive ${hud.nearbyVehicleLabel}`
                : hud.nearbyInteractLabel}
            </button>
          )}
        </div>
      )}

      {/* BOTTOM-LEFT: Circular Minimap */}
      {!touchControls && (
        <div className="fixed bottom-3 left-3 flex items-end gap-2">
          <div
            className="relative rounded-full p-1 border-2 border-amber-500/70 shadow-lg"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)' }}
          >
            <canvas
              ref={minimapCanvasRef}
              width={132}
              height={132}
              className="rounded-full block"
              aria-label="City Mini-map"
            />
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 bg-slate-950 text-[9px] font-black text-amber-400 px-1.5 rounded border border-amber-500/50">
              N
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM-RIGHT: Speedometer (in vehicle) OR Weapon Slots (on foot) */}
      {!touchControls && (
        <div className="fixed bottom-3 right-3 pointer-events-auto">
          {hud.inVehicle ? (
            <div
              className="px-4 py-2.5 rounded border border-slate-700 flex items-center gap-4"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.86)' }}
            >
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {hud.vehicleLabel}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-amber-400 tabular-nums leading-none">
                    {hud.speedKmh}
                  </span>
                  <span className="text-xs font-bold text-slate-300">KM/H</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase text-slate-400">Hull</div>
                <div className="text-sm font-black text-emerald-400 tabular-nums">
                  {hud.vehicleHpPct}%
                </div>
                {hud.vehicleType === 'helicopter' && (
                  <div className="text-[10px] text-sky-300 tabular-nums">ALT {hud.altitude}m</div>
                )}
              </div>
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  engineRef.current?.setTouchControlsInput({ interactJustPressed: true });
                }}
                className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[11px] font-bold text-slate-100 cursor-pointer"
              >
                Exit [F]
              </button>
            </div>
          ) : (
            <div
              className="p-1.5 rounded border border-slate-700 flex items-center gap-1.5"
              style={{ backgroundColor: 'rgba(15, 23, 42, 0.85)' }}
            >
              {(
                [
                  { id: 'fists', key: '1', label: 'Fists' },
                  { id: 'bat', key: '2', label: 'Lathi' },
                  { id: 'blaster', key: '3', label: 'Blaster' },
                ] as const
              ).map((w) => {
                const active = hud.weapon === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onSelectWeapon(w.id);
                    }}
                    className="px-2.5 py-1.5 rounded border text-xs font-bold cursor-pointer transition-colors"
                    style={{
                      backgroundColor: active ? 'rgba(245, 158, 11, 0.22)' : 'rgba(30, 41, 59, 0.7)',
                      borderColor: active ? '#f59e0b' : 'rgba(100, 116, 139, 0.4)',
                      color: active ? '#fef3c7' : '#cbd5e1',
                    }}
                  >
                    <span className="text-[10px] text-amber-400 mr-1">[{w.key}]</span>
                    {w.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ANDROID LANDSCAPE TOUCH CONTROLS OVERLAY (Toggleable in Settings) */}
      {touchControls && (
        <>
          {/* Left Virtual Joystick */}
          <div
            ref={joyStickRef}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              handleJoystickMove(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (e.buttons > 0) handleJoystickMove(e.clientX, e.clientY);
            }}
            onPointerUp={resetJoystick}
            onPointerCancel={resetJoystick}
            className="fixed bottom-5 left-5 w-32 h-32 rounded-full border-2 border-slate-400/50 pointer-events-auto flex items-center justify-center touch-none"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.55)' }}
          >
            <div
              ref={joyKnobRef}
              className="w-12 h-12 rounded-full bg-amber-400/85 border-2 border-slate-900 shadow"
            />
          </div>

          {/* Right Camera Swipe Pad + Action Buttons */}
          <div
            onPointerDown={(e) => {
              camDragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
            }}
            onPointerMove={(e) => {
              if (!camDragRef.current.active) return;
              const dx = e.clientX - camDragRef.current.lastX;
              const dy = e.clientY - camDragRef.current.lastY;
              camDragRef.current.lastX = e.clientX;
              camDragRef.current.lastY = e.clientY;
              engineRef.current?.setTouchControlsInput({ lookDeltaX: dx, lookDeltaY: dy });
            }}
            onPointerUp={() => {
              camDragRef.current.active = false;
            }}
            className="fixed right-3 bottom-3 w-64 h-44 pointer-events-auto touch-none flex flex-col justify-end items-end gap-2"
          >
            <div className="flex gap-2">
              <button
                type="button"
                onPointerDown={() => engineRef.current?.setTouchControlsInput({ interactJustPressed: true })}
                className="w-12 h-12 rounded-full bg-sky-600/90 text-white text-[10px] font-black border border-sky-300 cursor-pointer"
              >
                {hud.inVehicle ? 'EXIT' : 'CAR'}
              </button>
              <button
                type="button"
                onPointerDown={() => engineRef.current?.setTouchControlsInput({ sprint: true })}
                onPointerUp={() => engineRef.current?.setTouchControlsInput({ sprint: false })}
                className="w-12 h-12 rounded-full bg-slate-800/90 text-white text-[10px] font-black border border-slate-400 cursor-pointer"
              >
                RUN
              </button>
              <button
                type="button"
                onPointerDown={() => engineRef.current?.setTouchControlsInput({ jumpJustPressed: true })}
                className="w-12 h-12 rounded-full bg-emerald-600/90 text-white text-[10px] font-black border border-emerald-300 cursor-pointer"
              >
                JUMP
              </button>
            </div>
            <div className="flex gap-2">
              {hud.inVehicle ? (
                <>
                  <button
                    type="button"
                    onPointerDown={() => engineRef.current?.setTouchControlsInput({ brakeHeld: true })}
                    onPointerUp={() => engineRef.current?.setTouchControlsInput({ brakeHeld: false })}
                    className="w-16 h-14 rounded-lg bg-red-600/90 text-white text-xs font-black border border-red-300 cursor-pointer"
                  >
                    BRAKE
                  </button>
                  <button
                    type="button"
                    onPointerDown={() => engineRef.current?.setTouchControlsInput({ moveY: 1 })}
                    onPointerUp={() => engineRef.current?.setTouchControlsInput({ moveY: 0 })}
                    className="w-16 h-14 rounded-lg bg-amber-500/95 text-slate-950 text-xs font-black border border-amber-200 cursor-pointer"
                  >
                    GAS
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onPointerDown={() => engineRef.current?.setTouchControlsInput({ attackJustPressed: true })}
                  className="w-16 h-16 rounded-full bg-red-600/90 text-white text-xs font-black border-2 border-amber-300 cursor-pointer"
                >
                  ATTACK
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { CityPhoneModal, GameOverModal, PauseModal } from './components/Modals';
import { TitleScreen } from './components/TitleScreen';
import { OpenWorldEngine } from './game/engine';
import { createDefaultSaveData, SAVE_STORAGE_KEY } from './game/simulation';
import type { GameSettings, GameStateMode, HudSnapshot, SaveGameData, VehicleType, WeaponId } from './game/types';

function readSavedGame(): SaveGameData | null {
  try {
    const raw = localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SaveGameData;
    return parsed && parsed.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

const INITIAL_HUD: HudSnapshot = {
  hp: 100,
  maxHp: 100,
  armor: 50,
  maxArmor: 100,
  cash: 1200,
  respect: 100,
  wantedStars: 0,
  wantedCooldown: 0,
  districtName: 'Nariman Downtown',
  districtId: 'downtown',
  weapon: 'fists',
  ammo: 60,
  inVehicle: false,
  vehicleLabel: '',
  vehicleType: null,
  vehicleHpPct: 100,
  speedKmh: 0,
  altitude: 0,
  isSwimming: false,
  nearbyVehicleLabel: null,
  nearbyInteractLabel: null,
  activeMission: null,
  completedMissionIds: [],
  timeOfDayHours: 16.5,
  weather: 'clear',
  toastText: null,
  gameOverReason: null,
  kills: 0,
  missionsDone: 0,
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<OpenWorldEngine | null>(null);

  const [mode, setMode] = useState<GameStateMode>('title');
  const [selectedCharacterId, setSelectedCharacterId] = useState('vikram');
  const [savedGame, setSavedGame] = useState<SaveGameData | null>(() => readSavedGame());
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [activeSubModal, setActiveSubModal] = useState<'missions' | 'garage' | 'wardrobe' | null>(null);
  const [settings, setSettings] = useState<GameSettings>({
    graphics: 'medium',
    weather: 'clear',
    timeOfDayHours: 16.5,
    autoCycleTime: true,
    touchControls: false,
    muted: false,
  });
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [gameOverReason, setGameOverReason] = useState<'wasted' | 'busted' | 'victory'>('wasted');

  const modeRef = useRef(mode);
  modeRef.current = mode;
  const subModalRef = useRef(activeSubModal);
  subModalRef.current = activeSubModal;

  useEffect(() => {
    document.body.dataset.state = mode;
  }, [mode]);

  // Mount Three.js OpenWorldEngine once in isolated sibling container
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const engine = new OpenWorldEngine(el, {
      onHudUpdate: (snap) => setHud(snap),
      onOpenModal: (modal) => {
        setActiveSubModal(modal);
        engine.setGameState('paused');
      },
      onGameOver: (reason, snap) => {
        setGameOverReason(reason);
        setHud(snap);
        setMode('gameover');
      },
    });
    engineRef.current = engine;

    // Support ?autostart=1 to jump straight into playing
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      engine.startNewOrContinue(null);
      setMode('playing');
    } else {
      engine.setGameState('title');
      setMode('title');
    }

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleStartNew = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.selectCharacter(selectedCharacterId);
    engineRef.current.startNewOrContinue(null);
    setMode('playing');
  }, [selectedCharacterId]);

  const handleContinueSave = useCallback(() => {
    if (!engineRef.current || !savedGame) return;
    engineRef.current.startNewOrContinue(savedGame);
    setMode('playing');
  }, [savedGame]);

  const handlePause = useCallback(() => {
    if (!engineRef.current) return;
    setActiveSubModal(null);
    engineRef.current.setGameState('paused');
    setMode('paused');
  }, []);

  const handleResume = useCallback(() => {
    if (!engineRef.current) return;
    setActiveSubModal(null);
    setSaveStatus(null);
    engineRef.current.setGameState('playing');
    setMode('playing');
  }, []);

  const handleOpenSubModal = useCallback((modal: 'missions' | 'garage' | 'wardrobe') => {
    if (!engineRef.current) return;
    setActiveSubModal(modal);
    engineRef.current.setGameState('paused');
  }, []);

  const handleCloseSubModal = useCallback(() => {
    if (!engineRef.current) return;
    setActiveSubModal(null);
    engineRef.current.setGameState('playing');
    setMode('playing');
  }, []);

  const handleUpdateSettings = useCallback((partial: Partial<GameSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      engineRef.current?.updateSettings(partial);
      return next;
    });
  }, []);

  const handleSaveGame = useCallback(() => {
    if (!engineRef.current) return;
    const snap = engineRef.current.getSaveSnapshot();
    try {
      localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(snap));
      setSavedGame(snap);
      setSaveStatus('Saved!');
    } catch {
      setSaveStatus('Save failed');
    }
  }, []);

  const handleLoadGame = useCallback(() => {
    const loaded = readSavedGame();
    if (!loaded || !engineRef.current) {
      setSaveStatus('No save found');
      return;
    }
    engineRef.current.startNewOrContinue(loaded);
    setMode('playing');
    setSaveStatus(null);
  }, []);

  // Global Keyboard Shortcuts (Enter/Space on Title, Esc/P Pause, Tab Missions, G Garage, M Mute)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (modeRef.current === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleStartNew();
        }
        return;
      }

      if (subModalRef.current) {
        if (e.code === 'Escape' || e.code === 'Tab') {
          e.preventDefault();
          handleCloseSubModal();
        }
        return;
      }

      if (modeRef.current === 'playing') {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          handlePause();
        } else if (e.code === 'Tab') {
          e.preventDefault();
          handleOpenSubModal('missions');
        } else if (e.code === 'KeyG') {
          e.preventDefault();
          handleOpenSubModal('garage');
        } else if (e.code === 'KeyM') {
          handleUpdateSettings({ muted: !settings.muted });
        }
      } else if (modeRef.current === 'paused') {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          handleResume();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleStartNew,
    handleCloseSubModal,
    handlePause,
    handleOpenSubModal,
    handleResume,
    handleUpdateSettings,
    settings.muted,
  ]);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950">
      {/* Isolated WebGL Mount Container */}
      <div
        ref={mountRef}
        data-testid="game-canvas-mount"
        className="absolute inset-0 w-full h-full"
      />

      {mode === 'title' && (
        <TitleScreen
          selectedCharacterId={selectedCharacterId}
          onSelectCharacter={(id) => {
            setSelectedCharacterId(id);
            engineRef.current?.selectCharacter(id);
          }}
          onStartNew={handleStartNew}
          savedGame={savedGame}
          onContinueSave={handleContinueSave}
        />
      )}

      {mode === 'playing' && !activeSubModal && (
        <GameHud
          hud={hud}
          engineRef={engineRef}
          touchControls={settings.touchControls}
          muted={settings.muted}
          onToggleMute={() => handleUpdateSettings({ muted: !settings.muted })}
          onPause={handlePause}
          onOpenModal={handleOpenSubModal}
          onSelectWeapon={(w: WeaponId) => engineRef.current?.setWeapon(w)}
        />
      )}

      {activeSubModal && (
        <CityPhoneModal
          initialTab={activeSubModal}
          hud={hud}
          onClose={handleCloseSubModal}
          onStartMission={(id) => engineRef.current?.startMission(id)}
          onSpawnVehicle={(type: VehicleType, color: string) =>
            engineRef.current?.spawnOrCustomizeVehicle(type, color)
          }
          onSelectOutfit={(id) => engineRef.current?.selectOrBuyOutfit(id)}
        />
      )}

      {mode === 'paused' && !activeSubModal && (
        <PauseModal
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onResume={handleResume}
          onSaveGame={handleSaveGame}
          onLoadGame={handleLoadGame}
          onRestart={() => {
            engineRef.current?.startNewOrContinue(createDefaultSaveData());
            setMode('playing');
          }}
          onReturnTitle={() => {
            engineRef.current?.setGameState('title');
            setMode('title');
          }}
          saveStatus={saveStatus}
        />
      )}

      {mode === 'gameover' && (
        <GameOverModal
          reason={gameOverReason}
          hud={hud}
          onRespawn={() => {
            engineRef.current?.respawnAfterDefeat();
            setMode('playing');
          }}
          onReturnTitle={() => {
            engineRef.current?.setGameState('title');
            setMode('title');
          }}
        />
      )}
    </main>
  );
}

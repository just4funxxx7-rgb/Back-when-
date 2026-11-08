import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from './game/GameEngine';
import { VitalsHUD } from './components/VitalsHUD';
import { WeatherHUD } from './components/WeatherHUD';
import { BottomDock } from './components/BottomDock';
import { DialogueModal } from './components/DialogueModal';
import { TitleScreen } from './components/TitleScreen';
import { MobileControls } from './components/MobileControls';
import { audioEngine } from './game/audioEngine';
import {
  PlayerVitals,
  Item,
  CraftingRecipe,
  PlacedStructure,
  NPCData,
  WeatherType,
  GameSaveState,
} from './types/game';
import { ITEM_CATALOG, INITIAL_NPCS } from './game/itemsData';
import { DEFAULT_GRAPHICS_CONFIG, EngineGraphicsConfig } from './game/postprocessing';

export default function App() {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // Engine Graphics Profile (Unreal Engine 5 / Unity HDRP)
  const [graphicsConfig, setGraphicsConfig] = useState<EngineGraphicsConfig>(DEFAULT_GRAPHICS_CONFIG);

  // High-level Game State
  const [gamePhase, setGamePhase] = useState<'title' | 'playing'>('title');
  const [isMuted, setIsMuted] = useState(false);
  const [isCoopActive, setIsCoopActive] = useState(false);

  // In-Game Live State
  const [vitals, setVitals] = useState<PlayerVitals>({
    health: 100,
    maxHealth: 100,
    stamina: 100,
    maxStamina: 100,
    hunger: 85,
    thirst: 90,
    temperature: 20,
    morale: 80,
    wetness: 0,
    level: 1,
    xp: 0,
    nextLevelXp: 150,
  });

  const [hotbar, setHotbar] = useState<(Item | null)[]>(new Array(6).fill(null));
  const [inventory, setInventory] = useState<(Item | null)[]>(new Array(24).fill(null));
  const [selectedHotbarIndex, setSelectedHotbarIndex] = useState(0);

  const [timeOfDay, setTimeOfDay] = useState(9.0);
  const [dayCount, setDayCount] = useState(1);
  const [currentWeather, setCurrentWeather] = useState<WeatherType>('clear');

  const [npcs, setNpcs] = useState<Record<string, NPCData>>(INITIAL_NPCS);
  const [activeDialogueNPC, setActiveDialogueNPC] = useState<NPCData | null>(null);
  const [moralKarma, setMoralKarma] = useState(15);

  const [interactionPrompt, setInteractionPrompt] = useState<string | null>(null);
  const [toastNotification, setToastNotification] = useState<{ text: string; icon: string } | null>(null);
  const [placementActive, setPlacementActive] = useState(false);
  const [isSprinting, setIsSprinting] = useState(false);

  // Initialize GameEngine once
  useEffect(() => {
    if (!canvasContainerRef.current) return;

    const engine = new GameEngine(canvasContainerRef.current);
    engineRef.current = engine;

    // Hook up engine callbacks
    engine.onVitalsUpdate = (newVitals) => {
      setVitals(newVitals);
      if (engine.weatherSystem) {
        setTimeOfDay(engine.weatherSystem.state.timeOfDay);
        setDayCount(engine.weatherSystem.state.dayCount);
        setCurrentWeather(engine.weatherSystem.state.currentWeather);
      }
    };

    engine.onInventoryUpdate = (newInv, newHotbar) => {
      setInventory(newInv);
      setHotbar(newHotbar);
    };

    engine.onNPCInteract = (npc) => {
      setActiveDialogueNPC(npc);
    };

    engine.onInteractTargetChange = (prompt) => {
      setInteractionPrompt(prompt);
    };

    engine.onNotification = (text, icon = '🔔') => {
      setToastNotification({ text, icon });
      setTimeout(() => {
        setToastNotification((prev) => (prev?.text === text ? null : prev));
      }, 3500);
    };

    // Initial sync
    setHotbar([...engine.hotbar]);
    setInventory([...engine.inventory]);

    // Global Key Listener for Title Screen Space/Enter start
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        setGamePhase((prev) => {
          if (prev === 'title') {
            audioEngine.init();
            return 'playing';
          }
          return prev;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      engine.destroy();
    };
  }, []);

  const handleStartGame = () => {
    audioEngine.init();
    setGamePhase('playing');
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    audioEngine.setMuted(nextMuted);
  };

  const handleWeatherChange = (weather: WeatherType) => {
    setCurrentWeather(weather);
    if (engineRef.current) {
      engineRef.current.weatherSystem.setWeather(weather);
      engineRef.current.notify(`Weather shifted to ${weather.replace('_', ' ')}!`, '⛅');
    }
  };

  const handleToggleCoop = () => {
    const nextState = !isCoopActive;
    setIsCoopActive(nextState);
    if (engineRef.current) {
      engineRef.current.toggleCoOpSimulation(nextState);
    }
  };

  const handleUseItem = (item: Item, index: number, isHotbar: boolean) => {
    if (!engineRef.current) return;
    const engine = engineRef.current;

    // Apply food/drink or medicine effects
    if (item.category === 'food' || item.category === 'medicine') {
      if (item.stats?.healthHeal) {
        engine.vitals.health = Math.min(engine.vitals.maxHealth, engine.vitals.health + item.stats.healthHeal);
      }
      if (item.stats?.hungerHeal) {
        engine.vitals.hunger = Math.min(100, engine.vitals.hunger + item.stats.hungerHeal);
      }
      if (item.stats?.thirstHeal) {
        engine.vitals.thirst = Math.min(100, engine.vitals.thirst + item.stats.thirstHeal);
      }
      if (item.stats?.warmth) {
        engine.vitals.temperature = Math.min(37, engine.vitals.temperature + item.stats.warmth);
      }

      engine.notify(`Consumed ${item.name}!`, item.icon);
      audioEngine.playCraftSuccess();
      engine.deductItem(item.id, 1);
    } else if (item.category === 'structure') {
      // Activate placement mode for structure item
      engine.setPlacementMode(true, item.id as PlacedStructure['type']);
      setPlacementActive(true);
      engine.notify(`Position your ${item.name}. Click to build!`, '🔨');
    } else {
      engine.notify(`Equipped ${item.name}!`, item.icon);
      audioEngine.playFootstep('stone');
    }
  };

  const handleCraftRecipe = (recipe: CraftingRecipe) => {
    if (!engineRef.current) return;
    const engine = engineRef.current;

    // Deduct ingredients
    for (const req of recipe.ingredients) {
      engine.deductItem(req.itemId, req.count);
    }

    // Add result
    engine.addInventoryItem(recipe.resultItemId, recipe.resultCount);
    engine.addXP(30, 'engineering');
    audioEngine.playCraftSuccess();
    engine.notify(`Crafted ${recipe.name}!`, ITEM_CATALOG[recipe.resultItemId]?.icon || '✨');
  };

  const handleStartPlacement = (type: PlacedStructure['type']) => {
    if (!engineRef.current) return;
    engineRef.current.setPlacementMode(true, type);
    setPlacementActive(true);
  };

  const handleCancelPlacement = () => {
    if (!engineRef.current) return;
    engineRef.current.setPlacementMode(false);
    setPlacementActive(false);
  };

  const handleRotatePlacement = () => {
    if (!engineRef.current) return;
    engineRef.current.rotatePlacement();
  };

  const handleConfirmPlacement = () => {
    if (!engineRef.current) return;
    engineRef.current.confirmPlacement();
    setPlacementActive(false);
    engineRef.current.setPlacementMode(false);
  };

  const handleSaveGame = async () => {
    if (!engineRef.current) return;
    const engine = engineRef.current;

    const saveObj: GameSaveState = {
      version: 1,
      saveName: 'Outcast_Autosave',
      timestamp: Date.now(),
      vitals: { ...engine.vitals },
      skills: { ...engine.skills },
      inventory: [...engine.inventory],
      hotbar: [...engine.hotbar],
      equippedArmor: { head: null, chest: null, legs: null, feet: null },
      activeWeapon: null,
      structures: [...engine.placedStructures],
      dayCount: engine.weatherSystem.state.dayCount,
      timeOfDay: engine.weatherSystem.state.timeOfDay,
      weather: engine.weatherSystem.state.currentWeather,
      karma: moralKarma,
      moralHistory: [],
      npcs: { ...npcs },
      quests: [],
      seasonPass: { tier: 1, xp: vitals.xp, isPremium: false, claimedTiers: [] },
      coop: { roomCode: 'AETH-9824', isHost: true, activePartner: isCoopActive ? 'Kaelen' : null },
    };

    localStorage.setItem('aetheria_save_v1', JSON.stringify(saveObj));

    try {
      await fetch('/api/cloud-save/player_1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saveObj),
      });
      engine.notify('World state synced to Cloud & Local Storage!', '☁️');
    } catch {
      engine.notify('Saved to Local Storage (Cloud offline)!', '💾');
    }
  };

  const handleLoadGame = async () => {
    try {
      const res = await fetch('/api/cloud-save/player_1');
      const json = await res.json();
      const save: GameSaveState = json?.data || JSON.parse(localStorage.getItem('aetheria_save_v1') || '{}');

      if (save && save.vitals && engineRef.current) {
        const engine = engineRef.current;
        engine.vitals = { ...save.vitals };
        engine.skills = { ...save.skills };
        engine.inventory = [...save.inventory];
        engine.hotbar = [...save.hotbar];
        setVitals({ ...save.vitals });
        setHotbar([...save.hotbar]);
        setInventory([...save.inventory]);
        engine.notify('Loaded persistent save state!', '📂');
      } else {
        engineRef.current?.notify('No previous save state found.', '⚠️');
      }
    } catch {
      engineRef.current?.notify('Failed to load cloud save.', '⚠️');
    }
  };

  const handleExportSave = () => {
    if (!engineRef.current) return;
    const saveStr = localStorage.getItem('aetheria_save_v1') || JSON.stringify({ vitals, hotbar, inventory });
    navigator.clipboard?.writeText(saveStr);
    engineRef.current.notify('Save JSON copied to clipboard!', '📋');
  };

  const handleImportSave = (jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.vitals && engineRef.current) {
        engineRef.current.vitals = parsed.vitals;
        engineRef.current.hotbar = parsed.hotbar;
        engineRef.current.inventory = parsed.inventory;
        setVitals({ ...parsed.vitals });
        setHotbar([...parsed.hotbar]);
        setInventory([...parsed.inventory]);
        engineRef.current.notify('Save state imported successfully!', '✅');
      }
    } catch {
      engineRef.current?.notify('Invalid Save JSON string.', '❌');
    }
  };

  const handleApplyGraphicsPreset = (preset: 'unreal5' | 'unity_hdrp' | 'performance') => {
    if (engineRef.current) {
      engineRef.current.renderPipeline.applyPreset(preset);
      setGraphicsConfig({ ...engineRef.current.renderPipeline.config });
      engineRef.current.notify(
        `Engine profile set to ${preset === 'unreal5' ? 'Unreal Engine 5 (Lumen/HDRP)' : preset === 'unity_hdrp' ? 'Unity HDRP' : 'Performance 120FPS'}!`,
        '✨'
      );
    }
  };

  const handleUpdateGraphicsConfig = (partial: Partial<EngineGraphicsConfig>) => {
    if (engineRef.current) {
      Object.assign(engineRef.current.renderPipeline.config, partial);
      if (typeof partial.bloomStrength === 'number' && engineRef.current.renderPipeline.bloomPass) {
        engineRef.current.renderPipeline.bloomPass.strength = partial.bloomStrength;
      }
      if (typeof partial.vignetteDarkness === 'number' && engineRef.current.renderPipeline.vignettePass) {
        engineRef.current.renderPipeline.vignettePass.uniforms.darkness.value = partial.vignetteDarkness;
      }
      setGraphicsConfig({ ...engineRef.current.renderPipeline.config });
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none font-sans">
      {/* 3D WebGL Canvas Mount Container */}
      <div ref={canvasContainerRef} className="absolute inset-0 w-full h-full" />

      {/* Title Screen Overlay */}
      {gamePhase === 'title' && (
        <TitleScreen
          onStartGame={handleStartGame}
          onOpenCoop={handleToggleCoop}
          onOpenSaves={handleLoadGame}
          onOpenGuide={() => engineRef.current?.notify('WASD Move · Shift Sprint · Space Jump · Left-Click Harvest', '📖')}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Active Playing In-Game HUD (Zero-occlusion architecture) */}
      {gamePhase === 'playing' && (
        <>
          {/* Top-Left: Player Vitals Cluster */}
          <div className="absolute top-4 left-4 z-20 pointer-events-auto">
            <VitalsHUD vitals={vitals} />
          </div>

          {/* Top-Right: Weather & Clock & Audio Cluster */}
          <div className="absolute top-4 right-4 z-20 pointer-events-auto">
            <WeatherHUD
              timeOfDay={timeOfDay}
              dayCount={dayCount}
              currentWeather={currentWeather}
              onWeatherChange={handleWeatherChange}
              isCoopActive={isCoopActive}
              onToggleCoop={handleToggleCoop}
              isMuted={isMuted}
              onToggleMute={handleToggleMute}
            />
          </div>

          {/* Center Reticle & In-World Interaction Hint */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
            {/* Center Crosshair Dot */}
            <div className="w-1.5 h-1.5 rounded-full bg-white/70 shadow-[0_0_4px_rgba(255,255,255,0.8)]" />

            {/* Context Prompt */}
            {interactionPrompt && (
              <div className="mt-8 px-4 py-1.5 bg-neutral-900/90 text-amber-400 font-mono text-xs font-bold rounded-full border border-amber-500/50 shadow-2xl backdrop-blur-none animate-bounce">
                {interactionPrompt}
              </div>
            )}
          </div>

          {/* Toast Notification Alert */}
          {toastNotification && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 px-4 py-2 bg-neutral-900/95 border border-amber-500/60 text-neutral-100 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-bold animate-fade-in pointer-events-none">
              <span className="text-base">{toastNotification.icon}</span>
              <span>{toastNotification.text}</span>
            </div>
          )}

          {/* Mobile Touch Controls for handheld gameplay */}
          <MobileControls
            onJoystickMove={(vec) => {
              if (engineRef.current) engineRef.current.joystickVector = vec;
            }}
            onActionPress={() => engineRef.current?.performAction()}
            onInteractPress={() => engineRef.current?.interactNearest()}
            onJumpPress={() => {
              if (engineRef.current && engineRef.current.isGrounded) {
                engineRef.current.playerVelocity.y = 8.5;
                engineRef.current.isGrounded = false;
              }
            }}
            onRollPress={() => engineRef.current?.triggerDodgeRoll()}
            onSprintToggle={(sprint) => {
              setIsSprinting(sprint);
              if (engineRef.current) engineRef.current.keys['ShiftLeft'] = sprint;
            }}
            isSprinting={isSprinting}
          />

          {/* Bottom Dock (Hotbar + Inventory + Crafting + Building + NPCs + Season Pass) */}
          <BottomDock
            hotbar={hotbar}
            inventory={inventory}
            skills={engineRef.current?.skills || { foraging: 1, woodcraft: 1, mining: 1, combat: 1, engineering: 1, diplomacy: 1 }}
            npcs={npcs}
            selectedHotbarIndex={selectedHotbarIndex}
            onSelectHotbar={(idx) => {
              setSelectedHotbarIndex(idx);
              if (engineRef.current) engineRef.current.selectedHotbarSlot = idx;
            }}
            onUseItem={handleUseItem}
            onCraftRecipe={handleCraftRecipe}
            onStartPlacement={handleStartPlacement}
            placementActive={placementActive}
            onCancelPlacement={handleCancelPlacement}
            onRotatePlacement={handleRotatePlacement}
            onConfirmPlacement={handleConfirmPlacement}
            onOpenNPCDialogue={(npc) => setActiveDialogueNPC(npc)}
            playerLevel={vitals.level}
            playerXp={vitals.xp}
            onSaveGame={handleSaveGame}
            onLoadGame={handleLoadGame}
            onExportSave={handleExportSave}
            onImportSave={handleImportSave}
            graphicsConfig={graphicsConfig}
            onApplyGraphicsPreset={handleApplyGraphicsPreset}
            onUpdateGraphicsConfig={handleUpdateGraphicsConfig}
          />

          {/* Full NPC AI Dialogue Modal */}
          {activeDialogueNPC && (
            <DialogueModal
              npc={activeDialogueNPC}
              onClose={() => setActiveDialogueNPC(null)}
              onUpdateNPC={(updated) => {
                setNpcs((prev) => ({ ...prev, [updated.id]: updated }));
                setActiveDialogueNPC(updated);
              }}
              onKarmaChange={(delta) => setMoralKarma((k) => k + delta)}
            />
          )}
        </>
      )}
    </div>
  );
}

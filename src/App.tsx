import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from './game/GameEngine';
import { VitalsHUD } from './components/VitalsHUD';
import { WeatherHUD } from './components/WeatherHUD';
import { MinimapHUD } from './components/MinimapHUD';
import { WorldMapModal } from './components/WorldMapModal';
import { MissionTrackerHUD } from './components/MissionTrackerHUD';
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
  WorldSector,
  SurveyBeacon,
  Mission,
  MapWaypoint,
} from './types/game';
import { ITEM_CATALOG, INITIAL_NPCS } from './game/itemsData';
import {
  INITIAL_WORLD_SECTORS,
  INITIAL_SURVEY_BEACONS,
  INITIAL_MISSIONS,
} from './game/missionsData';
import {
  DEFAULT_GRAPHICS_CONFIG,
  EngineGraphicsConfig,
  GraphicsPresetType,
} from './game/postprocessing';
import {
  initAuth,
  googleSignIn,
  logout,
  testFirestoreConnection,
  syncSurvivorToFirestore,
  loadSurvivorFromFirestore,
} from './lib/firebase';
import type { User } from 'firebase/auth';

export default function App() {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [graphicsConfig, setGraphicsConfig] = useState<EngineGraphicsConfig>(
    DEFAULT_GRAPHICS_CONFIG
  );
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [gamePhase, setGamePhase] = useState<'title' | 'playing'>('title');
  const [isMuted, setIsMuted] = useState(false);
  const [isCoopActive, setIsCoopActive] = useState(false);

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
  const [inventory, setInventory] = useState<(Item | null)[]>(
    new Array(24).fill(null)
  );
  const [selectedHotbarIndex, setSelectedHotbarIndex] = useState(0);

  const [timeOfDay, setTimeOfDay] = useState(9.0);
  const [dayCount, setDayCount] = useState(1);
  const [currentWeather, setCurrentWeather] = useState<WeatherType>('clear');

  const [npcs, setNpcs] = useState<Record<string, NPCData>>(INITIAL_NPCS);
  const [activeDialogueNPC, setActiveDialogueNPC] = useState<NPCData | null>(
    null
  );
  const [moralKarma, setMoralKarma] = useState(15);

  // Expanding World Map & Missions State
  const [playerPos, setPlayerPos] = useState<{ x: number; z: number }>({
    x: 0,
    z: 0,
  });
  const [playerAngle, setPlayerAngle] = useState(0);
  const [worldSectors, setWorldSectors] = useState<WorldSector[]>(
    INITIAL_WORLD_SECTORS
  );
  const [surveyBeacons, setSurveyBeacons] = useState<SurveyBeacon[]>(
    INITIAL_SURVEY_BEACONS
  );
  const [missions, setMissions] = useState<Mission[]>(INITIAL_MISSIONS);
  const [activeWaypoint, setActiveWaypoint] = useState<MapWaypoint | null>({
    x: 3,
    z: 3,
    label: 'Hearth Campfire',
    color: '#f59e0b',
  });
  const [isWorldMapOpen, setIsWorldMapOpen] = useState(false);

  const [interactionPrompt, setInteractionPrompt] = useState<string | null>(
    null
  );
  const [toastNotification, setToastNotification] = useState<{
    text: string;
    icon: string;
  } | null>(null);
  const [placementActive, setPlacementActive] = useState(false);
  const [isSprinting, setIsSprinting] = useState(false);

  const notify = (text: string, icon = '🔔') => {
    setToastNotification({ text, icon });
    setTimeout(() => {
      setToastNotification((prev) => (prev?.text === text ? null : prev));
    }, 3500);
  };

  useEffect(() => {
    testFirestoreConnection();
    const unsub = initAuth(async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const idToken = await user.getIdToken();
          await fetch('/api/sql/sync-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              displayName: user.displayName,
            }),
          });
        } catch {
          // Non-fatal
        }
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!canvasContainerRef.current) return;

    const engine = new GameEngine(canvasContainerRef.current);
    engineRef.current = engine;

    engine.onVitalsUpdate = (newVitals) => {
      setVitals(newVitals);
      setPlayerPos({
        x: engine.playerGroup.position.x,
        z: engine.playerGroup.position.z,
      });
      setPlayerAngle(engine.playerFacingAngle);
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
      notify(text, icon);
    };

    engine.onMapAndMissionsUpdate = (
      sectors,
      beacons,
      updatedMissions,
      _exploredCount,
      wp
    ) => {
      setWorldSectors(sectors);
      setSurveyBeacons(beacons);
      setMissions(updatedMissions);
      setActiveWaypoint(wp);
    };

    setHotbar([...engine.hotbar]);
    setInventory([...engine.inventory]);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        setGamePhase((prev) => {
          if (prev === 'title') {
            audioEngine.init();
            return 'playing';
          }
          return prev;
        });
      } else if (e.code === 'KeyM') {
        setIsWorldMapOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      engine.destroy();
    };
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      const user = await googleSignIn();
      notify(`Signed in as ${user.email}`, '✅');
    } catch (err: any) {
      notify(err?.message || 'Google Sign-In cancelled', '⚠️');
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await logout();
      notify('Signed out of Aetheria Cloud', '👋');
    } catch {
      notify('Failed to sign out', '⚠️');
    }
  };

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
      engineRef.current.notify(
        `Weather shifted to ${weather.replace('_', ' ')}!`,
        '⛅'
      );
    }
  };

  const handleToggleCoop = () => {
    const nextState = !isCoopActive;
    setIsCoopActive(nextState);
    if (engineRef.current) {
      engineRef.current.toggleCoOpSimulation(nextState);
    }
  };

  const handleUseItem = (item: Item, _index: number, _isHotbar: boolean) => {
    if (!engineRef.current) return;
    const engine = engineRef.current;

    if (item.category === 'food' || item.category === 'medicine') {
      if (item.stats?.healthHeal) {
        engine.vitals.health = Math.min(
          engine.vitals.maxHealth,
          engine.vitals.health + item.stats.healthHeal
        );
      }
      if (item.stats?.hungerHeal) {
        engine.vitals.hunger = Math.min(
          100,
          engine.vitals.hunger + item.stats.hungerHeal
        );
      }
      if (item.stats?.thirstHeal) {
        engine.vitals.thirst = Math.min(
          100,
          engine.vitals.thirst + item.stats.thirstHeal
        );
      }
      if (item.stats?.warmth) {
        engine.vitals.temperature = Math.min(
          37,
          engine.vitals.temperature + item.stats.warmth
        );
      }

      engine.notify(`Consumed ${item.name}!`, item.icon);
      audioEngine.playCraftSuccess();
      engine.deductItem(item.id, 1);
    } else if (item.category === 'structure') {
      engine.setPlacementMode(true, item.id as PlacedStructure['type']);
      setPlacementActive(true);
      engine.notify(`Position your ${item.name}. Tap Place to build!`, '🔨');
    } else {
      engine.notify(`Equipped ${item.name}!`, item.icon);
      audioEngine.playFootstep('stone');
    }
  };

  const handleCraftRecipe = (recipe: CraftingRecipe) => {
    if (!engineRef.current) return;
    const engine = engineRef.current;

    for (const req of recipe.ingredients) {
      engine.deductItem(req.itemId, req.count);
    }

    engine.addInventoryItem(recipe.resultItemId, recipe.resultCount);
    engine.addXP(30, 'engineering');
    engine.recordMissionProgress('craft', undefined, 1);
    audioEngine.playCraftSuccess();
    engine.notify(
      `Crafted ${recipe.name}!`,
      ITEM_CATALOG[recipe.resultItemId]?.icon || '✨'
    );
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
      saveName: 'Aetheria_Outcast_Save',
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
      missions: [...engine.missions],
      discoveredSectors: engine.worldSectors
        .filter((s) => s.discovered)
        .map((s) => s.id),
      exploredCells: Array.from(engine.exploredCells),
      seasonPass: {
        tier: 1,
        xp: vitals.xp,
        isPremium: false,
        claimedTiers: [],
      },
      coop: {
        roomCode: 'AETH-9824',
        isHost: true,
        activePartner: isCoopActive ? 'Kaelen' : null,
      },
    };

    const jsonStr = JSON.stringify(saveObj);
    localStorage.setItem('aetheria_save_v1', jsonStr);

    try {
      if (currentUser) {
        await syncSurvivorToFirestore(
          currentUser,
          engine.vitals.level,
          moralKarma,
          engine.weatherSystem.state.dayCount,
          jsonStr
        );
        const idToken = await currentUser.getIdToken();
        await fetch('/api/sql/cloud-save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            level: engine.vitals.level,
            moralKarma,
            dayCount: engine.weatherSystem.state.dayCount,
            savePayloadJson: jsonStr,
          }),
        });
        engine.notify(
          'Synced to Cloud SQL (PostgreSQL) & Firebase Firestore!',
          '☁️'
        );
      } else {
        await fetch('/api/cloud-save/player_1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: jsonStr,
        });
        engine.notify('Saved to Cloud & Local Storage!', '☁️');
      }
    } catch {
      engine.notify('Saved to Local Storage!', '💾');
    }
  };

  const handleLoadGame = async () => {
    try {
      let save: GameSaveState | null = null;

      if (currentUser) {
        const idToken = await currentUser.getIdToken();
        const sqlRes = await fetch('/api/sql/cloud-save', {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (sqlRes.ok) {
          const sqlJson = await sqlRes.json();
          if (sqlJson?.data?.savePayloadJson) {
            save = JSON.parse(sqlJson.data.savePayloadJson);
          }
        }
        if (!save) {
          const fsDoc = await loadSurvivorFromFirestore(currentUser);
          if (fsDoc?.savePayloadJson) {
            save = JSON.parse(fsDoc.savePayloadJson);
          }
        }
      }

      if (!save) {
        const res = await fetch('/api/cloud-save/player_1');
        const json = await res.json();
        save =
          json?.data ||
          JSON.parse(localStorage.getItem('aetheria_save_v1') || '{}');
      }

      if (save && save.vitals && engineRef.current) {
        const engine = engineRef.current;
        engine.vitals = { ...save.vitals };
        engine.skills = { ...save.skills };
        engine.inventory = [...save.inventory];
        engine.hotbar = [...save.hotbar];
        if (save.missions) {
          engine.missions = save.missions;
          setMissions([...save.missions]);
        }
        if (save.exploredCells) {
          engine.exploredCells = new Set(save.exploredCells);
        }
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
    const saveStr =
      localStorage.getItem('aetheria_save_v1') ||
      JSON.stringify({ vitals, hotbar, inventory });
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

  const handleApplyGraphicsPreset = (preset: GraphicsPresetType) => {
    if (engineRef.current) {
      engineRef.current.renderPipeline.applyPreset(preset);
      setGraphicsConfig({ ...engineRef.current.renderPipeline.config });
      const labels: Record<GraphicsPresetType, string> = {
        '8k_ultra': '8K Native Ultra (2.0x Supersampled + FidelityFX CAS)',
        unreal5: 'Unreal Engine 5 (Lumen & Filmic Post)',
        unity_hdrp: 'Unity HDRP (Balanced PBR)',
        performance: 'Mobile 120FPS Performance',
      };
      engineRef.current.notify(`Graphics set to ${labels[preset]}!`, '✨');
    }
  };

  const handleUpdateGraphicsConfig = (
    partial: Partial<EngineGraphicsConfig>
  ) => {
    if (engineRef.current) {
      const pipeline = engineRef.current.renderPipeline;
      Object.assign(pipeline.config, partial);
      if (typeof partial.bloomStrength === 'number' && pipeline.bloomPass) {
        pipeline.bloomPass.strength = partial.bloomStrength;
      }
      if (
        typeof partial.vignetteDarkness === 'number' &&
        pipeline.vignettePass
      ) {
        pipeline.vignettePass.uniforms.darkness.value =
          partial.vignetteDarkness;
      }
      if (typeof partial.casSharpness === 'number' && pipeline.casPass) {
        pipeline.casPass.uniforms.sharpness.value = partial.casSharpness;
      }
      if (typeof partial.renderScale === 'number') {
        pipeline.setSize(window.innerWidth, window.innerHeight);
      }
      setGraphicsConfig({ ...pipeline.config });
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
          onOpenGuide={() =>
            engineRef.current?.notify(
              'WASD / Joystick Move · [M] Expanding World Map · [E] Activate Survey Spires',
              '📖'
            )
          }
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Active Playing In-Game HUD */}
      {gamePhase === 'playing' && (
        <>
          {/* Top Bar: Left (Vitals + Active Mission Tracker) & Right (Weather + Live Radar Minimap) */}
          <div className="absolute top-2 inset-x-2 sm:top-4 sm:inset-x-4 z-20 flex items-start justify-between gap-2 pointer-events-none">
            <div className="flex flex-col gap-2 pointer-events-auto">
              <VitalsHUD vitals={vitals} />
              <MissionTrackerHUD
                missions={missions}
                playerPos={playerPos}
                onTrackWaypoint={(wp) => engineRef.current?.setWaypoint(wp)}
                onRequestNewDirective={() =>
                  engineRef.current?.generateNewDirectiveMission()
                }
              />
            </div>

            <div className="flex flex-col items-end gap-2 pointer-events-auto">
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
              <MinimapHUD
                playerPos={playerPos}
                playerAngle={playerAngle}
                sectors={worldSectors}
                beacons={surveyBeacons}
                npcs={npcs}
                structures={engineRef.current?.placedStructures || []}
                exploredCells={engineRef.current?.exploredCells || new Set()}
                activeWaypoint={activeWaypoint}
                onOpenWorldMap={() => setIsWorldMapOpen(true)}
              />
            </div>
          </div>

          {/* Center Reticle & In-World Interaction Hint */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
            <div className="w-1.5 h-1.5 rounded-full bg-white/70 shadow-[0_0_4px_rgba(255,255,255,0.8)]" />

            {interactionPrompt && (
              <div className="mt-8 px-3.5 py-1.5 bg-neutral-900/90 text-amber-400 font-mono text-xs font-bold rounded-full border border-amber-500/50 shadow-2xl animate-bounce">
                {interactionPrompt}
              </div>
            )}
          </div>

          {/* Toast Notification Alert */}
          {toastNotification && (
            <div className="absolute top-16 sm:top-20 left-1/2 -translate-x-1/2 z-30 px-3.5 py-2 bg-neutral-900/95 border border-amber-500/60 text-neutral-100 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold pointer-events-none max-w-[90vw]">
              <span className="text-base">{toastNotification.icon}</span>
              <span className="truncate">{toastNotification.text}</span>
            </div>
          )}

          {/* Mobile Touch Controls */}
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

          {/* Bottom Dock */}
          <BottomDock
            hotbar={hotbar}
            inventory={inventory}
            skills={
              engineRef.current?.skills || {
                foraging: 1,
                woodcraft: 1,
                mining: 1,
                combat: 1,
                engineering: 1,
                diplomacy: 1,
              }
            }
            vitals={vitals}
            dayCount={dayCount}
            moralKarma={moralKarma}
            npcs={npcs}
            missions={missions}
            onTrackWaypoint={(wp) => engineRef.current?.setWaypoint(wp)}
            onRequestNewDirective={() =>
              engineRef.current?.generateNewDirectiveMission()
            }
            onOpenWorldMap={() => setIsWorldMapOpen(true)}
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
            onOpenNPCDialogue={(npc) => {
              engineRef.current?.recordMissionProgress('talk_npc', undefined, 1);
              setActiveDialogueNPC(npc);
            }}
            playerLevel={vitals.level}
            playerXp={vitals.xp}
            onSaveGame={handleSaveGame}
            onLoadGame={handleLoadGame}
            onExportSave={handleExportSave}
            onImportSave={handleImportSave}
            graphicsConfig={graphicsConfig}
            onApplyGraphicsPreset={handleApplyGraphicsPreset}
            onUpdateGraphicsConfig={handleUpdateGraphicsConfig}
            currentUser={currentUser}
            onGoogleSignIn={handleGoogleSignIn}
            onGoogleSignOut={handleGoogleSignOut}
            onNotify={notify}
          />

          {/* Full-Screen Interactive World Map & Cartography Modal */}
          {isWorldMapOpen && (
            <WorldMapModal
              onClose={() => setIsWorldMapOpen(false)}
              playerPos={playerPos}
              sectors={worldSectors}
              beacons={surveyBeacons}
              npcs={npcs}
              structures={engineRef.current?.placedStructures || []}
              exploredCells={engineRef.current?.exploredCells || new Set()}
              activeWaypoint={activeWaypoint}
              onSetWaypoint={(wp) => engineRef.current?.setWaypoint(wp)}
            />
          )}

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

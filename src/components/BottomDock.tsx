import React, { useState, useEffect } from 'react';
import {
  Item,
  CraftingRecipe,
  PlacedStructure,
  PlayerSkills,
  NPCData,
  PlayerVitals,
  Mission,
  MapWaypoint,
} from '../types/game';
import {
  CRAFTING_RECIPES,
  ITEM_CATALOG,
  SEASON_PASS_REWARDS,
} from '../game/itemsData';
import { audioEngine } from '../game/audioEngine';
import { EngineGraphicsConfig, GraphicsPresetType } from '../game/postprocessing';
import {
  UNIFIED_PROJECT_NAME,
  isClientAdminEmail,
  listUserSurvivalDocs,
  createSurvivalChronicleDoc,
  listRecentGmailDispatches,
  sendGmailSurvivalDispatch,
  ExpeditionDocItem,
  GmailMessageSummary,
} from '../lib/firebase';
import type { User } from 'firebase/auth';
import {
  Backpack,
  Hammer,
  Home,
  Award,
  Heart,
  Crown,
  CloudUpload,
  ChevronDown,
  ChevronUp,
  RotateCw,
  X,
  Check,
  Sliders,
  Sparkles,
  FileText,
  Mail,
  ShieldCheck,
  LogOut,
  Send,
  ExternalLink,
  RefreshCw,
  Database,
  Zap,
  Target,
  Compass,
  Navigation,
  CheckCircle2,
  Circle,
} from 'lucide-react';

interface BottomDockProps {
  hotbar: (Item | null)[];
  inventory: (Item | null)[];
  skills: PlayerSkills;
  vitals: PlayerVitals;
  dayCount: number;
  moralKarma: number;
  npcs: Record<string, NPCData>;
  missions: Mission[];
  onTrackWaypoint: (wp: MapWaypoint) => void;
  onRequestNewDirective: () => void;
  onOpenWorldMap: () => void;
  selectedHotbarIndex: number;
  onSelectHotbar: (index: number) => void;
  onUseItem: (item: Item, index: number, isHotbar: boolean) => void;
  onCraftRecipe: (recipe: CraftingRecipe) => void;
  onStartPlacement: (type: PlacedStructure['type']) => void;
  placementActive: boolean;
  onCancelPlacement: () => void;
  onRotatePlacement: () => void;
  onConfirmPlacement: () => void;
  onOpenNPCDialogue: (npc: NPCData) => void;
  playerLevel: number;
  playerXp: number;
  onSaveGame: () => void;
  onLoadGame: () => void;
  onExportSave: () => void;
  onImportSave: (jsonStr: string) => void;
  graphicsConfig: EngineGraphicsConfig;
  onApplyGraphicsPreset: (preset: GraphicsPresetType) => void;
  onUpdateGraphicsConfig: (config: Partial<EngineGraphicsConfig>) => void;
  currentUser: User | null;
  onGoogleSignIn: () => Promise<void>;
  onGoogleSignOut: () => Promise<void>;
  onNotify: (msg: string, icon?: string) => void;
}

type TabType =
  | 'none'
  | 'inventory'
  | 'crafting'
  | 'building'
  | 'missions'
  | 'skills'
  | 'npcs'
  | 'season_pass'
  | 'cloud_save'
  | 'graphics';

type CloudSubTab = 'saves' | 'docs' | 'gmail' | 'admin';

export const BottomDock: React.FC<BottomDockProps> = ({
  hotbar,
  inventory,
  skills,
  vitals,
  dayCount,
  moralKarma,
  npcs,
  missions,
  onTrackWaypoint,
  onRequestNewDirective,
  onOpenWorldMap,
  selectedHotbarIndex,
  onSelectHotbar,
  onUseItem,
  onCraftRecipe,
  onStartPlacement,
  placementActive,
  onCancelPlacement,
  onRotatePlacement,
  onConfirmPlacement,
  onOpenNPCDialogue,
  playerLevel,
  playerXp,
  onSaveGame,
  onLoadGame,
  onExportSave,
  onImportSave,
  graphicsConfig,
  onApplyGraphicsPreset,
  onUpdateGraphicsConfig,
  currentUser,
  onGoogleSignIn,
  onGoogleSignOut,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('none');
  const [cloudSubTab, setCloudSubTab] = useState<CloudSubTab>('saves');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedItemDetail, setSelectedItemDetail] = useState<{
    item: Item;
    index: number;
    isHotbar: boolean;
  } | null>(null);
  const [isPremiumPass, setIsPremiumPass] = useState(false);
  const [claimedTiers, setClaimedTiers] = useState<number[]>([]);
  const [importInput, setImportInput] = useState('');
  const [craftingCategory, setCraftingCategory] = useState<
    'all' | 'tools' | 'survival' | 'building' | 'armor' | 'advanced'
  >('all');

  // Google Workspace & Cloud SQL state
  const [docsList, setDocsList] = useState<ExpeditionDocItem[]>([]);
  const [sqlLogs, setSqlLogs] = useState<any[]>([]);
  const [docTitle, setDocTitle] = useState(
    `${UNIFIED_PROJECT_NAME} — Day ${dayCount} Survivor Chronicle`
  );
  const [isBusyWorkspace, setIsBusyWorkspace] = useState(false);

  const [gmailList, setGmailList] = useState<GmailMessageSummary[]>([]);
  const [emailTo, setEmailTo] = useState('new.dawn.industries2026@gmail.com');
  const [emailSubject, setEmailSubject] = useState(
    `[${UNIFIED_PROJECT_NAME}] Outcast Settlement Dispatch — Day ${dayCount}`
  );
  const [emailBody, setEmailBody] = useState(
    `Survivor Report from ${UNIFIED_PROJECT_NAME}:\n- Rank: Level ${vitals.level}\n- Health: ${Math.round(vitals.health)}/${vitals.maxHealth}\n- Moral Karma: ${moralKarma}\n- Settlement Status: Perimeter fortified.`
  );

  const [adminUsers, setAdminUsers] = useState<any[]>([]);

  const [pendingConfirmation, setPendingConfirmation] = useState<{
    type: 'create_doc' | 'send_email';
    title: string;
    details: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  useEffect(() => {
    setDocTitle(`${UNIFIED_PROJECT_NAME} — Day ${dayCount} Survivor Chronicle`);
    setEmailSubject(
      `[${UNIFIED_PROJECT_NAME}] Outcast Settlement Dispatch — Day ${dayCount}`
    );
  }, [dayCount]);

  const handleTabClick = (tab: TabType) => {
    if (activeTab === tab) {
      setActiveTab('none');
    } else {
      setActiveTab(tab);
      setIsCollapsed(false);
    }
  };

  const checkHasIngredients = (recipe: CraftingRecipe): boolean => {
    const allItems = [...hotbar, ...inventory];
    for (const req of recipe.ingredients) {
      let count = 0;
      for (const it of allItems) {
        if (it && it.id === req.itemId) count += it.count;
      }
      if (count < req.count) return false;
    }
    return true;
  };

  const getAvailableCount = (itemId: string): number => {
    let count = 0;
    for (const it of [...hotbar, ...inventory]) {
      if (it && it.id === itemId) count += it.count;
    }
    return count;
  };

  const claimTier = (tier: number) => {
    if (!claimedTiers.includes(tier)) {
      setClaimedTiers([...claimedTiers, tier]);
      audioEngine.playCraftSuccess();
    }
  };

  const fetchSqlExpeditionLogs = async () => {
    if (!currentUser) return;
    try {
      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/sql/expedition-log', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        const json = await res.json();
        setSqlLogs(json.data || []);
      }
    } catch {
      // Non-fatal
    }
  };

  const fetchAdminDirectory = async () => {
    if (!currentUser) return;
    setIsBusyWorkspace(true);
    try {
      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/sql/admin/users', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const json = await res.json();
      if (res.ok) {
        setAdminUsers(json.users || []);
        onNotify('Loaded Cloud SQL Project Admin Directory', '🛡️');
      } else {
        onNotify(json.error || 'Admin access restricted', '⚠️');
      }
    } catch {
      onNotify('Failed to load Admin Directory', '⚠️');
    } finally {
      setIsBusyWorkspace(false);
    }
  };

  const handleLoadGoogleDocs = async () => {
    setIsBusyWorkspace(true);
    try {
      const files = await listUserSurvivalDocs();
      setDocsList(files);
      await fetchSqlExpeditionLogs();
      onNotify(`Loaded ${files.length} Google Docs from Drive`, '📄');
    } catch (err: any) {
      onNotify(err?.message || 'Could not load Google Docs', '⚠️');
    } finally {
      setIsBusyWorkspace(false);
    }
  };

  const promptCreateGoogleDoc = () => {
    const companionSummary = Object.values(npcs)
      .map((n) => `${n.name} (${n.romanceStage}, Affinity: ${n.affinity}/100)`)
      .join(', ');

    const bodyText = [
      `==================================================`,
      `${UNIFIED_PROJECT_NAME.toUpperCase()} — OFFICIAL SURVIVOR CHRONICLE`,
      `==================================================`,
      `Project ID: agile-gear-q3rp2 (us-east1)`,
      `Survivor: ${currentUser?.email || 'Outcast Wanderer'}`,
      `Day: ${dayCount} | Survivor Rank: Level ${vitals.level} (${vitals.xp} XP)`,
      `Moral Karma Alignment: ${moralKarma}`,
      `Vitals: HP ${Math.round(vitals.health)}/${vitals.maxHealth} | Stamina ${Math.round(vitals.stamina)} | Temp ${vitals.temperature.toFixed(1)}°C`,
      ``,
      `SKILL MASTERIES:`,
      `- Woodcraft: LVL ${skills.woodcraft} | Mining: LVL ${skills.mining}`,
      `- Foraging: LVL ${skills.foraging} | Combat: LVL ${skills.combat}`,
      `- Engineering: LVL ${skills.engineering} | Diplomacy: LVL ${skills.diplomacy}`,
      ``,
      `COMPANION RELATIONSHIPS:`,
      `${companionSummary}`,
      ``,
      `Generated via ${UNIFIED_PROJECT_NAME} Cloud & Google Docs Integration.`,
    ].join('\n');

    setPendingConfirmation({
      type: 'create_doc',
      title: `Create Google Doc: "${docTitle}"`,
      details: bodyText,
      onConfirm: async () => {
        setIsBusyWorkspace(true);
        try {
          const created = await createSurvivalChronicleDoc(docTitle, bodyText);
          if (currentUser) {
            const idToken = await currentUser.getIdToken();
            await fetch('/api/sql/expedition-log', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({
                title: created.title,
                summary: `Day ${dayCount} · Level ${vitals.level} · Karma ${moralKarma}`,
                googleDocId: created.documentId,
              }),
            });
            await fetchSqlExpeditionLogs();
          }
          await handleLoadGoogleDocs();
          onNotify('Created Survival Chronicle in Google Docs & Cloud SQL!', '📝');
        } catch (err: any) {
          onNotify(err?.message || 'Failed to create Google Doc', '❌');
        } finally {
          setIsBusyWorkspace(false);
          setPendingConfirmation(null);
        }
      },
    });
  };

  const handleLoadGmail = async () => {
    setIsBusyWorkspace(true);
    try {
      const msgs = await listRecentGmailDispatches(4);
      setGmailList(msgs);
      onNotify(`Synced ${msgs.length} messages from Gmail`, '✉️');
    } catch (err: any) {
      onNotify(err?.message || 'Could not load Gmail messages', '⚠️');
    } finally {
      setIsBusyWorkspace(false);
    }
  };

  const promptSendGmail = () => {
    if (!emailTo.trim() || !emailSubject.trim()) {
      onNotify('Please specify recipient and subject', '⚠️');
      return;
    }
    setPendingConfirmation({
      type: 'send_email',
      title: `Send Gmail Dispatch to ${emailTo}`,
      details: `Subject: ${emailSubject}\n\n${emailBody}`,
      onConfirm: async () => {
        setIsBusyWorkspace(true);
        try {
          await sendGmailSurvivalDispatch(emailTo, emailSubject, emailBody);
          onNotify(`Survival dispatch sent to ${emailTo}!`, '📨');
        } catch (err: any) {
          onNotify(err?.message || 'Failed to send Gmail message', '❌');
        } finally {
          setIsBusyWorkspace(false);
          setPendingConfirmation(null);
        }
      },
    });
  };

  const activeHotbarItem = hotbar[selectedHotbarIndex];
  const isUserAdmin = isClientAdminEmail(currentUser?.email);

  return (
    <div className="fixed bottom-1.5 sm:bottom-3 left-1/2 -translate-x-1/2 z-30 w-full max-w-4xl px-2 sm:px-4 select-none pointer-events-auto">
      {/* Explicit User Confirmation Modal for Google Docs / Gmail Mutations */}
      {pendingConfirmation && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-amber-500/60 rounded-2xl max-w-md w-full p-4 shadow-2xl space-y-3 text-neutral-100">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Confirm Google Workspace Action
              </h4>
              <button
                onClick={() => setPendingConfirmation(null)}
                className="p-1 text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs font-semibold text-white">
              {pendingConfirmation.title}
            </p>
            <pre className="p-2.5 bg-neutral-950 rounded-lg border border-neutral-800 text-[10px] font-mono text-neutral-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
              {pendingConfirmation.details}
            </pre>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                disabled={isBusyWorkspace}
                onClick={() => setPendingConfirmation(null)}
                className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-300"
              >
                Cancel
              </button>
              <button
                disabled={isBusyWorkspace}
                onClick={() => pendingConfirmation.onConfirm()}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                {isBusyWorkspace ? 'Executing...' : 'Confirm & Execute'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Placement Control Bar */}
      {placementActive && (
        <div className="mb-2 flex flex-wrap items-center justify-center gap-2 p-2 bg-neutral-900/95 text-neutral-100 rounded-xl border border-emerald-500/50 shadow-2xl">
          <span className="text-[11px] font-bold text-emerald-400">
            Build Mode
          </span>
          <button
            onClick={onRotatePlacement}
            className="flex items-center gap-1 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-md border border-neutral-700"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Rotate
          </button>
          <button
            onClick={onConfirmPlacement}
            className="flex items-center gap-1 px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-md"
          >
            <Check className="w-3.5 h-3.5" />
            Place
          </button>
          <button
            onClick={onCancelPlacement}
            className="flex items-center gap-1 px-2.5 py-1 bg-neutral-800 hover:bg-rose-900/50 text-rose-300 text-xs font-semibold rounded-md border border-neutral-700"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
        </div>
      )}

      {/* Main Dock Container */}
      <div className="bg-neutral-900/95 text-neutral-100 rounded-2xl border border-neutral-800 shadow-2xl overflow-hidden">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-3 py-1 bg-neutral-950/90 border-b border-neutral-800/80 text-xs text-neutral-400">
          <div className="flex items-center gap-2 truncate">
            <span className="font-mono text-[10px] sm:text-[11px] font-bold text-amber-500 truncate">
              {UNIFIED_PROJECT_NAME.toUpperCase()}
            </span>
            <span className="hidden md:inline text-neutral-600">|</span>
            <span className="hidden md:inline text-[10px] text-neutral-400">
              8K Unified Character · Expanding World Map [M] · Missions &amp; Directives
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {activeTab !== 'none' && (
              <button
                onClick={() => setActiveTab('none')}
                className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-white px-1.5 py-0.5 rounded bg-neutral-800"
              >
                <X className="w-3 h-3" />
                <span>Close Panel</span>
              </button>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="flex items-center gap-1 text-[10px] sm:text-[11px] hover:text-white transition py-0.5 px-2 rounded hover:bg-neutral-800"
            >
              {isCollapsed ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                  <span>Expand</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Minimize</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Expandable Bottom-Sheet Drawer Content */}
        {!isCollapsed && activeTab !== 'none' && (
          <div className="p-3 sm:p-4 bg-neutral-900/98 border-b border-neutral-800 max-h-[54vh] sm:max-h-96 overflow-y-auto">
            {/* MISSIONS & DIRECTIVES TAB */}
            {activeTab === 'missions' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                      Campaign Missions, Cartography &amp; Frontier Directives
                    </h3>
                    <p className="text-xs text-neutral-400">
                      Complete objectives to earn Rank XP, survival gear, and expand the known world map.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        onOpenWorldMap();
                        setActiveTab('none');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-amber-300 flex items-center gap-1.5 border border-neutral-700"
                    >
                      <Compass className="w-3.5 h-3.5" />
                      <span>Open World Map [M]</span>
                    </button>
                    <button
                      onClick={onRequestNewDirective}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>New Directive Bounty</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {missions.map((mission) => (
                    <div
                      key={mission.id}
                      className={`p-3 rounded-xl border flex flex-col justify-between ${
                        mission.status === 'completed'
                          ? 'bg-emerald-950/20 border-emerald-500/40'
                          : 'bg-neutral-950/80 border-neutral-800'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-mono uppercase text-amber-400">
                            {mission.chapter} · {mission.giver}
                          </span>
                          <span
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                              mission.status === 'completed'
                                ? 'bg-emerald-900/60 text-emerald-300'
                                : 'bg-amber-900/50 text-amber-300'
                            }`}
                          >
                            {mission.status}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-white mb-1">
                          {mission.title}
                        </h4>
                        <p className="text-[11px] text-neutral-400 mb-2">
                          {mission.description}
                        </p>

                        <div className="space-y-1 mb-2">
                          {mission.objectives.map((obj) => (
                            <div
                              key={obj.id}
                              className="flex items-center justify-between text-[11px] bg-neutral-900/80 px-2 py-1 rounded border border-neutral-800/80"
                            >
                              <span
                                className={`flex items-center gap-1.5 ${
                                  obj.done
                                    ? 'line-through text-neutral-500'
                                    : 'text-neutral-200'
                                }`}
                              >
                                {obj.done ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                ) : (
                                  <Circle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                )}
                                <span>{obj.text}</span>
                              </span>
                              <span className="font-mono text-amber-400 font-bold ml-2">
                                {obj.current}/{obj.target}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-neutral-800/80 text-[11px]">
                        <span className="font-mono text-emerald-400">
                          Reward: +{mission.rewardXP} XP
                        </span>
                        {mission.targetWaypoint && mission.status === 'active' && (
                          <button
                            onClick={() => {
                              onTrackWaypoint({
                                x: mission.targetWaypoint!.x,
                                z: mission.targetWaypoint!.z,
                                label: mission.targetWaypoint!.label,
                                color: '#f59e0b',
                              });
                              setActiveTab('none');
                            }}
                            className="px-2.5 py-1 rounded bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white font-bold flex items-center gap-1 transition"
                          >
                            <Navigation className="w-3 h-3" />
                            <span>Track 3D Waypoint</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* INVENTORY TAB */}
            {activeTab === 'inventory' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                    Backpack Inventory (24 Slots)
                  </h3>
                  <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
                    {inventory.map((item, idx) => (
                      <div
                        key={`inv_${idx}`}
                        onClick={() =>
                          item &&
                          setSelectedItemDetail({
                            item,
                            index: idx,
                            isHotbar: false,
                          })
                        }
                        className={`aspect-square p-1 rounded-lg border flex flex-col items-center justify-between cursor-pointer transition ${
                          item
                            ? selectedItemDetail?.index === idx &&
                              !selectedItemDetail.isHotbar
                              ? 'border-amber-400 bg-amber-950/30'
                              : 'border-neutral-700 bg-neutral-800/80 hover:border-neutral-500'
                            : 'border-neutral-800 bg-neutral-900/50'
                        }`}
                      >
                        {item ? (
                          <>
                            <span className="text-lg sm:text-2xl mt-0.5">
                              {item.icon}
                            </span>
                            <span className="text-[9px] sm:text-[10px] font-mono font-bold text-neutral-300">
                              x{item.count}
                            </span>
                          </>
                        ) : (
                          <span className="text-[9px] text-neutral-700 font-mono mt-auto">
                            {idx + 1}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-neutral-950/70 rounded-xl border border-neutral-800 flex flex-col justify-between">
                  {selectedItemDetail?.item ? (
                    <div>
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-neutral-800">
                        <span className="text-3xl">
                          {selectedItemDetail.item.icon}
                        </span>
                        <div>
                          <h4 className="text-sm font-bold text-amber-300">
                            {selectedItemDetail.item.name}
                          </h4>
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                            {selectedItemDetail.item.category} ·{' '}
                            {selectedItemDetail.item.rarity}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-neutral-300 mb-3 leading-relaxed">
                        {selectedItemDetail.item.description}
                      </p>

                      <div className="flex items-center gap-2 pt-2 border-t border-neutral-800">
                        <button
                          onClick={() => {
                            onUseItem(
                              selectedItemDetail.item,
                              selectedItemDetail.index,
                              selectedItemDetail.isHotbar
                            );
                            setSelectedItemDetail(null);
                          }}
                          className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-md transition"
                        >
                          Use / Equip Item
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-center text-xs text-neutral-500 py-4">
                      Tap any slot to inspect survival stats or consume items.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CRAFTING TAB */}
            {activeTab === 'crafting' && (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Field Crafting &amp; Blueprints
                  </h3>
                  <div className="flex items-center gap-1 text-[11px] overflow-x-auto">
                    {(
                      [
                        'all',
                        'tools',
                        'survival',
                        'building',
                        'armor',
                        'advanced',
                      ] as const
                    ).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCraftingCategory(cat)}
                        className={`px-2 py-1 rounded capitalize transition ${
                          craftingCategory === cat
                            ? 'bg-amber-500/30 text-amber-300 font-bold'
                            : 'text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {CRAFTING_RECIPES.filter(
                    (r) =>
                      craftingCategory === 'all' ||
                      r.category === craftingCategory
                  ).map((recipe) => {
                    const resultItem = ITEM_CATALOG[recipe.resultItemId];
                    const canCraft = checkHasIngredients(recipe);

                    return (
                      <div
                        key={recipe.id}
                        className="p-2.5 bg-neutral-950/70 border border-neutral-800 rounded-xl flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-2xl">
                              {resultItem?.icon || '📦'}
                            </span>
                            <div>
                              <h4 className="text-xs font-bold text-neutral-100">
                                {recipe.name}
                              </h4>
                              <span className="text-[10px] text-neutral-500 capitalize">
                                {recipe.category}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-0.5 text-[11px] font-mono mb-2">
                            {recipe.ingredients.map((ing) => {
                              const have = getAvailableCount(ing.itemId);
                              const reqItem = ITEM_CATALOG[ing.itemId];
                              const met = have >= ing.count;

                              return (
                                <div
                                  key={ing.itemId}
                                  className={`flex justify-between ${
                                    met ? 'text-emerald-400' : 'text-rose-400'
                                  }`}
                                >
                                  <span>{reqItem?.name || ing.itemId}:</span>
                                  <span>
                                    {have}/{ing.count}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <button
                          disabled={!canCraft}
                          onClick={() => onCraftRecipe(recipe)}
                          className={`w-full py-1.5 rounded-lg text-xs font-bold transition ${
                            canCraft
                              ? 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer'
                              : 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
                          }`}
                        >
                          {canCraft ? 'Craft Recipe' : 'Missing Resources'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* BASE BUILDING TAB */}
            {activeTab === 'building' && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                  Modular Outpost Construction
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {[
                    {
                      type: 'foundation_wood',
                      name: 'Timber Foundation',
                      cost: '12 Wood',
                      icon: '🪵',
                    },
                    {
                      type: 'wall_log',
                      name: 'Fortified Log Wall',
                      cost: '10 Wood, 4 Fiber',
                      icon: '🧱',
                    },
                    {
                      type: 'door_wood',
                      name: 'Reinforced Doorway',
                      cost: '8 Wood, 4 Stone',
                      icon: '🚪',
                    },
                    {
                      type: 'workbench',
                      name: 'Master Craft Table',
                      cost: '15 Wood, 10 Stone',
                      icon: '🛠️',
                    },
                    {
                      type: 'campfire',
                      name: 'Hearth Campfire',
                      cost: '10 Wood, 8 Stone',
                      icon: '🔥',
                    },
                    {
                      type: 'storage_crate',
                      name: 'Storage Crate',
                      cost: '12 Wood, 4 Stone',
                      icon: '📦',
                    },
                    {
                      type: 'water_collector',
                      name: 'Dew Purifier',
                      cost: '8 Wood, 6 Stone',
                      icon: '🚰',
                    },
                    {
                      type: 'watchtower',
                      name: 'Watchtower',
                      cost: '20 Wood, 10 Stone',
                      icon: '🗼',
                    },
                    {
                      type: 'cot_bedroll',
                      name: 'Fur Bedroll',
                      cost: '6 Wood, 1 Pelt',
                      icon: '🛏️',
                    },
                  ].map((item) => (
                    <button
                      key={item.type}
                      onClick={() => {
                        onStartPlacement(item.type as PlacedStructure['type']);
                        setActiveTab('none');
                      }}
                      className="p-2.5 bg-neutral-950/70 hover:bg-neutral-800/80 border border-neutral-800 hover:border-amber-500/50 rounded-xl flex flex-col items-center text-center transition"
                    >
                      <span className="text-2xl mb-1">{item.icon}</span>
                      <span className="text-xs font-bold text-neutral-200">
                        {item.name}
                      </span>
                      <span className="text-[10px] font-mono text-amber-400/90 mt-0.5">
                        {item.cost}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* SKILLS TAB */}
            {activeTab === 'skills' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Survival Masteries
                  </h3>
                  <span className="text-xs font-mono text-amber-400">
                    Rank {playerLevel} Survivor
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    {
                      key: 'woodcraft',
                      name: 'Woodcraft & Forestry',
                      desc: 'Increases timber yield and structural durability.',
                      icon: '🪓',
                    },
                    {
                      key: 'mining',
                      name: 'Mining & Metallurgy',
                      desc: 'Accelerates pickaxe strikes and rare ore yields.',
                      icon: '⛏️',
                    },
                    {
                      key: 'foraging',
                      name: 'Botany & Foraging',
                      desc: 'Boosts medicinal herb potency and harvest abundance.',
                      icon: '🌿',
                    },
                    {
                      key: 'combat',
                      name: 'Combat & Marksmanship',
                      desc: 'Empowers melee critical strikes and bow velocity.',
                      icon: '⚔️',
                    },
                    {
                      key: 'engineering',
                      name: 'Survival Engineering',
                      desc: 'Unlocks advanced automation and base defenses.',
                      icon: '⚙️',
                    },
                    {
                      key: 'diplomacy',
                      name: 'Charisma & Diplomacy',
                      desc: 'Accelerates NPC affinity and romantic intimacy.',
                      icon: '🗣️',
                    },
                  ].map((skill) => {
                    const level = skills[skill.key as keyof PlayerSkills];
                    return (
                      <div
                        key={skill.key}
                        className="p-2.5 bg-neutral-950/70 border border-neutral-800 rounded-xl"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{skill.icon}</span>
                            <div>
                              <h4 className="text-xs font-bold text-neutral-200">
                                {skill.name}
                              </h4>
                              <span className="text-[10px] text-neutral-500">
                                {skill.desc}
                              </span>
                            </div>
                          </div>
                          <span className="text-xs font-mono font-bold text-amber-400">
                            LVL {level}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* NPCS TAB */}
            {activeTab === 'npcs' && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                  Settlement Companions &amp; Intimate Relationships
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {Object.values(npcs).map((npc) => (
                    <div
                      key={npc.id}
                      className="p-3 bg-neutral-950/70 border border-neutral-800 rounded-xl flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-neutral-800">
                          <div>
                            <h4 className="text-xs font-bold text-neutral-100">
                              {npc.name}
                            </h4>
                            <span className="text-[10px] text-neutral-400">
                              {npc.title}
                            </span>
                          </div>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-neutral-800 text-amber-300">
                            {npc.romanceStage}
                          </span>
                        </div>
                        <div className="flex justify-between text-[11px] font-mono text-neutral-400 mb-1">
                          <span>Affinity: {npc.affinity}/100</span>
                          <span className="text-purple-400">
                            Intimacy: {npc.intimacyLevel}%
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          onOpenNPCDialogue(npc);
                          setActiveTab('none');
                        }}
                        className="w-full mt-2 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
                      >
                        <Heart className="w-3.5 h-3.5 text-rose-400" />
                        Speak with {npc.name.split(' ')[0]}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SEASON PASS TAB */}
            {activeTab === 'season_pass' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Outcast Pass · Season 1: Frostfall &amp; Embers
                  </h3>
                  <button
                    onClick={() => setIsPremiumPass(!isPremiumPass)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold border bg-amber-500/20 border-amber-500 text-amber-300 flex items-center gap-1"
                  >
                    <Crown className="w-3.5 h-3.5" />
                    <span>
                      {isPremiumPass ? 'Premium Active' : 'Activate Premium'}
                    </span>
                  </button>
                </div>
                <div className="space-y-2">
                  {SEASON_PASS_REWARDS.map((reward) => {
                    const isUnlocked =
                      playerXp >= reward.requiredXp ||
                      playerLevel >= reward.tier;
                    const isClaimed = claimedTiers.includes(reward.tier);
                    return (
                      <div
                        key={reward.tier}
                        className="p-2.5 rounded-xl border bg-neutral-950/80 border-neutral-800 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-mono font-bold text-amber-400">
                            T{reward.tier}
                          </span>
                          <span className="text-xs font-bold text-neutral-200">
                            {reward.freeReward.icon} {reward.freeReward.title}
                          </span>
                        </div>
                        <button
                          disabled={!isUnlocked || isClaimed}
                          onClick={() => claimTier(reward.tier)}
                          className={`px-2.5 py-1 rounded text-xs font-bold ${
                            isClaimed
                              ? 'bg-neutral-800 text-neutral-500'
                              : isUnlocked
                              ? 'bg-emerald-600 text-white'
                              : 'bg-neutral-800 text-neutral-600'
                          }`}
                        >
                          {isClaimed
                            ? 'Claimed'
                            : isUnlocked
                            ? 'Claim'
                            : 'Locked'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 8K GRAPHICS & REALISM PIPELINE TAB */}
            {activeTab === 'graphics' && (
              <div className="max-w-3xl mx-auto space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                      8K Native Ultra &amp; Unreal Engine 5 Rendering Pipeline
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                    16x Anisotropic · 4096 Shadow · FidelityFX CAS
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <button
                    onClick={() => onApplyGraphicsPreset('8k_ultra')}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                      graphicsConfig.preset === '8k_ultra'
                        ? 'bg-fuchsia-950/50 border-fuchsia-400 shadow-[0_0_15px_rgba(232,121,249,0.25)]'
                        : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-600'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-fuchsia-300">
                          8K Native Ultra
                        </span>
                        <Zap className="w-3.5 h-3.5 text-fuchsia-400" />
                      </div>
                      <p className="text-[10px] text-neutral-400 leading-snug">
                        2.0x Supersampling, FidelityFX CAS 0.92, 1024px 16x PBR micro-maps &amp; 4K shadows.
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-fuchsia-400 mt-2 font-bold">
                      {graphicsConfig.preset === '8k_ultra'
                        ? '● ACTIVE 8K'
                        : 'Activate 8K'}
                    </span>
                  </button>

                  <button
                    onClick={() => onApplyGraphicsPreset('unreal5')}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                      graphicsConfig.preset === 'unreal5'
                        ? 'bg-cyan-950/40 border-cyan-400'
                        : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-600'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-cyan-300 block mb-1">
                        Unreal Engine 5
                      </span>
                      <p className="text-[10px] text-neutral-400 leading-snug">
                        Lumen GI simulation, ACES Filmic tone mapping, HDR Bloom &amp; CAS 0.65.
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-400 mt-2 font-bold">
                      {graphicsConfig.preset === 'unreal5'
                        ? '● ACTIVE'
                        : 'Select'}
                    </span>
                  </button>

                  <button
                    onClick={() => onApplyGraphicsPreset('unity_hdrp')}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                      graphicsConfig.preset === 'unity_hdrp'
                        ? 'bg-amber-950/40 border-amber-400'
                        : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-600'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-amber-300 block mb-1">
                        Unity HDRP
                      </span>
                      <p className="text-[10px] text-neutral-400 leading-snug">
                        Crisp PBR physical lighting, subtle bloom, balanced mobile &amp; desktop frame pacing.
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-amber-400 mt-2 font-bold">
                      {graphicsConfig.preset === 'unity_hdrp'
                        ? '● ACTIVE'
                        : 'Select'}
                    </span>
                  </button>

                  <button
                    onClick={() => onApplyGraphicsPreset('performance')}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                      graphicsConfig.preset === 'performance'
                        ? 'bg-emerald-950/40 border-emerald-400'
                        : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-600'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-emerald-300 block mb-1">
                        Mobile 120FPS
                      </span>
                      <p className="text-[10px] text-neutral-400 leading-snug">
                        Zero post-processing overhead for battery-saving handheld play.
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 mt-2 font-bold">
                      {graphicsConfig.preset === 'performance'
                        ? '● ACTIVE'
                        : 'Select'}
                    </span>
                  </button>
                </div>

                <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="flex justify-between text-neutral-300 mb-1 font-mono text-[11px]">
                      <span>8K FidelityFX CAS Sharpness:</span>
                      <span className="text-fuchsia-400">
                        {(graphicsConfig.casSharpness ?? 0.85).toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1.0"
                      step="0.05"
                      value={graphicsConfig.casSharpness ?? 0.85}
                      onChange={(e) =>
                        onUpdateGraphicsConfig({
                          casSharpness: parseFloat(e.target.value),
                        })
                      }
                      className="w-full accent-fuchsia-400 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-neutral-300 mb-1 font-mono text-[11px]">
                      <span>8K Supersampling Scale:</span>
                      <span className="text-fuchsia-400">
                        {(graphicsConfig.renderScale ?? 1.5).toFixed(2)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1.0"
                      max="2.0"
                      step="0.25"
                      value={graphicsConfig.renderScale ?? 1.5}
                      onChange={(e) =>
                        onUpdateGraphicsConfig({
                          renderScale: parseFloat(e.target.value),
                        })
                      }
                      className="w-full accent-fuchsia-400 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-neutral-300 mb-1 font-mono text-[11px]">
                      <span>HDR Bloom Strength:</span>
                      <span className="text-cyan-400">
                        {graphicsConfig.bloomStrength.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1.5"
                      step="0.05"
                      value={graphicsConfig.bloomStrength}
                      onChange={(e) =>
                        onUpdateGraphicsConfig({
                          bloomStrength: parseFloat(e.target.value),
                        })
                      }
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-neutral-300 mb-1 font-mono text-[11px]">
                      <span>Filmic Vignette Darkness:</span>
                      <span className="text-cyan-400">
                        {graphicsConfig.vignetteDarkness.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="2.0"
                      step="0.1"
                      value={graphicsConfig.vignetteDarkness}
                      onChange={(e) =>
                        onUpdateGraphicsConfig({
                          vignetteDarkness: parseFloat(e.target.value),
                        })
                      }
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* CLOUD SQL, FIREBASE, GOOGLE WORKSPACE & ADMIN HUB */}
            {activeTab === 'cloud_save' && (
              <div className="max-w-3xl mx-auto space-y-3">
                <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-400">
                        {UNIFIED_PROJECT_NAME}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300">
                        agile-gear-q3rp2 · us-east1
                      </span>
                      {isUserAdmin && (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                          PROJECT ADMIN
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      {currentUser
                        ? `Authenticated as ${currentUser.email} (Firebase + Cloud SQL + Google Workspace)`
                        : 'Sign in with Google to sync Cloud SQL, Firestore, Google Docs Chronicles & Gmail Dispatches.'}
                    </p>
                  </div>

                  {currentUser ? (
                    <button
                      onClick={onGoogleSignOut}
                      className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 flex items-center gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-400" />
                      <span>Sign Out</span>
                    </button>
                  ) : (
                    <button
                      onClick={onGoogleSignIn}
                      className="px-3.5 py-2 rounded-lg bg-white hover:bg-neutral-100 text-neutral-900 font-bold text-xs flex items-center gap-2 shadow transition cursor-pointer"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 48 48">
                        <path
                          fill="#EA4335"
                          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                        />
                        <path
                          fill="#4285F4"
                          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                        />
                        <path
                          fill="#34A853"
                          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                        />
                      </svg>
                      <span>Sign in with Google</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  <button
                    onClick={() => setCloudSubTab('saves')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                      cloudSubTab === 'saves'
                        ? 'bg-amber-600 text-white'
                        : 'bg-neutral-800 text-neutral-300 hover:text-white'
                    }`}
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>Cloud SQL &amp; Firestore Saves</span>
                  </button>

                  <button
                    onClick={() => {
                      setCloudSubTab('docs');
                      if (currentUser && docsList.length === 0) {
                        handleLoadGoogleDocs();
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                      cloudSubTab === 'docs'
                        ? 'bg-blue-600 text-white'
                        : 'bg-neutral-800 text-neutral-300 hover:text-white'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Google Docs Chronicles</span>
                  </button>

                  <button
                    onClick={() => {
                      setCloudSubTab('gmail');
                      if (currentUser && gmailList.length === 0) {
                        handleLoadGmail();
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                      cloudSubTab === 'gmail'
                        ? 'bg-rose-600 text-white'
                        : 'bg-neutral-800 text-neutral-300 hover:text-white'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Gmail Outcast Dispatches</span>
                  </button>

                  <button
                    onClick={() => {
                      setCloudSubTab('admin');
                      if (currentUser) {
                        fetchAdminDirectory();
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                      cloudSubTab === 'admin'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-neutral-800 text-neutral-300 hover:text-white'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Project Admin Directory</span>
                  </button>
                </div>

                {cloudSubTab === 'saves' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        onClick={onSaveGame}
                        className="p-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition"
                      >
                        <CloudUpload className="w-4 h-4" />
                        Sync Save to Cloud SQL &amp; Firestore
                      </button>
                      <button
                        onClick={onLoadGame}
                        className="p-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition"
                      >
                        <RotateCw className="w-4 h-4" />
                        Load Latest Cloud Save
                      </button>
                    </div>

                    <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2">
                      <h4 className="text-xs font-bold text-neutral-300">
                        Cross-Platform Save JSON Export / Import
                      </h4>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={onExportSave}
                          className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs rounded-md text-neutral-200"
                        >
                          Copy Save JSON
                        </button>
                        <input
                          type="text"
                          placeholder="Paste Save State JSON here..."
                          value={importInput}
                          onChange={(e) => setImportInput(e.target.value)}
                          className="flex-1 px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-md text-xs font-mono text-neutral-300"
                        />
                        <button
                          onClick={() => {
                            if (importInput.trim()) {
                              onImportSave(importInput);
                              setImportInput('');
                            }
                          }}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-xs rounded-md text-white font-bold"
                        >
                          Import
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {cloudSubTab === 'docs' && (
                  <div className="space-y-3">
                    <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-blue-400">
                          Export Live Survivor Chronicle to Google Docs
                        </h4>
                        <button
                          onClick={handleLoadGoogleDocs}
                          disabled={isBusyWorkspace}
                          className="text-[11px] text-neutral-300 hover:text-white flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-800"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Refresh Docs</span>
                        </button>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={docTitle}
                          onChange={(e) => setDocTitle(e.target.value)}
                          className="flex-1 px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-neutral-200"
                          placeholder="Document Title..."
                        />
                        <button
                          onClick={promptCreateGoogleDoc}
                          disabled={isBusyWorkspace}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Create Google Doc</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {docsList.map((d) => (
                        <div
                          key={d.id}
                          className="p-2.5 bg-neutral-950/80 border border-neutral-800 rounded-lg flex items-center justify-between"
                        >
                          <div className="truncate pr-2">
                            <div className="text-xs font-bold text-neutral-200 truncate">
                              {d.name}
                            </div>
                            <div className="text-[10px] text-neutral-500 font-mono">
                              ID: {d.id.slice(0, 12)}...
                            </div>
                          </div>
                          {d.webViewLink && (
                            <a
                              href={d.webViewLink}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-blue-400 text-[10px] font-bold flex items-center gap-1 shrink-0"
                            >
                              <span>Open</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      ))}
                      {docsList.length === 0 && (
                        <div className="col-span-2 text-center py-3 text-xs text-neutral-500">
                          Click &ldquo;Refresh Docs&rdquo; or &ldquo;Create Google Doc&rdquo; to sync your survival chronicles with Google Drive &amp; Cloud SQL.
                        </div>
                      )}
                    </div>

                    {sqlLogs.length > 0 && (
                      <div className="p-2.5 bg-neutral-950 rounded-xl border border-neutral-800">
                        <div className="text-[10px] font-mono uppercase text-neutral-400 mb-1.5">
                          Cloud SQL Logged Chronicles ({sqlLogs.length})
                        </div>
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                          {sqlLogs.map((log) => (
                            <div
                              key={log.id}
                              className="text-[11px] flex justify-between text-neutral-300 border-b border-neutral-900 pb-1"
                            >
                              <span className="truncate">{log.title}</span>
                              <span className="font-mono text-amber-400 shrink-0 ml-2">
                                {log.summary}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {cloudSubTab === 'gmail' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2">
                      <h4 className="text-xs font-bold text-rose-400">
                        Send Outcast Survival Dispatch (Gmail)
                      </h4>
                      <input
                        type="email"
                        value={emailTo}
                        onChange={(e) => setEmailTo(e.target.value)}
                        placeholder="Recipient email..."
                        className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded text-xs text-neutral-200"
                      />
                      <input
                        type="text"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        placeholder="Subject..."
                        className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded text-xs text-neutral-200"
                      />
                      <textarea
                        rows={3}
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded text-xs text-neutral-200 font-mono"
                      />
                      <button
                        onClick={promptSendGmail}
                        disabled={isBusyWorkspace}
                        className="w-full py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Review &amp; Send Gmail Dispatch</span>
                      </button>
                    </div>

                    <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-neutral-300">
                          Recent Gmail Inbox Dispatches
                        </h4>
                        <button
                          onClick={handleLoadGmail}
                          disabled={isBusyWorkspace}
                          className="text-[11px] text-neutral-300 hover:text-white flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-800"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Sync Inbox</span>
                        </button>
                      </div>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {gmailList.map((m) => (
                          <div
                            key={m.id}
                            className="p-2 rounded bg-neutral-900/90 border border-neutral-800 text-[11px]"
                          >
                            <div className="font-bold text-neutral-200 truncate">
                              {m.subject}
                            </div>
                            <div className="text-[10px] text-neutral-400 truncate">
                              From: {m.from}
                            </div>
                            <div className="text-[10px] text-neutral-500 line-clamp-1 mt-0.5">
                              {m.snippet}
                            </div>
                          </div>
                        ))}
                        {gmailList.length === 0 && (
                          <div className="text-center py-6 text-xs text-neutral-500">
                            Tap &ldquo;Sync Inbox&rdquo; to read recent Gmail messages.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {cloudSubTab === 'admin' && (
                  <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-emerald-400">
                          Unified Project Administrators &amp; Cloud SQL Directory
                        </h4>
                        <p className="text-[11px] text-neutral-400">
                          Designated Project Admin:{' '}
                          <span className="font-mono text-amber-300">
                            new.dawn.industries2026@gmail.com
                          </span>{' '}
                          · Unified Name:{' '}
                          <span className="font-semibold text-white">
                            {UNIFIED_PROJECT_NAME}
                          </span>
                        </p>
                      </div>
                      <button
                        onClick={fetchAdminDirectory}
                        disabled={isBusyWorkspace}
                        className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Refresh</span>
                      </button>
                    </div>

                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {adminUsers.map((u) => (
                        <div
                          key={u.uid}
                          className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-neutral-100">
                              {u.displayName || u.email}
                            </span>
                            <span className="text-neutral-400 font-mono text-[11px] ml-2">
                              {u.email}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-neutral-400">
                              {u.unifiedProjectName}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                                u.role === 'admin'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-neutral-800 text-neutral-300'
                              }`}
                            >
                              {u.role}
                            </span>
                          </div>
                        </div>
                      ))}
                      {adminUsers.length === 0 && (
                        <div className="text-center py-4 text-xs text-neutral-400">
                          Pre-seeded Project Admin:{' '}
                          <span className="font-mono text-emerald-400">
                            new.dawn.industries2026@gmail.com (role: admin)
                          </span>
                          . Sign in with an admin account and tap Refresh to inspect all Cloud SQL records.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bottom Bar: 6-Slot Hotbar + Quick Use Button + Scrollable Mobile Navigation Tabs */}
        {!isCollapsed && (
          <div className="p-1.5 sm:p-2 flex flex-col md:flex-row items-center justify-between gap-2 bg-neutral-950/95">
            {/* Hotbar Slots + Mobile Quick-Use Button */}
            <div className="flex items-center gap-1 sm:gap-1.5 w-full md:w-auto justify-center">
              {hotbar.map((item, index) => (
                <div
                  key={`hotbar_${index}`}
                  onClick={() => onSelectHotbar(index)}
                  className={`w-10 h-10 sm:w-11 sm:h-11 p-1 rounded-lg border flex flex-col items-center justify-between cursor-pointer transition shrink-0 ${
                    selectedHotbarIndex === index
                      ? 'border-amber-400 bg-amber-950/40 shadow-[0_0_10px_rgba(251,191,36,0.25)]'
                      : item
                      ? 'border-neutral-700 bg-neutral-800/80 hover:border-neutral-500'
                      : 'border-neutral-800 bg-neutral-900/60'
                  }`}
                >
                  <div className="w-full flex justify-between text-[8px] sm:text-[9px] font-mono text-neutral-400 leading-none">
                    <span>{index + 1}</span>
                  </div>
                  {item ? (
                    <>
                      <span className="text-base sm:text-xl leading-none">
                        {item.icon}
                      </span>
                      <span className="text-[9px] sm:text-[10px] font-mono font-bold text-neutral-200 leading-none">
                        x{item.count}
                      </span>
                    </>
                  ) : null}
                </div>
              ))}

              {activeHotbarItem && (
                <button
                  onClick={() =>
                    onUseItem(activeHotbarItem, selectedHotbarIndex, true)
                  }
                  className="px-2.5 h-10 sm:h-11 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] shrink-0 transition shadow"
                  title={`Use ${activeHotbarItem.name}`}
                >
                  Use
                </button>
              )}
            </div>

            {/* Horizontally Scrollable Navigation Tabs for Mobile & Desktop */}
            <div className="flex items-center gap-1 text-xs w-full md:w-auto overflow-x-auto pb-0.5 md:pb-0 justify-start md:justify-end">
              <button
                onClick={onOpenWorldMap}
                className="flex items-center gap-1 px-2.5 py-2 sm:py-1.5 rounded-lg border bg-neutral-800/90 border-amber-500/40 text-amber-300 hover:text-white shrink-0 transition"
              >
                <Compass className="w-3.5 h-3.5" />
                <span className="text-[11px]">Map</span>
              </button>

              <button
                onClick={() => handleTabClick('missions')}
                className={`flex items-center gap-1 px-2.5 py-2 sm:py-1.5 rounded-lg border shrink-0 transition ${
                  activeTab === 'missions'
                    ? 'bg-amber-600 border-amber-500 text-white font-bold'
                    : 'bg-neutral-800/90 border-neutral-700 text-neutral-300 hover:text-white'
                }`}
              >
                <Target className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px]">Missions</span>
              </button>

              <button
                onClick={() => handleTabClick('inventory')}
                className={`flex items-center gap-1 px-2.5 py-2 sm:py-1.5 rounded-lg border shrink-0 transition ${
                  activeTab === 'inventory'
                    ? 'bg-amber-600 border-amber-500 text-white font-bold'
                    : 'bg-neutral-800/90 border-neutral-700 text-neutral-300 hover:text-white'
                }`}
              >
                <Backpack className="w-3.5 h-3.5" />
                <span className="text-[11px]">Bag</span>
              </button>

              <button
                onClick={() => handleTabClick('crafting')}
                className={`flex items-center gap-1 px-2.5 py-2 sm:py-1.5 rounded-lg border shrink-0 transition ${
                  activeTab === 'crafting'
                    ? 'bg-amber-600 border-amber-500 text-white font-bold'
                    : 'bg-neutral-800/90 border-neutral-700 text-neutral-300 hover:text-white'
                }`}
              >
                <Hammer className="w-3.5 h-3.5" />
                <span className="text-[11px]">Craft</span>
              </button>

              <button
                onClick={() => handleTabClick('building')}
                className={`flex items-center gap-1 px-2.5 py-2 sm:py-1.5 rounded-lg border shrink-0 transition ${
                  activeTab === 'building'
                    ? 'bg-amber-600 border-amber-500 text-white font-bold'
                    : 'bg-neutral-800/90 border-neutral-700 text-neutral-300 hover:text-white'
                }`}
              >
                <Home className="w-3.5 h-3.5" />
                <span className="text-[11px]">Build</span>
              </button>

              <button
                onClick={() => handleTabClick('skills')}
                className={`flex items-center gap-1 px-2.5 py-2 sm:py-1.5 rounded-lg border shrink-0 transition ${
                  activeTab === 'skills'
                    ? 'bg-amber-600 border-amber-500 text-white font-bold'
                    : 'bg-neutral-800/90 border-neutral-700 text-neutral-300 hover:text-white'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span className="text-[11px]">Skills</span>
              </button>

              <button
                onClick={() => handleTabClick('npcs')}
                className={`flex items-center gap-1 px-2.5 py-2 sm:py-1.5 rounded-lg border shrink-0 transition ${
                  activeTab === 'npcs'
                    ? 'bg-amber-600 border-amber-500 text-white font-bold'
                    : 'bg-neutral-800/90 border-neutral-700 text-neutral-300 hover:text-white'
                }`}
              >
                <Heart className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-[11px]">NPCs</span>
              </button>

              <button
                onClick={() => handleTabClick('graphics')}
                className={`flex items-center gap-1 px-2.5 py-2 sm:py-1.5 rounded-lg border shrink-0 transition ${
                  activeTab === 'graphics'
                    ? 'bg-fuchsia-600 border-fuchsia-400 text-white font-bold'
                    : 'bg-neutral-800/90 border-neutral-700 text-fuchsia-300 hover:text-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span className="text-[11px]">8K Engine</span>
              </button>

              <button
                onClick={() => handleTabClick('cloud_save')}
                className={`flex items-center gap-1 px-2.5 py-2 sm:py-1.5 rounded-lg border shrink-0 transition ${
                  activeTab === 'cloud_save'
                    ? 'bg-amber-600 border-amber-500 text-white font-bold'
                    : 'bg-neutral-800/90 border-neutral-700 text-neutral-300 hover:text-white'
                }`}
              >
                <CloudUpload className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px]">Cloud &amp; Google</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

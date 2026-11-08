import React, { useState } from 'react';
import {
  Item,
  CraftingRecipe,
  PlacedStructure,
  PlayerSkills,
  NPCData,
  SeasonPassReward,
} from '../types/game';
import {
  CRAFTING_RECIPES,
  ITEM_CATALOG,
  SEASON_PASS_REWARDS,
} from '../game/itemsData';
import { audioEngine } from '../game/audioEngine';
import { EngineGraphicsConfig } from '../game/postprocessing';
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
} from 'lucide-react';

interface BottomDockProps {
  hotbar: (Item | null)[];
  inventory: (Item | null)[];
  skills: PlayerSkills;
  npcs: Record<string, NPCData>;
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
  onApplyGraphicsPreset: (preset: 'unreal5' | 'unity_hdrp' | 'performance') => void;
  onUpdateGraphicsConfig: (config: Partial<EngineGraphicsConfig>) => void;
}

type TabType = 'none' | 'inventory' | 'crafting' | 'building' | 'skills' | 'npcs' | 'season_pass' | 'cloud_save' | 'graphics';

export const BottomDock: React.FC<BottomDockProps> = ({
  hotbar,
  inventory,
  skills,
  npcs,
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
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('none');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedItemDetail, setSelectedItemDetail] = useState<{ item: Item; index: number; isHotbar: boolean } | null>(null);
  const [isPremiumPass, setIsPremiumPass] = useState(false);
  const [claimedTiers, setClaimedTiers] = useState<number[]>([]);
  const [importInput, setImportInput] = useState('');
  const [craftingCategory, setCraftingCategory] = useState<'all' | 'tools' | 'survival' | 'building' | 'armor' | 'advanced'>('all');

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

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-30 w-full max-w-4xl px-4 select-none pointer-events-auto">
      {/* Placement Control Pill (Shown when actively positioning a structure) */}
      {placementActive && (
        <div className="mb-2 flex items-center justify-center gap-3 p-2 bg-neutral-900/95 text-neutral-100 rounded-xl border border-emerald-500/50 shadow-2xl animate-fade-in">
          <span className="text-xs font-bold text-emerald-400">
            Hologram Placement Mode Active
          </span>
          <button
            onClick={onRotatePlacement}
            className="flex items-center gap-1 px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-md border border-neutral-700 transition"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Rotate (R)
          </button>
          <button
            onClick={onConfirmPlacement}
            className="flex items-center gap-1 px-3 py-1 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-md transition"
          >
            <Check className="w-3.5 h-3.5" />
            Place Structure [Click]
          </button>
          <button
            onClick={onCancelPlacement}
            className="flex items-center gap-1 px-3 py-1 bg-neutral-800 hover:bg-rose-900/50 text-rose-300 text-xs font-semibold rounded-md border border-neutral-700 transition"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
        </div>
      )}

      {/* Main Container */}
      <div className="bg-neutral-900/95 text-neutral-100 rounded-2xl border border-neutral-800 shadow-2xl overflow-hidden">
        {/* Collapse / Expand Zen Mode Toggle */}
        <div className="flex items-center justify-between px-4 py-1.5 bg-neutral-950/80 border-b border-neutral-800/80 text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-amber-500">AETHERIA SURVIVAL DOCK</span>
            <span className="text-neutral-600">|</span>
            <span className="text-[11px] text-neutral-400">1-6 Hotbar · C / Alt Dodge Roll · Space Jump · E Interact · F Action</span>
          </div>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-1 text-[11px] hover:text-white transition py-0.5 px-2 rounded hover:bg-neutral-800"
          >
            {isCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                <span>Show Controls (H)</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
                <span>Hide Controls (H)</span>
              </>
            )}
          </button>
        </div>

        {/* Expandable Tabs Body */}
        {!isCollapsed && activeTab !== 'none' && (
          <div className="p-4 bg-neutral-900/98 border-b border-neutral-800 max-h-96 overflow-y-auto">
            {/* INVENTORY TAB */}
            {activeTab === 'inventory' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                    Backpack Inventory (24 Slots)
                  </h3>
                  <div className="grid grid-cols-6 gap-2">
                    {inventory.map((item, idx) => (
                      <div
                        key={`inv_${idx}`}
                        onClick={() => item && setSelectedItemDetail({ item, index: idx, isHotbar: false })}
                        className={`aspect-square p-1.5 rounded-lg border flex flex-col items-center justify-between cursor-pointer transition ${
                          item
                            ? selectedItemDetail?.index === idx && !selectedItemDetail.isHotbar
                              ? 'border-amber-400 bg-amber-950/30'
                              : 'border-neutral-700 bg-neutral-800/80 hover:border-neutral-500'
                            : 'border-neutral-800 bg-neutral-900/50'
                        }`}
                      >
                        {item ? (
                          <>
                            <span className="text-2xl mt-1">{item.icon}</span>
                            <span className="text-[10px] font-mono font-bold text-neutral-300">
                              x{item.count}
                            </span>
                          </>
                        ) : (
                          <span className="text-[10px] text-neutral-700 font-mono mt-auto">{idx + 1}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Selected Item Detail Sidebar */}
                <div className="p-3 bg-neutral-950/70 rounded-xl border border-neutral-800 flex flex-col justify-between">
                  {selectedItemDetail?.item ? (
                    <div>
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-neutral-800">
                        <span className="text-3xl">{selectedItemDetail.item.icon}</span>
                        <div>
                          <h4 className="text-sm font-bold text-amber-300">
                            {selectedItemDetail.item.name}
                          </h4>
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                            {selectedItemDetail.item.category} · {selectedItemDetail.item.rarity}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-neutral-300 mb-3 leading-relaxed">
                        {selectedItemDetail.item.description}
                      </p>

                      {selectedItemDetail.item.stats && (
                        <div className="space-y-1 mb-3 text-xs font-mono text-neutral-400">
                          {selectedItemDetail.item.stats.damage && (
                            <div>Damage: +{selectedItemDetail.item.stats.damage}</div>
                          )}
                          {selectedItemDetail.item.stats.warmth && (
                            <div>Insulation Warmth: +{selectedItemDetail.item.stats.warmth}°C</div>
                          )}
                          {selectedItemDetail.item.stats.hungerHeal && (
                            <div>Nutrition: +{selectedItemDetail.item.stats.hungerHeal}%</div>
                          )}
                          {selectedItemDetail.item.stats.thirstHeal && (
                            <div>Hydration: +{selectedItemDetail.item.stats.thirstHeal}%</div>
                          )}
                          {selectedItemDetail.item.stats.healthHeal && (
                            <div>Health Restoration: +{selectedItemDetail.item.stats.healthHeal} HP</div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-2 border-t border-neutral-800">
                        <button
                          onClick={() => {
                            onUseItem(selectedItemDetail.item, selectedItemDetail.index, selectedItemDetail.isHotbar);
                            setSelectedItemDetail(null);
                          }}
                          className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-md transition"
                        >
                          Use / Consume
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-center text-xs text-neutral-500">
                      Select an item in your inventory to view survival properties and actions.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CRAFTING TAB */}
            {activeTab === 'crafting' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Field Crafting & Blueprint Recipes
                  </h3>
                  <div className="flex items-center gap-1 text-[11px]">
                    {(['all', 'tools', 'survival', 'building', 'armor', 'advanced'] as const).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCraftingCategory(cat)}
                        className={`px-2 py-0.5 rounded capitalize transition ${
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {CRAFTING_RECIPES.filter(
                    (r) => craftingCategory === 'all' || r.category === craftingCategory
                  ).map((recipe) => {
                    const resultItem = ITEM_CATALOG[recipe.resultItemId];
                    const canCraft = checkHasIngredients(recipe);

                    return (
                      <div
                        key={recipe.id}
                        className="p-3 bg-neutral-950/70 border border-neutral-800 rounded-xl flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-2xl">{resultItem?.icon || '📦'}</span>
                            <div>
                              <h4 className="text-xs font-bold text-neutral-100">{recipe.name}</h4>
                              <span className="text-[10px] text-neutral-500 capitalize">{recipe.category}</span>
                            </div>
                          </div>

                          <p className="text-[11px] text-neutral-400 mb-2 line-clamp-2">
                            {recipe.description}
                          </p>

                          {/* Requirements list */}
                          <div className="space-y-0.5 text-[11px] font-mono mb-3">
                            {recipe.ingredients.map((ing) => {
                              const have = getAvailableCount(ing.itemId);
                              const reqItem = ITEM_CATALOG[ing.itemId];
                              const met = have >= ing.count;

                              return (
                                <div
                                  key={ing.itemId}
                                  className={`flex justify-between ${met ? 'text-emerald-400' : 'text-rose-400'}`}
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
                  Survival Base Modular Construction
                </h3>
                <p className="text-xs text-neutral-400 mb-3">
                  Click any structure module to project a holographic placement preview into the world. Use [R] to rotate and [Left Click] to place.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {[
                    { type: 'foundation_wood', name: 'Timber Foundation', cost: '12 Wood', icon: '🪵' },
                    { type: 'wall_log', name: 'Fortified Log Wall', cost: '10 Wood, 4 Fiber', icon: '🧱' },
                    { type: 'door_wood', name: 'Reinforced Doorway', cost: '8 Wood, 4 Stone', icon: '🚪' },
                    { type: 'workbench', name: 'Master Craft Table', cost: '15 Wood, 10 Stone', icon: '🛠️' },
                    { type: 'campfire', name: 'Hearth Campfire', cost: '10 Wood, 8 Stone', icon: '🔥' },
                    { type: 'storage_crate', name: 'Storage Crate', cost: '12 Wood, 4 Stone', icon: '📦' },
                    { type: 'water_collector', name: 'Dew Purifier', cost: '8 Wood, 6 Stone', icon: '🚰' },
                    { type: 'watchtower', name: 'Watchtower', cost: '20 Wood, 10 Stone', icon: '🗼' },
                    { type: 'cot_bedroll', name: 'Fur Bedroll', cost: '6 Wood, 1 Pelt', icon: '🛏️' },
                  ].map((item) => (
                    <button
                      key={item.type}
                      onClick={() => onStartPlacement(item.type as PlacedStructure['type'])}
                      className="p-3 bg-neutral-950/70 hover:bg-neutral-800/80 border border-neutral-800 hover:border-amber-500/50 rounded-xl flex flex-col items-center text-center transition group"
                    >
                      <span className="text-3xl mb-1 group-hover:scale-110 transition">{item.icon}</span>
                      <span className="text-xs font-bold text-neutral-200">{item.name}</span>
                      <span className="text-[10px] font-mono text-amber-400/90 mt-1">{item.cost}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* SKILLS & PROGRESSION TAB */}
            {activeTab === 'skills' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Survival Masteries & Skill Tree
                  </h3>
                  <span className="text-xs font-mono text-amber-400">Rank {playerLevel} Survivor</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { key: 'woodcraft', name: 'Woodcraft & Forestry', desc: 'Increases timber yield, axe durability, and structural HP.', icon: '🪓' },
                    { key: 'mining', name: 'Mining & Metallurgy', desc: 'Accelerates pickaxe strikes, yields rare hematite and refined iron.', icon: '⛏️' },
                    { key: 'foraging', name: 'Botany & Foraging', desc: 'Boosts medicinal herb potency and harvest abundance.', icon: '🌿' },
                    { key: 'combat', name: 'Combat & Marksmanship', desc: 'Empowers melee critical strikes and arrow velocity.', icon: '⚔️' },
                    { key: 'engineering', name: 'Survival Engineering', desc: 'Unlocks advanced automation, water purifiers, and traps.', icon: '⚙️' },
                    { key: 'diplomacy', name: 'Charisma & Diplomacy', desc: 'Accelerates NPC affinity, romantic intimacy, and moral influence.', icon: '🗣️' },
                  ].map((skill) => {
                    const level = skills[skill.key as keyof PlayerSkills];
                    return (
                      <div key={skill.key} className="p-3 bg-neutral-950/70 border border-neutral-800 rounded-xl">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{skill.icon}</span>
                            <div>
                              <h4 className="text-xs font-bold text-neutral-200">{skill.name}</h4>
                              <span className="text-[10px] text-neutral-500">{skill.desc}</span>
                            </div>
                          </div>
                          <span className="text-xs font-mono font-bold text-amber-400">LVL {level}</span>
                        </div>
                        <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden mt-2">
                          <div
                            className="h-full bg-amber-500 rounded-full"
                            style={{ width: `${Math.min(100, (level % 5) * 25 + 20)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* NPCS & MORAL RELATIONSHIPS TAB */}
            {activeTab === 'npcs' && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                  Settlement Companions & Intimate Relationships
                </h3>
                <p className="text-xs text-neutral-400 mb-3">
                  Every moral choice shifts reputation, trust, and intimate romance paths. NPCs remember your actions.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {Object.values(npcs).map((npc) => (
                    <div
                      key={npc.id}
                      className="p-3 bg-neutral-950/70 border border-neutral-800 rounded-xl flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-800">
                          <div>
                            <h4 className="text-sm font-bold text-neutral-100">{npc.name}</h4>
                            <span className="text-[10px] text-neutral-400">{npc.title}</span>
                          </div>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-neutral-800 text-amber-300">
                            {npc.romanceStage}
                          </span>
                        </div>

                        <p className="text-[11px] text-neutral-300 italic mb-2">
                          "{npc.persona}"
                        </p>

                        <div className="space-y-1 mb-2 text-xs font-mono">
                          <div className="flex justify-between text-neutral-400">
                            <span>Affinity:</span>
                            <span className="text-emerald-400 font-bold">{npc.affinity}/100</span>
                          </div>
                          <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500"
                              style={{ width: `${Math.max(0, Math.min(100, npc.affinity))}%` }}
                            />
                          </div>

                          <div className="flex justify-between text-neutral-400 pt-1">
                            <span>Intimacy:</span>
                            <span className="text-purple-400 font-bold">{npc.intimacyLevel}%</span>
                          </div>
                        </div>

                        {npc.memoryLog && npc.memoryLog.length > 0 && (
                          <div className="mt-2 p-2 bg-neutral-900 rounded border border-neutral-800 text-[10px] text-neutral-400 space-y-1">
                            <span className="font-bold text-neutral-300">Recent Memory:</span>
                            <p>{npc.memoryLog[npc.memoryLog.length - 1]}</p>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => onOpenNPCDialogue(npc)}
                        className="w-full mt-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
                      >
                        <Heart className="w-3.5 h-3.5 text-rose-400" />
                        Initiate Dialogue Tree
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
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                      Outcast Pass · Season 1: Frostfall & Embers
                    </h3>
                    <p className="text-xs text-neutral-400">
                      Earn seasonal XP through survival, hunting, and base building to unlock exclusive cosmetics.
                    </p>
                  </div>

                  <button
                    onClick={() => setIsPremiumPass(!isPremiumPass)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition flex items-center gap-1.5 ${
                      isPremiumPass
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isPremiumPass ? 'Premium Pass Active' : 'Unlock Premium ($0 Cosmetic)'}</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {SEASON_PASS_REWARDS.map((reward) => {
                    const isUnlocked = playerXp >= reward.requiredXp || playerLevel >= reward.tier;
                    const isClaimed = claimedTiers.includes(reward.tier);

                    return (
                      <div
                        key={reward.tier}
                        className={`p-3 rounded-xl border flex items-center justify-between ${
                          isUnlocked ? 'bg-neutral-950/80 border-neutral-700' : 'bg-neutral-900/40 border-neutral-800 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center font-bold text-xs font-mono text-amber-400">
                            T{reward.tier}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-neutral-200">
                                {reward.freeReward.icon} {reward.freeReward.title}
                              </span>
                              {isPremiumPass && (
                                <span className="text-xs text-amber-300 font-bold">
                                  + {reward.premiumReward.icon} {reward.premiumReward.title}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-neutral-500 font-mono">
                              Required XP: {reward.requiredXp}
                            </span>
                          </div>
                        </div>

                        <button
                          disabled={!isUnlocked || isClaimed}
                          onClick={() => claimTier(reward.tier)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                            isClaimed
                              ? 'bg-neutral-800 text-neutral-500 cursor-default'
                              : isUnlocked
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                              : 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
                          }`}
                        >
                          {isClaimed ? 'Claimed' : isUnlocked ? 'Claim Reward' : 'Locked'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CLOUD SAVE & PROGRESSION TAB */}
            {/* GRAPHICS & REALISM PIPELINE TAB */}
            {activeTab === 'graphics' && (
              <div className="max-w-2xl mx-auto space-y-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                      Unreal Engine 5 & Unity HDRP Rendering Pipeline
                    </h3>
                  </div>
                  <p className="text-xs text-neutral-400 mt-1">
                    Simulates AAA game engine pipelines in real-time with HDR bloom, filmic tone mapping, lens chromatic aberration, and physical wetness reflections.
                  </p>
                </div>

                {/* Preset Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => onApplyGraphicsPreset('unreal5')}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      graphicsConfig.preset === 'unreal5'
                        ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.2)]'
                        : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-600'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-cyan-300">Unreal Engine 5</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-900/60 text-cyan-200">Lumen & Post</span>
                      </div>
                      <p className="text-[11px] text-neutral-400 leading-snug">
                        Full HDR Bloom, ACES Filmic exposure, lens dispersion, filmic vignette, and wetness sheen.
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-400 mt-2 font-bold">
                      {graphicsConfig.preset === 'unreal5' ? '● ACTIVE PRESET' : 'Select'}
                    </span>
                  </button>

                  <button
                    onClick={() => onApplyGraphicsPreset('unity_hdrp')}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      graphicsConfig.preset === 'unity_hdrp'
                        ? 'bg-amber-950/40 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.2)]'
                        : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-600'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-amber-300">Unity HDRP</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-200">Balanced PBR</span>
                      </div>
                      <p className="text-[11px] text-neutral-400 leading-snug">
                        Crisp anti-aliasing, subtle soft bloom, balanced exposure, and high stability.
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-amber-400 mt-2 font-bold">
                      {graphicsConfig.preset === 'unity_hdrp' ? '● ACTIVE PRESET' : 'Select'}
                    </span>
                  </button>

                  <button
                    onClick={() => onApplyGraphicsPreset('performance')}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      graphicsConfig.preset === 'performance'
                        ? 'bg-emerald-950/40 border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.2)]'
                        : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-600'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-emerald-300">Performance</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-900/60 text-emerald-200">120+ FPS</span>
                      </div>
                      <p className="text-[11px] text-neutral-400 leading-snug">
                        Direct forward rendering, zero post-pass overhead, ideal for laptops or mobile.
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 mt-2 font-bold">
                      {graphicsConfig.preset === 'performance' ? '● ACTIVE PRESET' : 'Select'}
                    </span>
                  </button>
                </div>

                {/* Fine-Tuning Sliders */}
                <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="flex justify-between text-neutral-300 mb-1 font-mono">
                      <span>Unreal Bloom Strength:</span>
                      <span className="text-cyan-400">{graphicsConfig.bloomStrength.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1.5"
                      step="0.05"
                      value={graphicsConfig.bloomStrength}
                      onChange={(e) => onUpdateGraphicsConfig({ bloomStrength: parseFloat(e.target.value) })}
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-neutral-300 mb-1 font-mono">
                      <span>Filmic Vignette Darkness:</span>
                      <span className="text-cyan-400">{graphicsConfig.vignetteDarkness.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="2.0"
                      step="0.1"
                      value={graphicsConfig.vignetteDarkness}
                      onChange={(e) => onUpdateGraphicsConfig({ vignetteDarkness: parseFloat(e.target.value) })}
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* CLOUD SAVE & PROGRESSION TAB */}
            {activeTab === 'cloud_save' && (
              <div className="max-w-xl mx-auto space-y-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-1">
                    Cross-Platform Persistent Cloud Save
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Sync your character vitals, base structures, inventory, and NPC affinity across mobile and desktop.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={onSaveGame}
                    className="p-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition"
                  >
                    <CloudUpload className="w-4 h-4" />
                    Save Game to Cloud & Storage
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
                  <h4 className="text-xs font-bold text-neutral-300">Raw Save State JSON Export/Import</h4>
                  <div className="flex gap-2">
                    <button
                      onClick={onExportSave}
                      className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs rounded-md text-neutral-200 transition"
                    >
                      Export Save File
                    </button>
                    <input
                      type="text"
                      placeholder="Paste Save State JSON here..."
                      value={importInput}
                      onChange={(e) => setImportInput(e.target.value)}
                      className="flex-1 px-3 py-1 bg-neutral-900 border border-neutral-700 rounded-md text-xs font-mono text-neutral-300"
                    />
                    <button
                      onClick={() => {
                        if (importInput.trim()) {
                          onImportSave(importInput);
                          setImportInput('');
                        }
                      }}
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-xs rounded-md text-white font-bold transition"
                    >
                      Import
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Hotbar (6 Slots) & Feature Tab Toggles */}
        {!isCollapsed && (
          <div className="p-2 flex flex-col md:flex-row items-center justify-between gap-3 bg-neutral-950/90">
            {/* Hotbar Slots */}
            <div className="flex items-center gap-1.5">
              {hotbar.map((item, index) => (
                <div
                  key={`hotbar_${index}`}
                  onClick={() => onSelectHotbar(index)}
                  className={`w-11 h-11 p-1 rounded-lg border flex flex-col items-center justify-between cursor-pointer transition ${
                    selectedHotbarIndex === index
                      ? 'border-amber-400 bg-amber-950/40 shadow-[0_0_12px_rgba(251,191,36,0.25)]'
                      : item
                      ? 'border-neutral-700 bg-neutral-800/80 hover:border-neutral-500'
                      : 'border-neutral-800 bg-neutral-900/60'
                  }`}
                >
                  <div className="w-full flex justify-between text-[9px] font-mono text-neutral-400 leading-none">
                    <span>{index + 1}</span>
                  </div>
                  {item ? (
                    <>
                      <span className="text-xl leading-none">{item.icon}</span>
                      <span className="text-[10px] font-mono font-bold text-neutral-200 leading-none">
                        x{item.count}
                      </span>
                    </>
                  ) : null}
                </div>
              ))}
            </div>

            {/* Navigation Tab Buttons */}
            <div className="flex items-center gap-1 text-xs">
              <button
                onClick={() => handleTabClick('inventory')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border transition ${
                  activeTab === 'inventory'
                    ? 'bg-amber-600 border-amber-500 text-white font-bold'
                    : 'bg-neutral-800/90 border-neutral-700 text-neutral-300 hover:text-white'
                }`}
              >
                <Backpack className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Inventory</span>
              </button>

              <button
                onClick={() => handleTabClick('crafting')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border transition ${
                  activeTab === 'crafting'
                    ? 'bg-amber-600 border-amber-500 text-white font-bold'
                    : 'bg-neutral-800/90 border-neutral-700 text-neutral-300 hover:text-white'
                }`}
              >
                <Hammer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Crafting</span>
              </button>

              <button
                onClick={() => handleTabClick('building')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border transition ${
                  activeTab === 'building'
                    ? 'bg-amber-600 border-amber-500 text-white font-bold'
                    : 'bg-neutral-800/90 border-neutral-700 text-neutral-300 hover:text-white'
                }`}
              >
                <Home className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Building</span>
              </button>

              <button
                onClick={() => handleTabClick('skills')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border transition ${
                  activeTab === 'skills'
                    ? 'bg-amber-600 border-amber-500 text-white font-bold'
                    : 'bg-neutral-800/90 border-neutral-700 text-neutral-300 hover:text-white'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Skills</span>
              </button>

              <button
                onClick={() => handleTabClick('npcs')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border transition ${
                  activeTab === 'npcs'
                    ? 'bg-amber-600 border-amber-500 text-white font-bold'
                    : 'bg-neutral-800/90 border-neutral-700 text-neutral-300 hover:text-white'
                }`}
              >
                <Heart className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">Companions</span>
              </button>

              <button
                onClick={() => handleTabClick('season_pass')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border transition ${
                  activeTab === 'season_pass'
                    ? 'bg-amber-600 border-amber-500 text-white font-bold'
                    : 'bg-neutral-800/90 border-neutral-700 text-neutral-300 hover:text-white'
                }`}
              >
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Pass</span>
              </button>

              <button
                onClick={() => handleTabClick('cloud_save')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border transition ${
                  activeTab === 'cloud_save'
                    ? 'bg-amber-600 border-amber-500 text-white font-bold'
                    : 'bg-neutral-800/90 border-neutral-700 text-neutral-300 hover:text-white'
                }`}
              >
                <CloudUpload className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Save</span>
              </button>

              <button
                onClick={() => handleTabClick('graphics')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border transition ${
                  activeTab === 'graphics'
                    ? 'bg-cyan-600 border-cyan-500 text-white font-bold'
                    : 'bg-neutral-800/90 border-neutral-700 text-cyan-300 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">Engine FX</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

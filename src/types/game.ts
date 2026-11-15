export type WeatherType = 'clear' | 'overcast' | 'rain' | 'storm' | 'blizzard' | 'ash_tempest';

export type MoralAlignment = 'Ruthless' | 'Pragmatic' | 'Neutral' | 'Empathetic' | 'Altruistic';

export type RomanceStage = 'Stranger' | 'Acquaintance' | 'Trusted Ally' | 'Confidant' | 'Intimate' | 'Lover' | 'Devoted Soulmate';

export interface PlayerVitals {
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  hunger: number;
  thirst: number;
  temperature: number; // in Celsius (comfort zone: 18 - 25°C)
  morale: number; // 0 - 100
  wetness: number; // 0 - 100%
  level: number;
  xp: number;
  nextLevelXp: number;
}

export interface PlayerSkills {
  foraging: number;
  woodcraft: number;
  mining: number;
  combat: number;
  engineering: number;
  diplomacy: number;
}

export interface Item {
  id: string;
  name: string;
  category: 'tool' | 'weapon' | 'resource' | 'food' | 'medicine' | 'gear' | 'structure';
  count: number;
  maxStack: number;
  weight: number;
  durability?: number;
  maxDurability?: number;
  description: string;
  icon: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic';
  stats?: {
    damage?: number;
    defense?: number;
    warmth?: number;
    hungerHeal?: number;
    thirstHeal?: number;
    healthHeal?: number;
    woodBonus?: number;
    stoneBonus?: number;
  };
}

export interface CraftingRecipe {
  id: string;
  name: string;
  category: 'tools' | 'survival' | 'building' | 'armor' | 'advanced';
  ingredients: { itemId: string; count: number }[];
  resultItemId: string;
  resultCount: number;
  craftTimeSeconds: number;
  requiredSkill?: { skill: keyof PlayerSkills; level: number };
  description: string;
}

export interface PlacedStructure {
  id: string;
  type: 'foundation_wood' | 'wall_log' | 'door_wood' | 'workbench' | 'campfire' | 'storage_crate' | 'water_collector' | 'watchtower' | 'cot_bedroll';
  x: number;
  y: number;
  z: number;
  rotationY: number;
  health: number;
  maxHealth: number;
  inventory?: Item[];
}

export interface HarvestableNode {
  id: string;
  type: 'tree_pine' | 'tree_oak' | 'tree_dead' | 'rock_stone' | 'rock_iron' | 'rock_flint' | 'herb_sage' | 'berry_bush' | 'supply_cache';
  x: number;
  y: number;
  z: number;
  health: number;
  maxHealth: number;
  respawnTime?: number;
  yieldItem: string;
  yieldCount: number;
  sectorId?: string;
}

export interface WorldSector {
  id: string;
  name: string;
  biome: 'haven' | 'timberlands' | 'ironcrag' | 'badlands' | 'frostpeak' | 'frontier';
  centerX: number;
  centerZ: number;
  radius: number;
  discovered: boolean;
  beaconActivated: boolean;
  description: string;
  color: string;
}

export interface SurveyBeacon {
  id: string;
  sectorId: string;
  name: string;
  x: number;
  y: number;
  z: number;
  activated: boolean;
}

export interface MapWaypoint {
  x: number;
  z: number;
  label: string;
  color: string;
}

export interface MissionObjective {
  id: string;
  text: string;
  type:
    | 'harvest'
    | 'craft'
    | 'build'
    | 'talk_npc'
    | 'discover_sector'
    | 'activate_beacon'
    | 'rest_campfire'
    | 'reach_affinity';
  targetId?: string;
  current: number;
  target: number;
  done: boolean;
  targetPos?: { x: number; z: number };
}

export interface Mission {
  id: string;
  title: string;
  category: 'campaign' | 'exploration' | 'directive';
  chapter: string;
  description: string;
  giver: string;
  status: 'active' | 'completed' | 'locked';
  objectives: MissionObjective[];
  rewardXP: number;
  rewardItems: { itemId: string; count: number }[];
  targetWaypoint?: { x: number; z: number; label: string };
}

export interface NPCData {
  id: string;
  name: string;
  title: string;
  role: string;
  persona: string;
  color: string;
  affinity: number; // -100 to +100
  trust: number; // 0 to 100
  romanceStage: RomanceStage;
  currentExpression: 'Warm' | 'Affectionate' | 'Guarded' | 'Stern' | 'Seductive' | 'Despairing' | 'Passionate';
  memoryLog: string[];
  intimacyLevel: number; // 0 to 100
  position: { x: number; y: number; z: number };
  dialogueHistory: { speaker: 'npc' | 'player'; text: string; timestamp: number }[];
  moralStance: string;
}

export interface MoralChoice {
  id: string;
  title: string;
  description: string;
  karmaImpact: number;
  timestamp: number;
  choiceMade: string;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  giver: string;
  status: 'active' | 'completed' | 'failed';
  objectives: { id: string; text: string; current: number; target: number; done: boolean }[];
  rewardXP: number;
  rewardItems?: { itemId: string; count: number }[];
  moralConsequence?: string;
}

export interface SeasonPassReward {
  tier: number;
  requiredXp: number;
  freeReward: { title: string; icon: string; description: string };
  premiumReward: { title: string; icon: string; description: string };
  unlocked: boolean;
  claimedFree: boolean;
  claimedPremium: boolean;
}

export interface GameSaveState {
  version: number;
  saveName: string;
  timestamp: number;
  vitals: PlayerVitals;
  skills: PlayerSkills;
  inventory: (Item | null)[];
  hotbar: (Item | null)[];
  equippedArmor: {
    head: Item | null;
    chest: Item | null;
    legs: Item | null;
    feet: Item | null;
  };
  activeWeapon: Item | null;
  structures: PlacedStructure[];
  dayCount: number;
  timeOfDay: number; // 0 to 24 hours
  weather: WeatherType;
  karma: number; // -100 to 100
  moralHistory: MoralChoice[];
  npcs: Record<string, NPCData>;
  quests: Quest[];
  missions?: Mission[];
  discoveredSectors?: string[];
  exploredCells?: string[];
  seasonPass: {
    tier: number;
    xp: number;
    isPremium: boolean;
    claimedTiers: number[];
  };
  coop: {
    roomCode: string;
    isHost: boolean;
    activePartner: string | null;
  };
}

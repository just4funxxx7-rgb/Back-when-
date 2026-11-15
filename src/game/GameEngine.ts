import * as THREE from 'three';
import {
  isSoftwareGl,
  setupStudioEnvironment,
  gameMaterials,
  updateMaterialsWetness,
} from './materials';
import { UnrealRenderPipeline } from './postprocessing';
import {
  createProceduralTree,
  createProceduralRock,
  createHarvestableHerb,
  createSupplyCacheMesh,
  createSurveyBeaconMesh,
  createPlayerModel,
  createNPCModel,
  createStructureMesh,
  createDebrisChunkMesh,
  createRubblePileMesh,
  NPCModelParts,
} from './proceduralModels';
import {
  getTerrainHeight,
  createTerrainMesh,
  createPerimeterNaturalBarriers,
} from './terrain';
import { DynamicWeatherSystem } from './weather';
import { audioEngine } from './audioEngine';
import {
  PlayerVitals,
  PlayerSkills,
  Item,
  PlacedStructure,
  RubblePile,
  HarvestableNode,
  NPCData,
  WorldSector,
  SurveyBeacon,
  Mission,
  MissionObjective,
  MapWaypoint,
} from '../types/game';
import { ITEM_CATALOG, INITIAL_NPCS } from './itemsData';
import {
  INITIAL_WORLD_SECTORS,
  INITIAL_SURVEY_BEACONS,
  INITIAL_MISSIONS,
} from './missionsData';

const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _camOffset = new THREE.Vector3();

interface DebrisParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface RagdollActorState {
  active: boolean;
  timer: number;
  duration: number;
  velocity: THREE.Vector3;
  angularVel: THREE.Vector3;
  limbPhase: number;
}

export class GameEngine {
  public renderer!: THREE.WebGLRenderer;
  public scene!: THREE.Scene;
  public camera!: THREE.PerspectiveCamera;
  public weatherSystem!: DynamicWeatherSystem;
  public renderPipeline!: UnrealRenderPipeline;
  public cameraTrauma: number = 0;

  private container: HTMLElement;
  private animFrameId: number = 0;
  private isDestroyed: boolean = false;
  private clock: THREE.Clock;

  // Player & Actor groups
  public playerGroup!: THREE.Group;
  private playerParts!: ReturnType<typeof createPlayerModel>;
  public playerVelocity: THREE.Vector3 = new THREE.Vector3();
  public isGrounded: boolean = true;
  public playerFacingAngle: number = 0;
  private swingAnimTimer: number = 0;
  private walkAnimTimer: number = 0;
  public rollTimer: number = 0;

  // Ragdoll Physics & Structural Debris State
  public playerRagdoll: RagdollActorState = {
    active: false,
    timer: 0,
    duration: 2.5,
    velocity: new THREE.Vector3(),
    angularVel: new THREE.Vector3(),
    limbPhase: 0,
  };
  private npcRagdolls: Record<string, RagdollActorState> = {};
  private debrisParticles: DebrisParticle[] = [];
  public rubblePiles: RubblePile[] = [];
  private rubbleMeshes: Map<string, THREE.Group> = new Map();

  // Camera third-person orbit state
  public cameraDistance: number = 6.8;
  public cameraPitch: number = 0.32;
  public cameraYaw: number = 0;
  public isDraggingCamera: boolean = false;
  private previousMouseX: number = 0;
  private previousMouseY: number = 0;

  // World objects & Expanding Map Sectors
  public harvestNodes: (HarvestableNode & { mesh: THREE.Group })[] = [];
  public placedStructures: PlacedStructure[] = [];
  private structureMeshes: Map<string, THREE.Group> = new Map();
  public npcs: Record<string, NPCData & { mesh: THREE.Group }> = {};
  private coOpPartnerMesh: THREE.Group | null = null;

  public worldSectors: WorldSector[] = [];
  public surveyBeacons: (SurveyBeacon & { mesh: THREE.Group })[] = [];
  public exploredCells: Set<string> = new Set();
  public missions: Mission[] = [];
  public activeWaypoint: MapWaypoint | null = null;
  private waypointMesh: THREE.Group | null = null;
  private spawnedSectorIds: Set<string> = new Set();
  private mapSyncTimer: number = 0;

  // Placement mode
  public placementActive: boolean = false;
  public placementType: PlacedStructure['type'] = 'foundation_wood';
  public placementRotation: number = 0;
  private hologramMesh: THREE.Group | null = null;

  // Game state references
  public vitals: PlayerVitals = {
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
  };

  public skills: PlayerSkills = {
    foraging: 1,
    woodcraft: 1,
    mining: 1,
    combat: 1,
    engineering: 1,
    diplomacy: 1,
  };

  public inventory: (Item | null)[] = new Array(24).fill(null);
  public hotbar: (Item | null)[] = new Array(6).fill(null);
  public selectedHotbarSlot: number = 0;

  // Input states
  public keys: Record<string, boolean> = {};
  public joystickVector: { x: number; y: number } = { x: 0, y: 0 };

  // Callbacks to React UI
  public onVitalsUpdate?: (vitals: PlayerVitals) => void;
  public onInventoryUpdate?: (
    inventory: (Item | null)[],
    hotbar: (Item | null)[]
  ) => void;
  public onNPCInteract?: (npc: NPCData) => void;
  public onNotification?: (text: string, icon?: string) => void;
  public onInteractTargetChange?: (prompt: string | null) => void;
  public onStructurePlacedCallback?: (structures: PlacedStructure[]) => void;
  public onLevelUp?: (newLevel: number) => void;
  public onMapAndMissionsUpdate?: (
    sectors: WorldSector[],
    beacons: SurveyBeacon[],
    missions: Mission[],
    exploredCount: number,
    waypoint: MapWaypoint | null
  ) => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.clock = new THREE.Clock();
    this.initScene();
    this.initPlayer();
    this.initNPCs();
    this.initMapAndMissions();
    this.initWorldNodes();
    this.initInitialStructures();
    this.initInitialInventory();
    this.bindEvents();
    this.startLoop();
  }

  private initScene() {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      58,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      650
    );

    this.renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight
    );
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.shadowMap.enabled = !isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    setupStudioEnvironment(this.renderer, this.scene);

    this.renderPipeline = new UnrealRenderPipeline(
      this.renderer,
      this.scene,
      this.camera
    );

    this.weatherSystem = new DynamicWeatherSystem(this.scene);

    const { terrainMesh, waterMesh } = createTerrainMesh();
    this.scene.add(terrainMesh);
    this.scene.add(waterMesh);

    const perimeterBarriers = createPerimeterNaturalBarriers();
    this.scene.add(perimeterBarriers);
  }

  private initPlayer() {
    this.playerParts = createPlayerModel();
    this.playerGroup = this.playerParts.root;

    const spawnX = 0;
    const spawnZ = 0;
    const spawnY = getTerrainHeight(spawnX, spawnZ);
    this.playerGroup.position.set(spawnX, spawnY, spawnZ);
    this.scene.add(this.playerGroup);
  }

  private initNPCs() {
    Object.values(INITIAL_NPCS).forEach((npcData) => {
      const mesh = createNPCModel(npcData.id);
      const y = getTerrainHeight(npcData.position.x, npcData.position.z);
      mesh.position.set(npcData.position.x, y, npcData.position.z);
      this.scene.add(mesh);
      this.npcs[npcData.id] = { ...npcData, mesh };
    });
  }

  private initMapAndMissions() {
    this.worldSectors = INITIAL_WORLD_SECTORS.map((s) => ({ ...s }));
    this.missions = JSON.parse(JSON.stringify(INITIAL_MISSIONS));

    // Reveal initial Haven fog-of-war radius (60m around 0,0)
    this.revealFogRadius(0, 0, 62);

    // Spawn Survey Beacons in 3D World
    INITIAL_SURVEY_BEACONS.forEach((b) => {
      const y = getTerrainHeight(b.x, b.z);
      const mesh = createSurveyBeaconMesh(b.activated);
      mesh.position.set(b.x, y, b.z);
      this.scene.add(mesh);
      this.surveyBeacons.push({ ...b, y, mesh });
    });

    // Set initial 3D Waypoint to first active mission
    this.setWaypoint({ x: 3, z: 3, label: 'Hearth Campfire', color: '#f59e0b' });
  }

  public setWaypoint(wp: MapWaypoint | null) {
    this.activeWaypoint = wp;
    if (this.waypointMesh) {
      this.scene.remove(this.waypointMesh);
      this.waypointMesh = null;
    }

    if (wp) {
      const group = new THREE.Group();
      const y = getTerrainHeight(wp.x, wp.z);
      const beamMat = new THREE.MeshBasicMaterial({
        color: wp.color || 0xf59e0b,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
      });
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.45, 45, 16, 1, true),
        beamMat
      );
      beam.position.y = 22.5;
      group.add(beam);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.4, 0.08, 10, 24),
        new THREE.MeshBasicMaterial({ color: wp.color || 0xf59e0b })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.25;
      group.add(ring);

      group.position.set(wp.x, y, wp.z);
      this.scene.add(group);
      this.waypointMesh = group;
    }
    this.emitMapAndMissions();
  }

  public revealFogRadius(cx: number, cz: number, radius: number) {
    const cellSize = 12;
    const steps = Math.ceil(radius / cellSize);
    const baseGx = Math.round(cx / cellSize);
    const baseGz = Math.round(cz / cellSize);

    for (let dx = -steps; dx <= steps; dx++) {
      for (let dz = -steps; dz <= steps; dz++) {
        const wx = (baseGx + dx) * cellSize;
        const wz = (baseGz + dz) * cellSize;
        if (Math.hypot(wx - cx, wz - cz) <= radius) {
          this.exploredCells.add(`${baseGx + dx},${baseGz + dz}`);
        }
      }
    }
  }

  private initWorldNodes() {
    // Spawn Sector 1 (Outcast Haven) nodes immediately
    this.spawnSectorNodes(this.worldSectors[0]);
    // Also pre-seed outer cardinal sectors so players can see distant forests & mountains on the horizon
    for (let i = 1; i < this.worldSectors.length; i++) {
      this.spawnSectorNodes(this.worldSectors[i]);
    }
  }

  public spawnSectorNodes(sector: WorldSector) {
    if (this.spawnedSectorIds.has(sector.id)) return;
    this.spawnedSectorIds.add(sector.id);

    const isHaven = sector.biome === 'haven';
    const treeCount =
      sector.biome === 'timberlands' ? 28 : isHaven ? 26 : 16;
    const rockCount =
      sector.biome === 'ironcrag' ? 22 : isHaven ? 18 : 14;
    const herbCount =
      sector.biome === 'frostpeak' || sector.biome === 'timberlands' ? 14 : 10;

    const treeTypes: ('pine' | 'oak' | 'dead')[] =
      sector.biome === 'timberlands'
        ? ['pine', 'pine', 'oak']
        : sector.biome === 'badlands'
        ? ['dead', 'dead', 'pine']
        : ['pine', 'oak', 'dead'];

    for (let i = 0; i < treeCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const minDist = isHaven ? 12 : 8;
      const dist = minDist + Math.random() * (sector.radius - minDist);
      const x = sector.centerX + Math.cos(angle) * dist;
      const z = sector.centerZ + Math.sin(angle) * dist;
      const y = getTerrainHeight(x, z);

      const riverX = 40 + Math.sin(z * 0.035) * 18;
      if (Math.abs(x - riverX) < 10) continue;

      const type = treeTypes[Math.floor(Math.random() * treeTypes.length)];
      const treeMesh = createProceduralTree(type);
      treeMesh.position.set(x, y, z);
      treeMesh.rotation.y = Math.random() * Math.PI * 2;
      const s = 0.85 + Math.random() * 0.35;
      treeMesh.scale.set(s, s, s);
      this.scene.add(treeMesh);

      this.harvestNodes.push({
        id: `tree_${sector.id}_${i}`,
        type:
          type === 'pine'
            ? 'tree_pine'
            : type === 'oak'
            ? 'tree_oak'
            : 'tree_dead',
        x,
        y,
        z,
        health: 40,
        maxHealth: 40,
        yieldItem: 'wood',
        yieldCount: 4,
        sectorId: sector.id,
        mesh: treeMesh,
      });
    }

    const rockTypes: ('stone' | 'iron' | 'flint')[] =
      sector.biome === 'ironcrag'
        ? ['iron', 'iron', 'flint', 'stone']
        : sector.biome === 'frostpeak'
        ? ['iron', 'stone', 'flint']
        : ['stone', 'stone', 'iron', 'flint'];

    for (let i = 0; i < rockCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const minDist = isHaven ? 14 : 6;
      const dist = minDist + Math.random() * (sector.radius - minDist);
      const x = sector.centerX + Math.cos(angle) * dist;
      const z = sector.centerZ + Math.sin(angle) * dist;
      const y = getTerrainHeight(x, z);

      const riverX = 40 + Math.sin(z * 0.035) * 18;
      if (Math.abs(x - riverX) < 10) continue;

      const rType = rockTypes[Math.floor(Math.random() * rockTypes.length)];
      const rockMesh = createProceduralRock(rType);
      rockMesh.position.set(x, y, z);
      rockMesh.rotation.y = Math.random() * Math.PI * 2;
      const s = 0.9 + Math.random() * 0.4;
      rockMesh.scale.set(s, s, s);
      this.scene.add(rockMesh);

      this.harvestNodes.push({
        id: `rock_${sector.id}_${i}`,
        type:
          rType === 'stone'
            ? 'rock_stone'
            : rType === 'iron'
            ? 'rock_iron'
            : 'rock_flint',
        x,
        y,
        z,
        health: 50,
        maxHealth: 50,
        yieldItem:
          rType === 'iron'
            ? 'iron_ore'
            : rType === 'flint'
            ? 'flint'
            : 'stone',
        yieldCount: 3,
        sectorId: sector.id,
        mesh: rockMesh,
      });
    }

    for (let i = 0; i < herbCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 6 + Math.random() * (sector.radius - 10);
      const x = sector.centerX + Math.cos(angle) * dist;
      const z = sector.centerZ + Math.sin(angle) * dist;
      const y = getTerrainHeight(x, z);

      const isHerb = i % 2 === 0;
      const herbMesh = createHarvestableHerb();
      herbMesh.position.set(x, y, z);
      this.scene.add(herbMesh);

      this.harvestNodes.push({
        id: `forage_${sector.id}_${i}`,
        type: isHerb ? 'herb_sage' : 'berry_bush',
        x,
        y,
        z,
        health: 10,
        maxHealth: 10,
        yieldItem: isHerb ? 'mountain_sage' : 'wild_berries',
        yieldCount: 2,
        sectorId: sector.id,
        mesh: herbMesh,
      });
    }

    // Spawn 2 Expedition Supply Caches in outer sectors
    if (!isHaven) {
      for (let c = 0; c < 2; c++) {
        const angle = (c * Math.PI) + 0.6;
        const x = sector.centerX + Math.cos(angle) * 24;
        const z = sector.centerZ + Math.sin(angle) * 24;
        const y = getTerrainHeight(x, z);
        const cacheMesh = createSupplyCacheMesh();
        cacheMesh.position.set(x, y, z);
        this.scene.add(cacheMesh);

        this.harvestNodes.push({
          id: `cache_${sector.id}_${c}`,
          type: 'supply_cache',
          x,
          y,
          z,
          health: 20,
          maxHealth: 20,
          yieldItem: c === 0 ? 'iron_ingot' : 'roasted_venison',
          yieldCount: 3,
          sectorId: sector.id,
          mesh: cacheMesh,
        });
      }
    }
  }

  // Dynamic Exploration Check: Unlocks sectors & generates new procedural frontier sectors when exploring outward!
  private updateExplorationAndMapExpansion(delta: number) {
    const px = this.playerGroup.position.x;
    const pz = this.playerGroup.position.z;

    // Continuously reveal fog-of-war in a 28m radius around the player
    this.revealFogRadius(px, pz, 28);

    // Animate Survey Beacon crystals
    const time = this.clock.getElapsedTime();
    for (const b of this.surveyBeacons) {
      const crystal = b.mesh.getObjectByName('beacon_crystal');
      const gyro = b.mesh.getObjectByName('beacon_gyro');
      if (crystal) {
        crystal.rotation.y = time * 1.4;
        crystal.position.y = 5.2 + Math.sin(time * 2.2) * 0.15;
      }
      if (gyro) {
        gyro.rotation.z = time * 1.8;
        gyro.rotation.y = time * 1.1;
      }
    }

    // Check if player entered an undiscovered World Sector
    let sectorChanged = false;
    for (const sector of this.worldSectors) {
      if (!sector.discovered) {
        const dist = Math.hypot(px - sector.centerX, pz - sector.centerZ);
        if (dist <= sector.radius + 12) {
          sector.discovered = true;
          sectorChanged = true;
          this.spawnSectorNodes(sector);
          this.revealFogRadius(sector.centerX, sector.centerZ, 55);
          this.addXP(65, 'foraging');
          audioEngine.playCraftSuccess();
          this.notify(
            `Map Expanded! Discovered ${sector.name} (+65 XP)`,
            '🗺️'
          );
          this.recordMissionProgress('discover_sector', sector.id, 1);
        }
      }
    }

    // Dynamic Infinite Frontier Generation: if player explores beyond 165m from origin where no sector exists, expand the world map with a new procedural sector!
    const distFromOrigin = Math.hypot(px, pz);
    if (distFromOrigin > 155 && distFromOrigin < 255) {
      const nearExisting = this.worldSectors.some(
        (s) => Math.hypot(px - s.centerX, pz - s.centerZ) < 88
      );
      if (!nearExisting && this.worldSectors.length < 12) {
        const newIdx = this.worldSectors.length + 1;
        const newSector: WorldSector = {
          id: `sector_frontier_${newIdx}`,
          name: `Uncharted Frontier Sector ${newIdx}`,
          biome: 'frontier',
          centerX: Math.round(px),
          centerZ: Math.round(pz),
          radius: 70,
          discovered: true,
          beaconActivated: false,
          description: `Newly charted outer expedition territory at (${Math.round(px)}m, ${Math.round(pz)}m). Rich in untouched resources and supply caches.`,
          color: '#a855f7',
        };
        this.worldSectors.push(newSector);
        this.spawnSectorNodes(newSector);

        // Also spawn a Frontier Survey Spire in this newly generated sector!
        const bx = newSector.centerX + 8;
        const bz = newSector.centerZ + 8;
        const by = getTerrainHeight(bx, bz);
        const bMesh = createSurveyBeaconMesh(false);
        bMesh.position.set(bx, by, bz);
        this.scene.add(bMesh);
        this.surveyBeacons.push({
          id: `beacon_frontier_${newIdx}`,
          sectorId: newSector.id,
          name: `Frontier Sector ${newIdx} Survey Spire`,
          x: bx,
          y: by,
          z: bz,
          activated: false,
          mesh: bMesh,
        });

        this.revealFogRadius(px, pz, 70);
        this.addXP(100, 'foraging');
        audioEngine.playCraftSuccess();
        this.notify(
          `Dynamic World Expansion! Charted ${newSector.name} (+100 XP)`,
          '🧭'
        );
        this.recordMissionProgress('discover_sector', newSector.id, 1);
        sectorChanged = true;
      }
    }

    this.mapSyncTimer += delta;
    if (sectorChanged || this.mapSyncTimer > 1.2) {
      this.mapSyncTimer = 0;
      this.emitMapAndMissions();
    }
  }

  public activateSurveyBeacon(beaconId: string) {
    const beacon = this.surveyBeacons.find((b) => b.id === beaconId);
    if (!beacon || beacon.activated) return;

    beacon.activated = true;
    const crystal = beacon.mesh.getObjectByName('beacon_crystal') as THREE.Mesh;
    if (crystal) {
      crystal.material = gameMaterials.beaconCrystalActive;
    }

    const sector = this.worldSectors.find((s) => s.id === beacon.sectorId);
    if (sector) {
      if (!sector.discovered) {
        sector.discovered = true;
        this.recordMissionProgress('discover_sector', sector.id, 1);
      }
      sector.beaconActivated = true;
      this.spawnSectorNodes(sector);
      this.revealFogRadius(sector.centerX, sector.centerZ, 95);
    } else {
      this.revealFogRadius(beacon.x, beacon.z, 95);
    }

    this.addXP(120, 'engineering');
    audioEngine.playCraftSuccess();
    this.notify(
      `Activated ${beacon.name}! Entire Sector Map Revealed (+120 XP)`,
      '📡'
    );
    this.recordMissionProgress('activate_beacon', beacon.id, 1);
    this.emitMapAndMissions();
  }

  public recordMissionProgress(
    type: MissionObjective['type'],
    targetId?: string,
    amount: number = 1
  ) {
    let anyUpdated = false;

    for (const mission of this.missions) {
      if (mission.status !== 'active') continue;

      for (const obj of mission.objectives) {
        if (obj.done || obj.type !== type) continue;
        if (obj.targetId && obj.targetId !== targetId) continue;

        obj.current = Math.min(obj.target, obj.current + amount);
        if (obj.current >= obj.target) {
          obj.done = true;
        }
        anyUpdated = true;
      }

      // Check if all objectives in this mission are now complete
      if (mission.objectives.every((o) => o.done)) {
        mission.status = 'completed';
        this.addXP(mission.rewardXP, 'diplomacy');
        for (const rew of mission.rewardItems) {
          this.addInventoryItem(rew.itemId, rew.count);
        }
        audioEngine.playCraftSuccess();
        this.notify(
          `Mission Completed: ${mission.title}! (+${mission.rewardXP} XP)`,
          '🏆'
        );
        anyUpdated = true;
      }
    }

    if (anyUpdated) {
      this.emitMapAndMissions();
    }
  }

  public generateNewDirectiveMission() {
    const idx = this.missions.length + 1;
    const targets = [
      {
        title: `Frontier Directive #${idx}: Timber Supply Run`,
        objText: 'Harvest 8 Timber Logs for Outpost Expansion',
        type: 'harvest' as const,
        targetId: 'wood',
        count: 8,
        rewardItem: 'roasted_venison',
      },
      {
        title: `Frontier Directive #${idx}: Ironcrag Ore Extraction`,
        objText: 'Mine 4 Iron Ore from Quarry Boulders',
        type: 'harvest' as const,
        targetId: 'iron_ore',
        count: 4,
        rewardItem: 'iron_ingot',
      },
      {
        title: `Frontier Directive #${idx}: Herbalist Apothecary`,
        objText: 'Forage 4 Mountain Sage or Wild Berries',
        type: 'harvest' as const,
        targetId: 'mountain_sage',
        count: 4,
        rewardItem: 'herbal_salve',
      },
    ];
    const pick = targets[idx % targets.length];
    const newMission: Mission = {
      id: `directive_dyn_${Date.now()}`,
      title: pick.title,
      category: 'directive',
      chapter: 'Dynamic Settlement Bounty',
      description:
        'Fulfill urgent resource and fortification requisitions for the Outcast Haven leadership.',
      giver: 'Settlement Quartermaster',
      status: 'active',
      rewardXP: 150,
      rewardItems: [{ itemId: pick.rewardItem, count: 3 }],
      objectives: [
        {
          id: `obj_dyn_${Date.now()}`,
          text: pick.objText,
          type: pick.type,
          targetId: pick.targetId,
          current: 0,
          target: pick.count,
          done: false,
        },
      ],
    };
    this.missions.unshift(newMission);
    this.notify(`New Mission Accepted: ${newMission.title}`, '📜');
    this.emitMapAndMissions();
  }

  public emitMapAndMissions() {
    if (this.onMapAndMissionsUpdate) {
      this.onMapAndMissionsUpdate(
        [...this.worldSectors],
        this.surveyBeacons.map(({ mesh, ...rest }) => rest),
        [...this.missions],
        this.exploredCells.size,
        this.activeWaypoint
      );
    }
  }

  private initInitialStructures() {
    this.placeStructure('campfire', 3, 3, 0, true);
    this.placeStructure('wall_log', -5.5, 4.5, 0.35, true);
    // Spawn an initial persistent Rubble Pile from an old breached barricade on the perimeter
    this.spawnRubblePile('watchtower', -8.5, -5.5, 0.6, true);
  }

  public spawnRubblePile(
    originalType: PlacedStructure['type'],
    x: number,
    z: number,
    rotationY: number = 0,
    silent = false
  ): RubblePile {
    const y = getTerrainHeight(x, z);
    const id = `rubble_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const rubble: RubblePile = {
      id,
      originalType,
      x,
      y,
      z,
      rotationY,
      createdAt: Date.now(),
      salvageYield: [
        { itemId: 'wood', count: 5 },
        { itemId: 'stone', count: 3 },
      ],
    };

    const mesh = createRubblePileMesh(originalType);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotationY;
    this.scene.add(mesh);

    this.rubbleMeshes.set(id, mesh);
    this.rubblePiles.push(rubble);

    if (!silent) {
      this.notify(
        `Collapsed ${originalType.replace('_', ' ')} left a persistent Rubble Pile! [E] to salvage`,
        '🏚️'
      );
    }
    return rubble;
  }

  public restoreRubblePiles(savedRubble: RubblePile[]) {
    for (const mesh of this.rubbleMeshes.values()) {
      this.scene.remove(mesh);
    }
    this.rubbleMeshes.clear();
    this.rubblePiles = [];

    for (const r of savedRubble) {
      const y = getTerrainHeight(r.x, r.z);
      const mesh = createRubblePileMesh(r.originalType);
      mesh.position.set(r.x, y, r.z);
      mesh.rotation.y = r.rotationY || 0;
      this.scene.add(mesh);
      this.rubbleMeshes.set(r.id, mesh);
      this.rubblePiles.push({ ...r, y });
    }
  }

  public spawnDebrisBurst(
    x: number,
    y: number,
    z: number,
    count: number = 22
  ) {
    const types: ('wood' | 'stone' | 'iron')[] = ['wood', 'wood', 'stone', 'iron'];
    for (let i = 0; i < count; i++) {
      const matType = types[i % types.length];
      const mesh = createDebrisChunkMesh(matType);
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed = 3.5 + Math.random() * 6.5;
      const upVel = 4.5 + Math.random() * 6.2;

      mesh.position.set(
        x + Math.cos(angle) * 0.4,
        y + 0.5 + Math.random() * 1.1,
        z + Math.sin(angle) * 0.4
      );
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      this.scene.add(mesh);

      this.debrisParticles.push({
        mesh,
        velocity: new THREE.Vector3(
          Math.cos(angle) * speed,
          upVel,
          Math.sin(angle) * speed
        ),
        angularVelocity: new THREE.Vector3(
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12
        ),
        life: 0,
        maxLife: 4.5 + Math.random() * 2.5,
      });
    }
  }

  public destroyStructureIntoRubble(structId: string) {
    const idx = this.placedStructures.findIndex((s) => s.id === structId);
    if (idx === -1) return;
    const struct = this.placedStructures[idx];

    const mesh = this.structureMeshes.get(struct.id);
    if (mesh) {
      this.scene.remove(mesh);
      this.structureMeshes.delete(struct.id);
    }
    this.placedStructures.splice(idx, 1);

    // 1. Spawn flying 3D physical debris chunks
    this.spawnDebrisBurst(struct.x, struct.y, struct.z, 24);
    audioEngine.playAxeChop();
    audioEngine.playMiningPick();
    this.cameraTrauma = Math.min(1.0, this.cameraTrauma + 0.78);

    // 2. Spawn persistent 3D Rubble Pile in the world
    this.spawnRubblePile(
      struct.type,
      struct.x,
      struct.z,
      struct.rotationY,
      false
    );

    // 3. Apply shockwave ragdoll physics to nearby player or NPCs
    const sPos = new THREE.Vector3(struct.x, struct.y, struct.z);
    const pDist = this.playerGroup.position.distanceTo(sPos);
    if (pDist < 5.2) {
      const dir = new THREE.Vector3()
        .subVectors(this.playerGroup.position, sPos)
        .normalize();
      this.triggerPlayerRagdoll(dir, 10.5);
    }

    for (const npc of Object.values(this.npcs)) {
      const nDist = npc.mesh.position.distanceTo(sPos);
      if (nDist < 6.0) {
        const dir = new THREE.Vector3()
          .subVectors(npc.mesh.position, sPos)
          .normalize();
        this.triggerNPCRagdoll(npc.id, dir, 9.5);
      }
    }

    if (this.onStructurePlacedCallback) {
      this.onStructurePlacedCallback([...this.placedStructures]);
    }
  }

  public demolishNearestStructure() {
    let nearest: PlacedStructure | null = null;
    let minDist = 14.0;
    for (const s of this.placedStructures) {
      const d = Math.hypot(
        this.playerGroup.position.x - s.x,
        this.playerGroup.position.z - s.z
      );
      if (d < minDist) {
        minDist = d;
        nearest = s;
      }
    }

    if (nearest) {
      this.destroyStructureIntoRubble(nearest.id);
    } else {
      // Spawn a temporary barricade 3.5m ahead and immediately shatter it into flying debris + persistent rubble!
      const tx =
        this.playerGroup.position.x + Math.sin(this.playerFacingAngle) * 3.6;
      const tz =
        this.playerGroup.position.z + Math.cos(this.playerFacingAngle) * 3.6;
      this.placeStructure('wall_log', tx, tz, this.playerFacingAngle, true);
      const latest = this.placedStructures[this.placedStructures.length - 1];
      if (latest) {
        this.destroyStructureIntoRubble(latest.id);
      }
    }
  }

  public salvageRubblePile(rubbleId: string) {
    const idx = this.rubblePiles.findIndex((r) => r.id === rubbleId);
    if (idx === -1) return;
    const rubble = this.rubblePiles[idx];

    // Spawn small dust/splinter burst
    this.spawnDebrisBurst(rubble.x, rubble.y, rubble.z, 8);
    audioEngine.playAxeChop();

    for (const item of rubble.salvageYield) {
      this.addInventoryItem(item.itemId, item.count);
      this.recordMissionProgress('harvest', item.itemId, item.count);
    }

    const mesh = this.rubbleMeshes.get(rubble.id);
    if (mesh) {
      this.scene.remove(mesh);
      this.rubbleMeshes.delete(rubble.id);
    }
    this.rubblePiles.splice(idx, 1);
    this.addXP(35, 'engineering');
    this.notify(
      `Salvaged Reclaimed Timber & Stone from Rubble Pile! (+35 XP)`,
      '♻️'
    );
  }

  // Articulated Ragdoll Physics Trigger for Player
  public triggerPlayerRagdoll(
    impulseDir?: THREE.Vector3,
    strength: number = 11.0
  ) {
    if (this.playerRagdoll.active) {
      // Recover immediately if toggled again while ragdolling
      this.playerRagdoll.active = false;
      this.playerRagdoll.timer = 0;
      this.notify('Recovered from Ragdoll Physics state', '🧍');
      return;
    }

    const dir =
      impulseDir ||
      new THREE.Vector3(
        -Math.sin(this.playerFacingAngle) + (Math.random() - 0.5) * 0.5,
        0.65,
        -Math.cos(this.playerFacingAngle) + (Math.random() - 0.5) * 0.5
      ).normalize();

    this.playerRagdoll.active = true;
    this.playerRagdoll.timer = 0;
    this.playerRagdoll.duration = 2.6;
    this.playerRagdoll.velocity.set(
      dir.x * strength,
      Math.max(5.5, dir.y * strength),
      dir.z * strength
    );
    this.playerRagdoll.angularVel.set(
      (Math.random() > 0.5 ? 1 : -1) * (5.5 + Math.random() * 4.0),
      (Math.random() - 0.5) * 6.0,
      (Math.random() - 0.5) * 5.5
    );
    this.playerRagdoll.limbPhase = Math.random() * Math.PI * 2;
    this.cameraTrauma = Math.min(1.0, this.cameraTrauma + 0.55);
    audioEngine.playAttackSwish();
    this.notify('Ragdoll Physics Impulse Activated!', '💥');
  }

  // Articulated Ragdoll Physics Trigger for NPCs
  public triggerNPCRagdoll(
    npcId: string,
    impulseDir?: THREE.Vector3,
    strength: number = 9.5
  ) {
    const npc = this.npcs[npcId];
    if (!npc) return;

    const dir =
      impulseDir ||
      new THREE.Vector3(
        Math.sin(this.playerFacingAngle),
        0.55,
        Math.cos(this.playerFacingAngle)
      ).normalize();

    this.npcRagdolls[npcId] = {
      active: true,
      timer: 0,
      duration: 2.8,
      velocity: new THREE.Vector3(
        dir.x * strength,
        5.2,
        dir.z * strength
      ),
      angularVel: new THREE.Vector3(
        6.2,
        (Math.random() - 0.5) * 5.0,
        (Math.random() - 0.5) * 5.0
      ),
      limbPhase: Math.random() * Math.PI * 2,
    };
    audioEngine.playAttackSwish();
    this.notify(`${npc.name} knocked into Ragdoll Physics tumble!`, '💥');
  }

  public setNPCFollowing(npcId: string, follow: boolean) {
    const npc = this.npcs[npcId];
    if (!npc) return;
    npc.followingPlayer = follow;
    this.notify(
      follow
        ? `${npc.name} is now accompanying you on patrol!`
        : `${npc.name} is holding position at camp.`,
      follow ? '🛡️' : '⛺'
    );
  }

  private initInitialInventory() {
    this.hotbar[0] = { ...ITEM_CATALOG.stone_axe, count: 1 };
    this.hotbar[1] = { ...ITEM_CATALOG.stone_pickaxe, count: 1 };
    this.hotbar[2] = { ...ITEM_CATALOG.torch, count: 2 };
    this.hotbar[3] = { ...ITEM_CATALOG.clean_water, count: 2 };
    this.hotbar[4] = { ...ITEM_CATALOG.wild_berries, count: 8 };
    this.hotbar[5] = { ...ITEM_CATALOG.foundation_wood, count: 4 };

    this.inventory[0] = { ...ITEM_CATALOG.wood, count: 25 };
    this.inventory[1] = { ...ITEM_CATALOG.stone, count: 15 };
    this.inventory[2] = { ...ITEM_CATALOG.plant_fiber, count: 12 };
    this.inventory[3] = { ...ITEM_CATALOG.mountain_sage, count: 4 };
    this.inventory[4] = { ...ITEM_CATALOG.flint, count: 5 };
  }

  public placeStructure(
    type: PlacedStructure['type'],
    x: number,
    z: number,
    rotationY: number = 0,
    silent = false
  ) {
    const y = getTerrainHeight(x, z);
    const id = `struct_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const structure: PlacedStructure = {
      id,
      type,
      x,
      y,
      z,
      rotationY,
      health: 100,
      maxHealth: 100,
    };

    const mesh = createStructureMesh(type, false);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotationY;
    this.scene.add(mesh);

    this.structureMeshes.set(id, mesh);
    this.placedStructures.push(structure);
    if (!silent) {
      audioEngine.playBuildPlacement();
      this.recordMissionProgress('build', undefined, 1);
    }

    if (this.onStructurePlacedCallback) {
      this.onStructurePlacedCallback([...this.placedStructures]);
    }
    this.addXP(25, 'engineering');
  }

  public setPlacementMode(active: boolean, type?: PlacedStructure['type']) {
    this.placementActive = active;
    if (type) this.placementType = type;

    if (this.hologramMesh) {
      this.scene.remove(this.hologramMesh);
      this.hologramMesh = null;
    }

    if (active) {
      this.hologramMesh = createStructureMesh(this.placementType, true, true);
      this.scene.add(this.hologramMesh);
    }
  }

  public rotatePlacement() {
    this.placementRotation =
      (this.placementRotation + Math.PI / 4) % (Math.PI * 2);
    if (this.hologramMesh) {
      this.hologramMesh.rotation.y = this.placementRotation;
    }
  }

  public confirmPlacement() {
    if (!this.placementActive || !this.hologramMesh) return;

    const costWood = 10;
    if (
      !this.hasItemCount('wood', costWood) &&
      this.placementType === 'foundation_wood'
    ) {
      this.notify('Need 10 Timber Logs to build Foundation!', '🪵');
      return;
    }

    this.deductItem('wood', costWood);
    this.placeStructure(
      this.placementType,
      this.hologramMesh.position.x,
      this.hologramMesh.position.z,
      this.placementRotation
    );
    this.notify(`Placed ${this.placementType.replace('_', ' ')}!`, '🔨');
  }

  public toggleCoOpSimulation(enable: boolean) {
    if (enable && !this.coOpPartnerMesh) {
      this.coOpPartnerMesh = createNPCModel('vesper');
      const y = getTerrainHeight(4, -4);
      this.coOpPartnerMesh.position.set(4, y, -4);
      this.scene.add(this.coOpPartnerMesh);
      this.notify('Co-op Partner Kaelen connected to your world session!', '🤝');
    } else if (!enable && this.coOpPartnerMesh) {
      this.scene.remove(this.coOpPartnerMesh);
      this.coOpPartnerMesh = null;
      this.notify('Co-op session disconnected.', '🔌');
    }
  }

  public addInventoryItem(itemCatalogId: string, count: number = 1): boolean {
    const template = ITEM_CATALOG[itemCatalogId];
    if (!template) return false;

    for (let i = 0; i < this.hotbar.length; i++) {
      const slot = this.hotbar[i];
      if (slot && slot.id === template.id && slot.count < slot.maxStack) {
        slot.count = Math.min(slot.maxStack, slot.count + count);
        this.triggerInventoryChange();
        return true;
      }
    }

    for (let i = 0; i < this.inventory.length; i++) {
      const slot = this.inventory[i];
      if (slot && slot.id === template.id && slot.count < slot.maxStack) {
        slot.count = Math.min(slot.maxStack, slot.count + count);
        this.triggerInventoryChange();
        return true;
      }
    }

    for (let i = 0; i < this.hotbar.length; i++) {
      if (!this.hotbar[i]) {
        this.hotbar[i] = { ...template, count };
        this.triggerInventoryChange();
        return true;
      }
    }

    for (let i = 0; i < this.inventory.length; i++) {
      if (!this.inventory[i]) {
        this.inventory[i] = { ...template, count };
        this.triggerInventoryChange();
        return true;
      }
    }

    this.notify('Inventory is full!', '⚠️');
    return false;
  }

  public hasItemCount(itemId: string, required: number): boolean {
    let total = 0;
    for (const item of [...this.hotbar, ...this.inventory]) {
      if (item && item.id === itemId) {
        total += item.count;
      }
    }
    return total >= required;
  }

  public deductItem(itemId: string, count: number): boolean {
    if (!this.hasItemCount(itemId, count)) return false;
    let remaining = count;

    for (let i = 0; i < this.hotbar.length; i++) {
      const item = this.hotbar[i];
      if (item && item.id === itemId) {
        if (item.count <= remaining) {
          remaining -= item.count;
          this.hotbar[i] = null;
        } else {
          item.count -= remaining;
          remaining = 0;
        }
        if (remaining === 0) break;
      }
    }

    if (remaining > 0) {
      for (let i = 0; i < this.inventory.length; i++) {
        const item = this.inventory[i];
        if (item && item.id === itemId) {
          if (item.count <= remaining) {
            remaining -= item.count;
            this.inventory[i] = null;
          } else {
            item.count -= remaining;
            remaining = 0;
          }
          if (remaining === 0) break;
        }
      }
    }

    this.triggerInventoryChange();
    return true;
  }

  public triggerInventoryChange() {
    if (this.onInventoryUpdate) {
      this.onInventoryUpdate([...this.inventory], [...this.hotbar]);
    }
  }

  public addXP(amount: number, skillName: keyof PlayerSkills) {
    this.skills[skillName] += 1;
    this.vitals.xp += amount;
    if (this.vitals.xp >= this.vitals.nextLevelXp) {
      this.vitals.level += 1;
      this.vitals.xp -= this.vitals.nextLevelXp;
      this.vitals.nextLevelXp = Math.floor(this.vitals.nextLevelXp * 1.5);
      this.vitals.maxHealth += 10;
      this.vitals.health = this.vitals.maxHealth;
      this.notify(`Level Up! Reached Rank ${this.vitals.level}`, '⭐');
      audioEngine.playCraftSuccess();
      if (this.onLevelUp) this.onLevelUp(this.vitals.level);
    }
  }

  public notify(text: string, icon = '🔔') {
    if (this.onNotification) {
      this.onNotification(text, icon);
    }
  }

  public performAction() {
    this.swingAnimTimer = 0.35;
    audioEngine.playAttackSwish();

    // 1. Check if striking an NPC (triggers physical ragdoll reaction!)
    for (const npc of Object.values(this.npcs)) {
      const dist = this.playerGroup.position.distanceTo(npc.mesh.position);
      if (dist < 2.6) {
        const dir = new THREE.Vector3()
          .subVectors(npc.mesh.position, this.playerGroup.position)
          .normalize();
        this.triggerNPCRagdoll(npc.id, dir, 9.5);
        this.cameraTrauma = Math.min(1.0, this.cameraTrauma + 0.35);
        return;
      }
    }

    // 2. Check if striking a Placed Structure (damages structure, spawns debris, collapses into persistent Rubble Pile!)
    for (const struct of this.placedStructures) {
      const sPos = new THREE.Vector3(struct.x, struct.y, struct.z);
      const dist = this.playerGroup.position.distanceTo(sPos);
      if (dist < 3.4) {
        struct.health -= 35;
        this.spawnDebrisBurst(struct.x, struct.y, struct.z, 6);
        audioEngine.playAxeChop();
        this.cameraTrauma = Math.min(1.0, this.cameraTrauma + 0.35);

        const sMesh = this.structureMeshes.get(struct.id);
        if (sMesh) {
          sMesh.rotation.z = (Math.random() - 0.5) * 0.08;
        }

        if (struct.health <= 0) {
          this.destroyStructureIntoRubble(struct.id);
        } else {
          this.notify(
            `Damaged ${struct.type.replace('_', ' ')} (${Math.max(
              0,
              struct.health
            )}/${struct.maxHealth} HP)`,
            '🔨'
          );
        }
        return;
      }
    }

    // 3. Check Harvestable Resource Nodes
    let nearestNode: (typeof this.harvestNodes)[0] | null = null;
    let minDist = 3.4;

    for (const node of this.harvestNodes) {
      const dist = this.playerGroup.position.distanceTo(node.mesh.position);
      if (dist < minDist) {
        minDist = dist;
        nearestNode = node;
      }
    }

    if (nearestNode) {
      const activeSlot = this.hotbar[this.selectedHotbarSlot];
      let damage = 15;
      if (nearestNode.yieldItem === 'wood') {
        audioEngine.playAxeChop();
        damage = activeSlot?.stats?.woodBonus ? 28 : 14;
        this.addXP(10, 'woodcraft');
      } else if (
        nearestNode.yieldItem === 'stone' ||
        nearestNode.yieldItem === 'iron_ore'
      ) {
        audioEngine.playMiningPick();
        damage = activeSlot?.stats?.stoneBonus ? 30 : 15;
        this.addXP(12, 'mining');
      } else {
        audioEngine.playFootstep('grass');
        damage = 20;
        this.addXP(8, 'foraging');
      }

      nearestNode.health -= damage;
      this.cameraTrauma = Math.min(1.0, this.cameraTrauma + 0.32);
      nearestNode.mesh.scale.multiplyScalar(0.96);

      if (nearestNode.health <= 0) {
        this.addInventoryItem(nearestNode.yieldItem, nearestNode.yieldCount);
        this.recordMissionProgress(
          'harvest',
          nearestNode.yieldItem,
          nearestNode.yieldCount
        );
        this.notify(
          `Harvested +${nearestNode.yieldCount} ${
            ITEM_CATALOG[nearestNode.yieldItem]?.name || nearestNode.yieldItem
          }!`,
          ITEM_CATALOG[nearestNode.yieldItem]?.icon || '📦'
        );
        this.scene.remove(nearestNode.mesh);
        this.harvestNodes = this.harvestNodes.filter(
          (n) => n.id !== nearestNode!.id
        );
      } else {
        this.addInventoryItem(nearestNode.yieldItem, 1);
        this.recordMissionProgress('harvest', nearestNode.yieldItem, 1);
      }
    }
  }

  public interactNearest() {
    // 1. Check Survey Beacon interaction first
    for (const beacon of this.surveyBeacons) {
      if (!beacon.activated) {
        const dist = this.playerGroup.position.distanceTo(beacon.mesh.position);
        if (dist < 4.5) {
          this.activateSurveyBeacon(beacon.id);
          return;
        }
      }
    }

    // 2. Check Persistent Rubble Pile Salvage interaction
    for (const rubble of this.rubblePiles) {
      const dist = Math.hypot(
        this.playerGroup.position.x - rubble.x,
        this.playerGroup.position.z - rubble.z
      );
      if (dist < 3.6) {
        this.salvageRubblePile(rubble.id);
        return;
      }
    }

    // 3. Check NPC interaction
    for (const npc of Object.values(this.npcs)) {
      const dist = this.playerGroup.position.distanceTo(npc.mesh.position);
      if (dist < 3.8) {
        this.recordMissionProgress('talk_npc', undefined, 1);
        if (this.onNPCInteract) {
          this.onNPCInteract(npc);
          return;
        }
      }
    }

    // 4. Check Campfire rest & cook
    for (const struct of this.placedStructures) {
      if (struct.type === 'campfire') {
        const dist = this.playerGroup.position.distanceTo(
          new THREE.Vector3(struct.x, struct.y, struct.z)
        );
        if (dist < 3.8) {
          this.vitals.temperature = Math.min(37, this.vitals.temperature + 4);
          this.vitals.morale = Math.min(100, this.vitals.morale + 10);
          this.vitals.health = Math.min(
            this.vitals.maxHealth,
            this.vitals.health + 12
          );
          this.recordMissionProgress('rest_campfire', undefined, 1);
          this.notify('Rested by the campfire warmth (+Health & Morale)!', '🔥');
          audioEngine.playIntimateMomentChord();
          return;
        }
      }
    }

    // 5. Fallback harvest
    this.performAction();
  }

  public triggerDodgeRoll() {
    if (this.rollTimer > 0 || this.playerRagdoll.active) return;
    if (this.vitals.stamina < 15) {
      this.notify('Not enough stamina for tactical roll!', '⚡');
      return;
    }
    this.vitals.stamina = Math.max(0, this.vitals.stamina - 15);
    this.rollTimer = 0.48;
    audioEngine.playAttackSwish();

    let rollDirX = this.playerVelocity.x;
    let rollDirZ = this.playerVelocity.z;
    const currentSpeed = Math.hypot(rollDirX, rollDirZ);
    if (currentSpeed > 0.5) {
      rollDirX /= currentSpeed;
      rollDirZ /= currentSpeed;
    } else {
      rollDirX = Math.sin(this.playerFacingAngle);
      rollDirZ = Math.cos(this.playerFacingAngle);
    }

    const impulseSpeed = 14.5;
    this.playerVelocity.x = rollDirX * impulseSpeed;
    this.playerVelocity.z = rollDirZ * impulseSpeed;
    this.cameraTrauma = Math.min(1.0, this.cameraTrauma + 0.25);
    this.notify('Tactical Dodge Roll', '💨');
  }

  // Update Flying Debris Fragments & NPC Companion AI + Ragdoll Physics
  private updatePhysicsAndCompanions(delta: number) {
    // 1. Update 3D Flying Debris Fragments (Ballistic Trajectory + Ground Bounce + Friction)
    for (let i = this.debrisParticles.length - 1; i >= 0; i--) {
      const p = this.debrisParticles[i];
      p.life += delta;
      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        this.debrisParticles.splice(i, 1);
        continue;
      }

      p.velocity.y -= 19.6 * delta; // Gravity
      p.mesh.position.x += p.velocity.x * delta;
      p.mesh.position.y += p.velocity.y * delta;
      p.mesh.position.z += p.velocity.z * delta;

      p.mesh.rotation.x += p.angularVelocity.x * delta;
      p.mesh.rotation.y += p.angularVelocity.y * delta;
      p.mesh.rotation.z += p.angularVelocity.z * delta;

      const groundY =
        getTerrainHeight(p.mesh.position.x, p.mesh.position.z) + 0.08;
      if (p.mesh.position.y <= groundY) {
        p.mesh.position.y = groundY;
        p.velocity.y = Math.abs(p.velocity.y) * 0.36; // Ground bounce restitution
        p.velocity.x *= 0.72;
        p.velocity.z *= 0.72;
        p.angularVelocity.multiplyScalar(0.68);
      }

      // Fade out gently in final second
      if (p.life > p.maxLife - 0.8) {
        const s = Math.max(0.05, (p.maxLife - p.life) / 0.8);
        p.mesh.scale.setScalar(s);
      }
    }

    // 2. Update NPCs (Ragdoll Physics OR Autonomous Companion Follow + Head-Tracking)
    const time = this.clock.getElapsedTime();
    Object.values(this.npcs).forEach((npc, idx) => {
      const parts = npc.mesh.userData.parts as NPCModelParts | undefined;
      const rag = this.npcRagdolls[npc.id];

      if (parts?.marker) {
        parts.marker.rotation.y = time * 2.0 + idx;
        parts.marker.position.y = 2.38 + Math.sin(time * 2.5 + idx) * 0.06;
      }

      if (rag && rag.active) {
        rag.timer += delta;
        rag.velocity.y -= 20.0 * delta;
        npc.mesh.position.x += rag.velocity.x * delta;
        npc.mesh.position.y += rag.velocity.y * delta;
        npc.mesh.position.z += rag.velocity.z * delta;

        const gy = getTerrainHeight(npc.mesh.position.x, npc.mesh.position.z);
        if (npc.mesh.position.y <= gy) {
          npc.mesh.position.y = gy;
          rag.velocity.y = Math.abs(rag.velocity.y) * 0.3;
          rag.velocity.x *= 0.78;
          rag.velocity.z *= 0.78;
          rag.angularVel.multiplyScalar(0.75);
        }

        if (parts) {
          // Articulated ragdoll collapse & limb flail
          parts.pelvisGroup.position.y = THREE.MathUtils.damp(
            parts.pelvisGroup.position.y,
            0.28,
            10,
            delta
          );
          parts.pelvisGroup.rotation.x = THREE.MathUtils.damp(
            parts.pelvisGroup.rotation.x,
            -Math.PI * 0.46,
            8,
            delta
          );
          parts.pelvisGroup.rotation.z =
            Math.sin(rag.timer * 8 + rag.limbPhase) * 0.35;
          parts.leftArm.rotation.x =
            -1.2 + Math.sin(rag.timer * 12) * 0.65;
          parts.rightArm.rotation.x =
            -1.2 + Math.cos(rag.timer * 12) * 0.65;
          parts.leftLeg.rotation.x =
            0.45 + Math.sin(rag.timer * 10) * 0.45;
          parts.rightLeg.rotation.x =
            -0.35 + Math.cos(rag.timer * 10) * 0.45;
        }

        npc.position.x = npc.mesh.position.x;
        npc.position.y = npc.mesh.position.y;
        npc.position.z = npc.mesh.position.z;

        if (rag.timer >= rag.duration) {
          rag.active = false;
        }
        return;
      }

      // Smooth recovery & normal articulated NPC behavior
      if (parts) {
        parts.pelvisGroup.position.y = THREE.MathUtils.damp(
          parts.pelvisGroup.position.y,
          0.94,
          8,
          delta
        );
        parts.pelvisGroup.rotation.x = THREE.MathUtils.damp(
          parts.pelvisGroup.rotation.x,
          0,
          8,
          delta
        );
        parts.pelvisGroup.rotation.z = THREE.MathUtils.damp(
          parts.pelvisGroup.rotation.z,
          0,
          8,
          delta
        );
      }

      const dx = this.playerGroup.position.x - npc.mesh.position.x;
      const dz = this.playerGroup.position.z - npc.mesh.position.z;
      const distToPlayer = Math.hypot(dx, dz);

      if (npc.followingPlayer && distToPlayer > 2.8) {
        // Companion Follow Mode: Walk alongside the player!
        const moveAngle = Math.atan2(dx, dz);
        const followSpeed = distToPlayer > 9 ? 7.2 : 5.2;
        npc.mesh.position.x += Math.sin(moveAngle) * followSpeed * delta;
        npc.mesh.position.z += Math.cos(moveAngle) * followSpeed * delta;
        npc.mesh.position.y = getTerrainHeight(
          npc.mesh.position.x,
          npc.mesh.position.z
        );
        npc.mesh.rotation.y = THREE.MathUtils.damp(
          npc.mesh.rotation.y,
          moveAngle,
          10,
          delta
        );

        npc.position.x = npc.mesh.position.x;
        npc.position.y = npc.mesh.position.y;
        npc.position.z = npc.mesh.position.z;

        if (parts) {
          const gait = Math.sin(time * 9.5 + idx) * 0.55;
          parts.leftLeg.rotation.x = gait;
          parts.rightLeg.rotation.x = -gait;
          parts.leftArm.rotation.x = -gait * 0.7;
          parts.rightArm.rotation.x = gait * 0.7;
          parts.pelvisGroup.position.y =
            0.94 + Math.abs(Math.sin(time * 9.5 + idx)) * 0.03;
        }
      } else {
        // Standing / Guarding: Turn smoothly toward player when nearby & animate subtle breathing + head tracking
        if (distToPlayer < 8.5) {
          const targetYaw = Math.atan2(dx, dz);
          npc.mesh.rotation.y = THREE.MathUtils.damp(
            npc.mesh.rotation.y,
            targetYaw,
            6,
            delta
          );
          if (parts) {
            parts.headGroup.rotation.x = THREE.MathUtils.damp(
              parts.headGroup.rotation.x,
              -0.06,
              6,
              delta
            );
            // Subtle welcoming wave/gesture when very close
            parts.rightArm.rotation.x = THREE.MathUtils.damp(
              parts.rightArm.rotation.x,
              distToPlayer < 3.5 ? -0.35 + Math.sin(time * 3.5) * 0.12 : 0,
              6,
              delta
            );
          }
        } else if (parts) {
          parts.headGroup.rotation.y = Math.sin(time * 0.8 + idx) * 0.22;
          parts.rightArm.rotation.x = THREE.MathUtils.damp(
            parts.rightArm.rotation.x,
            0,
            6,
            delta
          );
        }

        if (parts) {
          parts.leftLeg.rotation.x = THREE.MathUtils.damp(
            parts.leftLeg.rotation.x,
            0,
            8,
            delta
          );
          parts.rightLeg.rotation.x = THREE.MathUtils.damp(
            parts.rightLeg.rotation.x,
            0,
            8,
            delta
          );
          parts.leftArm.rotation.x = THREE.MathUtils.damp(
            parts.leftArm.rotation.x,
            0,
            8,
            delta
          );
          parts.spineGroup.position.y = 0.08 + Math.sin(time * 1.8 + idx) * 0.01;
        }
      }
    });
  }

  private updatePlayerMovement(delta: number) {
    // Handle Active Player Ragdoll Physics Simulation
    if (this.playerRagdoll.active) {
      this.playerRagdoll.timer += delta;
      this.playerRagdoll.velocity.y -= 21.0 * delta;

      this.playerGroup.position.x += this.playerRagdoll.velocity.x * delta;
      this.playerGroup.position.y += this.playerRagdoll.velocity.y * delta;
      this.playerGroup.position.z += this.playerRagdoll.velocity.z * delta;

      const groundY = getTerrainHeight(
        this.playerGroup.position.x,
        this.playerGroup.position.z
      );
      if (this.playerGroup.position.y <= groundY) {
        this.playerGroup.position.y = groundY;
        if (Math.abs(this.playerRagdoll.velocity.y) > 2.2) {
          audioEngine.playFootstep('stone');
        }
        this.playerRagdoll.velocity.y =
          Math.abs(this.playerRagdoll.velocity.y) * 0.34;
        this.playerRagdoll.velocity.x *= 0.78;
        this.playerRagdoll.velocity.z *= 0.78;
        this.playerRagdoll.angularVel.multiplyScalar(0.75);
      }

      // Articulated Ragdoll Body & Limb Kinematics
      const t = this.playerRagdoll.timer;
      const p = this.playerRagdoll.limbPhase;
      this.playerParts.pelvisGroup.position.y = THREE.MathUtils.damp(
        this.playerParts.pelvisGroup.position.y,
        0.26,
        10,
        delta
      );
      this.playerParts.pelvisGroup.rotation.x = THREE.MathUtils.damp(
        this.playerParts.pelvisGroup.rotation.x,
        -Math.PI * 0.47,
        9,
        delta
      );
      this.playerParts.pelvisGroup.rotation.z =
        Math.sin(t * 7.0 + p) * 0.42;
      this.playerParts.spineGroup.position.y = 0.08;
      this.playerParts.spineGroup.rotation.x =
        0.28 + Math.sin(t * 9.0) * 0.25;
      this.playerParts.spineGroup.rotation.z =
        Math.cos(t * 8.0 + p) * 0.3;

      this.playerParts.leftArm.rotation.x =
        -1.35 + Math.sin(t * 14.0 + p) * 0.75;
      this.playerParts.rightArm.rotation.x =
        -1.25 + Math.cos(t * 13.0 + p) * 0.75;
      this.playerParts.leftForearm.rotation.x = -0.65;
      this.playerParts.rightForearm.rotation.x = -0.65;

      this.playerParts.leftLeg.rotation.x =
        0.5 + Math.sin(t * 11.0) * 0.55;
      this.playerParts.rightLeg.rotation.x =
        -0.4 + Math.cos(t * 11.0) * 0.55;
      this.playerParts.leftLowerLeg.rotation.x = 0.85;
      this.playerParts.rightLowerLeg.rotation.x = 0.75;

      if (this.playerRagdoll.timer >= this.playerRagdoll.duration) {
        this.playerRagdoll.active = false;
        this.playerParts.pelvisGroup.rotation.z = 0;
        this.notify('Survivor recovered to standing posture', '🧍');
      }
      return;
    }

    const isSprinting =
      (this.keys['ShiftLeft'] || this.keys['ShiftRight']) &&
      this.vitals.stamina > 5;
    let baseSpeed = isSprinting ? 10.2 : 6.2;

    if (
      isSprinting &&
      (this.keys['KeyW'] ||
        this.keys['KeyA'] ||
        this.keys['KeyS'] ||
        this.keys['KeyD'] ||
        Math.abs(this.joystickVector.x) > 0.1 ||
        Math.abs(this.joystickVector.y) > 0.1)
    ) {
      this.vitals.stamina = Math.max(0, this.vitals.stamina - delta * 12);
    } else if (this.rollTimer <= 0) {
      this.vitals.stamina = Math.min(
        this.vitals.maxStamina,
        this.vitals.stamina + delta * 14
      );
    }

    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    let moveX = 0;
    let moveZ = 0;

    if (this.keys['KeyW'] || this.keys['ArrowUp']) {
      moveX += forward.x;
      moveZ += forward.z;
    }
    if (this.keys['KeyS'] || this.keys['ArrowDown']) {
      moveX -= forward.x;
      moveZ -= forward.z;
    }
    if (this.keys['KeyD'] || this.keys['ArrowRight']) {
      moveX += right.x;
      moveZ += right.z;
    }
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
      moveX -= right.x;
      moveZ -= right.z;
    }

    if (
      Math.abs(this.joystickVector.x) > 0.05 ||
      Math.abs(this.joystickVector.y) > 0.05
    ) {
      moveX +=
        right.x * this.joystickVector.x - forward.x * this.joystickVector.y;
      moveZ +=
        right.z * this.joystickVector.x - forward.z * this.joystickVector.y;
    }

    const moveLength = Math.sqrt(moveX * moveX + moveZ * moveZ);
    const isMoving = moveLength > 0.05;

    // Terrain Slope Physics
    const checkDist = 0.65;
    const curY = getTerrainHeight(
      this.playerGroup.position.x,
      this.playerGroup.position.z
    );
    const aheadX =
      this.playerGroup.position.x +
      (isMoving ? moveX / moveLength : Math.sin(this.playerFacingAngle)) *
        checkDist;
    const aheadZ =
      this.playerGroup.position.z +
      (isMoving ? moveZ / moveLength : Math.cos(this.playerFacingAngle)) *
        checkDist;
    const aheadY = getTerrainHeight(aheadX, aheadZ);
    const slope = (aheadY - curY) / checkDist;

    let slopeMod = 1.0;
    if (slope > 0) {
      slopeMod = Math.max(0.42, 1.0 - slope * 0.65);
      if (slope > 0.85) slopeMod = 0.2;
    } else {
      slopeMod = Math.min(1.25, 1.0 - slope * 0.28);
    }

    const surfaceTraction = Math.max(
      0.7,
      1.0 - (this.vitals.wetness / 100) * 0.3
    );
    baseSpeed = baseSpeed * slopeMod * surfaceTraction;

    const sd = 0.45;
    const hL = getTerrainHeight(
      this.playerGroup.position.x - sd,
      this.playerGroup.position.z
    );
    const hR = getTerrainHeight(
      this.playerGroup.position.x + sd,
      this.playerGroup.position.z
    );
    const hF = getTerrainHeight(
      this.playerGroup.position.x,
      this.playerGroup.position.z + sd
    );
    const hB = getTerrainHeight(
      this.playerGroup.position.x,
      this.playerGroup.position.z - sd
    );
    const pitchSlope = Math.atan2(hF - hB, sd * 2);
    const rollSlope = Math.atan2(hR - hL, sd * 2);

    this.playerGroup.rotation.x = THREE.MathUtils.damp(
      this.playerGroup.rotation.x,
      -pitchSlope * 0.6,
      8,
      delta
    );
    this.playerGroup.rotation.z = THREE.MathUtils.damp(
      this.playerGroup.rotation.z,
      rollSlope * 0.6,
      8,
      delta
    );

    // Kinematic Velocity & Seamless Anatomical Animation (NO SPLIT TORSO!)
    if (this.rollTimer > 0) {
      this.rollTimer -= delta;
      const rollProgress = Math.min(1, (0.48 - this.rollTimer) / 0.48);

      this.playerParts.pelvisGroup.rotation.x = -rollProgress * Math.PI * 2;
      this.playerParts.spineGroup.rotation.x = 0.35;
      this.playerParts.spineGroup.position.y = 0.08;
      this.playerParts.leftLeg.rotation.x = 0.85;
      this.playerParts.rightLeg.rotation.x = 0.85;
      this.playerParts.leftLowerLeg.rotation.x = 1.25;
      this.playerParts.rightLowerLeg.rotation.x = 1.25;
      this.playerParts.leftArm.rotation.x = -1.1;
      this.playerParts.rightArm.rotation.x = -1.1;

      this.playerVelocity.x = THREE.MathUtils.damp(
        this.playerVelocity.x,
        0,
        4.5,
        delta
      );
      this.playerVelocity.z = THREE.MathUtils.damp(
        this.playerVelocity.z,
        0,
        4.5,
        delta
      );
    } else if (isMoving) {
      this.playerParts.pelvisGroup.rotation.x = THREE.MathUtils.damp(
        this.playerParts.pelvisGroup.rotation.x,
        0,
        12,
        delta
      );
      this.playerParts.pelvisGroup.rotation.z = THREE.MathUtils.damp(
        this.playerParts.pelvisGroup.rotation.z,
        0,
        12,
        delta
      );
      moveX /= moveLength;
      moveZ /= moveLength;

      this.playerVelocity.x = THREE.MathUtils.damp(
        this.playerVelocity.x,
        moveX * baseSpeed,
        12,
        delta
      );
      this.playerVelocity.z = THREE.MathUtils.damp(
        this.playerVelocity.z,
        moveZ * baseSpeed,
        12,
        delta
      );

      this.playerFacingAngle = Math.atan2(moveX, moveZ);
      this.playerGroup.rotation.y = THREE.MathUtils.damp(
        this.playerGroup.rotation.y,
        this.playerFacingAngle,
        14,
        delta
      );

      this.walkAnimTimer += delta * (isSprinting ? 15 : 9.5);
      const legAngle =
        Math.sin(this.walkAnimTimer) * (isSprinting ? 0.72 : 0.56);
      this.playerParts.leftLeg.rotation.x = legAngle;
      this.playerParts.rightLeg.rotation.x = -legAngle;

      this.playerParts.leftLowerLeg.rotation.x = Math.max(
        0.06,
        -legAngle * 1.1
      );
      this.playerParts.rightLowerLeg.rotation.x = Math.max(
        0.06,
        legAngle * 1.1
      );

      this.playerParts.leftArm.rotation.x = -legAngle * 0.75;
      this.playerParts.leftForearm.rotation.x = -Math.max(
        0.18,
        -legAngle * 0.8
      );

      if (this.swingAnimTimer <= 0) {
        this.playerParts.rightArm.rotation.x = legAngle * 0.75;
        this.playerParts.rightForearm.rotation.x = -Math.max(
          0.18,
          legAngle * 0.8
        );
      }

      const headingDiff =
        moveX * Math.cos(this.playerFacingAngle) -
        moveZ * Math.sin(this.playerFacingAngle);
      this.playerParts.spineGroup.rotation.z = THREE.MathUtils.damp(
        this.playerParts.spineGroup.rotation.z,
        headingDiff * 0.16,
        10,
        delta
      );
      this.playerParts.spineGroup.rotation.x = THREE.MathUtils.damp(
        this.playerParts.spineGroup.rotation.x,
        isSprinting ? 0.12 : 0.06,
        8,
        delta
      );

      // Bounce WHOLE pelvis + torso together at hip height (0.94) while spineGroup stays locked at socket (0.08)!
      this.playerParts.pelvisGroup.position.y =
        0.94 + Math.abs(Math.sin(this.walkAnimTimer)) * 0.035;
      this.playerParts.spineGroup.position.y = 0.08;

      if (Math.sin(this.walkAnimTimer) > 0.94 && Math.random() < 0.24) {
        const riverX = 40 + Math.sin(this.playerGroup.position.z * 0.035) * 18;
        const inRiver = Math.abs(this.playerGroup.position.x - riverX) < 8.5;
        audioEngine.playFootstep(inRiver ? 'water' : 'grass');
      }
    } else {
      this.playerParts.pelvisGroup.rotation.x = THREE.MathUtils.damp(
        this.playerParts.pelvisGroup.rotation.x,
        0,
        12,
        delta
      );
      this.playerParts.pelvisGroup.rotation.z = THREE.MathUtils.damp(
        this.playerParts.pelvisGroup.rotation.z,
        0,
        12,
        delta
      );
      this.playerVelocity.x = THREE.MathUtils.damp(
        this.playerVelocity.x,
        0,
        12,
        delta
      );
      this.playerVelocity.z = THREE.MathUtils.damp(
        this.playerVelocity.z,
        0,
        12,
        delta
      );

      this.playerParts.leftLeg.rotation.x = THREE.MathUtils.damp(
        this.playerParts.leftLeg.rotation.x,
        0,
        8,
        delta
      );
      this.playerParts.rightLeg.rotation.x = THREE.MathUtils.damp(
        this.playerParts.rightLeg.rotation.x,
        0,
        8,
        delta
      );
      this.playerParts.leftLowerLeg.rotation.x = THREE.MathUtils.damp(
        this.playerParts.leftLowerLeg.rotation.x,
        0.04,
        8,
        delta
      );
      this.playerParts.rightLowerLeg.rotation.x = THREE.MathUtils.damp(
        this.playerParts.rightLowerLeg.rotation.x,
        0.04,
        8,
        delta
      );
      this.playerParts.leftArm.rotation.x = THREE.MathUtils.damp(
        this.playerParts.leftArm.rotation.x,
        0.04,
        8,
        delta
      );
      this.playerParts.leftForearm.rotation.x = THREE.MathUtils.damp(
        this.playerParts.leftForearm.rotation.x,
        -0.2,
        8,
        delta
      );

      if (this.swingAnimTimer <= 0) {
        this.playerParts.rightArm.rotation.x = THREE.MathUtils.damp(
          this.playerParts.rightArm.rotation.x,
          0.04,
          8,
          delta
        );
        this.playerParts.rightForearm.rotation.x = THREE.MathUtils.damp(
          this.playerParts.rightForearm.rotation.x,
          -0.2,
          8,
          delta
        );
      }

      this.playerParts.spineGroup.rotation.z = THREE.MathUtils.damp(
        this.playerParts.spineGroup.rotation.z,
        0,
        8,
        delta
      );
      this.playerParts.spineGroup.rotation.x = THREE.MathUtils.damp(
        this.playerParts.spineGroup.rotation.x,
        0,
        8,
        delta
      );

      // Subtle breathing at anatomical socket (0.08 +/- 0.01) — never splits torso from pelvis!
      this.walkAnimTimer += delta * 1.5;
      const breathe = Math.sin(this.walkAnimTimer) * 0.01;
      this.playerParts.pelvisGroup.position.y = 0.94;
      this.playerParts.spineGroup.position.y = 0.08 + breathe;
      this.playerParts.neckGroup.rotation.x = breathe * 0.3;
    }

    // Secondary Cloth Physics on Scarf Tail
    const hSpeed = Math.hypot(this.playerVelocity.x, this.playerVelocity.z);
    const windSpeed = this.weatherSystem?.state.windSpeed || 0;
    const targetScarfPitch =
      -hSpeed * 0.08 -
      windSpeed * 0.04 +
      Math.sin(this.walkAnimTimer * 2.2) * 0.12;
    this.playerParts.scarfTail.rotation.x = THREE.MathUtils.damp(
      this.playerParts.scarfTail.rotation.x,
      targetScarfPitch,
      10,
      delta
    );
    this.playerParts.scarfTail.rotation.z =
      Math.cos(this.walkAnimTimer * 1.6) * 0.08;

    // Jump Physics
    if (
      this.keys['Space'] &&
      this.isGrounded &&
      this.vitals.stamina >= 10 &&
      this.rollTimer <= 0
    ) {
      this.playerVelocity.y = 8.5;
      this.isGrounded = false;
      this.vitals.stamina -= 10;
    }

    this.playerVelocity.y -= 22 * delta;

    this.playerGroup.position.x += this.playerVelocity.x * delta;
    this.playerGroup.position.z += this.playerVelocity.z * delta;
    this.playerGroup.position.y += this.playerVelocity.y * delta;

    // Clamp to outer 280m world rim
    const rDist = Math.hypot(
      this.playerGroup.position.x,
      this.playerGroup.position.z
    );
    if (rDist > 272) {
      const scale = 272 / rDist;
      this.playerGroup.position.x *= scale;
      this.playerGroup.position.z *= scale;
    }

    const groundY = getTerrainHeight(
      this.playerGroup.position.x,
      this.playerGroup.position.z
    );
    if (this.playerGroup.position.y <= groundY) {
      this.playerGroup.position.y = groundY;
      this.playerVelocity.y = 0;
      this.isGrounded = true;
    }

    if (this.swingAnimTimer > 0) {
      this.swingAnimTimer -= delta;
      const progress = (0.35 - this.swingAnimTimer) / 0.35;
      this.playerParts.rightArm.rotation.x =
        -Math.sin(progress * Math.PI) * 1.65;
      this.playerParts.rightForearm.rotation.x =
        -Math.sin(progress * Math.PI) * 0.95;
      this.playerParts.spineGroup.rotation.y =
        Math.sin(progress * Math.PI) * 0.25;
    } else {
      this.playerParts.spineGroup.rotation.y = THREE.MathUtils.damp(
        this.playerParts.spineGroup.rotation.y,
        0,
        10,
        delta
      );
    }

    // Check interaction prompts (Survey Beacons, Rubble Piles, NPCs, Harvest Nodes, Structures)
    let promptTarget: string | null = null;
    for (const beacon of this.surveyBeacons) {
      if (
        !beacon.activated &&
        this.playerGroup.position.distanceTo(beacon.mesh.position) < 4.5
      ) {
        promptTarget = `Activate ${beacon.name} to Expand Map [E]`;
        break;
      }
    }
    if (!promptTarget) {
      for (const rubble of this.rubblePiles) {
        if (
          Math.hypot(
            this.playerGroup.position.x - rubble.x,
            this.playerGroup.position.z - rubble.z
          ) < 3.6
        ) {
          promptTarget = `Salvage Persistent ${rubble.originalType.replace(
            '_',
            ' '
          )} Rubble Pile [E]`;
          break;
        }
      }
    }
    if (!promptTarget) {
      for (const npc of Object.values(this.npcs)) {
        if (this.playerGroup.position.distanceTo(npc.mesh.position) < 3.8) {
          promptTarget = `Talk with ${npc.name} [E] · Strike for Ragdoll [Click]`;
          break;
        }
      }
    }
    if (!promptTarget) {
      for (const node of this.harvestNodes) {
        if (this.playerGroup.position.distanceTo(node.mesh.position) < 3.4) {
          promptTarget = `Harvest ${
            ITEM_CATALOG[node.yieldItem]?.name || 'Resource'
          } [E / Click]`;
          break;
        }
      }
    }
    if (!promptTarget) {
      for (const struct of this.placedStructures) {
        const d = this.playerGroup.position.distanceTo(
          new THREE.Vector3(struct.x, struct.y, struct.z)
        );
        if (d < 3.8) {
          if (struct.type === 'campfire') {
            promptTarget =
              'Warm & Rest by Campfire [E] · Strike to Demolish into Rubble [Click]';
          } else {
            promptTarget = `Strike ${struct.type.replace(
              '_',
              ' '
            )} (${struct.health}/${struct.maxHealth} HP) to Shatter into Rubble [Click / X]`;
          }
          break;
        }
      }
    }
    if (this.onInteractTargetChange) {
      this.onInteractTargetChange(promptTarget);
    }

    if (this.placementActive && this.hologramMesh) {
      const holoDist = 4.0;
      const hx =
        this.playerGroup.position.x +
        Math.sin(this.playerFacingAngle) * holoDist;
      const hz =
        this.playerGroup.position.z +
        Math.cos(this.playerFacingAngle) * holoDist;
      const snappedX = Math.round(hx / 1.5) * 1.5;
      const snappedZ = Math.round(hz / 1.5) * 1.5;
      const hy = getTerrainHeight(snappedX, snappedZ);
      this.hologramMesh.position.set(snappedX, hy, snappedZ);
      this.hologramMesh.rotation.y = this.placementRotation;
    }
  }

  private updateCamera(delta: number) {
    _vec3A.copy(this.playerGroup.position);
    _vec3A.y += 1.55;

    const cosPitch = Math.cos(this.cameraPitch);
    const sinPitch = Math.sin(this.cameraPitch);
    const sinYaw = Math.sin(this.cameraYaw);
    const cosYaw = Math.cos(this.cameraYaw);

    _camOffset.set(
      sinYaw * cosPitch * this.cameraDistance,
      sinPitch * this.cameraDistance,
      cosYaw * cosPitch * this.cameraDistance
    );

    if (this.cameraTrauma > 0) {
      const shakeMag = this.cameraTrauma * this.cameraTrauma * 0.45;
      _camOffset.x += (Math.random() - 0.5) * shakeMag;
      _camOffset.y += (Math.random() - 0.5) * shakeMag;
      this.cameraTrauma = Math.max(0, this.cameraTrauma - delta * 3.8);
    }

    if (this.walkAnimTimer > 0) {
      _camOffset.y += Math.sin(this.walkAnimTimer * 1.8) * 0.03;
    }

    _vec3B.addVectors(_vec3A, _camOffset);

    // Ensure camera stays above terrain height + 0.6m
    const camGround = getTerrainHeight(_vec3B.x, _vec3B.z) + 0.65;
    if (_vec3B.y < camGround) _vec3B.y = camGround;

    this.camera.position.x = THREE.MathUtils.damp(
      this.camera.position.x,
      _vec3B.x,
      10,
      delta
    );
    this.camera.position.y = THREE.MathUtils.damp(
      this.camera.position.y,
      _vec3B.y,
      10,
      delta
    );
    this.camera.position.z = THREE.MathUtils.damp(
      this.camera.position.z,
      _vec3B.z,
      10,
      delta
    );

    this.camera.lookAt(_vec3A);
  }

  private updateVitalsSimulation(delta: number) {
    this.vitals.hunger = Math.max(0, this.vitals.hunger - delta * 0.04);
    this.vitals.thirst = Math.max(0, this.vitals.thirst - delta * 0.06);

    const targetTemp = this.weatherSystem.state.ambientTemperature;

    let nearFire = false;
    for (const struct of this.placedStructures) {
      if (struct.type === 'campfire') {
        const d = this.playerGroup.position.distanceTo(
          new THREE.Vector3(struct.x, struct.y, struct.z)
        );
        if (d < 5.0) {
          nearFire = true;
          break;
        }
      }
    }

    const effectiveTarget = nearFire ? Math.max(targetTemp, 24) : targetTemp;
    this.vitals.temperature = THREE.MathUtils.damp(
      this.vitals.temperature,
      effectiveTarget,
      0.08,
      delta
    );

    if (
      this.weatherSystem.state.currentWeather === 'rain' ||
      this.weatherSystem.state.currentWeather === 'storm'
    ) {
      this.vitals.wetness = Math.min(100, this.vitals.wetness + delta * 2.5);
    } else if (nearFire) {
      this.vitals.wetness = Math.max(0, this.vitals.wetness - delta * 6.0);
    } else {
      this.vitals.wetness = Math.max(0, this.vitals.wetness - delta * 0.8);
    }

    updateMaterialsWetness(this.vitals.wetness);

    if (
      this.vitals.temperature < 8 ||
      this.vitals.thirst <= 0 ||
      this.vitals.hunger <= 0
    ) {
      this.vitals.health = Math.max(0, this.vitals.health - delta * 2.0);
      if (Math.random() < 0.05) audioEngine.playHeartbeatThump();
    }

    if (this.onVitalsUpdate) {
      this.onVitalsUpdate({ ...this.vitals });
    }
  }

  private bindEvents() {
    window.addEventListener('keydown', (e) => {
      // Ignore shortcuts if typing in an input or textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      this.keys[e.code] = true;
      if (e.code === 'KeyE') this.interactNearest();
      if (e.code === 'KeyF') this.performAction();
      if (e.code === 'KeyK') this.triggerPlayerRagdoll();
      if (e.code === 'KeyX') this.demolishNearestStructure();
      if (e.code === 'KeyC' || e.code === 'AltLeft') this.triggerDodgeRoll();
      if (e.code === 'KeyR' && this.placementActive) this.rotatePlacement();
      if (e.code >= 'Digit1' && e.code <= 'Digit6') {
        this.selectedHotbarSlot = Number(e.code.replace('Digit', '')) - 1;
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    const dom = this.renderer.domElement;
    dom.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        if (this.placementActive) {
          this.confirmPlacement();
        } else {
          this.performAction();
        }
      } else if (e.button === 2) {
        this.isDraggingCamera = true;
        this.previousMouseX = e.clientX;
        this.previousMouseY = e.clientY;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDraggingCamera) {
        const deltaX = e.clientX - this.previousMouseX;
        const deltaY = e.clientY - this.previousMouseY;
        this.cameraYaw -= deltaX * 0.005;
        this.cameraPitch = Math.max(
          0.08,
          Math.min(1.3, this.cameraPitch + deltaY * 0.004)
        );
        this.previousMouseX = e.clientX;
        this.previousMouseY = e.clientY;
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDraggingCamera = false;
    });

    let touchLookId: number | null = null;
    let lastTouchX = 0;
    let lastTouchY = 0;
    let lastPinchDist = 0;

    dom.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 1) {
          const t = e.touches[0];
          touchLookId = t.identifier;
          lastTouchX = t.clientX;
          lastTouchY = t.clientY;
        } else if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          lastPinchDist = Math.hypot(dx, dy);
        }
      },
      { passive: true }
    );

    dom.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.hypot(dx, dy);
          if (lastPinchDist > 0) {
            const diff = lastPinchDist - dist;
            this.cameraDistance = Math.max(
              3.2,
              Math.min(14.0, this.cameraDistance + diff * 0.025)
            );
          }
          lastPinchDist = dist;
          return;
        }

        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.identifier === touchLookId) {
            const deltaX = t.clientX - lastTouchX;
            const deltaY = t.clientY - lastTouchY;
            this.cameraYaw -= deltaX * 0.0065;
            this.cameraPitch = Math.max(
              0.08,
              Math.min(1.3, this.cameraPitch + deltaY * 0.005)
            );
            lastTouchX = t.clientX;
            lastTouchY = t.clientY;
          }
        }
      },
      { passive: true }
    );

    dom.addEventListener(
      'touchend',
      (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === touchLookId) {
            touchLookId = null;
          }
        }
        if (e.touches.length < 2) {
          lastPinchDist = 0;
        }
      },
      { passive: true }
    );

    dom.addEventListener('contextmenu', (e) => e.preventDefault());

    dom.addEventListener('wheel', (e) => {
      this.cameraDistance = Math.max(
        3.2,
        Math.min(14.0, this.cameraDistance + e.deltaY * 0.005)
      );
    });

    window.addEventListener('resize', () => {
      if (!this.container) return;
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.renderPipeline.setSize(w, h);
    });
  }

  private startLoop() {
    const tick = () => {
      if (this.isDestroyed) return;
      const rawDt = this.clock.getDelta();
      const delta = Math.min(rawDt, 0.05);

      this.updatePlayerMovement(delta);
      this.updatePhysicsAndCompanions(delta);
      this.updateExplorationAndMapExpansion(delta);
      this.updateCamera(delta);
      this.weatherSystem.update(delta, this.playerGroup.position);
      this.updateVitalsSimulation(delta);

      audioEngine.updateWeatherAudio(
        this.weatherSystem.state.currentWeather,
        this.weatherSystem.state.windSpeed
      );

      this.renderPipeline.render();

      if (isSoftwareGl) {
        const gl = this.renderer.getContext() as WebGL2RenderingContext;
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (this.isDestroyed) return;
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            this.animFrameId = window.setTimeout(poll, 6);
          } else {
            if (sync) gl.deleteSync(sync);
            this.animFrameId = window.setTimeout(tick, 70);
          }
        };
        this.animFrameId = window.setTimeout(poll, 6);
      } else {
        this.animFrameId = requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      this.animFrameId = window.setTimeout(tick, 10);
    } else {
      this.animFrameId = requestAnimationFrame(tick);
    }
  }

  public destroy() {
    this.isDestroyed = true;
    cancelAnimationFrame(this.animFrameId);
    clearTimeout(this.animFrameId);
    this.renderer.dispose();
  }
}

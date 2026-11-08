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
  createPlayerModel,
  createNPCModel,
  createStructureMesh,
} from './proceduralModels';
import { getTerrainHeight, createTerrainMesh, createPerimeterNaturalBarriers } from './terrain';
import { DynamicWeatherSystem } from './weather';
import { audioEngine } from './audioEngine';
import {
  PlayerVitals,
  PlayerSkills,
  Item,
  PlacedStructure,
  HarvestableNode,
  NPCData,
  WeatherType,
} from '../types/game';
import { ITEM_CATALOG, INITIAL_NPCS } from './itemsData';

// Pre-allocated scratch math helpers (Zero GC in render loop)
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _camOffset = new THREE.Vector3();

export class GameEngine {
  public renderer!: THREE.WebGLRenderer;
  public scene!: THREE.Scene;
  public camera!: THREE.PerspectiveCamera;
  public weatherSystem!: DynamicWeatherSystem;
  public renderPipeline!: UnrealRenderPipeline;
  public cameraTrauma: number = 0;

  // Mount container
  private container: HTMLElement;
  private animFrameId: number = 0;
  private isDestroyed: boolean = false;
  private clock: THREE.Clock;

  // Player & Actor groups
  public playerGroup!: THREE.Group;
  private playerParts!: ReturnType<typeof createPlayerModel>;
  public playerVelocity: THREE.Vector3 = new THREE.Vector3();
  public isGrounded: boolean = true;
  private playerFacingAngle: number = 0;
  private swingAnimTimer: number = 0;
  private walkAnimTimer: number = 0;
  public rollTimer: number = 0;

  // Camera third-person orbit state
  public cameraDistance: number = 7.5;
  public cameraPitch: number = 0.35; // radians
  public cameraYaw: number = 0;
  public isDraggingCamera: boolean = false;
  private previousMouseX: number = 0;
  private previousMouseY: number = 0;

  // World objects
  public harvestNodes: (HarvestableNode & { mesh: THREE.Group })[] = [];
  public placedStructures: PlacedStructure[] = [];
  private structureMeshes: Map<string, THREE.Group> = new Map();
  public npcs: Record<string, NPCData & { mesh: THREE.Group }> = {};
  private coOpPartnerMesh: THREE.Group | null = null;

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
  public onInventoryUpdate?: (inventory: (Item | null)[], hotbar: (Item | null)[]) => void;
  public onNPCInteract?: (npc: NPCData) => void;
  public onNotification?: (text: string, icon?: string) => void;
  public onInteractTargetChange?: (prompt: string | null) => void;
  public onStructurePlacedCallback?: (structures: PlacedStructure[]) => void;
  public onLevelUp?: (newLevel: number) => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.clock = new THREE.Clock();
    this.initScene();
    this.initPlayer();
    this.initNPCs();
    this.initWorldNodes();
    this.initInitialStructures();
    this.initInitialInventory();
    this.bindEvents();
    this.startLoop();
  }

  private initScene() {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      60,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      400
    );

    this.renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    // Studio Environment & Room reflection
    setupStudioEnvironment(this.renderer, this.scene);

    // Unreal / Unity HDRP Post-Processing Pipeline (Bloom, Vignette, FXAA, Tone Mapping)
    this.renderPipeline = new UnrealRenderPipeline(this.renderer, this.scene, this.camera);

    // Weather & Day/Night System
    this.weatherSystem = new DynamicWeatherSystem(this.scene);

    // Terrain & Natural Boundaries
    const { terrainMesh, waterMesh } = createTerrainMesh();
    this.scene.add(terrainMesh);
    this.scene.add(waterMesh);

    const perimeterBarriers = createPerimeterNaturalBarriers();
    this.scene.add(perimeterBarriers);
  }

  private initPlayer() {
    this.playerParts = createPlayerModel();
    this.playerGroup = this.playerParts.root;

    // Spawn player in clearing
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

  private initWorldNodes() {
    // Generate organic clusters of harvestable trees
    const treeTypes: ('pine' | 'oak' | 'dead')[] = ['pine', 'oak', 'dead'];
    for (let i = 0; i < 35; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 12 + Math.random() * 60;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = getTerrainHeight(x, z);

      // Don't spawn in river
      if (Math.abs(x - 40) < 6) continue;

      const type = treeTypes[Math.floor(Math.random() * treeTypes.length)];
      const treeMesh = createProceduralTree(type);
      treeMesh.position.set(x, y, z);
      treeMesh.rotation.y = Math.random() * Math.PI * 2;
      const s = 0.85 + Math.random() * 0.3;
      treeMesh.scale.set(s, s, s);
      this.scene.add(treeMesh);

      this.harvestNodes.push({
        id: `tree_${i}`,
        type: type === 'pine' ? 'tree_pine' : type === 'oak' ? 'tree_oak' : 'tree_dead',
        x,
        y,
        z,
        health: 40,
        maxHealth: 40,
        yieldItem: 'wood',
        yieldCount: 4,
        mesh: treeMesh,
      });
    }

    // Generate rocks & ore nodes
    const rockTypes: ('stone' | 'iron' | 'flint')[] = ['stone', 'stone', 'iron', 'flint'];
    for (let i = 0; i < 24; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 15 + Math.random() * 65;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = getTerrainHeight(x, z);

      if (Math.abs(x - 40) < 6) continue;

      const rType = rockTypes[Math.floor(Math.random() * rockTypes.length)];
      const rockMesh = createProceduralRock(rType);
      rockMesh.position.set(x, y, z);
      rockMesh.rotation.y = Math.random() * Math.PI * 2;
      const s = 0.9 + Math.random() * 0.35;
      rockMesh.scale.set(s, s, s);
      this.scene.add(rockMesh);

      this.harvestNodes.push({
        id: `rock_${i}`,
        type: rType === 'stone' ? 'rock_stone' : rType === 'iron' ? 'rock_iron' : 'rock_flint',
        x,
        y,
        z,
        health: 50,
        maxHealth: 50,
        yieldItem: rType === 'iron' ? 'iron_ore' : rType === 'flint' ? 'flint' : 'stone',
        yieldCount: 3,
        mesh: rockMesh,
      });
    }

    // Medicinal herbs & Berry bushes
    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 6 + Math.random() * 50;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = getTerrainHeight(x, z);

      const isHerb = i % 2 === 0;
      const herbMesh = createHarvestableHerb();
      herbMesh.position.set(x, y, z);
      this.scene.add(herbMesh);

      this.harvestNodes.push({
        id: `forage_${i}`,
        type: isHerb ? 'herb_sage' : 'berry_bush',
        x,
        y,
        z,
        health: 10,
        maxHealth: 10,
        yieldItem: isHerb ? 'mountain_sage' : 'wild_berries',
        yieldCount: 2,
        mesh: herbMesh,
      });
    }
  }

  private initInitialStructures() {
    // Initial camp hearth campfire
    this.placeStructure('campfire', 3, 3, 0);
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
    rotationY: number = 0
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
    audioEngine.playBuildPlacement();

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
    this.placementRotation = (this.placementRotation + Math.PI / 4) % (Math.PI * 2);
    if (this.hologramMesh) {
      this.hologramMesh.rotation.y = this.placementRotation;
    }
  }

  public confirmPlacement() {
    if (!this.placementActive || !this.hologramMesh) return;

    // Check recipe / cost deduction
    const costWood = 10;
    if (!this.hasItemCount('wood', costWood) && this.placementType === 'foundation_wood') {
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
      // Spawn simulated co-op companion
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

    // Check hotbar stack first
    for (let i = 0; i < this.hotbar.length; i++) {
      const slot = this.hotbar[i];
      if (slot && slot.id === template.id && slot.count < slot.maxStack) {
        slot.count = Math.min(slot.maxStack, slot.count + count);
        this.triggerInventoryChange();
        return true;
      }
    }

    // Check main inventory stack
    for (let i = 0; i < this.inventory.length; i++) {
      const slot = this.inventory[i];
      if (slot && slot.id === template.id && slot.count < slot.maxStack) {
        slot.count = Math.min(slot.maxStack, slot.count + count);
        this.triggerInventoryChange();
        return true;
      }
    }

    // Check empty hotbar slot
    for (let i = 0; i < this.hotbar.length; i++) {
      if (!this.hotbar[i]) {
        this.hotbar[i] = { ...template, count };
        this.triggerInventoryChange();
        return true;
      }
    }

    // Check empty inventory slot
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
    for (let item of [...this.hotbar, ...this.inventory]) {
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
    this.swingAnimTimer = 0.35; // Trigger arm swing
    audioEngine.playAttackSwish();

    // Check harvestable node in front of player
    let nearestNode: (typeof this.harvestNodes)[0] | null = null;
    let minDist = 3.2;

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
      } else if (nearestNode.yieldItem === 'stone' || nearestNode.yieldItem === 'iron_ore') {
        audioEngine.playMiningPick();
        damage = activeSlot?.stats?.stoneBonus ? 30 : 15;
        this.addXP(12, 'mining');
      } else {
        audioEngine.playFootstep('grass');
        damage = 20;
        this.addXP(8, 'foraging');
      }

      nearestNode.health -= damage;
      this.cameraTrauma = Math.min(1.0, this.cameraTrauma + 0.35); // Unreal impact trauma recoil
      // Scale node down slightly on hit for weight feedback
      nearestNode.mesh.scale.multiplyScalar(0.96);

      if (nearestNode.health <= 0) {
        this.addInventoryItem(nearestNode.yieldItem, nearestNode.yieldCount);
        this.notify(`Harvested +${nearestNode.yieldCount} ${ITEM_CATALOG[nearestNode.yieldItem]?.name || nearestNode.yieldItem}!`, ITEM_CATALOG[nearestNode.yieldItem]?.icon || '📦');
        this.scene.remove(nearestNode.mesh);
        this.harvestNodes = this.harvestNodes.filter((n) => n.id !== nearestNode!.id);
      } else {
        this.addInventoryItem(nearestNode.yieldItem, 1);
      }
    }
  }

  public interactNearest() {
    // 1. Check NPC interaction
    for (const npc of Object.values(this.npcs)) {
      const dist = this.playerGroup.position.distanceTo(npc.mesh.position);
      if (dist < 3.8) {
        if (this.onNPCInteract) {
          this.onNPCInteract(npc);
          return;
        }
      }
    }

    // 2. Check Campfire rest & cook
    for (const struct of this.placedStructures) {
      if (struct.type === 'campfire') {
        const dist = this.playerGroup.position.distanceTo(new THREE.Vector3(struct.x, struct.y, struct.z));
        if (dist < 3.5) {
          this.vitals.temperature = Math.min(37, this.vitals.temperature + 4);
          this.vitals.morale = Math.min(100, this.vitals.morale + 10);
          this.vitals.health = Math.min(this.vitals.maxHealth, this.vitals.health + 10);
          this.notify('Rested by the campfire warmth (+Health & Morale)!', '🔥');
          audioEngine.playIntimateMomentChord();
          return;
        }
      }
    }

    // 3. Fallback harvest
    this.performAction();
  }

  public triggerDodgeRoll() {
    if (this.rollTimer > 0) return;
    if (this.vitals.stamina < 15) {
      this.notify('Not enough stamina for tactical roll!', '⚡');
      return;
    }
    this.vitals.stamina = Math.max(0, this.vitals.stamina - 15);
    this.rollTimer = 0.48;
    audioEngine.playAttackSwish();

    // Direction vector of roll (momentum direction or forward facing)
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

  private updatePlayerMovement(delta: number) {
    const isSprinting = (this.keys['ShiftLeft'] || this.keys['ShiftRight']) && this.vitals.stamina > 5;
    let baseSpeed = isSprinting ? 9.6 : 5.8;

    // Stamina drain/recovery
    if (isSprinting && (this.keys['KeyW'] || this.keys['KeyA'] || this.keys['KeyS'] || this.keys['KeyD'] || Math.abs(this.joystickVector.x) > 0.1 || Math.abs(this.joystickVector.y) > 0.1)) {
      this.vitals.stamina = Math.max(0, this.vitals.stamina - delta * 14);
    } else if (this.rollTimer <= 0) {
      this.vitals.stamina = Math.min(this.vitals.maxStamina, this.vitals.stamina + delta * 12);
    }

    // Camera relative forward and right vectors
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

    // Touch joystick input
    if (Math.abs(this.joystickVector.x) > 0.05 || Math.abs(this.joystickVector.y) > 0.05) {
      moveX += right.x * this.joystickVector.x - forward.x * this.joystickVector.y;
      moveZ += right.z * this.joystickVector.x - forward.z * this.joystickVector.y;
    }

    const moveLength = Math.sqrt(moveX * moveX + moveZ * moveZ);
    const isMoving = moveLength > 0.05;

    // 1. Terrain Slope Physics & Resistance Mechanics
    const checkDist = 0.65;
    const curY = getTerrainHeight(this.playerGroup.position.x, this.playerGroup.position.z);
    const aheadX = this.playerGroup.position.x + (isMoving ? (moveX / moveLength) : Math.sin(this.playerFacingAngle)) * checkDist;
    const aheadZ = this.playerGroup.position.z + (isMoving ? (moveZ / moveLength) : Math.cos(this.playerFacingAngle)) * checkDist;
    const aheadY = getTerrainHeight(aheadX, aheadZ);
    const slope = (aheadY - curY) / checkDist;

    // Slope modifier: uphill resistance / downhill assistance
    let slopeMod = 1.0;
    if (slope > 0) {
      // Uphill: slows down as slope steepens
      slopeMod = Math.max(0.38, 1.0 - slope * 0.72);
      if (slope > 0.85) {
        // Very steep rock incline
        slopeMod = 0.15;
      }
    } else {
      // Downhill: slight acceleration assistance
      slopeMod = Math.min(1.28, 1.0 - slope * 0.32);
    }

    // Surface wetness traction friction (Unreal physics response)
    const surfaceTraction = Math.max(0.68, 1.0 - (this.vitals.wetness / 100) * 0.32);
    baseSpeed = baseSpeed * slopeMod * surfaceTraction;

    // Ground Normal Surface Alignment (Sample 4 cardinal points to align feet to slope)
    const sd = 0.45;
    const hL = getTerrainHeight(this.playerGroup.position.x - sd, this.playerGroup.position.z);
    const hR = getTerrainHeight(this.playerGroup.position.x + sd, this.playerGroup.position.z);
    const hF = getTerrainHeight(this.playerGroup.position.x, this.playerGroup.position.z + sd);
    const hB = getTerrainHeight(this.playerGroup.position.x, this.playerGroup.position.z - sd);
    const pitchSlope = Math.atan2(hF - hB, sd * 2);
    const rollSlope = Math.atan2(hR - hL, sd * 2);

    this.playerGroup.rotation.x = THREE.MathUtils.damp(this.playerGroup.rotation.x, -pitchSlope * 0.75, 8, delta);
    this.playerGroup.rotation.z = THREE.MathUtils.damp(this.playerGroup.rotation.z, rollSlope * 0.75, 8, delta);

    // 2. Kinematic Velocity and Dodge Roll Handling
    if (this.rollTimer > 0) {
      this.rollTimer -= delta;
      const rollProgress = Math.min(1, (0.48 - this.rollTimer) / 0.48);

      // Full 360-degree rotational dive tumble
      this.playerParts.spineGroup.rotation.x = -rollProgress * Math.PI * 2;
      this.playerParts.leftLeg.rotation.x = 0.9;
      this.playerParts.rightLeg.rotation.x = 0.9;
      this.playerParts.leftLowerLeg.rotation.x = 1.35;
      this.playerParts.rightLowerLeg.rotation.x = 1.35;
      this.playerParts.leftArm.rotation.x = -1.2;
      this.playerParts.rightArm.rotation.x = -1.2;

      // Friction deceleration during roll
      this.playerVelocity.x = THREE.MathUtils.damp(this.playerVelocity.x, 0, 4.5, delta);
      this.playerVelocity.z = THREE.MathUtils.damp(this.playerVelocity.z, 0, 4.5, delta);
    } else if (isMoving) {
      moveX /= moveLength;
      moveZ /= moveLength;

      this.playerVelocity.x = THREE.MathUtils.damp(this.playerVelocity.x, moveX * baseSpeed, 12, delta);
      this.playerVelocity.z = THREE.MathUtils.damp(this.playerVelocity.z, moveZ * baseSpeed, 12, delta);

      // Facing angle
      this.playerFacingAngle = Math.atan2(moveX, moveZ);
      this.playerGroup.rotation.y = THREE.MathUtils.damp(
        this.playerGroup.rotation.y,
        this.playerFacingAngle,
        14,
        delta
      );

      // 3. Articulated Biomechanical Gait (Hip + Knee dual joints + Forearms)
      this.walkAnimTimer += delta * (isSprinting ? 15 : 9.5);
      const legAngle = Math.sin(this.walkAnimTimer) * (isSprinting ? 0.75 : 0.6);
      this.playerParts.leftLeg.rotation.x = legAngle;
      this.playerParts.rightLeg.rotation.x = -legAngle;

      // Knee flexion: lower leg flexes backwards on forward swing so boot clears terrain
      this.playerParts.leftLowerLeg.rotation.x = Math.max(0.06, -legAngle * 1.15);
      this.playerParts.rightLowerLeg.rotation.x = Math.max(0.06, legAngle * 1.15);

      // Arm & elbow counter-swing
      this.playerParts.leftArm.rotation.x = -legAngle * 0.8;
      this.playerParts.leftForearm.rotation.x = -Math.max(0.18, -legAngle * 0.85);

      if (this.swingAnimTimer <= 0) {
        this.playerParts.rightArm.rotation.x = legAngle * 0.8;
        this.playerParts.rightForearm.rotation.x = -Math.max(0.18, legAngle * 0.85);
      }

      // Torso centrifugal banking into turns
      const headingDiff = moveX * Math.cos(this.playerFacingAngle) - moveZ * Math.sin(this.playerFacingAngle);
      this.playerParts.spineGroup.rotation.z = THREE.MathUtils.damp(this.playerParts.spineGroup.rotation.z, headingDiff * 0.22, 10, delta);
      this.playerParts.spineGroup.rotation.x = THREE.MathUtils.damp(this.playerParts.spineGroup.rotation.x, isSprinting ? 0.15 : 0.08, 8, delta);

      // Dynamic vertical pelvis step bounce
      this.playerParts.spineGroup.position.y = 0.85 + Math.abs(Math.sin(this.walkAnimTimer)) * 0.045;

      // Realistic Footsteps (River water splash vs dry grass)
      if (Math.sin(this.walkAnimTimer) > 0.94 && Math.random() < 0.24) {
        const inRiver = Math.abs(this.playerGroup.position.x - 40) < 5.5;
        audioEngine.playFootstep(inRiver ? 'water' : 'grass');
      }
    } else {
      // Idle Kinematic State with Realistic Muscle Relax & Breathing
      this.playerVelocity.x = THREE.MathUtils.damp(this.playerVelocity.x, 0, 12, delta);
      this.playerVelocity.z = THREE.MathUtils.damp(this.playerVelocity.z, 0, 12, delta);

      this.playerParts.leftLeg.rotation.x = THREE.MathUtils.damp(this.playerParts.leftLeg.rotation.x, 0, 8, delta);
      this.playerParts.rightLeg.rotation.x = THREE.MathUtils.damp(this.playerParts.rightLeg.rotation.x, 0, 8, delta);
      this.playerParts.leftLowerLeg.rotation.x = THREE.MathUtils.damp(this.playerParts.leftLowerLeg.rotation.x, 0.05, 8, delta);
      this.playerParts.rightLowerLeg.rotation.x = THREE.MathUtils.damp(this.playerParts.rightLowerLeg.rotation.x, 0.05, 8, delta);
      this.playerParts.leftArm.rotation.x = THREE.MathUtils.damp(this.playerParts.leftArm.rotation.x, 0.05, 8, delta);
      this.playerParts.leftForearm.rotation.x = THREE.MathUtils.damp(this.playerParts.leftForearm.rotation.x, -0.22, 8, delta);

      if (this.swingAnimTimer <= 0) {
        this.playerParts.rightArm.rotation.x = THREE.MathUtils.damp(this.playerParts.rightArm.rotation.x, 0.05, 8, delta);
        this.playerParts.rightForearm.rotation.x = THREE.MathUtils.damp(this.playerParts.rightForearm.rotation.x, -0.22, 8, delta);
      }

      this.playerParts.spineGroup.rotation.z = THREE.MathUtils.damp(this.playerParts.spineGroup.rotation.z, 0, 8, delta);
      this.playerParts.spineGroup.rotation.x = THREE.MathUtils.damp(this.playerParts.spineGroup.rotation.x, 0, 8, delta);

      // Micro-idle breathing cycle
      this.walkAnimTimer += delta * 1.5;
      const breathe = Math.sin(this.walkAnimTimer) * 0.018;
      this.playerParts.spineGroup.position.y = 0.85 + breathe;
      this.playerParts.neckGroup.rotation.x = breathe * 0.35;
    }

    // 4. Secondary Cloth Physics on Scarf Tail
    const hSpeed = Math.hypot(this.playerVelocity.x, this.playerVelocity.z);
    const windSpeed = this.weatherSystem?.state.windSpeed || 0;
    const targetScarfPitch = -hSpeed * 0.08 - windSpeed * 0.04 + Math.sin(this.walkAnimTimer * 2.2) * 0.12;
    this.playerParts.scarfTail.rotation.x = THREE.MathUtils.damp(this.playerParts.scarfTail.rotation.x, targetScarfPitch, 10, delta);
    this.playerParts.scarfTail.rotation.z = Math.cos(this.walkAnimTimer * 1.6) * 0.08;

    // Jump Physics
    if (this.keys['Space'] && this.isGrounded && this.vitals.stamina >= 10 && this.rollTimer <= 0) {
      this.playerVelocity.y = 8.5;
      this.isGrounded = false;
      this.vitals.stamina -= 10;
    }

    // Apply gravity
    this.playerVelocity.y -= 22 * delta;

    // Apply position updates
    this.playerGroup.position.x += this.playerVelocity.x * delta;
    this.playerGroup.position.z += this.playerVelocity.z * delta;
    this.playerGroup.position.y += this.playerVelocity.y * delta;

    // Ground snap collision
    const groundY = getTerrainHeight(this.playerGroup.position.x, this.playerGroup.position.z);
    if (this.playerGroup.position.y <= groundY) {
      this.playerGroup.position.y = groundY;
      this.playerVelocity.y = 0;
      this.isGrounded = true;
    }

    // 5. Tool swinging animation with torso windup
    if (this.swingAnimTimer > 0) {
      this.swingAnimTimer -= delta;
      const progress = (0.35 - this.swingAnimTimer) / 0.35;
      this.playerParts.rightArm.rotation.x = -Math.sin(progress * Math.PI) * 1.65;
      this.playerParts.rightForearm.rotation.x = -Math.sin(progress * Math.PI) * 0.95;
      this.playerParts.spineGroup.rotation.y = Math.sin(progress * Math.PI) * 0.28;
    } else {
      this.playerParts.spineGroup.rotation.y = THREE.MathUtils.damp(this.playerParts.spineGroup.rotation.y, 0, 10, delta);
    }

    // Check interaction prompt
    let promptTarget: string | null = null;
    for (const npc of Object.values(this.npcs)) {
      if (this.playerGroup.position.distanceTo(npc.mesh.position) < 3.8) {
        promptTarget = `Talk with ${npc.name} [E]`;
        break;
      }
    }
    if (!promptTarget) {
      for (const node of this.harvestNodes) {
        if (this.playerGroup.position.distanceTo(node.mesh.position) < 3.2) {
          promptTarget = `Harvest ${ITEM_CATALOG[node.yieldItem]?.name || 'Node'} [E / Click]`;
          break;
        }
      }
    }
    if (!promptTarget) {
      for (const struct of this.placedStructures) {
        if (struct.type === 'campfire' && this.playerGroup.position.distanceTo(new THREE.Vector3(struct.x, struct.y, struct.z)) < 3.5) {
          promptTarget = 'Warm & Rest by Campfire [E]';
          break;
        }
      }
    }
    if (this.onInteractTargetChange) {
      this.onInteractTargetChange(promptTarget);
    }

    // Update hologram in front of player
    if (this.placementActive && this.hologramMesh) {
      const holoDist = 4.0;
      const hx = this.playerGroup.position.x + Math.sin(this.playerFacingAngle) * holoDist;
      const hz = this.playerGroup.position.z + Math.cos(this.playerFacingAngle) * holoDist;
      // Snap to 1.5m grid
      const snappedX = Math.round(hx / 1.5) * 1.5;
      const snappedZ = Math.round(hz / 1.5) * 1.5;
      const hy = getTerrainHeight(snappedX, snappedZ);
      this.hologramMesh.position.set(snappedX, hy, snappedZ);
      this.hologramMesh.rotation.y = this.placementRotation;
    }
  }

  private updateCamera(delta: number) {
    // Target position above player chest
    _vec3A.copy(this.playerGroup.position);
    _vec3A.y += 1.6;

    // Calculate spherical camera offset
    const cosPitch = Math.cos(this.cameraPitch);
    const sinPitch = Math.sin(this.cameraPitch);
    const sinYaw = Math.sin(this.cameraYaw);
    const cosYaw = Math.cos(this.cameraYaw);

    _camOffset.set(
      sinYaw * cosPitch * this.cameraDistance,
      sinPitch * this.cameraDistance,
      cosYaw * cosPitch * this.cameraDistance
    );

    // Unreal-style camera trauma screen shake
    if (this.cameraTrauma > 0) {
      const shakeMag = this.cameraTrauma * this.cameraTrauma * 0.45;
      _camOffset.x += (Math.random() - 0.5) * shakeMag;
      _camOffset.y += (Math.random() - 0.5) * shakeMag;
      this.cameraTrauma = Math.max(0, this.cameraTrauma - delta * 3.8);
    }

    // Walking/Running dynamic camera inertia bob
    if (this.walkAnimTimer > 0) {
      _camOffset.y += Math.sin(this.walkAnimTimer * 1.8) * 0.04;
    }

    _vec3B.addVectors(_vec3A, _camOffset);

    // Exponential Damping camera move
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _vec3B.x, 10, delta);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _vec3B.y, 10, delta);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _vec3B.z, 10, delta);

    this.camera.lookAt(_vec3A);
  }

  private updateVitalsSimulation(delta: number) {
    // Metabolic drain
    this.vitals.hunger = Math.max(0, this.vitals.hunger - delta * 0.04);
    this.vitals.thirst = Math.max(0, this.vitals.thirst - delta * 0.06);

    // Weather impact on body temperature
    const targetTemp = this.weatherSystem.state.ambientTemperature;

    // Check if near campfire
    let nearFire = false;
    for (const struct of this.placedStructures) {
      if (struct.type === 'campfire') {
        const d = this.playerGroup.position.distanceTo(new THREE.Vector3(struct.x, struct.y, struct.z));
        if (d < 5.0) {
          nearFire = true;
          break;
        }
      }
    }

    const effectiveTarget = nearFire ? Math.max(targetTemp, 24) : targetTemp;
    this.vitals.temperature = THREE.MathUtils.damp(this.vitals.temperature, effectiveTarget, 0.08, delta);

    // Rain causes wetness
    if (this.weatherSystem.state.currentWeather === 'rain' || this.weatherSystem.state.currentWeather === 'storm') {
      this.vitals.wetness = Math.min(100, this.vitals.wetness + delta * 2.5);
    } else if (nearFire) {
      this.vitals.wetness = Math.max(0, this.vitals.wetness - delta * 6.0);
    } else {
      this.vitals.wetness = Math.max(0, this.vitals.wetness - delta * 0.8);
    }

    // Dynamic wetness reflection & roughness update (Unreal/Unity HDRP weather response)
    updateMaterialsWetness(this.vitals.wetness);

    // Health damage from extreme hypothermia or dehydration
    if (this.vitals.temperature < 8 || this.vitals.thirst <= 0 || this.vitals.hunger <= 0) {
      this.vitals.health = Math.max(0, this.vitals.health - delta * 2.0);
      if (Math.random() < 0.05) audioEngine.playHeartbeatThump();
    }

    if (this.onVitalsUpdate) {
      this.onVitalsUpdate({ ...this.vitals });
    }
  }

  private bindEvents() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyE') this.interactNearest();
      if (e.code === 'KeyF') this.performAction();
      if (e.code === 'KeyC' || e.code === 'AltLeft') this.triggerDodgeRoll();
      if (e.code === 'KeyR' && this.placementActive) this.rotatePlacement();
      if (e.code >= 'Digit1' && e.code <= 'Digit6') {
        this.selectedHotbarSlot = Number(e.code.replace('Digit', '')) - 1;
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Mouse drag for camera orbit
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
        this.cameraPitch = Math.max(0.08, Math.min(1.3, this.cameraPitch + deltaY * 0.004));
        this.previousMouseX = e.clientX;
        this.previousMouseY = e.clientY;
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDraggingCamera = false;
    });

    dom.addEventListener('contextmenu', (e) => e.preventDefault());

    dom.addEventListener('wheel', (e) => {
      this.cameraDistance = Math.max(3.5, Math.min(14.0, this.cameraDistance + e.deltaY * 0.005));
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
      this.updateCamera(delta);
      this.weatherSystem.update(delta, this.playerGroup.position);
      this.updateVitalsSimulation(delta);

      audioEngine.updateWeatherAudio(this.weatherSystem.state.currentWeather, this.weatherSystem.state.windSpeed);

      this.renderPipeline.render();

      if (isSoftwareGl) {
        // Safe paced software WebGL loop
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

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export const isSoftwareGl = (() => {
  if (typeof document === 'undefined') return true;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
})();

export function setupStudioEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  const roomEnv = new RoomEnvironment();
  scene.environment = pmremGenerator.fromScene(roomEnv, 0.04).texture;
  pmremGenerator.dispose();
}

// Procedural 2D Canvas Textures (zero external 404s)
export function createWoodTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#654321';
  ctx.fillRect(0, 0, 256, 256);

  // Wood rings and grain lines
  ctx.fillStyle = '#4a2e12';
  for (let i = 0; i < 40; i++) {
    const y = Math.random() * 256;
    const h = 2 + Math.random() * 5;
    ctx.fillRect(0, y, 256, h);
  }

  // Grain fiber noise
  const imgData = ctx.getImageData(0, 0, 256, 256);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 24;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise * 0.8));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise * 0.5));
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createStoneTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#6b7280';
  ctx.fillRect(0, 0, 256, 256);

  const imgData = ctx.getImageData(0, 0, 256, 256);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 55;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createGroundTerrainTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base earth tone
  ctx.fillStyle = '#3a4428';
  ctx.fillRect(0, 0, 512, 512);

  // Speckled moss and soil patches
  for (let i = 0; i < 300; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 4 + Math.random() * 18;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = Math.random() > 0.5 ? '#2d371e' : '#453a2b';
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 16);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Procedural Normal Map generator from height perturbations
export function createProceduralNormalMap(type: 'rock' | 'wood' | 'ground'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const imgData = ctx.createImageData(256, 256);
  const data = imgData.data;

  // Generate heightfield
  const heights = new Float32Array(256 * 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      let h = Math.sin(x * 0.1) * Math.cos(y * 0.1) * 0.3;
      if (type === 'wood') {
        h = (Math.sin(y * 0.4) + Math.random() * 0.2) * 0.4;
      } else if (type === 'rock') {
        h = (Math.sin(x * 0.2) * Math.sin(y * 0.2) + Math.random() * 0.3) * 0.5;
      } else {
        h = (Math.sin(x * 0.15) * Math.cos(y * 0.15) + Math.random() * 0.15) * 0.35;
      }
      heights[y * 256 + x] = h;
    }
  }

  // Sobel-like filter to compute normal vectors
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const xPrev = (x - 1 + 256) % 256;
      const xNext = (x + 1) % 256;
      const yPrev = (y - 1 + 256) % 256;
      const yNext = (y + 1) % 256;

      const dx = (heights[y * 256 + xNext] - heights[y * 256 + xPrev]) * 2.5;
      const dy = (heights[yNext * 256 + x] - heights[yPrev * 256 + x]) * 2.5;
      const dz = 1.0;

      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const nx = -dx / len;
      const ny = -dy / len;
      const nz = dz / len;

      const idx = (y * 256 + x) * 4;
      data[idx] = Math.floor((nx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.floor((nz * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// Pre-created Shared Textures & Normal Maps
const woodTex = typeof document !== 'undefined' ? createWoodTexture() : null;
const stoneTex = typeof document !== 'undefined' ? createStoneTexture() : null;
const groundTex = typeof document !== 'undefined' ? createGroundTerrainTexture() : null;
const groundNormal = typeof document !== 'undefined' ? createProceduralNormalMap('ground') : null;
const rockNormal = typeof document !== 'undefined' ? createProceduralNormalMap('rock') : null;
const woodNormal = typeof document !== 'undefined' ? createProceduralNormalMap('wood') : null;

if (groundNormal) groundNormal.repeat.set(16, 16);
if (rockNormal) rockNormal.repeat.set(2, 2);
if (woodNormal) woodNormal.repeat.set(1, 4);

export const gameMaterials = {
  // Terrain
  terrain: new THREE.MeshStandardMaterial({
    map: groundTex,
    normalMap: groundNormal,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughness: 0.88,
    metalness: 0.08,
    color: 0x4a5538,
  }),
  water: new THREE.MeshStandardMaterial({
    color: 0x1e3a4c,
    normalMap: groundNormal,
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: 0.05,
    metalness: 0.45,
    transparent: true,
    opacity: 0.78,
  }),

  // Wood & Foliage
  woodBark: new THREE.MeshStandardMaterial({
    map: woodTex,
    normalMap: woodNormal,
    normalScale: new THREE.Vector2(1.2, 1.2),
    color: 0x5a3e26,
    roughness: 0.82,
    metalness: 0.04,
  }),
  woodPlanks: new THREE.MeshStandardMaterial({
    map: woodTex,
    normalMap: woodNormal,
    normalScale: new THREE.Vector2(0.6, 0.6),
    color: 0x8a623f,
    roughness: 0.72,
    metalness: 0.05,
  }),
  pineNeedles: new THREE.MeshStandardMaterial({
    color: 0x22422b,
    roughness: 0.6,
    metalness: 0.0,
    flatShading: true,
  }),
  oakLeaves: new THREE.MeshStandardMaterial({
    color: 0x385f2e,
    roughness: 0.55,
    metalness: 0.0,
    flatShading: true,
  }),

  // Minerals & Metals
  granite: new THREE.MeshStandardMaterial({
    map: stoneTex,
    normalMap: rockNormal,
    normalScale: new THREE.Vector2(1.4, 1.4),
    color: 0x6e737b,
    roughness: 0.85,
    metalness: 0.14,
    flatShading: true,
  }),
  ironOre: new THREE.MeshStandardMaterial({
    map: stoneTex,
    normalMap: rockNormal,
    normalScale: new THREE.Vector2(1.6, 1.6),
    color: 0x8a4b38,
    roughness: 0.45,
    metalness: 0.75,
    flatShading: true,
  }),
  refinedSteel: new THREE.MeshStandardMaterial({
    color: 0xdde4ea,
    roughness: 0.18,
    metalness: 0.95,
  }),
  flintNode: new THREE.MeshStandardMaterial({
    color: 0x242a34,
    normalMap: rockNormal,
    roughness: 0.28,
    metalness: 0.45,
    flatShading: true,
  }),

  // Base structures & props
  structureFrame: new THREE.MeshStandardMaterial({
    map: woodTex,
    color: 0x63462d,
    roughness: 0.8,
    metalness: 0.05,
  }),
  ironBand: new THREE.MeshStandardMaterial({
    color: 0x333b42,
    roughness: 0.4,
    metalness: 0.85,
  }),
  firePitStones: new THREE.MeshStandardMaterial({
    color: 0x474b52,
    roughness: 0.95,
    metalness: 0.05,
    flatShading: true,
  }),
  emberGlow: new THREE.MeshStandardMaterial({
    color: 0xff4400,
    emissive: 0xff3b00,
    emissiveIntensity: 3.0,
    roughness: 0.5,
  }),
  tentCanvas: new THREE.MeshStandardMaterial({
    color: 0x8b7d6b,
    roughness: 0.95,
    metalness: 0.02,
  }),

  // Characters & Outfits
  playerArmor: new THREE.MeshStandardMaterial({
    color: 0x4a525d,
    roughness: 0.5,
    metalness: 0.5,
  }),
  leatherVest: new THREE.MeshStandardMaterial({
    color: 0x593a22,
    roughness: 0.85,
    metalness: 0.08,
  }),
  skinTone: new THREE.MeshStandardMaterial({
    color: 0xd6a37e,
    roughness: 0.6,
    metalness: 0.0,
  }),
  furInsulation: new THREE.MeshStandardMaterial({
    color: 0x3b3a36,
    roughness: 0.95,
    metalness: 0.0,
  }),

  // Photorealistic Character Materials
  photorealSkin: new THREE.MeshPhysicalMaterial({
    color: 0xdfa685,
    roughness: 0.38,
    metalness: 0.0,
    sheen: 0.6,
    sheenColor: new THREE.Color(0xffaf99),
    clearcoat: 0.12,
    clearcoatRoughness: 0.35,
  }),
  eyeWhite: new THREE.MeshStandardMaterial({
    color: 0xf5f5f5,
    roughness: 0.15,
  }),
  eyeIris: new THREE.MeshStandardMaterial({
    color: 0x3d5a45,
    roughness: 0.2,
  }),
  eyePupil: new THREE.MeshBasicMaterial({
    color: 0x050505,
  }),
  hairBrunette: new THREE.MeshStandardMaterial({
    color: 0x241812,
    roughness: 0.52,
    metalness: 0.1,
  }),
  tacticalCamoVest: new THREE.MeshStandardMaterial({
    color: 0x3b423c,
    roughness: 0.78,
    metalness: 0.15,
  }),
  trenchCoatLeather: new THREE.MeshStandardMaterial({
    color: 0x422a18,
    roughness: 0.62,
    metalness: 0.1,
  }),
  combatBootRubber: new THREE.MeshStandardMaterial({
    color: 0x1f2428,
    roughness: 0.88,
    metalness: 0.1,
  }),
  buckleBrass: new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    roughness: 0.25,
    metalness: 0.9,
  }),
  razorSteel: new THREE.MeshStandardMaterial({
    color: 0xeef2f7,
    roughness: 0.14,
    metalness: 0.98,
  }),
  scarfCloth: new THREE.MeshStandardMaterial({
    color: 0xa8422b,
    roughness: 0.92,
    metalness: 0.02,
  }),

  // Hologram Placement Preview
  hologramValid: new THREE.MeshBasicMaterial({
    color: 0x22c55e,
    transparent: true,
    opacity: 0.5,
    wireframe: true,
  }),
  hologramInvalid: new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.5,
    wireframe: true,
  }),
};

export function updateMaterialsWetness(wetness: number) {
  const factor = Math.max(0, Math.min(1, wetness / 100));
  gameMaterials.terrain.roughness = 0.88 - factor * 0.45;
  gameMaterials.terrain.metalness = 0.08 + factor * 0.25;
  gameMaterials.granite.roughness = 0.85 - factor * 0.5;
  gameMaterials.granite.metalness = 0.14 + factor * 0.3;
  gameMaterials.woodBark.roughness = 0.82 - factor * 0.35;
}

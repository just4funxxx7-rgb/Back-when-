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
  scene.environment = pmremGenerator.fromScene(roomEnv, 0.035).texture;
  pmremGenerator.dispose();

  // Apply hardware max anisotropic filtering (16x) to all procedural textures for 8K grazing-angle sharpness
  const maxAniso = isSoftwareGl ? 1 : renderer.capabilities.getMaxAnisotropy();
  [
    woodTex,
    stoneTex,
    groundTex,
    groundNormal,
    rockNormal,
    woodNormal,
    skinNormal,
    fabricNormal,
  ].forEach((tex) => {
    if (tex) {
      tex.anisotropy = maxAniso;
      tex.needsUpdate = true;
    }
  });
}

// High-Definition Procedural 2D Canvas Textures
const TEX_RES = isSoftwareGl ? 256 : 1024;

export function createWoodTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_RES;
  canvas.height = TEX_RES;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#5c3c1e';
  ctx.fillRect(0, 0, TEX_RES, TEX_RES);

  for (let i = 0; i < (isSoftwareGl ? 45 : 220); i++) {
    const y = Math.random() * TEX_RES;
    const h = 1 + Math.random() * (TEX_RES * 0.014);
    ctx.fillStyle = i % 3 === 0 ? '#3d2510' : '#4e3218';
    ctx.fillRect(0, y, TEX_RES, h);
  }

  const imgData = ctx.getImageData(0, 0, TEX_RES, TEX_RES);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 28;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise * 0.82));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise * 0.55));
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
  canvas.width = TEX_RES;
  canvas.height = TEX_RES;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#68707a';
  ctx.fillRect(0, 0, TEX_RES, TEX_RES);

  for (let i = 0; i < (isSoftwareGl ? 30 : 180); i++) {
    ctx.strokeStyle =
      Math.random() > 0.5 ? 'rgba(32,37,44,0.4)' : 'rgba(220,230,240,0.22)';
    ctx.lineWidth = 1 + Math.random() * 2.5;
    ctx.beginPath();
    const sx = Math.random() * TEX_RES;
    const sy = Math.random() * TEX_RES;
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + (Math.random() - 0.5) * 140, sy + (Math.random() - 0.5) * 140);
    ctx.stroke();
  }

  const imgData = ctx.getImageData(0, 0, TEX_RES, TEX_RES);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 58;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise * 1.05));
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createGroundTerrainTexture(): THREE.CanvasTexture {
  const res = isSoftwareGl ? 512 : 1024;
  const canvas = document.createElement('canvas');
  canvas.width = res;
  canvas.height = res;
  const ctx = canvas.getContext('2d')!;

  // Neutral high-contrast micro-albedo so vertex biome colors shine through with 8K detail
  ctx.fillStyle = '#c8cebe';
  ctx.fillRect(0, 0, res, res);

  const patchCount = isSoftwareGl ? 350 : 1600;
  for (let i = 0; i < patchCount; i++) {
    const x = Math.random() * res;
    const y = Math.random() * res;
    const r = 1.5 + Math.random() * (res * 0.02);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    const roll = Math.random();
    ctx.fillStyle =
      roll > 0.65 ? '#adb89f' : roll > 0.3 ? '#bab29e' : '#9ea69b';
    ctx.fill();
  }

  const imgData = ctx.getImageData(0, 0, res, res);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const grit = (Math.random() - 0.5) * 32;
    data[i] = Math.max(0, Math.min(255, data[i] + grit));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + grit));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + grit * 0.9));
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(48, 48);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// High-Precision Sobel Normal Map generator from multi-octave height perturbations
export function createProceduralNormalMap(
  type: 'rock' | 'wood' | 'ground' | 'skin' | 'fabric'
): THREE.CanvasTexture {
  const res = isSoftwareGl ? 256 : 512;
  const canvas = document.createElement('canvas');
  canvas.width = res;
  canvas.height = res;
  const ctx = canvas.getContext('2d')!;

  const imgData = ctx.createImageData(res, res);
  const data = imgData.data;

  const heights = new Float32Array(res * res);
  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      let h = 0;
      if (type === 'wood') {
        h =
          (Math.sin(y * 0.45) +
            Math.sin(y * 1.2) * 0.35 +
            Math.random() * 0.22) *
          0.45;
      } else if (type === 'rock') {
        h =
          (Math.sin(x * 0.18) * Math.sin(y * 0.18) +
            Math.cos(x * 0.5 - y * 0.4) * 0.25 +
            Math.random() * 0.32) *
          0.65;
      } else if (type === 'skin') {
        // 8K Dermal micro-pores and epidermal grain
        h =
          (Math.sin(x * 0.85) * Math.cos(y * 0.85) * 0.25 +
            Math.sin((x + y) * 1.4) * 0.15 +
            Math.random() * 0.18) *
          0.22;
      } else if (type === 'fabric') {
        // Ballistic cross-weave pattern
        h =
          (Math.sin(x * 1.3) * 0.35 +
            Math.cos(y * 1.3) * 0.35 +
            Math.random() * 0.12) *
          0.35;
      } else {
        h =
          (Math.sin(x * 0.16) * Math.cos(y * 0.16) +
            Math.sin((x + y) * 0.4) * 0.2 +
            Math.random() * 0.2) *
          0.48;
      }
      heights[y * res + x] = h;
    }
  }

  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const xPrev = (x - 1 + res) % res;
      const xNext = (x + 1) % res;
      const yPrev = (y - 1 + res) % res;
      const yNext = (y + 1) % res;

      const dx = (heights[y * res + xNext] - heights[y * res + xPrev]) * 3.2;
      const dy = (heights[yNext * res + x] - heights[yPrev * res + x]) * 3.2;
      const dz = 1.0;

      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const nx = -dx / len;
      const ny = -dy / len;
      const nz = dz / len;

      const idx = (y * res + x) * 4;
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

const woodTex = typeof document !== 'undefined' ? createWoodTexture() : null;
const stoneTex = typeof document !== 'undefined' ? createStoneTexture() : null;
const groundTex =
  typeof document !== 'undefined' ? createGroundTerrainTexture() : null;
const groundNormal =
  typeof document !== 'undefined' ? createProceduralNormalMap('ground') : null;
const rockNormal =
  typeof document !== 'undefined' ? createProceduralNormalMap('rock') : null;
const woodNormal =
  typeof document !== 'undefined' ? createProceduralNormalMap('wood') : null;
const skinNormal =
  typeof document !== 'undefined' ? createProceduralNormalMap('skin') : null;
const fabricNormal =
  typeof document !== 'undefined' ? createProceduralNormalMap('fabric') : null;

if (groundNormal) groundNormal.repeat.set(48, 48);
if (rockNormal) rockNormal.repeat.set(3, 3);
if (woodNormal) woodNormal.repeat.set(2, 6);
if (skinNormal) skinNormal.repeat.set(6, 6);
if (fabricNormal) fabricNormal.repeat.set(8, 8);

export const gameMaterials = {
  // Multi-Biome Vertex-Colored 8K Terrain
  terrain: new THREE.MeshStandardMaterial({
    map: groundTex,
    normalMap: groundNormal,
    normalScale: new THREE.Vector2(1.35, 1.35),
    roughness: 0.82,
    metalness: 0.06,
    vertexColors: true,
  }),
  water: new THREE.MeshPhysicalMaterial({
    color: 0x124259,
    normalMap: groundNormal,
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughness: 0.03,
    metalness: 0.35,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    transparent: true,
    opacity: 0.84,
  }),

  // Wood & Foliage (Smooth Organic Shading)
  woodBark: new THREE.MeshStandardMaterial({
    map: woodTex,
    normalMap: woodNormal,
    normalScale: new THREE.Vector2(1.35, 1.35),
    color: 0x5c3e24,
    roughness: 0.8,
    metalness: 0.04,
  }),
  woodPlanks: new THREE.MeshStandardMaterial({
    map: woodTex,
    normalMap: woodNormal,
    normalScale: new THREE.Vector2(0.65, 0.65),
    color: 0x8d6440,
    roughness: 0.68,
    metalness: 0.05,
  }),
  pineNeedles: new THREE.MeshPhysicalMaterial({
    color: 0x1f4529,
    normalMap: fabricNormal,
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughness: 0.52,
    metalness: 0.02,
    sheen: 0.35,
    sheenColor: new THREE.Color(0x528a58),
  }),
  oakLeaves: new THREE.MeshPhysicalMaterial({
    color: 0x35622b,
    normalMap: fabricNormal,
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughness: 0.48,
    metalness: 0.02,
    sheen: 0.4,
    sheenColor: new THREE.Color(0x6da349),
  }),

  // Minerals & Metals
  granite: new THREE.MeshStandardMaterial({
    map: stoneTex,
    normalMap: rockNormal,
    normalScale: new THREE.Vector2(1.5, 1.5),
    color: 0x6f757e,
    roughness: 0.82,
    metalness: 0.15,
  }),
  ironOre: new THREE.MeshStandardMaterial({
    map: stoneTex,
    normalMap: rockNormal,
    normalScale: new THREE.Vector2(1.65, 1.65),
    color: 0x8f4d38,
    roughness: 0.42,
    metalness: 0.78,
  }),
  refinedSteel: new THREE.MeshStandardMaterial({
    normalMap: rockNormal,
    normalScale: new THREE.Vector2(0.25, 0.25),
    color: 0xe2e9f0,
    roughness: 0.16,
    metalness: 0.96,
  }),
  flintNode: new THREE.MeshStandardMaterial({
    color: 0x262d38,
    normalMap: rockNormal,
    normalScale: new THREE.Vector2(1.2, 1.2),
    roughness: 0.24,
    metalness: 0.5,
  }),

  // Base structures & props
  structureFrame: new THREE.MeshStandardMaterial({
    map: woodTex,
    color: 0x63462d,
    roughness: 0.8,
    metalness: 0.05,
  }),
  ironBand: new THREE.MeshStandardMaterial({
    normalMap: rockNormal,
    normalScale: new THREE.Vector2(0.35, 0.35),
    color: 0x363f47,
    roughness: 0.34,
    metalness: 0.88,
  }),
  firePitStones: new THREE.MeshStandardMaterial({
    map: stoneTex,
    normalMap: rockNormal,
    color: 0x474b52,
    roughness: 0.92,
    metalness: 0.05,
  }),
  emberGlow: new THREE.MeshStandardMaterial({
    color: 0xff4800,
    emissive: 0xff3b00,
    emissiveIntensity: 3.4,
    roughness: 0.4,
  }),
  beaconCrystalInactive: new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.9,
    roughness: 0.1,
    metalness: 0.2,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.88,
  }),
  beaconCrystalActive: new THREE.MeshPhysicalMaterial({
    color: 0x34d399,
    emissive: 0x10b981,
    emissiveIntensity: 3.2,
    roughness: 0.05,
    metalness: 0.2,
    clearcoat: 1.0,
  }),
  tentCanvas: new THREE.MeshStandardMaterial({
    normalMap: fabricNormal,
    normalScale: new THREE.Vector2(0.6, 0.6),
    color: 0x8b7d6b,
    roughness: 0.9,
    metalness: 0.02,
  }),

  // Characters & Outfits (8K Subsurface & Micro-Detail PBR)
  playerArmor: new THREE.MeshPhysicalMaterial({
    normalMap: rockNormal,
    normalScale: new THREE.Vector2(0.35, 0.35),
    color: 0x3e4752,
    roughness: 0.36,
    metalness: 0.68,
    clearcoat: 0.25,
    clearcoatRoughness: 0.4,
  }),
  leatherVest: new THREE.MeshPhysicalMaterial({
    normalMap: skinNormal,
    normalScale: new THREE.Vector2(0.6, 0.6),
    color: 0x593a22,
    roughness: 0.68,
    metalness: 0.08,
    sheen: 0.3,
    sheenColor: new THREE.Color(0x8a5b36),
  }),
  skinTone: new THREE.MeshPhysicalMaterial({
    normalMap: skinNormal,
    normalScale: new THREE.Vector2(0.32, 0.32),
    color: 0xdca788,
    roughness: 0.36,
    metalness: 0.0,
    sheen: 0.55,
    sheenColor: new THREE.Color(0xffb59e),
    clearcoat: 0.14,
    clearcoatRoughness: 0.35,
  }),
  furInsulation: new THREE.MeshPhysicalMaterial({
    normalMap: fabricNormal,
    normalScale: new THREE.Vector2(1.1, 1.1),
    color: 0x3b3935,
    roughness: 0.88,
    metalness: 0.0,
    sheen: 0.65,
    sheenColor: new THREE.Color(0x6e6a63),
  }),

  // Photorealistic 8K Character Materials
  photorealSkin: new THREE.MeshPhysicalMaterial({
    normalMap: skinNormal,
    normalScale: new THREE.Vector2(0.35, 0.35),
    color: 0xe2ab8b,
    roughness: 0.34,
    metalness: 0.0,
    sheen: 0.65,
    sheenColor: new THREE.Color(0xffb39c),
    clearcoat: 0.16,
    clearcoatRoughness: 0.32,
  }),
  lipSkin: new THREE.MeshPhysicalMaterial({
    normalMap: skinNormal,
    normalScale: new THREE.Vector2(0.25, 0.25),
    color: 0xc26d64,
    roughness: 0.26,
    metalness: 0.0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.2,
  }),
  eyeWhite: new THREE.MeshPhysicalMaterial({
    color: 0xf8fafc,
    roughness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
  }),
  eyeIris: new THREE.MeshPhysicalMaterial({
    color: 0x2e6f56,
    roughness: 0.15,
    clearcoat: 1.0,
  }),
  eyePupil: new THREE.MeshBasicMaterial({
    color: 0x050505,
  }),
  hairBrunette: new THREE.MeshPhysicalMaterial({
    normalMap: woodNormal,
    normalScale: new THREE.Vector2(0.55, 0.55),
    color: 0x221610,
    roughness: 0.42,
    metalness: 0.12,
    sheen: 0.75,
    sheenColor: new THREE.Color(0x593c28),
  }),
  hairSilver: new THREE.MeshPhysicalMaterial({
    normalMap: woodNormal,
    normalScale: new THREE.Vector2(0.5, 0.5),
    color: 0xcbd5e1,
    roughness: 0.38,
    metalness: 0.18,
    sheen: 0.8,
    sheenColor: new THREE.Color(0xf8fafc),
  }),
  hairAuburn: new THREE.MeshPhysicalMaterial({
    normalMap: woodNormal,
    normalScale: new THREE.Vector2(0.5, 0.5),
    color: 0x5c2418,
    roughness: 0.4,
    metalness: 0.1,
    sheen: 0.75,
    sheenColor: new THREE.Color(0x9e422b),
  }),
  tacticalCamoVest: new THREE.MeshPhysicalMaterial({
    normalMap: fabricNormal,
    normalScale: new THREE.Vector2(0.85, 0.85),
    color: 0x353d37,
    roughness: 0.72,
    metalness: 0.14,
    sheen: 0.25,
    sheenColor: new THREE.Color(0x525e54),
  }),
  trenchCoatLeather: new THREE.MeshPhysicalMaterial({
    normalMap: skinNormal,
    normalScale: new THREE.Vector2(0.65, 0.65),
    color: 0x452b18,
    roughness: 0.48,
    metalness: 0.12,
    clearcoat: 0.18,
    clearcoatRoughness: 0.45,
  }),
  combatBootRubber: new THREE.MeshStandardMaterial({
    normalMap: rockNormal,
    normalScale: new THREE.Vector2(0.5, 0.5),
    color: 0x1c2024,
    roughness: 0.78,
    metalness: 0.16,
  }),
  buckleBrass: new THREE.MeshStandardMaterial({
    color: 0xd9b43b,
    roughness: 0.2,
    metalness: 0.94,
  }),
  razorSteel: new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.1,
    metalness: 0.98,
  }),
  scarfCloth: new THREE.MeshPhysicalMaterial({
    normalMap: fabricNormal,
    normalScale: new THREE.Vector2(0.9, 0.9),
    color: 0xa83b24,
    roughness: 0.85,
    metalness: 0.02,
    sheen: 0.45,
    sheenColor: new THREE.Color(0xd96b43),
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
  gameMaterials.terrain.roughness = 0.82 - factor * 0.45;
  gameMaterials.terrain.metalness = 0.06 + factor * 0.25;
  gameMaterials.granite.roughness = 0.82 - factor * 0.5;
  gameMaterials.granite.metalness = 0.15 + factor * 0.3;
  gameMaterials.woodBark.roughness = 0.8 - factor * 0.35;
}

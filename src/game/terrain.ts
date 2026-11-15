import * as THREE from 'three';
import { gameMaterials, isSoftwareGl } from './materials';

// Expanded 640x640 Multi-Biome World Terrain Height Function
export function getTerrainHeight(x: number, z: number): number {
  const distFromCenter = Math.sqrt(x * x + z * z);

  // Settlement clearing in center (smooth gentle grade inside r < 22)
  const clearingFactor = Math.min(1.0, Math.max(0.0, (distFromCenter - 18) / 38));

  // Multi-octave rolling hills & mountain ridges across the 640m world
  const wave1 = Math.sin(x * 0.028) * Math.cos(z * 0.028) * 5.2;
  const wave2 = Math.sin(x * 0.075 + 1.2) * Math.cos(z * 0.068 - 0.7) * 2.4;
  const wave3 = Math.sin(x * 0.18) * Math.sin(z * 0.18) * 0.65;
  const ridge =
    distFromCenter > 95
      ? Math.sin(x * 0.018 - z * 0.015) * Math.cos(x * 0.014 + z * 0.02) * 8.5
      : 0;

  let h = (wave1 + wave2 + wave3 + ridge) * clearingFactor;

  // Riverbed depression curving across the valley
  const riverX = 40 + Math.sin(z * 0.035) * 18;
  const distToRiver = Math.abs(x - riverX);
  if (distToRiver < 12) {
    const depth = (1.0 - distToRiver / 12) * 2.8;
    h -= depth;
  }

  // Far outer world boundary mountain range (radius > 275m)
  if (distFromCenter > 275) {
    const cliffElev = Math.pow((distFromCenter - 275) * 0.35, 1.55);
    h += cliffElev;
  }

  return h;
}

// Compute Biome Color for any (x, z, y) coordinate for 8K Vertex Color Splatting
export function getBiomeTerrainColor(x: number, z: number, y: number): THREE.Color {
  const riverX = 40 + Math.sin(z * 0.035) * 18;
  const distToRiver = Math.abs(x - riverX);

  // Riverbank wet sand & smooth gravel
  if (distToRiver < 13.5) {
    return new THREE.Color(0x635b48);
  }

  // High altitude snow / alpine frost caps
  if (y > 9.5) {
    return new THREE.Color(0xdce6f2);
  }

  // Quadrant Biomes outside Central Haven (dist > 65)
  const dist = Math.hypot(x, z);
  if (dist > 65) {
    if (x < 0 && z < 0) {
      // North-West: Whispering Pine Timberlands (deep forest moss & dark loam)
      return new THREE.Color(0x2d4428);
    } else if (x >= 0 && z < 0) {
      // North-East: Ironcrag Obsidian & Rust Quarry (iron-rich slate & basalt)
      return new THREE.Color(0x524642);
    } else if (x >= 0 && z >= 0) {
      // South-East: Sunbleached Ruin Badlands (amber ochre & dry mesa earth)
      return new THREE.Color(0x785c3c);
    } else {
      // South-West: Frostpeak Glacial Pass (frosty tundra & silver moss)
      return new THREE.Color(0x7c8f99);
    }
  }

  // Central Outcast Haven lush valley
  return new THREE.Color(0x3f5430);
}

export function createTerrainMesh(): { terrainMesh: THREE.Mesh; waterMesh: THREE.Mesh } {
  const size = 640;
  const segments = isSoftwareGl ? 120 : 240;
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = getTerrainHeight(x, z);
    pos.setY(i, y);

    const c = getBiomeTerrainColor(x, z, y);
    // Subtle organic variation per vertex
    const jitter = 0.94 + Math.sin(x * 0.35 + z * 0.35) * 0.06;
    colors[i * 3] = Math.min(1, c.r * jitter);
    colors[i * 3 + 1] = Math.min(1, c.g * jitter);
    colors[i * 3 + 2] = Math.min(1, c.b * jitter);
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const terrainMesh = new THREE.Mesh(geo, gameMaterials.terrain);
  terrainMesh.receiveShadow = true;

  // Extended River water plane spanning the 640m world
  const waterGeo = new THREE.PlaneGeometry(42, 620);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMesh = new THREE.Mesh(waterGeo, gameMaterials.water);
  waterMesh.position.set(40, -1.1, 0);
  waterMesh.receiveShadow = true;

  return { terrainMesh, waterMesh };
}

// Outer World Rim Peaks & Landmark Rock Arches
export function createPerimeterNaturalBarriers(): THREE.Group {
  const barrierGroup = new THREE.Group();
  const radius = 285;
  const count = 48;

  for (let i = 0; i < count; i++) {
    const angle = (i * Math.PI * 2) / count + (Math.random() - 0.5) * 0.08;
    const x = Math.cos(angle) * (radius + (Math.random() - 0.5) * 14);
    const z = Math.sin(angle) * (radius + (Math.random() - 0.5) * 14);
    const y = getTerrainHeight(x, z) - 2.0;

    const rockGeo = new THREE.DodecahedronGeometry(14.0 + Math.random() * 8.0, 2);
    const rock = new THREE.Mesh(rockGeo, gameMaterials.granite);
    rock.position.set(x, y, z);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    rock.receiveShadow = true;
    barrierGroup.add(rock);
  }

  return barrierGroup;
}

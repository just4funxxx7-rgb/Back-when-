import * as THREE from 'three';
import { gameMaterials } from './materials';

// Procedural multi-octave height function
export function getTerrainHeight(x: number, z: number): number {
  const distFromCenter = Math.sqrt(x * x + z * z);

  // Settlement clearing in center (smooth gentle grade)
  const clearingFactor = Math.min(1.0, Math.max(0.0, (distFromCenter - 18) / 35));

  // Rolling hills
  const wave1 = Math.sin(x * 0.04) * Math.cos(z * 0.04) * 3.5;
  const wave2 = Math.sin(x * 0.09 + 1.2) * Math.cos(z * 0.08 - 0.7) * 1.8;
  const wave3 = Math.sin(x * 0.2) * Math.sin(z * 0.2) * 0.6;

  let h = (wave1 + wave2 + wave3) * clearingFactor;

  // Riverbed depression curving through x = 35..50
  const riverX = 40 + Math.sin(z * 0.05) * 12;
  const distToRiver = Math.abs(x - riverX);
  if (distToRiver < 10) {
    const depth = (1.0 - distToRiver / 10) * 2.5;
    h -= depth;
  }

  // Perimeter mountain cliff barriers bounding the world naturally (radius > 85)
  if (distFromCenter > 85) {
    const cliffElev = Math.pow((distFromCenter - 85) * 0.35, 1.6);
    h += cliffElev;
  }

  return h;
}

export function createTerrainMesh(): { terrainMesh: THREE.Mesh; waterMesh: THREE.Mesh } {
  const size = 260;
  const segments = 100;
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = getTerrainHeight(x, z);
    pos.setY(i, y);
  }

  geo.computeVertexNormals();

  const terrainMesh = new THREE.Mesh(geo, gameMaterials.terrain);
  terrainMesh.receiveShadow = true;

  // River water plane
  const waterGeo = new THREE.PlaneGeometry(28, 220);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMesh = new THREE.Mesh(waterGeo, gameMaterials.water);
  waterMesh.position.set(40, -1.1, 0);
  waterMesh.receiveShadow = true;

  return { terrainMesh, waterMesh };
}

// Perimeter Natural Cliff Rocks
export function createPerimeterNaturalBarriers(): THREE.Group {
  const barrierGroup = new THREE.Group();
  const radius = 95;
  const count = 36;

  for (let i = 0; i < count; i++) {
    const angle = (i * Math.PI * 2) / count + (Math.random() - 0.5) * 0.1;
    const x = Math.cos(angle) * (radius + (Math.random() - 0.5) * 10);
    const z = Math.sin(angle) * (radius + (Math.random() - 0.5) * 10);
    const y = getTerrainHeight(x, z) - 1.0;

    const rockGeo = new THREE.DodecahedronGeometry(8.0 + Math.random() * 5.0, 1);
    const rock = new THREE.Mesh(rockGeo, gameMaterials.granite);
    rock.position.set(x, y, z);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    rock.receiveShadow = true;
    barrierGroup.add(rock);
  }

  return barrierGroup;
}

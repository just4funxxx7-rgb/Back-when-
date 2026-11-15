import * as THREE from 'three';
import { gameMaterials, isSoftwareGl } from './materials';
import { PlacedStructure } from '../types/game';

const SEG = isSoftwareGl ? 12 : 28;

// Helper to enable shadow casting & receiving on all group meshes
export function setupGroupShadows(group: THREE.Group, cast = true, receive = true) {
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = cast;
      child.receiveShadow = receive;
    }
  });
}

// 1. High-Tessellation Procedural Trees (Pine, Oak, Gnarled Deadwood)
export function createProceduralTree(type: 'pine' | 'oak' | 'dead' = 'pine'): THREE.Group {
  const tree = new THREE.Group();

  if (type === 'pine') {
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.48, 4.4, SEG);
    const trunk = new THREE.Mesh(trunkGeo, gameMaterials.woodBark);
    trunk.position.y = 2.2;
    tree.add(trunk);

    // Sculpted root flares
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI * 2) / 4;
      const rootGeo = new THREE.ConeGeometry(0.2, 1.0, 10);
      const root = new THREE.Mesh(rootGeo, gameMaterials.woodBark);
      root.position.set(Math.cos(angle) * 0.36, 0.38, Math.sin(angle) * 0.36);
      root.rotation.z = Math.cos(angle) * 0.38;
      root.rotation.x = Math.sin(angle) * 0.38;
      tree.add(root);
    }

    // 5 lush layered conical needle canopies
    const tiers = [
      { y: 2.7, r: 2.35, h: 2.1 },
      { y: 3.9, r: 1.95, h: 1.9 },
      { y: 5.0, r: 1.5, h: 1.7 },
      { y: 6.0, r: 1.05, h: 1.5 },
      { y: 6.9, r: 0.6, h: 1.2 },
    ];

    tiers.forEach((tier, idx) => {
      const coneGeo = new THREE.ConeGeometry(tier.r, tier.h, 14);
      const foliage = new THREE.Mesh(coneGeo, gameMaterials.pineNeedles);
      foliage.position.y = tier.y;
      foliage.rotation.y = idx * 0.5;
      tree.add(foliage);
    });
  } else if (type === 'oak') {
    const trunkGeo = new THREE.CylinderGeometry(0.34, 0.62, 3.4, SEG);
    const trunk = new THREE.Mesh(trunkGeo, gameMaterials.woodBark);
    trunk.position.y = 1.7;
    tree.add(trunk);

    const canopyClusters = [
      { x: 0, y: 3.7, z: 0, r: 1.95 },
      { x: 0.9, y: 3.9, z: 0.55, r: 1.5 },
      { x: -0.8, y: 3.7, z: -0.65, r: 1.45 },
      { x: 0.25, y: 4.75, z: -0.25, r: 1.6 },
      { x: -0.5, y: 4.3, z: 0.7, r: 1.35 },
    ];

    canopyClusters.forEach((c) => {
      const leavesGeo = new THREE.IcosahedronGeometry(c.r, 2);
      const leaves = new THREE.Mesh(leavesGeo, gameMaterials.oakLeaves);
      leaves.position.set(c.x, c.y, c.z);
      tree.add(leaves);
    });
  } else {
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.42, 4.0, 12);
    const trunk = new THREE.Mesh(trunkGeo, gameMaterials.woodBark);
    trunk.position.y = 2.0;
    trunk.rotation.z = 0.12;
    tree.add(trunk);

    for (let i = 0; i < 4; i++) {
      const branchGeo = new THREE.CylinderGeometry(0.05, 0.12, 1.7, 8);
      const branch = new THREE.Mesh(branchGeo, gameMaterials.woodBark);
      const angle = (i * Math.PI) / 2;
      branch.position.set(Math.cos(angle) * 0.42, 2.5 + i * 0.35, Math.sin(angle) * 0.42);
      branch.rotation.z = Math.cos(angle) * 0.7;
      branch.rotation.x = Math.sin(angle) * 0.7;
      tree.add(branch);
    }
  }

  setupGroupShadows(tree, true, true);
  return tree;
}

// 2. High-Tessellation Procedural Boulders & Ore Veins
export function createProceduralRock(type: 'stone' | 'iron' | 'flint' = 'stone'): THREE.Group {
  const rockGroup = new THREE.Group();

  let baseMat = gameMaterials.granite;
  if (type === 'iron') baseMat = gameMaterials.ironOre;
  if (type === 'flint') baseMat = gameMaterials.flintNode;

  const boulderGeo = new THREE.DodecahedronGeometry(1.25, 2);
  const pos = boulderGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const warp = 1.0 + Math.sin(x * 3.1 + z * 2.7) * 0.12;
    pos.setX(i, x * warp);
    pos.setZ(i, z * warp);
    if (y < -0.25) {
      pos.setY(i, y * 0.45);
    }
  }
  boulderGeo.computeVertexNormals();

  const boulder = new THREE.Mesh(boulderGeo, baseMat);
  boulder.position.y = 0.75;
  rockGroup.add(boulder);

  const subGeo = new THREE.DodecahedronGeometry(0.68, 1);
  const subBoulder = new THREE.Mesh(subGeo, baseMat);
  subBoulder.position.set(0.92, 0.4, 0.42);
  rockGroup.add(subBoulder);

  if (type === 'iron') {
    for (let i = 0; i < 4; i++) {
      const crystalGeo = new THREE.OctahedronGeometry(0.24, 0);
      const crystal = new THREE.Mesh(crystalGeo, gameMaterials.refinedSteel);
      crystal.position.set(Math.sin(i * 1.6) * 0.75, 0.75 + i * 0.18, Math.cos(i * 1.6) * 0.75);
      crystal.rotation.set(0.4 * i, 0.8 * i, 0.2);
      rockGroup.add(crystal);
    }
  }

  setupGroupShadows(rockGroup, true, true);
  return rockGroup;
}

// 3. Procedural Medicinal Herb / Bush
export function createHarvestableHerb(): THREE.Group {
  const herbGroup = new THREE.Group();

  const stemGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.65, 8);
  const stem = new THREE.Mesh(stemGeo, gameMaterials.pineNeedles);
  stem.position.y = 0.32;
  herbGroup.add(stem);

  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI * 2) / 6;
    const leafGeo = new THREE.SphereGeometry(0.18, 10, 8);
    leafGeo.scale(1.4, 0.25, 0.7);
    const leaf = new THREE.Mesh(leafGeo, gameMaterials.oakLeaves);
    leaf.position.set(Math.cos(angle) * 0.24, 0.28, Math.sin(angle) * 0.24);
    leaf.rotation.y = -angle;
    leaf.rotation.z = 0.25;
    herbGroup.add(leaf);
  }

  const bloomGeo = new THREE.SphereGeometry(0.16, 12, 12);
  const bloomMat = new THREE.MeshPhysicalMaterial({
    color: 0xa855f7,
    emissive: 0x581c87,
    emissiveIntensity: 0.4,
    roughness: 0.3,
    clearcoat: 0.6,
  });
  const bloom = new THREE.Mesh(bloomGeo, bloomMat);
  bloom.position.y = 0.68;
  herbGroup.add(bloom);

  setupGroupShadows(herbGroup, true, false);
  return herbGroup;
}

// 3B. Frontier Supply Cache Crate
export function createSupplyCacheMesh(): THREE.Group {
  const group = new THREE.Group();
  const crate = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.75, 0.8),
    gameMaterials.tacticalCamoVest
  );
  crate.position.y = 0.375;
  group.add(crate);

  const strap1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.78, 0.84),
    gameMaterials.buckleBrass
  );
  strap1.position.set(-0.32, 0.38, 0);
  group.add(strap1);

  const strap2 = strap1.clone();
  strap2.position.x = 0.32;
  group.add(strap2);

  const beaconLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 10, 10),
    gameMaterials.emberGlow
  );
  beaconLight.position.set(0, 0.8, 0);
  group.add(beaconLight);

  setupGroupShadows(group, true, true);
  return group;
}

// 3C. Cartographer Survey Beacon Spire (Unlocks & Expands Map Sectors)
export function createSurveyBeaconMesh(activated = false): THREE.Group {
  const group = new THREE.Group();

  // Octagonal Stone Pedestal Base
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.35, 0.6, 8),
    gameMaterials.granite
  );
  base.position.y = 0.3;
  group.add(base);

  // Brushed Steel Pylon Core
  const pylon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.45, 4.2, 12),
    gameMaterials.ironBand
  );
  pylon.position.y = 2.4;
  group.add(pylon);

  // Brass Telemetry Rings
  for (const ry of [1.4, 2.8, 4.1]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.52, 0.045, 10, 24),
      gameMaterials.buckleBrass
    );
    ring.position.y = ry;
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
  }

  // Floating Aetheric Crystal Core at Apex
  const crystalMat = activated
    ? gameMaterials.beaconCrystalActive
    : gameMaterials.beaconCrystalInactive;
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 1), crystalMat);
  crystal.name = 'beacon_crystal';
  crystal.position.y = 5.2;
  group.add(crystal);

  // Outer Gyroscopic Ring
  const gyro = new THREE.Mesh(
    new THREE.TorusGeometry(0.85, 0.035, 10, 28),
    gameMaterials.refinedSteel
  );
  gyro.name = 'beacon_gyro';
  gyro.position.y = 5.2;
  gyro.rotation.x = 0.6;
  group.add(gyro);

  if (!isSoftwareGl) {
    const light = new THREE.PointLight(activated ? 0x10b981 : 0x38bdf8, 3.0, 18);
    light.position.set(0, 5.2, 0);
    group.add(light);
  }

  setupGroupShadows(group, true, true);
  return group;
}

export interface PlayerModelParts {
  root: THREE.Group;
  pelvisGroup: THREE.Group;
  spineGroup: THREE.Group;
  neckGroup: THREE.Group;
  headGroup: THREE.Group;
  rightArm: THREE.Group;
  rightForearm: THREE.Group;
  leftArm: THREE.Group;
  leftForearm: THREE.Group;
  rightLeg: THREE.Group;
  rightLowerLeg: THREE.Group;
  leftLeg: THREE.Group;
  leftLowerLeg: THREE.Group;
  scarfTail: THREE.Group;
  heldToolGroup: THREE.Group;
}

// 4. 8K High-Tessellation Photorealistic Player Character (100% Seamless Unified Anatomy)
export function createPlayerModel(): PlayerModelParts {
  const root = new THREE.Group();

  // Root Pelvis & Hips (Positioned at anatomical hip height y = 0.94m)
  const pelvisGroup = new THREE.Group();
  pelvisGroup.position.y = 0.94;
  root.add(pelvisGroup);

  // Seamless Anatomical Pelvis & Hip Capsule Core
  const pelvisGeo = new THREE.CylinderGeometry(0.215, 0.195, 0.26, SEG);
  const pelvisMesh = new THREE.Mesh(pelvisGeo, gameMaterials.tacticalCamoVest);
  pelvisMesh.position.y = 0.02;
  pelvisGroup.add(pelvisMesh);

  // Overlapping Hip-to-Abdomen Spherical Bridge (Eliminates any possible gap during spine rotation/lean)
  const waistBridge = new THREE.Mesh(
    new THREE.SphereGeometry(0.21, SEG, 16),
    gameMaterials.tacticalCamoVest
  );
  waistBridge.position.set(0, 0.11, 0);
  waistBridge.scale.set(1.02, 0.85, 0.88);
  pelvisGroup.add(waistBridge);

  // Weathered Leather Trench Coat Skirt / Tail overlapping upper thighs & waist
  const coatSkirt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.225, 0.275, 0.34, SEG, 1, true, Math.PI * 0.22, Math.PI * 1.56),
    gameMaterials.trenchCoatLeather
  );
  coatSkirt.material.side = THREE.DoubleSide;
  coatSkirt.position.set(0, -0.09, -0.01);
  pelvisGroup.add(coatSkirt);

  // Tactical Duty Belt with Brass Cartridge Loops
  const beltGeo = new THREE.CylinderGeometry(0.232, 0.232, 0.085, SEG);
  const beltMesh = new THREE.Mesh(beltGeo, gameMaterials.trenchCoatLeather);
  beltMesh.position.y = 0.04;
  pelvisGroup.add(beltMesh);

  // Solid Forged Brass Belt Buckle
  const buckleMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.095, 0.085, 0.05),
    gameMaterials.buckleBrass
  );
  buckleMesh.position.set(0, 0.04, 0.215);
  pelvisGroup.add(buckleMesh);

  // Survival Canteen Flask & Leather Pouch on Hips
  const canteenMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.16, 16),
    gameMaterials.combatBootRubber
  );
  canteenMesh.position.set(-0.235, -0.02, 0);
  canteenMesh.rotation.z = 0.12;
  pelvisGroup.add(canteenMesh);

  const knifeSheath = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 0.22, 0.075),
    gameMaterials.trenchCoatLeather
  );
  knifeSheath.position.set(0.235, -0.04, 0.04);
  knifeSheath.rotation.z = -0.18;
  pelvisGroup.add(knifeSheath);

  // Spine Group (Anchored directly inside the waist socket at local y = 0.08 — NEVER separated!)
  const spineGroup = new THREE.Group();
  spineGroup.position.set(0, 0.08, 0);
  pelvisGroup.add(spineGroup);

  // Lower Lumbar & Abdomen Core overlapping downward into pelvis (-0.06 to +0.28)
  const abdomenGeo = new THREE.CylinderGeometry(0.235, 0.21, 0.34, SEG);
  const abdomenMesh = new THREE.Mesh(abdomenGeo, gameMaterials.tacticalCamoVest);
  abdomenMesh.position.y = 0.11;
  abdomenMesh.scale.set(1.0, 1.0, 0.84);
  spineGroup.add(abdomenMesh);

  // Upper Pectoral & Ribcage Anatomical Torso (Smoothly joins abdomen at y = 0.22..0.60)
  const ribcageGeo = new THREE.CylinderGeometry(0.275, 0.235, 0.42, SEG);
  const ribcageMesh = new THREE.Mesh(ribcageGeo, gameMaterials.tacticalCamoVest);
  ribcageMesh.position.y = 0.41;
  ribcageMesh.scale.set(1.04, 1.0, 0.85);
  spineGroup.add(ribcageMesh);

  // Sculpted Pectoral Armor Plates & Ballistic Rig
  const chestPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.36, 0.23),
    gameMaterials.playerArmor
  );
  chestPlate.position.set(0, 0.4, 0.03);
  spineGroup.add(chestPlate);

  // Beveled Pectoral Sub-Plates
  for (const side of [-0.095, 0.095]) {
    const pecPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.15, 0.045),
      gameMaterials.ironBand
    );
    pecPlate.position.set(side, 0.46, 0.145);
    pecPlate.rotation.y = side > 0 ? -0.12 : 0.12;
    spineGroup.add(pecPlate);
  }

  // Expedition Survival Backpack with Rolled Fur Bedroll & Brass Lantern on Back
  const backpackGroup = new THREE.Group();
  backpackGroup.position.set(0, 0.38, -0.18);
  const packBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.42, 0.16),
    gameMaterials.trenchCoatLeather
  );
  backpackGroup.add(packBody);
  const bedroll = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.065, 0.38, 16),
    gameMaterials.furInsulation
  );
  bedroll.rotation.z = Math.PI / 2;
  bedroll.position.set(0, 0.25, 0);
  backpackGroup.add(bedroll);
  const packLantern = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.045, 0.11, 10),
    gameMaterials.emberGlow
  );
  packLantern.position.set(-0.16, -0.08, -0.05);
  backpackGroup.add(packLantern);
  spineGroup.add(backpackGroup);

  // Leather Shoulder Harness & Layered Steel Pauldrons
  for (const s of [-0.15, 0.15]) {
    const strap = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.46, 0.26),
      gameMaterials.trenchCoatLeather
    );
    strap.position.set(s, 0.39, 0);
    spineGroup.add(strap);

    const pauldron = new THREE.Mesh(
      new THREE.SphereGeometry(0.135, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.65),
      gameMaterials.ironBand
    );
    pauldron.position.set(s * 2.15, 0.56, 0);
    pauldron.rotation.z = s > 0 ? -0.35 : 0.35;
    spineGroup.add(pauldron);
  }

  // Neck Group
  const neckGroup = new THREE.Group();
  neckGroup.position.set(0, 0.6, 0);
  spineGroup.add(neckGroup);

  const neckMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.082, 0.098, 0.16, 20),
    gameMaterials.photorealSkin
  );
  neckMesh.position.y = 0.07;
  neckGroup.add(neckMesh);

  // Weathered Crimson-Amber Outcast Scarf Cowl
  const cowlMesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.145, 0.058, 14, 28),
    gameMaterials.scarfCloth
  );
  cowlMesh.position.set(0, 0.05, 0);
  cowlMesh.rotation.x = Math.PI / 2;
  neckGroup.add(cowlMesh);

  // Dynamic Scarf Tail
  const scarfTail = new THREE.Group();
  scarfTail.position.set(0.08, 0.05, -0.14);
  const scarfRibbon1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.48, 0.022),
    gameMaterials.scarfCloth
  );
  scarfRibbon1.position.y = -0.24;
  scarfTail.add(scarfRibbon1);
  neckGroup.add(scarfTail);

  // 8K High-Tessellation Head Group (Anatomical Cranium, Cheekbones, Jaw, Lips, Ears, Eyes, Hair)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.14, 0);
  neckGroup.add(headGroup);

  // Smooth High-Poly Cranium & Face
  const craniumGeo = new THREE.SphereGeometry(0.168, 32, 32);
  const cranium = new THREE.Mesh(craniumGeo, gameMaterials.photorealSkin);
  cranium.position.set(0, 0.14, 0);
  cranium.scale.set(0.94, 1.14, 1.04);
  headGroup.add(cranium);

  // Sculpted Jawline & Chin
  const jawGeo = new THREE.SphereGeometry(0.125, 24, 20);
  const jaw = new THREE.Mesh(jawGeo, gameMaterials.photorealSkin);
  jaw.position.set(0, 0.055, 0.035);
  jaw.scale.set(0.92, 0.78, 1.08);
  headGroup.add(jaw);

  // Sculpted Nose Bridge & Tip
  const noseBridge = new THREE.Mesh(
    new THREE.ConeGeometry(0.028, 0.085, 12),
    gameMaterials.photorealSkin
  );
  noseBridge.position.set(0, 0.13, 0.172);
  noseBridge.rotation.x = Math.PI * 0.42;
  headGroup.add(noseBridge);

  // Anatomical Lips (Upper & Lower Vermilion)
  const upperLip = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.011, 0.042, 8, 12),
    gameMaterials.lipSkin
  );
  upperLip.rotation.z = Math.PI / 2;
  upperLip.position.set(0, 0.072, 0.158);
  headGroup.add(upperLip);

  const lowerLip = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.012, 0.038, 8, 12),
    gameMaterials.lipSkin
  );
  lowerLip.rotation.z = Math.PI / 2;
  lowerLip.position.set(0, 0.056, 0.155);
  headGroup.add(lowerLip);

  // Anatomical Ears
  for (const s of [-0.158, 0.158]) {
    const ear = new THREE.Mesh(
      new THREE.SphereGeometry(0.036, 12, 12),
      gameMaterials.photorealSkin
    );
    ear.scale.set(0.38, 0.95, 0.65);
    ear.position.set(s, 0.135, -0.01);
    headGroup.add(ear);
  }

  // Realistic 8K Eyes (Sclera Sphere + Emerald-Hazel Iris + Pupil + Specular Cornea)
  for (const s of [-0.056, 0.056]) {
    const eyeSocket = new THREE.Group();
    eyeSocket.position.set(s, 0.155, 0.146);

    const eyeBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 18, 18),
      gameMaterials.eyeWhite
    );
    eyeSocket.add(eyeBall);

    const iris = new THREE.Mesh(
      new THREE.CircleGeometry(0.015, 18),
      gameMaterials.eyeIris
    );
    iris.position.z = 0.0265;
    eyeSocket.add(iris);

    const pupil = new THREE.Mesh(
      new THREE.CircleGeometry(0.007, 16),
      gameMaterials.eyePupil
    );
    pupil.position.z = 0.0275;
    eyeSocket.add(pupil);

    const brow = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.008, 0.042, 6, 10),
      gameMaterials.hairBrunette
    );
    brow.rotation.z = Math.PI / 2 + (s > 0 ? -0.08 : 0.08);
    brow.position.set(0, 0.032, 0.012);
    eyeSocket.add(brow);

    headGroup.add(eyeSocket);
  }

  // Volumetric Sculpted Hair Crown & Swept Locks
  const hairCrown = new THREE.Mesh(
    new THREE.SphereGeometry(0.176, 24, 24),
    gameMaterials.hairBrunette
  );
  hairCrown.position.set(0, 0.175, -0.022);
  hairCrown.scale.set(1.02, 1.06, 1.1);
  headGroup.add(hairCrown);

  for (let i = 0; i < 7; i++) {
    const strandAngle = (i - 3) * 0.16;
    const strand = new THREE.Mesh(
      new THREE.ConeGeometry(0.036, 0.15, 10),
      gameMaterials.hairBrunette
    );
    strand.position.set(Math.sin(strandAngle) * 0.13, 0.255, 0.105);
    strand.rotation.set(0.55, 0, -strandAngle * 0.75);
    headGroup.add(strand);
  }

  // Tactical Brass Goggles on Forehead
  const goggleStrap = new THREE.Mesh(
    new THREE.TorusGeometry(0.168, 0.018, 10, 28),
    gameMaterials.trenchCoatLeather
  );
  goggleStrap.position.set(0, 0.225, 0.01);
  goggleStrap.rotation.x = Math.PI / 2.2;
  headGroup.add(goggleStrap);

  for (const gx of [-0.06, 0.06]) {
    const lensRim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.042, 0.025, 16),
      gameMaterials.buckleBrass
    );
    lensRim.rotation.x = Math.PI / 2.2;
    lensRim.position.set(gx, 0.23, 0.155);
    headGroup.add(lensRim);
  }

  // Left Leg (Hip Ball Joint -> Muscular Thigh -> Knee Joint -> Calf -> Laced Combat Boot)
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.115, -0.02, 0);
  pelvisGroup.add(leftLeg);

  const lHipSocket = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 16, 16),
    gameMaterials.tacticalCamoVest
  );
  leftLeg.add(lHipSocket);

  const lThighMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.102, 0.082, 0.46, SEG),
    gameMaterials.tacticalCamoVest
  );
  lThighMesh.position.y = -0.23;
  leftLeg.add(lThighMesh);

  const leftLowerLeg = new THREE.Group();
  leftLowerLeg.position.set(0, -0.46, 0);
  leftLeg.add(leftLowerLeg);

  const lKneeJoint = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 16, 16),
    gameMaterials.ironBand
  );
  leftLowerLeg.add(lKneeJoint);

  const lCalfMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.082, 0.066, 0.4, SEG),
    gameMaterials.trenchCoatLeather
  );
  lCalfMesh.position.y = -0.2;
  leftLowerLeg.add(lCalfMesh);

  const lBoot = new THREE.Mesh(
    new THREE.BoxGeometry(0.135, 0.14, 0.26),
    gameMaterials.combatBootRubber
  );
  lBoot.position.set(0, -0.41, 0.045);
  leftLowerLeg.add(lBoot);

  // Right Leg (Hip Ball Joint -> Muscular Thigh -> Knee Joint -> Calf -> Laced Combat Boot)
  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.115, -0.02, 0);
  pelvisGroup.add(rightLeg);

  const rHipSocket = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 16, 16),
    gameMaterials.tacticalCamoVest
  );
  rightLeg.add(rHipSocket);

  const rThighMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.102, 0.082, 0.46, SEG),
    gameMaterials.tacticalCamoVest
  );
  rThighMesh.position.y = -0.23;
  rightLeg.add(rThighMesh);

  const rightLowerLeg = new THREE.Group();
  rightLowerLeg.position.set(0, -0.46, 0);
  rightLeg.add(rightLowerLeg);

  const rKneeJoint = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 16, 16),
    gameMaterials.ironBand
  );
  rightLowerLeg.add(rKneeJoint);

  const rCalfMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.082, 0.066, 0.4, SEG),
    gameMaterials.trenchCoatLeather
  );
  rCalfMesh.position.y = -0.2;
  rightLowerLeg.add(rCalfMesh);

  const rBoot = new THREE.Mesh(
    new THREE.BoxGeometry(0.135, 0.14, 0.26),
    gameMaterials.combatBootRubber
  );
  rBoot.position.set(0, -0.41, 0.045);
  rightLowerLeg.add(rBoot);

  // Left Arm (Shoulder Socket -> Deltoid/Bicep -> Elbow Joint -> Forearm Vambrace -> Sculpted Hand)
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.32, 0.5, 0);
  spineGroup.add(leftArm);

  const lShoulderBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.082, 16, 16),
    gameMaterials.tacticalCamoVest
  );
  leftArm.add(lShoulderBall);

  const lBicepMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.078, 0.066, 0.34, SEG),
    gameMaterials.tacticalCamoVest
  );
  lBicepMesh.position.y = -0.17;
  leftArm.add(lBicepMesh);

  const leftForearm = new THREE.Group();
  leftForearm.position.set(0, -0.34, 0);
  leftArm.add(leftForearm);

  const lElbowBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 14, 14),
    gameMaterials.trenchCoatLeather
  );
  leftForearm.add(lElbowBall);

  const lForearmMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.066, 0.054, 0.32, SEG),
    gameMaterials.trenchCoatLeather
  );
  lForearmMesh.position.y = -0.16;
  leftForearm.add(lForearmMesh);

  const lHand = new THREE.Mesh(
    new THREE.SphereGeometry(0.056, 14, 14),
    gameMaterials.photorealSkin
  );
  lHand.scale.set(0.85, 1.25, 0.65);
  lHand.position.set(0, -0.35, 0);
  leftForearm.add(lHand);

  // Right Arm (Shoulder Socket -> Deltoid/Bicep -> Elbow Joint -> Forearm Vambrace -> Hand & Waraxe)
  const rightArm = new THREE.Group();
  rightArm.position.set(0.32, 0.5, 0);
  spineGroup.add(rightArm);

  const rShoulderBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.082, 16, 16),
    gameMaterials.tacticalCamoVest
  );
  rightArm.add(rShoulderBall);

  const rBicepMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.078, 0.066, 0.34, SEG),
    gameMaterials.tacticalCamoVest
  );
  rBicepMesh.position.y = -0.17;
  rightArm.add(rBicepMesh);

  const rightForearm = new THREE.Group();
  rightForearm.position.set(0, -0.34, 0);
  rightArm.add(rightForearm);

  const rElbowBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 14, 14),
    gameMaterials.trenchCoatLeather
  );
  rightForearm.add(rElbowBall);

  const rForearmMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.066, 0.054, 0.32, SEG),
    gameMaterials.trenchCoatLeather
  );
  rForearmMesh.position.y = -0.16;
  rightForearm.add(rForearmMesh);

  const rHand = new THREE.Mesh(
    new THREE.SphereGeometry(0.056, 14, 14),
    gameMaterials.photorealSkin
  );
  rHand.scale.set(0.85, 1.25, 0.65);
  rHand.position.set(0, -0.35, 0);
  rightForearm.add(rHand);

  // Held Tool / Weapon Group attached to right hand
  const heldToolGroup = new THREE.Group();
  heldToolGroup.position.set(0, -0.36, 0.05);
  rightForearm.add(heldToolGroup);

  const axeHandle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.034, 0.88, 16),
    gameMaterials.woodPlanks
  );
  axeHandle.rotation.x = Math.PI / 2;
  heldToolGroup.add(axeHandle);

  const leatherGrip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.033, 0.033, 0.28, 16),
    gameMaterials.trenchCoatLeather
  );
  leatherGrip.rotation.x = Math.PI / 2;
  heldToolGroup.add(leatherGrip);

  const ferrule = new THREE.Mesh(
    new THREE.CylinderGeometry(0.044, 0.038, 0.1, 16),
    gameMaterials.ironBand
  );
  ferrule.position.set(0, 0, 0.32);
  ferrule.rotation.x = Math.PI / 2;
  heldToolGroup.add(ferrule);

  const axeHead = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.38, 0.26),
    gameMaterials.razorSteel
  );
  axeHead.position.set(0, 0.08, 0.36);
  heldToolGroup.add(axeHead);

  const axeSpike = new THREE.Mesh(
    new THREE.ConeGeometry(0.038, 0.14, 10),
    gameMaterials.ironBand
  );
  axeSpike.position.set(0, -0.12, 0.36);
  axeSpike.rotation.x = Math.PI;
  heldToolGroup.add(axeSpike);

  setupGroupShadows(root, true, true);

  return {
    root,
    pelvisGroup,
    spineGroup,
    neckGroup,
    headGroup,
    rightArm,
    rightForearm,
    leftArm,
    leftForearm,
    rightLeg,
    rightLowerLeg,
    leftLeg,
    leftLowerLeg,
    scarfTail,
    heldToolGroup,
  };
}

export interface NPCModelParts {
  root: THREE.Group;
  pelvisGroup: THREE.Group;
  spineGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  marker: THREE.Mesh;
}

// 5. 8K High-Tessellation Articulated Anatomical NPCs (Elena, Commander Drake, Vesper)
// Supports dynamic head-tracking, companion walking gait, gestures & Ragdoll Physics!
export function createNPCModel(npcId: string): THREE.Group {
  const npc = new THREE.Group();

  let coatMat: THREE.Material = gameMaterials.leatherVest;
  let hairMat: THREE.Material = gameMaterials.hairAuburn;
  let accentColor = 0x10b981; // Elena emerald
  if (npcId === 'drake') {
    coatMat = gameMaterials.playerArmor;
    hairMat = gameMaterials.hairSilver;
    accentColor = 0xf97316; // Drake amber-orange
  } else if (npcId === 'vesper') {
    coatMat = gameMaterials.furInsulation;
    hairMat = gameMaterials.hairBrunette;
    accentColor = 0xa855f7; // Vesper violet
  }

  // Articulated Pelvis Group at hip height y = 0.94
  const pelvisGroup = new THREE.Group();
  pelvisGroup.position.y = 0.94;
  npc.add(pelvisGroup);

  const pelvis = new THREE.Mesh(
    new THREE.CylinderGeometry(0.21, 0.19, 0.26, 24),
    coatMat
  );
  pelvis.position.y = 0.02;
  pelvisGroup.add(pelvis);

  const waistBridge = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 20, 14),
    coatMat
  );
  waistBridge.position.set(0, 0.1, 0);
  pelvisGroup.add(waistBridge);

  const belt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.08, 24),
    gameMaterials.trenchCoatLeather
  );
  belt.position.y = 0.06;
  pelvisGroup.add(belt);

  // Articulated Left & Right Legs attached to Pelvis
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.11, -0.02, 0);
  pelvisGroup.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.11, -0.02, 0);
  pelvisGroup.add(rightLeg);

  for (const legGroup of [leftLeg, rightLeg]) {
    const thigh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.098, 0.078, 0.48, 20),
      gameMaterials.tacticalCamoVest
    );
    thigh.position.set(0, -0.24, 0);
    legGroup.add(thigh);

    const calf = new THREE.Mesh(
      new THREE.CylinderGeometry(0.078, 0.064, 0.44, 20),
      gameMaterials.trenchCoatLeather
    );
    calf.position.set(0, -0.66, 0);
    legGroup.add(calf);

    const boot = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.14, 0.25),
      gameMaterials.combatBootRubber
    );
    boot.position.set(0, -0.86, 0.04);
    legGroup.add(boot);
  }

  // Articulated Spine & Torso Group
  const spineGroup = new THREE.Group();
  spineGroup.position.set(0, 0.08, 0);
  pelvisGroup.add(spineGroup);

  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.255, 0.205, 0.62, 24),
    coatMat
  );
  torso.position.y = 0.34;
  torso.scale.set(1.02, 1.0, 0.85);
  spineGroup.add(torso);

  // Articulated Arms & Hands attached to Spine
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.31, 0.56, 0);
  spineGroup.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.31, 0.56, 0);
  spineGroup.add(rightArm);

  for (const [idx, armGroup] of [leftArm, rightArm].entries()) {
    const isRight = idx === 1;
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.072, 0.056, 0.6, 18),
      coatMat
    );
    arm.position.set(0, -0.28, 0);
    arm.rotation.z = isRight ? -0.06 : 0.06;
    armGroup.add(arm);

    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(0.052, 14, 14),
      gameMaterials.photorealSkin
    );
    hand.position.set(isRight ? 0.02 : -0.02, -0.6, 0);
    armGroup.add(hand);
  }

  // Character-Specific Signature Gear on Spine
  if (npcId === 'elena') {
    const cloak = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.36, 0.95, 20, 1, true, Math.PI * 0.5, Math.PI),
      new THREE.MeshPhysicalMaterial({ color: accentColor, roughness: 0.65, side: THREE.DoubleSide })
    );
    cloak.position.set(0, 0.2, -0.04);
    spineGroup.add(cloak);
  } else if (npcId === 'drake') {
    for (const s of [-0.33, 0.33]) {
      const pauldron = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 16, 14),
        gameMaterials.refinedSteel
      );
      pauldron.position.set(s, 0.6, 0);
      spineGroup.add(pauldron);
    }
  } else {
    const scarf = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.055, 12, 24),
      new THREE.MeshPhysicalMaterial({ color: accentColor, roughness: 0.55 })
    );
    scarf.position.set(0, 0.68, 0);
    scarf.rotation.x = Math.PI / 2;
    spineGroup.add(scarf);
  }

  // Articulated Neck & Sculpted 8K Head Group
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.66, 0);
  spineGroup.add(headGroup);

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.078, 0.09, 0.15, 18),
    gameMaterials.photorealSkin
  );
  neck.position.y = 0.05;
  headGroup.add(neck);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.165, 28, 28),
    gameMaterials.photorealSkin
  );
  head.position.y = 0.24;
  head.scale.set(0.94, 1.12, 1.02);
  headGroup.add(head);

  // Eyes & Lips
  for (const ex of [-0.054, 0.054]) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 14, 14),
      gameMaterials.eyeWhite
    );
    eye.position.set(ex, 0.25, 0.145);
    headGroup.add(eye);

    const pupil = new THREE.Mesh(
      new THREE.CircleGeometry(0.011, 12),
      gameMaterials.eyeIris
    );
    pupil.position.set(ex, 0.25, 0.169);
    headGroup.add(pupil);
  }

  const lips = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.011, 0.038, 6, 10),
    gameMaterials.lipSkin
  );
  lips.rotation.z = Math.PI / 2;
  lips.position.set(0, 0.16, 0.155);
  headGroup.add(lips);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.174, 24, 24),
    hairMat
  );
  hair.position.set(0, 0.28, -0.02);
  hair.scale.set(1.03, 1.05, 1.1);
  headGroup.add(hair);

  // Floating Companion Status Diamond
  const markerGeo = new THREE.OctahedronGeometry(0.11, 0);
  const markerMat = new THREE.MeshBasicMaterial({ color: accentColor });
  const marker = new THREE.Mesh(markerGeo, markerMat);
  marker.position.y = 2.38;
  npc.add(marker);

  const parts: NPCModelParts = {
    root: npc,
    pelvisGroup,
    spineGroup,
    headGroup,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    marker,
  };
  npc.userData.parts = parts;

  setupGroupShadows(npc, true, true);
  return npc;
}

// 5B. Flying Physical Debris Fragment Mesh (Spawned during Structure Destruction)
export function createDebrisChunkMesh(
  materialType: 'wood' | 'stone' | 'iron' = 'wood'
): THREE.Mesh {
  if (materialType === 'wood') {
    const plankGeo = new THREE.BoxGeometry(
      0.16 + Math.random() * 0.14,
      0.08 + Math.random() * 0.06,
      0.55 + Math.random() * 0.45
    );
    const mesh = new THREE.Mesh(
      plankGeo,
      Math.random() > 0.4 ? gameMaterials.woodPlanks : gameMaterials.woodBark
    );
    mesh.castShadow = !isSoftwareGl;
    return mesh;
  } else if (materialType === 'iron') {
    const strapGeo = new THREE.BoxGeometry(0.1, 0.04, 0.48);
    const mesh = new THREE.Mesh(strapGeo, gameMaterials.ironBand);
    mesh.castShadow = !isSoftwareGl;
    return mesh;
  } else {
    const chunkGeo = new THREE.DodecahedronGeometry(
      0.16 + Math.random() * 0.14,
      0
    );
    const mesh = new THREE.Mesh(chunkGeo, gameMaterials.granite);
    mesh.castShadow = !isSoftwareGl;
    return mesh;
  }
}

// 5C. Persistent 3D Rubble Pile Mesh (Remains in the World when Base Structures Collapse)
export function createRubblePileMesh(
  originalType: PlacedStructure['type']
): THREE.Group {
  const group = new THREE.Group();

  // 1. Base Earth & Ash Rubble Mound
  const moundGeo = new THREE.ConeGeometry(1.45, 0.48, 12);
  const mound = new THREE.Mesh(moundGeo, gameMaterials.firePitStones);
  mound.position.y = 0.2;
  mound.scale.set(1.15, 1.0, 1.05);
  group.add(mound);

  // 2. Fractured Granite & Slate Stones scattered across the ruins
  for (let i = 0; i < 9; i++) {
    const angle = (i * Math.PI * 2) / 9 + (i % 2) * 0.25;
    const dist = 0.35 + (i % 3) * 0.34;
    const rStone = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.18 + (i % 3) * 0.06, 0),
      i % 2 === 0 ? gameMaterials.granite : gameMaterials.firePitStones
    );
    rStone.position.set(
      Math.cos(angle) * dist,
      0.14 + (i % 2) * 0.08,
      Math.sin(angle) * dist
    );
    rStone.rotation.set(i * 0.7, i * 1.1, i * 0.4);
    group.add(rStone);
  }

  // 3. Splintered Timber Beams & Collapsed Planks
  const beamCount = originalType === 'watchtower' ? 9 : 6;
  for (let i = 0; i < beamCount; i++) {
    const angle = (i * Math.PI * 2) / beamCount + 0.2;
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.1, 1.15 + (i % 2) * 0.35),
      i % 2 === 0 ? gameMaterials.woodBark : gameMaterials.woodPlanks
    );
    plank.position.set(
      Math.cos(angle) * 0.52,
      0.24 + (i % 3) * 0.09,
      Math.sin(angle) * 0.52
    );
    plank.rotation.set(
      0.25 + (i % 2) * 0.22,
      angle + 0.5,
      (i % 2 === 0 ? 1 : -1) * 0.18
    );
    group.add(plank);
  }

  // 4. Twisted Iron Bands & Rebar Brackets
  for (let i = 0; i < 3; i++) {
    const rebar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.85, 8),
      gameMaterials.ironBand
    );
    rebar.position.set((i - 1) * 0.42, 0.38, (i % 2 === 0 ? 1 : -1) * 0.25);
    rebar.rotation.set(0.45 * i, 0.8 * i, -0.35 + i * 0.3);
    group.add(rebar);
  }

  // 5. Smoldering Salvage Core Marker
  const emberCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 10),
    gameMaterials.emberGlow
  );
  emberCore.position.set(0, 0.36, 0);
  group.add(emberCore);

  setupGroupShadows(group, true, true);
  return group;
}

// 6. Procedural Base Building Pieces
export function createStructureMesh(
  type: PlacedStructure['type'],
  isHologram = false,
  isValid = true
): THREE.Group {
  const group = new THREE.Group();
  const holoMat = isValid ? gameMaterials.hologramValid : gameMaterials.hologramInvalid;

  if (type === 'foundation_wood') {
    const deckGeo = new THREE.BoxGeometry(3.0, 0.25, 3.0);
    const deck = new THREE.Mesh(deckGeo, isHologram ? holoMat : gameMaterials.woodPlanks);
    deck.position.y = 0.125;
    group.add(deck);

    for (const x of [-1.4, 1.4]) {
      for (const z of [-1.4, 1.4]) {
        const postGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.5, 12);
        const post = new THREE.Mesh(postGeo, isHologram ? holoMat : gameMaterials.woodBark);
        post.position.set(x, 0.25, z);
        group.add(post);
      }
    }
  } else if (type === 'wall_log') {
    const wallGeo = new THREE.BoxGeometry(3.0, 2.5, 0.3);
    const wall = new THREE.Mesh(wallGeo, isHologram ? holoMat : gameMaterials.woodBark);
    wall.position.y = 1.25;
    group.add(wall);

    if (!isHologram) {
      for (const y of [0.7, 1.8]) {
        const bandGeo = new THREE.BoxGeometry(3.05, 0.1, 0.34);
        const band = new THREE.Mesh(bandGeo, gameMaterials.ironBand);
        band.position.y = y;
        group.add(band);
      }
    }
  } else if (type === 'door_wood') {
    const frameLeft = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 2.5, 0.3),
      isHologram ? holoMat : gameMaterials.woodBark
    );
    frameLeft.position.set(-1.35, 1.25, 0);
    group.add(frameLeft);

    const frameRight = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 2.5, 0.3),
      isHologram ? holoMat : gameMaterials.woodBark
    );
    frameRight.position.set(1.35, 1.25, 0);
    group.add(frameRight);

    const frameTop = new THREE.Mesh(
      new THREE.BoxGeometry(3.0, 0.3, 0.3),
      isHologram ? holoMat : gameMaterials.woodBark
    );
    frameTop.position.set(0, 2.35, 0);
    group.add(frameTop);

    const doorGeo = new THREE.BoxGeometry(1.8, 2.2, 0.15);
    const door = new THREE.Mesh(doorGeo, isHologram ? holoMat : gameMaterials.woodPlanks);
    door.position.set(0, 1.1, 0);
    group.add(door);

    if (!isHologram) {
      const ringGeo = new THREE.TorusGeometry(0.08, 0.02, 8, 16);
      const ring = new THREE.Mesh(ringGeo, gameMaterials.ironBand);
      ring.position.set(0.65, 1.1, 0.1);
      group.add(ring);
    }
  } else if (type === 'campfire') {
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI * 2) / 8;
      const stoneGeo = new THREE.DodecahedronGeometry(0.22, 1);
      const stone = new THREE.Mesh(stoneGeo, isHologram ? holoMat : gameMaterials.firePitStones);
      stone.position.set(Math.cos(angle) * 0.75, 0.15, Math.sin(angle) * 0.75);
      group.add(stone);
    }

    for (let i = 0; i < 3; i++) {
      const logGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.1, 10);
      const log = new THREE.Mesh(logGeo, isHologram ? holoMat : gameMaterials.woodBark);
      log.position.y = 0.2;
      log.rotation.x = Math.PI / 2;
      log.rotation.z = (i * Math.PI) / 3;
      group.add(log);
    }

    const emberGeo = new THREE.SphereGeometry(0.3, 12, 12);
    const ember = new THREE.Mesh(emberGeo, isHologram ? holoMat : gameMaterials.emberGlow);
    ember.position.y = 0.25;
    group.add(ember);

    if (!isHologram) {
      const fireLight = new THREE.PointLight(0xff6611, 2.5, 14);
      fireLight.position.set(0, 0.7, 0);
      fireLight.castShadow = !isSoftwareGl;
      group.add(fireLight);
    }
  } else if (type === 'workbench') {
    const topGeo = new THREE.BoxGeometry(2.0, 0.15, 1.0);
    const top = new THREE.Mesh(topGeo, isHologram ? holoMat : gameMaterials.woodPlanks);
    top.position.y = 0.9;
    group.add(top);

    for (const x of [-0.85, 0.85]) {
      for (const z of [-0.35, 0.35]) {
        const legGeo = new THREE.BoxGeometry(0.15, 0.9, 0.15);
        const leg = new THREE.Mesh(legGeo, isHologram ? holoMat : gameMaterials.woodBark);
        leg.position.set(x, 0.45, z);
        group.add(leg);
      }
    }

    if (!isHologram) {
      const anvilGeo = new THREE.BoxGeometry(0.4, 0.25, 0.2);
      const anvil = new THREE.Mesh(anvilGeo, gameMaterials.refinedSteel);
      anvil.position.set(-0.5, 1.1, 0);
      group.add(anvil);

      const backGeo = new THREE.BoxGeometry(2.0, 0.6, 0.08);
      const back = new THREE.Mesh(backGeo, gameMaterials.woodBark);
      back.position.set(0, 1.25, -0.45);
      group.add(back);
    }
  } else if (type === 'storage_crate') {
    const boxGeo = new THREE.BoxGeometry(1.2, 0.8, 0.8);
    const box = new THREE.Mesh(boxGeo, isHologram ? holoMat : gameMaterials.woodPlanks);
    box.position.y = 0.4;
    group.add(box);

    if (!isHologram) {
      const lockGeo = new THREE.BoxGeometry(0.12, 0.15, 0.06);
      const lock = new THREE.Mesh(lockGeo, gameMaterials.refinedSteel);
      lock.position.set(0, 0.45, 0.42);
      group.add(lock);
    }
  } else if (type === 'water_collector') {
    const barrelGeo = new THREE.CylinderGeometry(0.5, 0.55, 1.2, 16);
    const barrel = new THREE.Mesh(barrelGeo, isHologram ? holoMat : gameMaterials.woodBark);
    barrel.position.y = 0.6;
    group.add(barrel);

    const funnelGeo = new THREE.ConeGeometry(0.8, 0.5, 16);
    const funnel = new THREE.Mesh(funnelGeo, isHologram ? holoMat : gameMaterials.ironBand);
    funnel.position.y = 1.45;
    funnel.rotation.x = Math.PI;
    group.add(funnel);
  } else if (type === 'watchtower') {
    for (const x of [-1.2, 1.2]) {
      for (const z of [-1.2, 1.2]) {
        const stiltGeo = new THREE.CylinderGeometry(0.15, 0.18, 5.0, 12);
        const stilt = new THREE.Mesh(stiltGeo, isHologram ? holoMat : gameMaterials.woodBark);
        stilt.position.set(x, 2.5, z);
        group.add(stilt);
      }
    }
    const platGeo = new THREE.BoxGeometry(3.0, 0.25, 3.0);
    const plat = new THREE.Mesh(platGeo, isHologram ? holoMat : gameMaterials.woodPlanks);
    plat.position.y = 5.0;
    group.add(plat);
  } else {
    const bedGeo = new THREE.BoxGeometry(1.2, 0.3, 2.2);
    const bed = new THREE.Mesh(bedGeo, isHologram ? holoMat : gameMaterials.tentCanvas);
    bed.position.y = 0.15;
    group.add(bed);

    const pillowGeo = new THREE.BoxGeometry(0.9, 0.18, 0.4);
    const pillow = new THREE.Mesh(pillowGeo, isHologram ? holoMat : gameMaterials.furInsulation);
    pillow.position.set(0, 0.35, -0.8);
    group.add(pillow);
  }

  if (!isHologram) {
    setupGroupShadows(group, true, true);
  }
  return group;
}

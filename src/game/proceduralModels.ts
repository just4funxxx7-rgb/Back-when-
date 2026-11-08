import * as THREE from 'three';
import { gameMaterials } from './materials';
import { PlacedStructure } from '../types/game';

// Helper to enable shadow casting & receiving on all group meshes
export function setupGroupShadows(group: THREE.Group, cast = true, receive = true) {
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = cast;
      child.receiveShadow = receive;
    }
  });
}

// 1. Procedural 3-12 Part Trees
export function createProceduralTree(type: 'pine' | 'oak' | 'dead' = 'pine'): THREE.Group {
  const tree = new THREE.Group();

  if (type === 'pine') {
    // Part 1: Trunk (Tapered cylinder)
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.45, 4.0, 8);
    const trunk = new THREE.Mesh(trunkGeo, gameMaterials.woodBark);
    trunk.position.y = 2.0;
    tree.add(trunk);

    // Part 2: Buttress Roots (3 angled pods at base)
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3;
      const rootGeo = new THREE.ConeGeometry(0.18, 0.9, 5);
      const root = new THREE.Mesh(rootGeo, gameMaterials.woodBark);
      root.position.set(Math.cos(angle) * 0.35, 0.35, Math.sin(angle) * 0.35);
      root.rotation.z = Math.cos(angle) * 0.35;
      root.rotation.x = Math.sin(angle) * 0.35;
      tree.add(root);
    }

    // Parts 3-6: 4 Tiered Conical Needle Layers
    const tiers = [
      { y: 2.8, r: 2.2, h: 2.0 },
      { y: 4.2, r: 1.8, h: 1.8 },
      { y: 5.4, r: 1.3, h: 1.6 },
      { y: 6.5, r: 0.8, h: 1.4 },
    ];

    tiers.forEach((tier) => {
      const coneGeo = new THREE.ConeGeometry(tier.r, tier.h, 7);
      const foliage = new THREE.Mesh(coneGeo, gameMaterials.pineNeedles);
      foliage.position.y = tier.y;
      tree.add(foliage);
    });
  } else if (type === 'oak') {
    // Oak Broadleaf Tree
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.6, 3.2, 8);
    const trunk = new THREE.Mesh(trunkGeo, gameMaterials.woodBark);
    trunk.position.y = 1.6;
    tree.add(trunk);

    // 4 Canopy clusters
    const canopyClusters = [
      { x: 0, y: 3.5, z: 0, r: 1.8 },
      { x: 0.8, y: 3.8, z: 0.5, r: 1.4 },
      { x: -0.7, y: 3.6, z: -0.6, r: 1.3 },
      { x: 0.2, y: 4.6, z: -0.2, r: 1.5 },
    ];

    canopyClusters.forEach((c) => {
      const leavesGeo = new THREE.DodecahedronGeometry(c.r, 1);
      const leaves = new THREE.Mesh(leavesGeo, gameMaterials.oakLeaves);
      leaves.position.set(c.x, c.y, c.z);
      tree.add(leaves);
    });
  } else {
    // Deadwood / Gnarled Tree
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.4, 3.8, 6);
    const trunk = new THREE.Mesh(trunkGeo, gameMaterials.woodBark);
    trunk.position.y = 1.9;
    trunk.rotation.z = 0.15;
    tree.add(trunk);

    // Bare branches
    for (let i = 0; i < 4; i++) {
      const branchGeo = new THREE.CylinderGeometry(0.06, 0.12, 1.6, 5);
      const branch = new THREE.Mesh(branchGeo, gameMaterials.woodBark);
      const angle = (i * Math.PI) / 2;
      branch.position.set(Math.cos(angle) * 0.4, 2.5 + i * 0.35, Math.sin(angle) * 0.4);
      branch.rotation.z = Math.cos(angle) * 0.7;
      branch.rotation.x = Math.sin(angle) * 0.7;
      tree.add(branch);
    }
  }

  setupGroupShadows(tree, true, true);
  return tree;
}

// 2. Procedural Faceted Boulders & Ore Nodes
export function createProceduralRock(type: 'stone' | 'iron' | 'flint' = 'stone'): THREE.Group {
  const rockGroup = new THREE.Group();

  let baseMat = gameMaterials.granite;
  if (type === 'iron') baseMat = gameMaterials.ironOre;
  if (type === 'flint') baseMat = gameMaterials.flintNode;

  // Main faceted boulder
  const boulderGeo = new THREE.DodecahedronGeometry(1.2, 1);
  // Flatten bottom slightly so it sits flush
  const pos = boulderGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < -0.3) {
      pos.setY(i, y * 0.5);
    }
  }
  boulderGeo.computeVertexNormals();

  const boulder = new THREE.Mesh(boulderGeo, baseMat);
  boulder.position.y = 0.75;
  rockGroup.add(boulder);

  // Secondary sub-boulder
  const subGeo = new THREE.DodecahedronGeometry(0.65, 0);
  const subBoulder = new THREE.Mesh(subGeo, baseMat);
  subBoulder.position.set(0.9, 0.4, 0.4);
  rockGroup.add(subBoulder);

  // If iron ore, add metallic glint crystals
  if (type === 'iron') {
    for (let i = 0; i < 3; i++) {
      const crystalGeo = new THREE.BoxGeometry(0.25, 0.25, 0.35);
      const crystal = new THREE.Mesh(crystalGeo, gameMaterials.refinedSteel);
      crystal.position.set(Math.sin(i) * 0.7, 0.8 + i * 0.2, Math.cos(i) * 0.7);
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

  const stemGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.6, 5);
  const stem = new THREE.Mesh(stemGeo, gameMaterials.pineNeedles);
  stem.position.y = 0.3;
  herbGroup.add(stem);

  // Radiating leaves
  for (let i = 0; i < 5; i++) {
    const angle = (i * Math.PI * 2) / 5;
    const leafGeo = new THREE.BoxGeometry(0.3, 0.04, 0.15);
    const leaf = new THREE.Mesh(leafGeo, gameMaterials.oakLeaves);
    leaf.position.set(Math.cos(angle) * 0.25, 0.25, Math.sin(angle) * 0.25);
    leaf.rotation.y = angle;
    leaf.rotation.z = 0.25;
    herbGroup.add(leaf);
  }

  // Blossom / Berries
  const bloomGeo = new THREE.SphereGeometry(0.16, 6, 6);
  const bloomMat = new THREE.MeshStandardMaterial({ color: 0x9333ea, roughness: 0.5 });
  const bloom = new THREE.Mesh(bloomGeo, bloomMat);
  bloom.position.y = 0.65;
  herbGroup.add(bloom);

  setupGroupShadows(herbGroup, true, false);
  return herbGroup;
}

export interface PlayerModelParts {
  root: THREE.Group;
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

// 4. Photorealistic Procedural Player Character (Anatomical Sculpt with Articulated Kinematic Joints)
export function createPlayerModel(): PlayerModelParts {
  const root = new THREE.Group();

  // Root Pelvis & Waist Belt
  const pelvisGroup = new THREE.Group();
  pelvisGroup.position.y = 0.96;
  root.add(pelvisGroup);

  // Pelvic base core
  const pelvisGeo = new THREE.CylinderGeometry(0.22, 0.19, 0.22, 10);
  const pelvisMesh = new THREE.Mesh(pelvisGeo, gameMaterials.tacticalCamoVest);
  pelvisMesh.position.y = 0;
  pelvisGroup.add(pelvisMesh);

  // Tactical Duty Belt with Stitching
  const beltGeo = new THREE.CylinderGeometry(0.23, 0.23, 0.08, 12);
  const beltMesh = new THREE.Mesh(beltGeo, gameMaterials.trenchCoatLeather);
  beltMesh.position.y = 0.04;
  pelvisGroup.add(beltMesh);

  // Solid Brass Belt Buckle
  const buckleGeo = new THREE.BoxGeometry(0.09, 0.08, 0.06);
  const buckleMesh = new THREE.Mesh(buckleGeo, gameMaterials.buckleBrass);
  buckleMesh.position.set(0, 0.04, 0.21);
  pelvisGroup.add(buckleMesh);

  // Survival Canteen Flask on Left Hip
  const canteenGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.15, 8);
  const canteenMesh = new THREE.Mesh(canteenGeo, gameMaterials.combatBootRubber);
  canteenMesh.position.set(-0.24, -0.02, 0);
  canteenMesh.rotation.z = 0.15;
  pelvisGroup.add(canteenMesh);
  const canteenCap = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.04, 8), gameMaterials.razorSteel);
  canteenCap.position.set(-0.24, 0.07, 0);
  pelvisGroup.add(canteenCap);

  // Sheathed Combat Knife on Right Hip
  const knifeSheath = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.22, 0.07), gameMaterials.trenchCoatLeather);
  knifeSheath.position.set(0.24, -0.04, 0.04);
  knifeSheath.rotation.z = -0.2;
  pelvisGroup.add(knifeSheath);

  // Spine Group (Pivots for breathing, spine bending, and torso lean)
  const spineGroup = new THREE.Group();
  spineGroup.position.set(0, 0.11, 0);
  pelvisGroup.add(spineGroup);

  // Pectoral Anatomical Torso Core
  const torsoGeo = new THREE.CylinderGeometry(0.27, 0.22, 0.58, 10);
  const torsoMesh = new THREE.Mesh(torsoGeo, gameMaterials.tacticalCamoVest);
  torsoMesh.position.y = 0.29;
  spineGroup.add(torsoMesh);

  // Ballistic Tactical Armor Chestplate with MOLLE Webbing
  const chestPlateGeo = new THREE.BoxGeometry(0.36, 0.38, 0.18);
  const chestPlate = new THREE.Mesh(chestPlateGeo, gameMaterials.playerArmor);
  chestPlate.position.set(0, 0.35, 0.09);
  spineGroup.add(chestPlate);

  // Weathered Leather Collar & Harness Straps
  for (let s of [-0.14, 0.14]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.22), gameMaterials.trenchCoatLeather);
    strap.position.set(s, 0.36, 0);
    spineGroup.add(strap);

    // Beveled Shoulder Pauldrons
    const pauldronGeo = new THREE.BoxGeometry(0.18, 0.14, 0.24);
    const pauldron = new THREE.Mesh(pauldronGeo, gameMaterials.ironBand);
    pauldron.position.set(s * 2.2, 0.52, 0);
    pauldron.rotation.z = s > 0 ? -0.2 : 0.2;
    spineGroup.add(pauldron);
  }

  // Neck Group
  const neckGroup = new THREE.Group();
  neckGroup.position.set(0, 0.58, 0);
  spineGroup.add(neckGroup);

  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.095, 0.14, 8), gameMaterials.photorealSkin);
  neckMesh.position.y = 0.07;
  neckGroup.add(neckMesh);

  // Weathered Amber Scarf & Cowl
  const cowlMesh = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.06, 8, 16), gameMaterials.scarfCloth);
  cowlMesh.position.set(0, 0.06, 0);
  cowlMesh.rotation.x = Math.PI / 2;
  neckGroup.add(cowlMesh);

  // Dynamic Scarf Tail (Reacts to physics velocity & wind)
  const scarfTail = new THREE.Group();
  scarfTail.position.set(0.08, 0.05, -0.14);
  const scarfRibbon1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.02), gameMaterials.scarfCloth);
  scarfRibbon1.position.y = -0.22;
  scarfTail.add(scarfRibbon1);
  neckGroup.add(scarfTail);

  // Head Group (Anatomical Cranium, Facial Features, Realistic Eyes, Layered Hair)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.14, 0);
  neckGroup.add(headGroup);

  // Cranium base
  const craniumGeo = new THREE.SphereGeometry(0.165, 12, 12);
  const cranium = new THREE.Mesh(craniumGeo, gameMaterials.photorealSkin);
  cranium.position.set(0, 0.14, -0.01);
  cranium.scale.set(0.95, 1.15, 1.05);
  headGroup.add(cranium);

  // Sculpted Jaw and Chin
  const jawGeo = new THREE.ConeGeometry(0.13, 0.16, 5);
  const jaw = new THREE.Mesh(jawGeo, gameMaterials.photorealSkin);
  jaw.position.set(0, 0.03, 0.05);
  jaw.rotation.x = Math.PI * 0.85;
  headGroup.add(jaw);

  // Defined Nose Bridge
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.07, 0.05), gameMaterials.photorealSkin);
  nose.position.set(0, 0.13, 0.17);
  nose.rotation.x = -0.15;
  headGroup.add(nose);

  // Realistic Eyes (Sockets + White Sclera + Hazel-Green Iris + Dark Pupil)
  for (let s of [-0.055, 0.055]) {
    const eyeSocket = new THREE.Group();
    eyeSocket.position.set(s, 0.155, 0.145);

    // Eyeball Sclera
    const eyeBall = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), gameMaterials.eyeWhite);
    eyeSocket.add(eyeBall);

    // Iris
    const iris = new THREE.Mesh(new THREE.CircleGeometry(0.015, 8), gameMaterials.eyeIris);
    iris.position.z = 0.026;
    eyeSocket.add(iris);

    // Pupil
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.007, 8), gameMaterials.eyePupil);
    pupil.position.z = 0.027;
    eyeSocket.add(pupil);

    // Brow ridge
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.015, 0.03), gameMaterials.hairBrunette);
    brow.position.set(0, 0.035, 0.01);
    eyeSocket.add(brow);

    headGroup.add(eyeSocket);
  }

  // Layered Sculpted Hair Strands (Volumetric locks with specular sheen)
  const hairCrown = new THREE.Mesh(new THREE.SphereGeometry(0.175, 10, 10), gameMaterials.hairBrunette);
  hairCrown.position.set(0, 0.18, -0.02);
  hairCrown.scale.set(1.02, 1.05, 1.1);
  headGroup.add(hairCrown);

  // Front swept hair strands
  for (let i = 0; i < 5; i++) {
    const strandAngle = (i - 2) * 0.18;
    const strand = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.14, 5), gameMaterials.hairBrunette);
    strand.position.set(Math.sin(strandAngle) * 0.12, 0.26, 0.1);
    strand.rotation.set(0.6, 0, -strandAngle * 0.8);
    headGroup.add(strand);
  }

  // Survival Aviator / Tactical Goggles on Forehead
  const goggleFrame = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.025, 6, 16), gameMaterials.buckleBrass);
  goggleFrame.position.set(0, 0.22, 0.04);
  goggleFrame.rotation.x = Math.PI / 2.3;
  headGroup.add(goggleFrame);

  // Left Leg (Hip Joint -> Thigh -> Knee Joint -> Calf -> Combat Boot)
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.16, 0, 0);
  pelvisGroup.add(leftLeg);

  // Upper Thigh
  const lThighMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.08, 0.46, 8), gameMaterials.tacticalCamoVest);
  lThighMesh.position.y = -0.23;
  leftLeg.add(lThighMesh);

  // Left Knee Joint
  const leftLowerLeg = new THREE.Group();
  leftLowerLeg.position.set(0, -0.46, 0);
  leftLeg.add(leftLowerLeg);

  // Knee Guard Plate
  const lKneePad = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.07), gameMaterials.ironBand);
  lKneePad.position.set(0, 0, 0.07);
  leftLowerLeg.add(lKneePad);

  // Calf with Laced Gaiter
  const lCalfMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.065, 0.38, 8), gameMaterials.trenchCoatLeather);
  lCalfMesh.position.y = -0.19;
  leftLowerLeg.add(lCalfMesh);

  // Combat Boot with Beveled Rubber Tread Sole
  const lBoot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.26), gameMaterials.combatBootRubber);
  lBoot.position.set(0, -0.42, 0.04);
  leftLowerLeg.add(lBoot);

  // Right Leg (Hip Joint -> Thigh -> Knee Joint -> Calf -> Combat Boot)
  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.16, 0, 0);
  pelvisGroup.add(rightLeg);

  // Upper Thigh
  const rThighMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.08, 0.46, 8), gameMaterials.tacticalCamoVest);
  rThighMesh.position.y = -0.23;
  rightLeg.add(rThighMesh);

  // Right Knee Joint
  const rightLowerLeg = new THREE.Group();
  rightLowerLeg.position.set(0, -0.46, 0);
  rightLeg.add(rightLowerLeg);

  // Knee Guard Plate
  const rKneePad = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.07), gameMaterials.ironBand);
  rKneePad.position.set(0, 0, 0.07);
  rightLowerLeg.add(rKneePad);

  // Calf with Laced Gaiter
  const rCalfMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.065, 0.38, 8), gameMaterials.trenchCoatLeather);
  rCalfMesh.position.y = -0.19;
  rightLowerLeg.add(rCalfMesh);

  // Combat Boot with Beveled Rubber Tread Sole
  const rBoot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.26), gameMaterials.combatBootRubber);
  rBoot.position.set(0, -0.42, 0.04);
  rightLowerLeg.add(rBoot);

  // Left Arm (Shoulder Joint -> Bicep -> Elbow Joint -> Forearm -> Articulated Hand)
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.35, 0.46, 0);
  spineGroup.add(leftArm);

  const lBicepMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.34, 8), gameMaterials.tacticalCamoVest);
  lBicepMesh.position.y = -0.17;
  leftArm.add(lBicepMesh);

  // Left Elbow Joint
  const leftForearm = new THREE.Group();
  leftForearm.position.set(0, -0.34, 0);
  leftArm.add(leftForearm);

  const lForearmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.32, 8), gameMaterials.trenchCoatLeather);
  lForearmMesh.position.y = -0.16;
  leftForearm.add(lForearmMesh);

  // Hand & Fingers (Photoreal Skin)
  const lHand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.05), gameMaterials.photorealSkin);
  lHand.position.set(0, -0.36, 0);
  leftForearm.add(lHand);

  // Right Arm (Shoulder Joint -> Bicep -> Elbow Joint -> Forearm -> Grasping Hand & Weapon)
  const rightArm = new THREE.Group();
  rightArm.position.set(0.35, 0.46, 0);
  spineGroup.add(rightArm);

  const rBicepMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.34, 8), gameMaterials.tacticalCamoVest);
  rBicepMesh.position.y = -0.17;
  rightArm.add(rBicepMesh);

  // Right Elbow Joint
  const rightForearm = new THREE.Group();
  rightForearm.position.set(0, -0.34, 0);
  rightArm.add(rightForearm);

  const rForearmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.32, 8), gameMaterials.trenchCoatLeather);
  rForearmMesh.position.y = -0.16;
  rightForearm.add(rForearmMesh);

  // Grasping Hand with Curled Fingers
  const rHand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.05), gameMaterials.photorealSkin);
  rHand.position.set(0, -0.36, 0);
  rightForearm.add(rHand);

  // Held Tool / Weapon Group attached to right hand
  const heldToolGroup = new THREE.Group();
  heldToolGroup.position.set(0, -0.38, 0.05);
  rightForearm.add(heldToolGroup);

  // Photorealistic Forged Survival Waraxe
  // Curved Hardwood Handle with Wrapped Leather Grip
  const axeHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.88, 8), gameMaterials.woodPlanks);
  axeHandle.rotation.x = Math.PI / 2;
  heldToolGroup.add(axeHandle);

  const leatherGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.28, 8), gameMaterials.trenchCoatLeather);
  leatherGrip.rotation.x = Math.PI / 2;
  heldToolGroup.add(leatherGrip);

  // Forged Steel Collar Ferrule with Brass Rivets
  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 8), gameMaterials.ironBand);
  ferrule.position.set(0, 0, 0.32);
  ferrule.rotation.x = Math.PI / 2;
  heldToolGroup.add(ferrule);

  // Double-Beveled Razor Steel Axe Head
  const axeHeadGeo = new THREE.BoxGeometry(0.06, 0.38, 0.26);
  const axeHead = new THREE.Mesh(axeHeadGeo, gameMaterials.razorSteel);
  axeHead.position.set(0, 0.08, 0.36);
  heldToolGroup.add(axeHead);

  const axeSpike = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 4), gameMaterials.ironBand);
  axeSpike.position.set(0, -0.12, 0.36);
  axeSpike.rotation.x = Math.PI;
  heldToolGroup.add(axeSpike);

  setupGroupShadows(root, true, true);

  return {
    root,
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

// 5. Procedural NPCs with bespoke silhouettes
export function createNPCModel(npcId: string): THREE.Group {
  const npc = new THREE.Group();

  let coatMat = gameMaterials.leatherVest;
  let accentColor = 0x10b981; // Elena green
  if (npcId === 'drake') {
    coatMat = gameMaterials.playerArmor;
    accentColor = 0xf97316; // Drake orange
  } else if (npcId === 'vesper') {
    coatMat = gameMaterials.furInsulation;
    accentColor = 0xa855f7; // Vesper purple
  }

  // Base humanoid body
  const legsGeo = new THREE.BoxGeometry(0.45, 0.9, 0.3);
  const legs = new THREE.Mesh(legsGeo, gameMaterials.leatherVest);
  legs.position.y = 0.45;
  npc.add(legs);

  const torsoGeo = new THREE.BoxGeometry(0.6, 0.75, 0.38);
  const torso = new THREE.Mesh(torsoGeo, coatMat);
  torso.position.y = 1.35;
  npc.add(torso);

  const headGeo = new THREE.BoxGeometry(0.35, 0.38, 0.35);
  const head = new THREE.Mesh(headGeo, gameMaterials.skinTone);
  head.position.y = 1.95;
  npc.add(head);

  // Accent detail
  if (npcId === 'elena') {
    // Herbalist Satchel & Cloak
    const satchelGeo = new THREE.BoxGeometry(0.3, 0.25, 0.15);
    const satchelMat = new THREE.MeshStandardMaterial({ color: 0x4d3826, roughness: 0.8 });
    const satchel = new THREE.Mesh(satchelGeo, satchelMat);
    satchel.position.set(0.32, 1.0, 0);
    npc.add(satchel);

    const capeGeo = new THREE.BoxGeometry(0.65, 0.85, 0.08);
    const capeMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.7 });
    const cape = new THREE.Mesh(capeGeo, capeMat);
    cape.position.set(0, 1.3, -0.22);
    npc.add(cape);
  } else if (npcId === 'drake') {
    // Heavy Pauldrons & Tactical Plate
    for (let s of [-0.38, 0.38]) {
      const pauldronGeo = new THREE.BoxGeometry(0.24, 0.2, 0.32);
      const pauldron = new THREE.Mesh(pauldronGeo, gameMaterials.refinedSteel);
      pauldron.position.set(s, 1.7, 0);
      npc.add(pauldron);
    }
    // Weapon sheath
    const sheathGeo = new THREE.BoxGeometry(0.1, 0.9, 0.15);
    const sheath = new THREE.Mesh(sheathGeo, gameMaterials.ironBand);
    sheath.position.set(-0.35, 0.9, 0);
    sheath.rotation.z = 0.2;
    npc.add(sheath);
  } else {
    // Vesper: Scavenger Rogue Coat & Daggers
    const scarfGeo = new THREE.TorusGeometry(0.25, 0.08, 6, 12);
    const scarfMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.6 });
    const scarf = new THREE.Mesh(scarfGeo, scarfMat);
    scarf.position.set(0, 1.75, 0);
    scarf.rotation.x = Math.PI / 2;
    npc.add(scarf);

    // Twin daggers
    for (let s of [-0.3, 0.3]) {
      const daggerGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.45, 5);
      const dagger = new THREE.Mesh(daggerGeo, gameMaterials.refinedSteel);
      dagger.position.set(s, 0.85, 0.15);
      dagger.rotation.z = s > 0 ? 0.3 : -0.3;
      npc.add(dagger);
    }
  }

  // Floating Name / Status Beacon Marker above head
  const markerGeo = new THREE.ConeGeometry(0.12, 0.25, 5);
  const markerMat = new THREE.MeshBasicMaterial({ color: accentColor });
  const marker = new THREE.Mesh(markerGeo, markerMat);
  marker.position.y = 2.4;
  marker.rotation.x = Math.PI;
  npc.add(marker);

  setupGroupShadows(npc, true, true);
  return npc;
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
    // Timber Foundation Deck (3x3 units)
    const deckGeo = new THREE.BoxGeometry(3.0, 0.25, 3.0);
    const deck = new THREE.Mesh(deckGeo, isHologram ? holoMat : gameMaterials.woodPlanks);
    deck.position.y = 0.125;
    group.add(deck);

    // 4 Corner Foundation Posts
    for (let x of [-1.4, 1.4]) {
      for (let z of [-1.4, 1.4]) {
        const postGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.5, 6);
        const post = new THREE.Mesh(postGeo, isHologram ? holoMat : gameMaterials.woodBark);
        post.position.set(x, 0.25, z);
        group.add(post);
      }
    }
  } else if (type === 'wall_log') {
    // Fortified Log Wall (3.0 wide, 2.5 high)
    const wallGeo = new THREE.BoxGeometry(3.0, 2.5, 0.3);
    const wall = new THREE.Mesh(wallGeo, isHologram ? holoMat : gameMaterials.woodBark);
    wall.position.y = 1.25;
    group.add(wall);

    // 2 Iron reinforcement strapping bands
    if (!isHologram) {
      for (let y of [0.7, 1.8]) {
        const bandGeo = new THREE.BoxGeometry(3.05, 0.1, 0.34);
        const band = new THREE.Mesh(bandGeo, gameMaterials.ironBand);
        band.position.y = y;
        group.add(band);
      }
    }
  } else if (type === 'door_wood') {
    // Doorway Frame
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

    // Door Panel
    const doorGeo = new THREE.BoxGeometry(1.8, 2.2, 0.15);
    const door = new THREE.Mesh(doorGeo, isHologram ? holoMat : gameMaterials.woodPlanks);
    door.position.set(0, 1.1, 0);
    group.add(door);

    if (!isHologram) {
      const ringGeo = new THREE.TorusGeometry(0.08, 0.02, 6, 8);
      const ring = new THREE.Mesh(ringGeo, gameMaterials.ironBand);
      ring.position.set(0.65, 1.1, 0.1);
      group.add(ring);
    }
  } else if (type === 'campfire') {
    // Hearth Campfire (Stone ring + Charred logs + Embers + Light)
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI * 2) / 8;
      const stoneGeo = new THREE.DodecahedronGeometry(0.22, 0);
      const stone = new THREE.Mesh(stoneGeo, isHologram ? holoMat : gameMaterials.firePitStones);
      stone.position.set(Math.cos(angle) * 0.75, 0.15, Math.sin(angle) * 0.75);
      group.add(stone);
    }

    // Crossed logs
    for (let i = 0; i < 3; i++) {
      const logGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.1, 5);
      const log = new THREE.Mesh(logGeo, isHologram ? holoMat : gameMaterials.woodBark);
      log.position.y = 0.2;
      log.rotation.x = Math.PI / 2;
      log.rotation.z = (i * Math.PI) / 3;
      group.add(log);
    }

    // Glowing ember center
    const emberGeo = new THREE.SphereGeometry(0.3, 6, 6);
    const ember = new THREE.Mesh(emberGeo, isHologram ? holoMat : gameMaterials.emberGlow);
    ember.position.y = 0.25;
    group.add(ember);

    if (!isHologram) {
      const fireLight = new THREE.PointLight(0xff6611, 2.5, 14);
      fireLight.position.set(0, 0.7, 0);
      fireLight.castShadow = true;
      group.add(fireLight);
    }
  } else if (type === 'workbench') {
    // Master Crafting Workbench
    const topGeo = new THREE.BoxGeometry(2.0, 0.15, 1.0);
    const top = new THREE.Mesh(topGeo, isHologram ? holoMat : gameMaterials.woodPlanks);
    top.position.y = 0.9;
    group.add(top);

    // 4 legs
    for (let x of [-0.85, 0.85]) {
      for (let z of [-0.35, 0.35]) {
        const legGeo = new THREE.BoxGeometry(0.15, 0.9, 0.15);
        const leg = new THREE.Mesh(legGeo, isHologram ? holoMat : gameMaterials.woodBark);
        leg.position.set(x, 0.45, z);
        group.add(leg);
      }
    }

    if (!isHologram) {
      // Mini Anvil
      const anvilGeo = new THREE.BoxGeometry(0.4, 0.25, 0.2);
      const anvil = new THREE.Mesh(anvilGeo, gameMaterials.refinedSteel);
      anvil.position.set(-0.5, 1.1, 0);
      group.add(anvil);

      // Tool rack backboard
      const backGeo = new THREE.BoxGeometry(2.0, 0.6, 0.08);
      const back = new THREE.Mesh(backGeo, gameMaterials.woodBark);
      back.position.set(0, 1.25, -0.45);
      group.add(back);
    }
  } else if (type === 'storage_crate') {
    // Wooden Storage Chest
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
    // Rain barrel & funnel
    const barrelGeo = new THREE.CylinderGeometry(0.5, 0.55, 1.2, 8);
    const barrel = new THREE.Mesh(barrelGeo, isHologram ? holoMat : gameMaterials.woodBark);
    barrel.position.y = 0.6;
    group.add(barrel);

    const funnelGeo = new THREE.ConeGeometry(0.8, 0.5, 8);
    const funnel = new THREE.Mesh(funnelGeo, isHologram ? holoMat : gameMaterials.ironBand);
    funnel.position.y = 1.45;
    funnel.rotation.x = Math.PI;
    group.add(funnel);
  } else if (type === 'watchtower') {
    // Elevated Stilt Platform
    for (let x of [-1.2, 1.2]) {
      for (let z of [-1.2, 1.2]) {
        const stiltGeo = new THREE.CylinderGeometry(0.15, 0.18, 5.0, 6);
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
    // cot_bedroll
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

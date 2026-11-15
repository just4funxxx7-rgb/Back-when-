# Aetheria: Outcast Lands — Master Engineering & Execution Plan

**Project ID:** `agile-gear-q3rp2` (`us-east1`)  
**Unified Project Name:** `Aetheria: Outcast Lands`  
**Status:** Completed & Verified ✅

---

## 1. Completed Architectural Upgrades & Bug Fixes

### A. Split-in-Half Character Fix & 8K High-Tessellation Anatomical Character Overhaul (`COMPLETED`)
- **Root Cause Fixed**:
  - Previously, `spineGroup` was a child of `pelvisGroup` (`y = 0.96`, local `y = 0.11`), and `GameEngine.ts` overwrote `this.playerParts.spineGroup.position.y = 0.85 + ...` during walking and idle animations, lifting the upper body `0.74m` into the air above the pelvis.
  - **Fix Applied**: Exposed `pelvisGroup` in `PlayerModelParts` (`src/game/proceduralModels.ts`). `GameEngine.ts` now applies vertical walk-cycle step bounce directly to `pelvisGroup.position.y = 0.94 + bounce`, while keeping `spineGroup.position.y = 0.08 + breathe` anchored inside the waist socket. Added an overlapping `waistBridge` sphere, `abdomenMesh` lumbar cylinder, and `coatSkirt` leather trench-coat tail so the torso and hips remain 100% seamlessly fused at every angle.
- **8K Character & Companion Sculpt Upgrade**:
  - Upgraded the player model and all NPC companions (`Elena`, `Commander Drake`, `Vesper`) to high-tessellation 28–32 radial segment geometry with subsurface-sheen `MeshPhysicalMaterial` skin (`skinNormal` micro-pore normal map), sculpted cranium, jawline, nose bridge, upper/lower vermilion lips (`lipSkin`), ears, 3D sclera/iris/pupil eyes with clearcoat cornea reflections, layered hair strands, shoulder pauldrons, and an expedition backpack with rolled fur bedroll & glowing lantern.

### B. 8K Multi-Biome Terrain & PBR Micro-Detail Pipeline (`COMPLETED`)
- **Expanded 640×640 Multi-Biome Vertex-Colored Terrain (`src/game/terrain.ts` & `src/game/materials.ts`)**:
  - Upgraded terrain mesh to a 640m×640m high-density grid with vertex-color biome splatting across 5 distinct regions:
    1. **Outcast Haven Valley** (lush alpine moss clearing & sandy riverbanks)
    2. **Whispering Pine Timberlands (NW)** (deep forest loam)
    3. **Ironcrag Obsidian Quarry (NE)** (volcanic slate & rust-vein basalt)
    4. **Sunbleached Ruin Badlands (SE)** (amber ochre mesa earth)
    5. **Frostpeak Glacial Pass (SW)** (sub-zero tundra & alpine snowcaps)
  - Added procedural `skin` (dermal micro-pores) and `fabric` (ballistic cross-weave) Sobel normal maps with 16× anisotropic filtering.

### C. Dynamic Exploration-Driven Map Expansion & Cartography System (`COMPLETED`)
- **Fog-of-War & Procedural Frontier Sector Generation (`src/game/GameEngine.ts`)**:
  - Implemented `exploredCells` fog-of-war tracking (revealing a 28m radius around the player as they walk and a 95m radius when activating a **Cartographer Survey Spire**).
  - Entering any uncharted sector automatically discovers it (`+65 XP`), clears regional fog, and populates biome-specific trees, iron ore veins, herbs, and **Frontier Supply Caches**.
  - Exploring beyond `155m` into unmapped outer territory dynamically generates and unlocks new **Procedural Frontier Sectors (`Uncharted Frontier Sector VI+`)** with their own Survey Spires and resource clusters (`+100 XP`).
- **Live Radar Minimap (`src/components/MinimapHUD.tsx`) & Full-Screen World Map (`src/components/WorldMapModal.tsx`)**:
  - Added a live top-right **Topographic Radar Minimap** displaying explored fog-of-war, river course, sector boundaries, structures, NPCs, Survey Spires, player heading cone, and 3D Waypoint direction.
  - Added a full-screen **Interactive World Map Modal (`[M]` key or Map button)** with click-to-place **3D Waypoint Beams**, exploration percentage, and a Sector & Spire directory.

### D. Player Tasks, Campaign Missions & Dynamic Directives (`COMPLETED`)
- **Mission & Objective Engine (`src/game/missionsData.ts`, `src/components/MissionTrackerHUD.tsx`, `src/components/BottomDock.tsx`)**:
  - Added 5 multi-stage Campaign, Cartography, and Engineering missions (*Chapter I: Embers of Outcast Haven*, *Chapter II: Expanding the Known Map*, *Chapter III: Voices of the Outcasts*, *Directive: Outpost Fortification*, *Grand Expedition: Chart the Four Corners*) plus an on-demand **Dynamic Frontier Directive Generator** so players can always generate new bounty tasks.
  - Added the live `MissionTrackerHUD` on the top-left HUD and the full **Missions** tab in `BottomDock.tsx` with one-click 3D Waypoint tracking and automatic XP + item rewards on completion.

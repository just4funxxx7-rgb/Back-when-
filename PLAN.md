# Aetheria: Outcast Lands — Master Architecture & Execution Plan

> **Rule**: Always update this plan FIRST before making changes, and update it LAST after all changes are verified.
> **Creator**: **Tyler Suggett**

---

## Phase 1: 8K Graphics, Unified Character Anatomy, Expanding World Map & Missions (COMPLETED ✅)
1. **Fix Character Split-in-Half Anatomy (`src/game/proceduralModels.ts` & `src/game/GameEngine.ts`)** — COMPLETED ✅
2. **True 8K Native Supersampling & Procedural Micro-Detail (`src/game/postprocessing.ts` & `src/game/proceduralModels.ts`)** — COMPLETED ✅
3. **Expanding World Map with Fog-of-War & Survey Spires (`src/components/MinimapHUD.tsx` & `src/components/WorldMapModal.tsx`)** — COMPLETED ✅
4. **Structured Missions, Tasks & Frontier Directives (`src/game/missionsData.ts` & `src/components/MissionTrackerHUD.tsx`)** — COMPLETED ✅

---

## Phase 2: Ragdoll & Debris/Rubble Physics, Enhanced NPC Interactions, Collapsible Play Screen Menus, Creator Credits (Tyler Suggett), and User Account Sign Up / Login (COMPLETED ✅)

### 1. Ragdoll Physics for Character Interactions & Structural Debris / Persistent Rubble (`src/game/proceduralModels.ts`, `src/game/GameEngine.ts`, `src/types/game.ts`)
- **Status**: `COMPLETED ✅`
- **Implementation Summary**:
  - Articulated ragdoll physics for both the player character (`triggerPlayerRagdoll()`, `[K]` hotkey or UI button) and NPCs (`triggerNPCRagdoll()`, triggered on physical impact or shockwave), with multi-joint angular velocity, gravity, terrain collision bounce, and smooth self-righting recovery.
  - Structural damage & demolition (`[X]` hotkey, `Demolish Nearest to Rubble` button, or repeated weapon/tool strikes on placed structures): structures burst into 18 flying 3D physics debris fragments (`DebrisChunk` with gravity, angular spin, and ground bounce) and leave behind a realistic, **persistent 3D rubble pile** (`RubblePile`) on the terrain and minimap.
  - Persistent rubble piles remain in the world across saves (`GameSaveState.rubblePiles`) and can be scavenged (`[E]`) to recover Wood, Stone, and Iron Ore.

### 2. Improved NPC Interactions (`src/game/GameEngine.ts`, `src/components/DialogueModal.tsx`)
- **Status**: `COMPLETED ✅`
- **Implementation Summary**:
  - 3D world NPCs dynamically turn their heads/bodies toward the player when nearby, react with articulated ragdoll physics if struck, and can be commanded to **Follow Player** or **Hold Position** across the 3D terrain (`setNPCFollowing`).
  - Upgraded `DialogueModal.tsx` with interactive companion actions: **Follow Me / Hold Position**, **Give Gift (+12 Affinity)**, **Barter Salvage**, **Intimate Embrace (100% Vitals & Morale boost)**, and an expandable **Persistent Memory Log** drawer.

### 3. Collapsible / Minimizable Play Screen Menus (`src/components/VitalsHUD.tsx`, `src/components/WeatherHUD.tsx`, `src/components/MinimapHUD.tsx`, `src/components/MissionTrackerHUD.tsx`, `src/components/BottomDock.tsx`, `src/App.tsx`)
- **Status**: `COMPLETED ✅`
- **Implementation Summary**:
  - Added individual minimize/expand (`ChevronUp` / `ChevronDown`) buttons to `VitalsHUD`, `WeatherHUD`, `MinimapHUD`, `MissionTrackerHUD`, and `BottomDock`.
  - Added a persistent top-center **Play Screen Control Bar** with a **"Hide Menus `[H]` / Show Menus `[H]`"** toggle so all play screen menus can be hidden or minimized for unobstructed 8K gameplay.

### 4. Creator Credit: Tyler Suggett (`src/components/TitleScreen.tsx`, `src/components/CreditsModal.tsx`, `src/components/BottomDock.tsx`, `src/lib/firebase.ts`)
- **Status**: `COMPLETED ✅`
- **Implementation Summary**:
  - Listed **Tyler Suggett** as the Creator on the Title Screen header & footer, in the Play Screen top bar & Bottom Dock header, and in the dedicated `CreditsModal.tsx`.

### 5. User Account Sign Up & Login System (`src/components/AuthModal.tsx`, `src/lib/firebase.ts`, `server.ts`, `src/App.tsx`)
- **Status**: `COMPLETED ✅`
- **Implementation Summary**:
  - Created `AuthModal.tsx` supporting **Sign Up (Create Account)** and **Log In** with Email, Password, Survivor Callsign, and Google OAuth, backed by Firebase Authentication (`createUserWithEmailAndPassword`, `signInWithEmailAndPassword`) and Cloud SQL PostgreSQL (`/api/auth/signup`, `/api/auth/login`).

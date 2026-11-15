# Aetheria: Outcast Lands — Master Architecture & Execution Plan

> **Rule**: Always update this plan FIRST before making changes, and update it LAST after all changes are verified.
> **Company / Ownership**: **New Dawn Industries** (Owned by **New Dawn Industries** with Creator **Tyler Suggett**)

---

## Phase 1: 8K Graphics, Unified Character Anatomy, Expanding World Map & Missions (COMPLETED ✅)
1. **Fix Character Split-in-Half Anatomy (`src/game/proceduralModels.ts` & `src/game/GameEngine.ts`)** — COMPLETED ✅
2. **True 8K Native Supersampling & Procedural Micro-Detail (`src/game/postprocessing.ts` & `src/game/proceduralModels.ts`)** — COMPLETED ✅
3. **Expanding World Map with Fog-of-War & Survey Spires (`src/components/MinimapHUD.tsx` & `src/components/WorldMapModal.tsx`)** — COMPLETED ✅
4. **Structured Missions, Tasks & Frontier Directives (`src/game/missionsData.ts` & `src/components/MissionTrackerHUD.tsx`)** — COMPLETED ✅

---

## Phase 2: Ragdoll & Debris/Rubble Physics, Enhanced NPC Interactions, Collapsible Play Screen Menus, and User Account Sign Up / Login (COMPLETED ✅)
1. **Ragdoll Physics for Character Interactions & Structural Debris / Persistent Rubble** — COMPLETED ✅
2. **Improved NPC Interactions (3D Follow Mode, Head-Tracking, Gifts, Barter, Intimate Boost)** — COMPLETED ✅
3. **Collapsible / Minimizable Play Screen Menus (`[H]` Hide All & Individual Panel Minimize)** — COMPLETED ✅
4. **User Account Sign Up & Login System (`AuthModal.tsx`, Firebase Auth & Cloud SQL)** — COMPLETED ✅

---

## Phase 3: Single Consolidated Credits Entry (New Dawn Industries & Tyler Suggett), Full-Screen Touch-Swipe Camera Panning, and APK + AWS Deployment Packaging (COMPLETED ✅)

### 1. Single Consolidated Credit for Tyler Suggett & New Dawn Industries (`src/components/CreditsModal.tsx`, `src/components/TitleScreen.tsx`, `src/components/BottomDock.tsx`, `src/App.tsx`, `src/lib/firebase.ts`)
- **Status**: `COMPLETED ✅`
- **Implementation Summary**:
  - Removed repeated "Creator: Tyler Suggett" labels from `TitleScreen.tsx`, `App.tsx` top bar, and `BottomDock.tsx` header so it is not duplicated across screens.
  - Placed **Tyler Suggett** in **one dedicated place inside the Credits Modal (`CreditsModal.tsx`)** alongside **New Dawn Industries** as the company that owns the game with Tyler Suggett (`COMPANY_NAME = 'New Dawn Industries'`).

### 2. Full-Screen Touch-Swipe & Drag Camera Panning (`src/game/GameEngine.ts`)
- **Status**: `COMPLETED ✅`
- **Implementation Summary**:
  - Enabled 360° horizontal yaw and vertical pitch camera panning by swiping or dragging anywhere on the 3D viewport (works with single-finger touch swipe via `targetTouches` even while holding the left movement joystick, two-finger pinch zoom, and left-click or right-click mouse drag with smooth inertia damping).

### 3. APK & AWS-Ready Deployment Package (`server.ts`, `capacitor.config.json`, `Dockerrun.aws.json`, `buildspec.yml`, `public/aetheria-outcast-lands-aws-release.apk`)
- **Status**: `COMPLETED ✅`
- **Implementation Summary**:
  - Created `capacitor.config.json` (`com.newdawnindustries.aetheria`), `Dockerrun.aws.json` (AWS Elastic Beanstalk / ECS), and `buildspec.yml` (AWS CodeBuild).
  - Implemented `/api/export/apk` and `/api/export/aws-config` in `server.ts` (plus pre-built `/public/aetheria-outcast-lands-aws-release.apk`) to package and serve a downloadable Android `.apk` release archive ready for AWS distribution, with one-click download buttons in `TitleScreen.tsx` and `CreditsModal.tsx`.

import React, { useEffect, useRef } from 'react';
import {
  WorldSector,
  SurveyBeacon,
  NPCData,
  PlacedStructure,
  MapWaypoint,
} from '../types/game';
import {
  X,
  Compass,
  MapPin,
  Radio,
  CheckCircle2,
  Lock,
  Navigation,
} from 'lucide-react';

interface WorldMapModalProps {
  onClose: () => void;
  playerPos: { x: number; z: number };
  sectors: WorldSector[];
  beacons: SurveyBeacon[];
  npcs: Record<string, NPCData>;
  structures: PlacedStructure[];
  exploredCells: Set<string>;
  activeWaypoint: MapWaypoint | null;
  onSetWaypoint: (wp: MapWaypoint | null) => void;
}

export const WorldMapModal: React.FC<WorldMapModalProps> = ({
  onClose,
  playerPos,
  sectors,
  beacons,
  npcs,
  structures,
  exploredCells,
  activeWaypoint,
  onSetWaypoint,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldSpan = 560; // -280m to +280m

  const discoveredCount = sectors.filter((s) => s.discovered).length;
  const explorationPercent = Math.min(
    100,
    Math.round((exploredCells.size / 420) * 100)
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const scale = w / worldSpan;

    // 1. Uncharted Fog-of-War Backdrop
    ctx.fillStyle = '#070a0e';
    ctx.fillRect(0, 0, w, h);

    // Subtle topographic coordinate grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let g = 0; g <= w; g += 40) {
      ctx.beginPath();
      ctx.moveTo(g, 0);
      ctx.lineTo(g, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, g);
      ctx.lineTo(w, g);
      ctx.stroke();
    }

    // 2. Render Explored Fog-of-War Cells with Biome Tints
    const cellSize = 12;
    exploredCells.forEach((cellKey) => {
      const [gx, gz] = cellKey.split(',').map(Number);
      const wx = gx * cellSize;
      const wz = gz * cellSize;
      const sx = cx + wx * scale;
      const sz = cy + wz * scale;

      const dist = Math.hypot(wx, wz);
      if (dist <= 65) {
        ctx.fillStyle = '#1f3622';
      } else if (wx < 0 && wz < 0) {
        ctx.fillStyle = '#19321e';
      } else if (wx >= 0 && wz < 0) {
        ctx.fillStyle = '#332622';
      } else if (wx >= 0 && wz >= 0) {
        ctx.fillStyle = '#3b2e1e';
      } else {
        ctx.fillStyle = '#24343d';
      }

      const pxSize = cellSize * scale + 2;
      ctx.fillRect(sx - pxSize / 2, sz - pxSize / 2, pxSize, pxSize);
    });

    // 3. Draw River Course across the Valley
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    for (let wz = -270; wz <= 270; wz += 10) {
      const rx = 40 + Math.sin(wz * 0.035) * 18;
      const sx = cx + rx * scale;
      const sz = cy + wz * scale;
      if (wz === -270) ctx.moveTo(sx, sz);
      else ctx.lineTo(sx, sz);
    }
    ctx.stroke();

    // 4. Draw World Sectors (Discovered vs Uncharted Frontier Rings)
    sectors.forEach((sec) => {
      const sx = cx + sec.centerX * scale;
      const sz = cy + sec.centerZ * scale;
      const sr = sec.radius * scale;

      ctx.save();
      ctx.beginPath();
      ctx.arc(sx, sz, sr, 0, Math.PI * 2);
      ctx.strokeStyle = sec.discovered
        ? sec.color
        : 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = sec.discovered ? 2 : 1.5;
      if (!sec.discovered) ctx.setLineDash([6, 4]);
      ctx.stroke();

      ctx.fillStyle = sec.discovered ? '#f8fafc' : '#94a3b8';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        sec.discovered ? sec.name : `Uncharted: ${sec.name}`,
        sx,
        sz - sr + 16
      );
      ctx.restore();
    });

    // 5. Placed Base Structures
    structures.forEach((st) => {
      const sx = cx + st.x * scale;
      const sz = cy + st.z * scale;
      ctx.fillStyle = '#f97316';
      ctx.fillRect(sx - 3, sz - 3, 6, 6);
    });

    // 6. Companion NPCs
    Object.values(npcs).forEach((npc) => {
      const sx = cx + npc.position.x * scale;
      const sz = cy + npc.position.z * scale;
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(sx, sz, 4.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // 7. Survey Beacons
    beacons.forEach((b) => {
      const sx = cx + b.x * scale;
      const sz = cy + b.z * scale;
      ctx.fillStyle = b.activated ? '#10b981' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(sx, sz, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // 8. Active Waypoint Line & Target Marker
    const px = cx + playerPos.x * scale;
    const pz = cy + playerPos.z * scale;

    if (activeWaypoint) {
      const wx = cx + activeWaypoint.x * scale;
      const wz = cy + activeWaypoint.z * scale;

      ctx.save();
      ctx.strokeStyle = activeWaypoint.color || '#f59e0b';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(px, pz);
      ctx.lineTo(wx, wz);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = activeWaypoint.color || '#f59e0b';
      ctx.beginPath();
      ctx.arc(wx, wz, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 9. Player Current Position Marker
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(px, pz, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [
    playerPos,
    sectors,
    beacons,
    npcs,
    structures,
    exploredCells,
    activeWaypoint,
  ]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const clickY = ((e.clientY - rect.top) / rect.height) * canvas.height;

    const scale = canvas.width / worldSpan;
    const worldX = Math.round((clickX - canvas.width / 2) / scale);
    const worldZ = Math.round((clickY - canvas.height / 2) / scale);

    onSetWaypoint({
      x: worldX,
      z: worldZ,
      label: `Custom Marker (${worldX}m, ${worldZ}m)`,
      color: '#f59e0b',
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-2 sm:p-4 select-none">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl text-neutral-100">
        {/* Top Header */}
        <div className="px-4 py-3 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Compass className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Aetheria Cartography &amp; Expanding World Map
              </h2>
              <p className="text-[11px] text-neutral-400">
                Explore uncharted territory or activate Survey Spires to expand the map and spawn new frontier sectors. Click anywhere on the map to place a 3D Waypoint.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-xs font-mono">
              <span className="text-emerald-400 font-bold">
                Sectors Charted: {discoveredCount}/{sectors.length}
              </span>
              <span className="text-neutral-600">|</span>
              <span className="text-amber-400 font-bold">
                Fog Cleared: {explorationPercent}%
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body: Interactive Topographic Map + Sector & Spire Directory */}
        <div className="p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-3 gap-4 overflow-y-auto">
          {/* Interactive Map Canvas */}
          <div className="lg:col-span-2 flex flex-col items-center justify-center bg-neutral-950 rounded-xl border border-neutral-800 p-2 relative">
            <canvas
              ref={canvasRef}
              width={520}
              height={520}
              onClick={handleCanvasClick}
              className="w-full max-w-[480px] aspect-square rounded-lg cursor-crosshair border border-neutral-800"
            />
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-[11px] text-neutral-400 font-mono">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                You ({Math.round(playerPos.x)}m, {Math.round(playerPos.z)}m)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" />
                Unactivated Survey Spire
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                Synced Spire / Companion
              </span>
              {activeWaypoint && (
                <button
                  onClick={() => onSetWaypoint(null)}
                  className="text-rose-400 hover:underline font-bold"
                >
                  Clear Waypoint
                </button>
              )}
            </div>
          </div>

          {/* Right Sidebar: World Sectors & Survey Spires */}
          <div className="space-y-3 overflow-y-auto max-h-[62vh] pr-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              World Sectors &amp; Frontier Expansion ({discoveredCount}/{sectors.length})
            </h3>

            {sectors.map((sec) => {
              const dist = Math.round(
                Math.hypot(sec.centerX - playerPos.x, sec.centerZ - playerPos.z)
              );
              const beacon = beacons.find((b) => b.sectorId === sec.id);

              return (
                <div
                  key={sec.id}
                  className={`p-3 rounded-xl border transition ${
                    sec.discovered
                      ? 'bg-neutral-950/90 border-neutral-700'
                      : 'bg-neutral-950/40 border-neutral-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      {sec.discovered ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Lock className="w-4 h-4 text-neutral-500 shrink-0" />
                      )}
                      <h4 className="text-xs font-bold text-white">
                        {sec.name}
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono text-neutral-400">
                      {dist}m away
                    </span>
                  </div>

                  <p className="text-[11px] text-neutral-400 mb-2 leading-snug">
                    {sec.description}
                  </p>

                  <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-neutral-800/80">
                    <span className="text-[10px] font-mono flex items-center gap-1 text-sky-400">
                      <Radio className="w-3 h-3" />
                      {sec.beaconActivated
                        ? 'Spire Synced'
                        : 'Spire Unactivated'}
                    </span>

                    <button
                      onClick={() => {
                        onSetWaypoint({
                          x: beacon ? beacon.x : sec.centerX,
                          z: beacon ? beacon.z : sec.centerZ,
                          label: beacon ? beacon.name : sec.name,
                          color: sec.color,
                        });
                        onClose();
                      }}
                      className="px-2.5 py-1 rounded-md bg-amber-600/20 hover:bg-amber-600 border border-amber-500/40 text-amber-300 hover:text-white text-[10px] font-bold flex items-center gap-1 transition"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Set 3D Waypoint</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

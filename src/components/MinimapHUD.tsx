import React, { useEffect, useRef } from 'react';
import {
  WorldSector,
  SurveyBeacon,
  NPCData,
  PlacedStructure,
  MapWaypoint,
} from '../types/game';
import { Compass, Maximize2, MapPin } from 'lucide-react';

interface MinimapHUDProps {
  playerPos: { x: number; z: number };
  playerAngle: number;
  sectors: WorldSector[];
  beacons: SurveyBeacon[];
  npcs: Record<string, NPCData>;
  structures: PlacedStructure[];
  exploredCells: Set<string>;
  activeWaypoint: MapWaypoint | null;
  onOpenWorldMap: () => void;
}

export const MinimapHUD: React.FC<MinimapHUDProps> = ({
  playerPos,
  playerAngle,
  sectors,
  beacons,
  npcs,
  structures,
  exploredCells,
  activeWaypoint,
  onOpenWorldMap,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Determine current sector name
  const currentSector =
    sectors.find(
      (s) =>
        Math.hypot(playerPos.x - s.centerX, playerPos.z - s.centerZ) <= s.radius
    ) || sectors[0];

  const discoveredSectorsCount = sectors.filter((s) => s.discovered).length;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const scale = 0.48; // 1 meter = 0.48 px on minimap (shows ~110m radius)

    ctx.clearRect(0, 0, w, h);

    // Dark topographic radar background
    ctx.fillStyle = '#090d11';
    ctx.fillRect(0, 0, w, h);

    // Draw Explored Fog-of-War cells relative to player
    const cellSize = 12;
    ctx.fillStyle = '#1b2a1e';
    exploredCells.forEach((cellKey) => {
      const [gx, gz] = cellKey.split(',').map(Number);
      const wx = gx * cellSize;
      const wz = gz * cellSize;
      const sx = cx + (wx - playerPos.x) * scale;
      const sz = cy + (wz - playerPos.z) * scale;
      if (sx >= -15 && sx <= w + 15 && sz >= -15 && sz <= h + 15) {
        ctx.fillRect(
          sx - (cellSize * scale) / 2,
          sz - (cellSize * scale) / 2,
          cellSize * scale + 1,
          cellSize * scale + 1
        );
      }
    });

    // Radar concentric range rings
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    [25, 50].forEach((r) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    });

    // River course
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let wz = playerPos.z - 120; wz <= playerPos.z + 120; wz += 10) {
      const rx = 40 + Math.sin(wz * 0.035) * 18;
      const sx = cx + (rx - playerPos.x) * scale;
      const sz = cy + (wz - playerPos.z) * scale;
      if (wz === playerPos.z - 120) ctx.moveTo(sx, sz);
      else ctx.lineTo(sx, sz);
    }
    ctx.stroke();

    // Sector boundaries
    sectors.forEach((sec) => {
      const sx = cx + (sec.centerX - playerPos.x) * scale;
      const sz = cy + (sec.centerZ - playerPos.z) * scale;
      ctx.strokeStyle = sec.discovered
        ? sec.color
        : 'rgba(148, 163, 184, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash(sec.discovered ? [] : [3, 3]);
      ctx.beginPath();
      ctx.arc(sx, sz, sec.radius * scale, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // Placed Structures
    structures.forEach((st) => {
      const sx = cx + (st.x - playerPos.x) * scale;
      const sz = cy + (st.z - playerPos.z) * scale;
      ctx.fillStyle = st.type === 'campfire' ? '#f97316' : '#eab308';
      ctx.fillRect(sx - 2, sz - 2, 4, 4);
    });

    // NPCs
    Object.values(npcs).forEach((npc) => {
      const sx = cx + (npc.position.x - playerPos.x) * scale;
      const sz = cy + (npc.position.z - playerPos.z) * scale;
      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.arc(sx, sz, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Survey Beacons
    beacons.forEach((b) => {
      const sx = cx + (b.x - playerPos.x) * scale;
      const sz = cy + (b.z - playerPos.z) * scale;
      ctx.fillStyle = b.activated ? '#10b981' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(sx, sz, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Active Waypoint Target or Edge Direction Indicator
    if (activeWaypoint) {
      let wx = cx + (activeWaypoint.x - playerPos.x) * scale;
      let wz = cy + (activeWaypoint.z - playerPos.z) * scale;
      const distPx = Math.hypot(wx - cx, wz - cy);
      const maxR = cx - 8;
      if (distPx > maxR) {
        wx = cx + ((wx - cx) / distPx) * maxR;
        wz = cy + ((wz - cy) / distPx) * maxR;
      }
      ctx.fillStyle = activeWaypoint.color || '#f59e0b';
      ctx.beginPath();
      ctx.arc(wx, wz, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Player Heading Cone & Center Marker
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-playerAngle + Math.PI);
    ctx.fillStyle = 'rgba(251, 191, 36, 0.22)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 22, -Math.PI * 0.72, -Math.PI * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }, [
    playerPos,
    playerAngle,
    sectors,
    beacons,
    npcs,
    structures,
    exploredCells,
    activeWaypoint,
  ]);

  const wpDist = activeWaypoint
    ? Math.round(
        Math.hypot(
          activeWaypoint.x - playerPos.x,
          activeWaypoint.z - playerPos.z
        )
      )
    : null;

  return (
    <div
      onClick={onOpenWorldMap}
      className="group cursor-pointer bg-neutral-900/95 border border-neutral-800 hover:border-amber-500/60 rounded-xl p-2 shadow-2xl transition w-36 sm:w-44 select-none"
      title="Click or press [M] to open Interactive World Map"
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1 truncate">
          <Compass className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-[10px] font-bold text-neutral-200 truncate">
            {currentSector?.name || 'Frontier'}
          </span>
        </div>
        <Maximize2 className="w-3 h-3 text-neutral-400 group-hover:text-amber-400 shrink-0" />
      </div>

      <div className="relative rounded-lg overflow-hidden border border-neutral-800 bg-black flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={140}
          height={104}
          className="w-full h-24 block"
        />
        <div className="absolute bottom-1 left-1.5 right-1.5 flex items-center justify-between text-[9px] font-mono text-neutral-300 bg-black/70 px-1.5 py-0.5 rounded">
          <span>
            Sectors: {discoveredSectorsCount}/{sectors.length}
          </span>
          <span className="text-amber-400 font-bold">[M] Map</span>
        </div>
      </div>

      {activeWaypoint && wpDist !== null && (
        <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-amber-300 truncate">
          <span className="flex items-center gap-1 truncate">
            <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="truncate">{activeWaypoint.label}</span>
          </span>
          <span className="font-bold shrink-0 ml-1">{wpDist}m</span>
        </div>
      )}
    </div>
  );
};

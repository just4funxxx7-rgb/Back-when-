import React from 'react';
import { PlayerVitals } from '../types/game';
import { Heart, Zap, Apple, Droplet, Thermometer, Smile, Shield } from 'lucide-react';

interface VitalsHUDProps {
  vitals: PlayerVitals;
}

export const VitalsHUD: React.FC<VitalsHUDProps> = ({ vitals }) => {
  // Temp color
  let tempColor = 'text-emerald-400';
  if (vitals.temperature < 14) tempColor = 'text-cyan-300';
  if (vitals.temperature < 8) tempColor = 'text-blue-400';
  if (vitals.temperature > 28) tempColor = 'text-amber-400';

  return (
    <div className="flex flex-col gap-1.5 p-3 bg-neutral-900/90 text-neutral-100 rounded-xl border border-neutral-800 shadow-2xl select-none max-w-xs">
      {/* Level & Rank Badge */}
      <div className="flex items-center justify-between text-xs pb-1 border-b border-neutral-800">
        <div className="flex items-center gap-1.5 font-bold tracking-wider text-amber-400">
          <Shield className="w-3.5 h-3.5" />
          <span>RANK {vitals.level} OUTCAST</span>
        </div>
        <span className="text-neutral-400 font-mono text-[11px]">
          {vitals.xp} / {vitals.nextLevelXp} XP
        </span>
      </div>

      {/* Health Bar */}
      <div className="flex items-center gap-2">
        <Heart className="w-4 h-4 text-rose-500 shrink-0" />
        <div className="flex-1 h-3.5 bg-neutral-800 rounded-sm overflow-hidden border border-neutral-700/60 relative">
          <div
            className="h-full bg-rose-600 transition-all duration-300"
            style={{ width: `${Math.max(0, Math.min(100, (vitals.health / vitals.maxHealth) * 100))}%` }}
          />
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold text-white drop-shadow">
            {Math.round(vitals.health)} / {vitals.maxHealth}
          </span>
        </div>
      </div>

      {/* Stamina Bar */}
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
        <div className="flex-1 h-2.5 bg-neutral-800 rounded-sm overflow-hidden border border-neutral-700/60 relative">
          <div
            className="h-full bg-emerald-500 transition-all duration-150"
            style={{ width: `${Math.max(0, Math.min(100, (vitals.stamina / vitals.maxStamina) * 100))}%` }}
          />
        </div>
      </div>

      {/* Nutritional & Environmental Grid */}
      <div className="grid grid-cols-4 gap-1.5 pt-1 text-[11px] font-mono">
        {/* Hunger */}
        <div className="flex items-center gap-1 bg-neutral-800/80 px-2 py-1 rounded border border-neutral-700/50">
          <Apple className="w-3 h-3 text-amber-500" />
          <span className="text-neutral-200">{Math.round(vitals.hunger)}%</span>
        </div>

        {/* Thirst */}
        <div className="flex items-center gap-1 bg-neutral-800/80 px-2 py-1 rounded border border-neutral-700/50">
          <Droplet className="w-3 h-3 text-cyan-400" />
          <span className="text-neutral-200">{Math.round(vitals.thirst)}%</span>
        </div>

        {/* Temperature */}
        <div className="flex items-center gap-1 bg-neutral-800/80 px-2 py-1 rounded border border-neutral-700/50">
          <Thermometer className={`w-3 h-3 ${tempColor}`} />
          <span className={tempColor}>{Math.round(vitals.temperature)}°C</span>
        </div>

        {/* Morale */}
        <div className="flex items-center gap-1 bg-neutral-800/80 px-2 py-1 rounded border border-neutral-700/50">
          <Smile className="w-3 h-3 text-purple-400" />
          <span className="text-neutral-200">{Math.round(vitals.morale)}%</span>
        </div>
      </div>
    </div>
  );
};

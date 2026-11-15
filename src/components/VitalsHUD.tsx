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
    <div className="flex flex-col gap-1 sm:gap-1.5 p-2 sm:p-3 bg-neutral-900/95 text-neutral-100 rounded-xl border border-neutral-800 shadow-2xl select-none w-[176px] sm:w-64">
      {/* Level & Rank Header */}
      <div className="flex items-center justify-between text-[10px] sm:text-xs pb-1 border-b border-neutral-800">
        <div className="flex items-center gap-1 font-bold tracking-wider text-amber-400 truncate">
          <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
          <span className="truncate">LV.{vitals.level} OUTCAST</span>
        </div>
        <span className="text-neutral-400 font-mono tabular-nums text-[9px] sm:text-[11px] shrink-0">
          {vitals.xp}/{vitals.nextLevelXp}
        </span>
      </div>

      {/* Health Bar */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-500 shrink-0" />
        <div className="flex-1 h-3 sm:h-3.5 bg-neutral-800 rounded-sm overflow-hidden border border-neutral-700/60 relative">
          <div
            className="h-full bg-rose-600 transition-all duration-300"
            style={{ width: `${Math.max(0, Math.min(100, (vitals.health / vitals.maxHealth) * 100))}%` }}
          />
          <span className="absolute inset-0 flex items-center justify-center text-[9px] sm:text-[10px] font-mono tabular-nums font-bold text-white drop-shadow">
            {Math.round(vitals.health)}/{vitals.maxHealth}
          </span>
        </div>
      </div>

      {/* Stamina Bar */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
        <div className="flex-1 h-2 sm:h-2.5 bg-neutral-800 rounded-sm overflow-hidden border border-neutral-700/60 relative">
          <div
            className="h-full bg-emerald-500 transition-all duration-150"
            style={{ width: `${Math.max(0, Math.min(100, (vitals.stamina / vitals.maxStamina) * 100))}%` }}
          />
        </div>
      </div>

      {/* Nutritional & Environmental Grid */}
      <div className="grid grid-cols-4 gap-1 pt-0.5 text-[9px] sm:text-[11px] font-mono tabular-nums">
        {/* Hunger */}
        <div className="flex items-center justify-center gap-0.5 bg-neutral-800/80 px-1 py-0.5 sm:px-1.5 sm:py-1 rounded border border-neutral-700/50" title="Hunger">
          <Apple className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-500 shrink-0" />
          <span className="text-neutral-200">{Math.round(vitals.hunger)}</span>
        </div>

        {/* Thirst */}
        <div className="flex items-center justify-center gap-0.5 bg-neutral-800/80 px-1 py-0.5 sm:px-1.5 sm:py-1 rounded border border-neutral-700/50" title="Thirst">
          <Droplet className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-cyan-400 shrink-0" />
          <span className="text-neutral-200">{Math.round(vitals.thirst)}</span>
        </div>

        {/* Temperature */}
        <div className="flex items-center justify-center gap-0.5 bg-neutral-800/80 px-1 py-0.5 sm:px-1.5 sm:py-1 rounded border border-neutral-700/50" title="Body Temperature">
          <Thermometer className={`w-2.5 h-2.5 sm:w-3 sm:h-3 ${tempColor} shrink-0`} />
          <span className={tempColor}>{Math.round(vitals.temperature)}°</span>
        </div>

        {/* Morale */}
        <div className="flex items-center justify-center gap-0.5 bg-neutral-800/80 px-1 py-0.5 sm:px-1.5 sm:py-1 rounded border border-neutral-700/50" title="Morale">
          <Smile className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-purple-400 shrink-0" />
          <span className="text-neutral-200">{Math.round(vitals.morale)}</span>
        </div>
      </div>
    </div>
  );
};

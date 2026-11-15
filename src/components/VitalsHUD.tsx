import React, { useState } from 'react';
import { PlayerVitals } from '../types/game';
import {
  Heart,
  Zap,
  Flame,
  Droplets,
  Thermometer,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

interface VitalsHUDProps {
  vitals: PlayerVitals;
}

export const VitalsHUD: React.FC<VitalsHUDProps> = ({ vitals }) => {
  const [isMinimized, setIsMinimized] = useState(false);

  const hpPct = Math.max(
    0,
    Math.min(100, (vitals.health / vitals.maxHealth) * 100)
  );
  const stPct = Math.max(
    0,
    Math.min(100, (vitals.stamina / vitals.maxStamina) * 100)
  );
  const huPct = Math.max(0, Math.min(100, vitals.hunger));
  const thPct = Math.max(0, Math.min(100, vitals.thirst));

  return (
    <div className="p-2 sm:p-3 bg-neutral-900/90 text-neutral-100 rounded-xl border border-neutral-800 w-44 sm:w-64 select-none shadow-xl">
      {/* Header Row with Minimize Button */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 text-[10px] sm:text-xs font-mono font-bold bg-amber-500/20 text-amber-400 rounded border border-amber-500/40">
            LVL {vitals.level}
          </span>
          <span className="text-[11px] font-bold text-neutral-200 truncate">
            {isMinimized
              ? `${Math.round(vitals.health)} HP · ${vitals.temperature.toFixed(0)}°C`
              : 'Survivor Vitals'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {!isMinimized && (
            <div className="flex items-center gap-0.5 text-[10px] sm:text-xs font-mono text-neutral-300">
              <Thermometer className="w-3 h-3 text-amber-400" />
              <span>{vitals.temperature.toFixed(1)}°C</span>
            </div>
          )}
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-0.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition cursor-pointer"
            title={isMinimized ? 'Expand Vitals HUD' : 'Minimize Vitals HUD'}
          >
            {isMinimized ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="mt-2">
          {/* Health Bar */}
          <div className="mb-1.5">
            <div className="flex justify-between text-[10px] sm:text-xs mb-0.5">
              <span className="flex items-center gap-1 font-medium text-rose-400">
                <Heart className="w-3 h-3 fill-rose-500/30" /> HP
              </span>
              <span className="font-mono text-neutral-300">
                {Math.round(vitals.health)}/{vitals.maxHealth}
              </span>
            </div>
            <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-500 transition-all duration-200"
                style={{ width: `${hpPct}%` }}
              />
            </div>
          </div>

          {/* Stamina Bar */}
          <div className="mb-2">
            <div className="flex justify-between text-[10px] sm:text-xs mb-0.5">
              <span className="flex items-center gap-1 font-medium text-emerald-400">
                <Zap className="w-3 h-3 fill-emerald-500/30" /> STM
              </span>
              <span className="font-mono text-neutral-300">
                {Math.round(vitals.stamina)}
              </span>
            </div>
            <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-150"
                style={{ width: `${stPct}%` }}
              />
            </div>
          </div>

          {/* Hunger & Thirst Sub-Row */}
          <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-neutral-800/80 text-[10px]">
            <div>
              <div className="flex items-center justify-between text-amber-300 mb-0.5">
                <span className="flex items-center gap-0.5">
                  <Flame className="w-2.5 h-2.5" /> Food
                </span>
                <span className="font-mono">{Math.round(huPct)}%</span>
              </div>
              <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500"
                  style={{ width: `${huPct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-sky-300 mb-0.5">
                <span className="flex items-center gap-0.5">
                  <Droplets className="w-2.5 h-2.5" /> H2O
                </span>
                <span className="font-mono">{Math.round(thPct)}%</span>
              </div>
              <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-400"
                  style={{ width: `${thPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

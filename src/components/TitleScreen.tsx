import React from 'react';
import { Play, Users, FolderOpen, HelpCircle, Volume2, VolumeX, ShieldAlert } from 'lucide-react';

interface TitleScreenProps {
  onStartGame: () => void;
  onOpenCoop: () => void;
  onOpenSaves: () => void;
  onOpenGuide: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStartGame,
  onOpenCoop,
  onOpenSaves,
  onOpenGuide,
  isMuted,
  onToggleMute,
}) => {
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-between p-8 bg-gradient-to-t from-neutral-950/95 via-neutral-950/40 to-transparent text-neutral-100 select-none pointer-events-auto">
      {/* Top Bar with mature age rating badge and audio toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 px-3 py-1 bg-neutral-900/80 border border-neutral-800 rounded-full text-xs font-mono text-amber-400">
          <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
          <span>MATURE 18+ · MORAL CHOICES & INTIMACY SYSTEM</span>
        </div>

        <button
          onClick={onToggleMute}
          className="p-2.5 bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 rounded-xl transition"
        >
          {isMuted ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
        </button>
      </div>

      {/* Center Bespoke SVG Title Lockup */}
      <div className="max-w-xl my-auto space-y-4">
        {/* Inline SVG Title Lockup */}
        <div className="space-y-1">
          <div className="text-xs font-mono font-bold tracking-[0.35em] text-amber-500 uppercase">
            3D Open World Survival Simulation
          </div>
          <svg className="w-full max-w-lg h-20" viewBox="0 0 500 80" fill="none">
            <text
              x="0"
              y="58"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontSize="56"
              fontWeight="900"
              letterSpacing="6"
              fill="url(#titleGradient)"
              stroke="#000000"
              strokeWidth="2"
            >
              AETHERIA
            </text>
            <text
              x="330"
              y="58"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontSize="20"
              fontWeight="700"
              letterSpacing="4"
              fill="#d97706"
            >
              OUTCAST LANDS
            </text>
            <defs>
              <linearGradient id="titleGradient" x1="0" y1="0" x2="500" y2="80" gradientUnits="userSpaceOnUse">
                <stop stopColor="#ffffff" />
                <stop offset="0.6" stopColor="#f3f4f6" />
                <stop offset="1" stopColor="#fbbf24" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <p className="text-sm text-neutral-300 font-sans leading-relaxed max-w-md">
          Forge shelter from the frozen wilderness, master deep crafting, navigate dynamic weather, and sculpt relationships where intimate trust and moral choices carry enduring consequence.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <button
            onClick={onStartGame}
            className="px-8 py-3.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-neutral-950 font-black text-sm tracking-wider uppercase rounded-xl shadow-xl transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Enter the Wild [Space]</span>
          </button>

          <button
            onClick={onOpenCoop}
            className="px-5 py-3.5 bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-700 hover:border-neutral-500 text-neutral-200 font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Users className="w-4 h-4 text-emerald-400" />
            <span>Co-op Session</span>
          </button>

          <button
            onClick={onOpenSaves}
            className="px-5 py-3.5 bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-700 hover:border-neutral-500 text-neutral-200 font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <FolderOpen className="w-4 h-4 text-cyan-400" />
            <span>Cloud Saves</span>
          </button>
        </div>
      </div>

      {/* Bottom Flat Control Hint Line */}
      <div className="flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-neutral-500 pt-4 border-t border-neutral-900">
        <div>
          WASD Move · Shift Sprint · Space Jump · C / Alt Dodge Roll · Right-Click Camera · E Interact · F Action · 1-6 Hotbar · H Dock
        </div>
        <div className="flex items-center gap-4 mt-2 sm:mt-0 text-[11px] text-neutral-400">
          <span className="text-cyan-400 font-bold">Unreal Engine 5 / Unity HDRP Pipeline (Bloom · FXAA · PBR)</span>
          <span>•</span>
          <span className="text-amber-400 font-bold">Gemini AI NPCs</span>
        </div>
      </div>
    </div>
  );
};

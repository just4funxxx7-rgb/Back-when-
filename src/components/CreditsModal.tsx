import React from 'react';
import { UNIFIED_PROJECT_NAME, CREATOR_NAME } from '../lib/firebase';
import { X, Award, Sparkles, Cpu, Shield, Compass, Heart } from 'lucide-react';

interface CreditsModalProps {
  onClose: () => void;
}

export const CreditsModal: React.FC<CreditsModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-neutral-900 border border-amber-500/50 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl text-neutral-100">
        {/* Header */}
        <div className="px-5 py-4 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 block">
                {UNIFIED_PROJECT_NAME}
              </span>
              <h2 className="text-base font-extrabold text-white">
                Official Game Credits
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Primary Creator Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/60 via-neutral-950 to-neutral-900 border border-amber-500/50 text-center space-y-1.5 shadow-inner">
            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400">
              Creator &amp; Executive Game Director
            </span>
            <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {CREATOR_NAME}
            </h3>
            <p className="text-xs text-neutral-300 max-w-md mx-auto">
              Original World Concept, 8K Rendering Architecture, Ragdoll &amp;
              Structural Debris Physics, Dynamic Cartography, and Interactive
              Companion Systems.
            </p>
          </div>

          {/* Department Credits Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Creator &amp; Visionary</span>
              </div>
              <p className="text-sm font-bold text-white">{CREATOR_NAME}</p>
              <p className="text-[11px] text-neutral-400">
                Creative Direction &amp; Executive Production
              </p>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
              <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
                <Cpu className="w-3.5 h-3.5" />
                <span>8K Graphics &amp; Physics Engine</span>
              </div>
              <p className="text-sm font-bold text-white">{CREATOR_NAME}</p>
              <p className="text-[11px] text-neutral-400">
                Articulated Ragdoll Kinematics, Debris &amp; Persistent Rubble
              </p>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
              <div className="flex items-center gap-1.5 text-rose-400 font-bold">
                <Heart className="w-3.5 h-3.5" />
                <span>Narrative &amp; Companion AI</span>
              </div>
              <p className="text-sm font-bold text-white">{CREATOR_NAME}</p>
              <p className="text-[11px] text-neutral-400">
                Branching Morality, Romance &amp; Adaptive NPC Memory
              </p>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <Compass className="w-3.5 h-3.5" />
                <span>World Cartography &amp; Cloud</span>
              </div>
              <p className="text-sm font-bold text-white">{CREATOR_NAME}</p>
              <p className="text-[11px] text-neutral-400">
                Expanding Frontier Sectors, Cloud SQL &amp; Firebase Sync
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-neutral-950/90 border border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400">
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>Unified Project: {UNIFIED_PROJECT_NAME}</span>
            </span>
            <span className="font-mono text-amber-300">
              © 2026 {CREATOR_NAME}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

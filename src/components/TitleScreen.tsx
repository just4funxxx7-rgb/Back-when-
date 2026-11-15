import React from 'react';
import {
  Play,
  Users,
  Cloud,
  Award,
  Volume2,
  VolumeX,
  UserCheck,
  UserPlus,
  BookOpen,
  Download,
  Building2,
} from 'lucide-react';
import { UserAccountProfile } from '../types/game';
import { COMPANY_NAME } from '../lib/firebase';

interface TitleScreenProps {
  onStartGame: () => void;
  onOpenCoop: () => void;
  onOpenSaves: () => void;
  onOpenGuide: () => void;
  onOpenAuth: () => void;
  onOpenCredits: () => void;
  accountProfile: UserAccountProfile | null;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStartGame,
  onOpenCoop,
  onOpenSaves,
  onOpenGuide,
  onOpenAuth,
  onOpenCredits,
  accountProfile,
  isMuted,
  onToggleMute,
}) => {
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-between p-4 sm:p-8 select-none pointer-events-none bg-gradient-to-t from-black/90 via-black/45 to-black/75">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pointer-events-auto">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-1 rounded bg-amber-600/20 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-amber-400" />
            <span>{COMPANY_NAME}</span>
          </span>
          <span className="px-2.5 py-1 rounded bg-neutral-900/90 border border-neutral-700 text-neutral-300 text-xs font-mono">
            v2.7 · 8K Engine · Touch-Swipe Panning · AWS APK
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/export/apk"
            download="aetheria-outcast-lands-aws-release.apk"
            className="px-3 py-1.5 rounded-xl bg-emerald-950/90 hover:bg-emerald-900 text-xs font-bold text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 transition cursor-pointer shadow-lg"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Download APK (AWS)</span>
          </a>

          <button
            onClick={onOpenAuth}
            className="px-3 py-1.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-xs font-bold text-amber-300 border border-amber-500/40 flex items-center gap-1.5 transition cursor-pointer shadow-lg"
          >
            {accountProfile ? (
              <>
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>{accountProfile.displayName}</span>
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5 text-amber-400" />
                <span>Sign Up / Log In</span>
              </>
            )}
          </button>

          <button
            onClick={onOpenCredits}
            className="px-3 py-1.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-xs font-bold text-neutral-200 border border-neutral-700 flex items-center gap-1.5 transition cursor-pointer"
          >
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span>Credits</span>
          </button>

          <button
            onClick={onToggleMute}
            className="p-2.5 rounded-xl bg-neutral-900/85 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 transition cursor-pointer"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            )}
          </button>
        </div>
      </div>

      {/* Center Hero Title & Primary Actions */}
      <div className="max-w-xl my-auto pointer-events-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-2 rounded-full bg-amber-950/60 border border-amber-500/40 text-amber-300 text-xs font-mono uppercase tracking-widest">
          <span>{COMPANY_NAME} Presents</span>
        </div>
        <p className="text-xs sm:text-sm font-mono uppercase tracking-[0.28em] text-amber-400 mb-2">
          Open-World Survival · Ragdoll &amp; Structural Debris Physics
        </p>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-none mb-3">
          AETHERIA
          <span className="block text-xl sm:text-2xl font-light tracking-widest text-neutral-300 mt-1.5">
            OUTCAST LANDS
          </span>
        </h1>
        <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed mb-6 max-w-lg">
          Brave a dynamic 8K wilderness where destroyed fortifications shatter
          into persistent rubble piles, companions walk at your side with
          evolving memories and romance, and swiping anywhere on screen pans your
          360° camera view across the frontier.
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <button
            onClick={onStartGame}
            className="px-7 py-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm tracking-wide flex items-center justify-center gap-2 shadow-xl transition cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>ENTER WORLD</span>
          </button>

          <button
            onClick={onOpenAuth}
            className="px-4 py-3.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-amber-300 font-semibold text-xs border border-amber-500/40 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-amber-400" />
            <span>
              {accountProfile ? 'Survivor Account' : 'Sign Up / Log In'}
            </span>
          </button>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={onOpenCoop}
              className="px-3 py-3 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 font-semibold text-xs border border-neutral-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>Co-Op</span>
            </button>

            <button
              onClick={onOpenSaves}
              className="px-3 py-3 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 font-semibold text-xs border border-neutral-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Cloud className="w-3.5 h-3.5 text-amber-400" />
              <span>Saves</span>
            </button>

            <button
              onClick={onOpenCredits}
              className="px-3 py-3 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 font-semibold text-xs border border-neutral-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Award className="w-3.5 h-3.5 text-purple-400" />
              <span>Credits</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Controls Hint */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-neutral-400 pointer-events-auto border-t border-white/10 pt-3">
        <span>
          [Swipe / Drag Screen] 360° Pan View · [WASD / Stick] Move · [X] Rubble Blast · [K] Ragdoll · [H] Hide HUD
        </span>
        <span className="text-neutral-300">
          © {COMPANY_NAME} ·{' '}
          <button
            onClick={onOpenGuide}
            className="underline hover:text-white inline-flex items-center gap-1 ml-1"
          >
            <BookOpen className="w-3 h-3" />
            Survival Guide
          </button>
        </span>
      </div>
    </div>
  );
};

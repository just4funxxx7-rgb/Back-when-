import React, { useState } from 'react';
import { Mission, MapWaypoint } from '../types/game';
import {
  Target,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  Navigation,
  Sparkles,
} from 'lucide-react';

interface MissionTrackerHUDProps {
  missions: Mission[];
  playerPos: { x: number; z: number };
  onTrackWaypoint: (wp: MapWaypoint) => void;
  onRequestNewDirective: () => void;
}

export const MissionTrackerHUD: React.FC<MissionTrackerHUDProps> = ({
  missions,
  playerPos,
  onTrackWaypoint,
  onRequestNewDirective,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  const activeMissions = missions.filter((m) => m.status === 'active');
  const completedCount = missions.filter((m) => m.status === 'completed').length;
  const primaryMission = activeMissions[0];

  return (
    <div className="bg-neutral-900/92 border border-neutral-800 rounded-xl p-2.5 shadow-2xl w-56 sm:w-68 text-neutral-100 select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-neutral-800">
        <div className="flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
            Active Missions ({completedCount}/{missions.length})
          </span>
        </div>
        <button
          onClick={() => setIsMinimized(!isMinimized)}
          className="text-neutral-400 hover:text-white p-0.5"
        >
          {isMinimized ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {!isMinimized && (
        <div className="mt-2 space-y-2">
          {primaryMission ? (
            <div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-mono text-emerald-400 uppercase">
                  {primaryMission.chapter}
                </span>
                <span className="text-[10px] font-mono text-amber-300">
                  +{primaryMission.rewardXP} XP
                </span>
              </div>
              <h4 className="text-xs font-bold text-white mt-0.5 leading-snug">
                {primaryMission.title}
              </h4>

              {/* Objectives */}
              <div className="mt-1.5 space-y-1">
                {primaryMission.objectives.map((obj) => (
                  <div key={obj.id} className="text-[11px]">
                    <div className="flex items-start justify-between gap-1.5">
                      <span
                        className={`flex items-center gap-1 leading-tight ${
                          obj.done
                            ? 'line-through text-neutral-500'
                            : 'text-neutral-200'
                        }`}
                      >
                        {obj.done ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        ) : (
                          <Circle className="w-3 h-3 text-amber-400 shrink-0" />
                        )}
                        <span>{obj.text}</span>
                      </span>
                      <span className="font-mono text-[10px] text-amber-400 shrink-0">
                        {obj.current}/{obj.target}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {primaryMission.targetWaypoint && (
                <button
                  onClick={() =>
                    onTrackWaypoint({
                      x: primaryMission.targetWaypoint!.x,
                      z: primaryMission.targetWaypoint!.z,
                      label: primaryMission.targetWaypoint!.label,
                      color: '#f59e0b',
                    })
                  }
                  className="mt-2 w-full py-1 px-2 rounded-lg bg-neutral-800 hover:bg-amber-600/30 border border-neutral-700 hover:border-amber-500/50 text-[10px] font-bold text-amber-300 flex items-center justify-center gap-1 transition"
                >
                  <Navigation className="w-3 h-3" />
                  <span>
                    Track {primaryMission.targetWaypoint.label} (
                    {Math.round(
                      Math.hypot(
                        primaryMission.targetWaypoint.x - playerPos.x,
                        primaryMission.targetWaypoint.z - playerPos.z
                      )
                    )}
                    m)
                  </span>
                </button>
              )}
            </div>
          ) : (
            <div className="text-center py-2 space-y-1.5">
              <p className="text-xs text-emerald-400 font-bold">
                All Campaign Missions Completed!
              </p>
              <button
                onClick={onRequestNewDirective}
                className="w-full py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center justify-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate Frontier Directive</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

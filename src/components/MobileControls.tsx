import React, { useRef, useState } from 'react';
import { Axe, Hand, ArrowUp, Zap, Wind } from 'lucide-react';

interface MobileControlsProps {
  onJoystickMove: (vector: { x: number; y: number }) => void;
  onActionPress: () => void;
  onInteractPress: () => void;
  onJumpPress: () => void;
  onRollPress?: () => void;
  onSprintToggle: (sprint: boolean) => void;
  isSprinting: boolean;
  visible?: boolean;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  onJoystickMove,
  onActionPress,
  onInteractPress,
  onJumpPress,
  onRollPress,
  onSprintToggle,
  isSprinting,
  visible = true,
}) => {
  const joystickRef = useRef<HTMLDivElement>(null);
  const activeTouchIdRef = useRef<number | null>(null);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  if (!visible) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    const touch = e.changedTouches[0];
    activeTouchIdRef.current = touch.identifier;
    setIsDragging(true);
    updateKnob(touch);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (!isDragging) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchIdRef.current) {
        updateKnob(e.changedTouches[i]);
        break;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchIdRef.current) {
        activeTouchIdRef.current = null;
        setIsDragging(false);
        setKnobPos({ x: 0, y: 0 });
        onJoystickMove({ x: 0, y: 0 });
        break;
      }
    }
  };

  const updateKnob = (touch: React.Touch) => {
    if (!joystickRef.current) return;
    const rect = joystickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = touch.clientX - centerX;
    let dy = touch.clientY - centerY;
    const maxRadius = rect.width / 2 - 8;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    setKnobPos({ x: dx, y: dy });
    onJoystickMove({ x: dx / maxRadius, y: dy / maxRadius });
  };

  return (
    <div className="fixed inset-x-0 bottom-28 sm:bottom-24 pointer-events-none select-none z-20 flex justify-between items-end px-4 sm:px-6 lg:hidden">
      {/* Left Thumb: Virtual Analog Stick */}
      <div className="flex flex-col items-center gap-1.5 pointer-events-auto">
        <div
          ref={joystickRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-neutral-950/75 border-2 ${
            isDragging ? 'border-amber-400/90' : 'border-neutral-700/80'
          } relative flex items-center justify-center touch-none shadow-2xl`}
        >
          {/* Subtle Cardinal Crosshair Marks */}
          <div className="absolute inset-3 rounded-full border border-neutral-800/70 pointer-events-none" />
          <div
            className={`w-12 h-12 rounded-full ${
              isSprinting
                ? 'bg-emerald-500 border-emerald-300'
                : 'bg-amber-500/90 border-amber-200'
            } shadow-xl border-2 pointer-events-none flex items-center justify-center`}
            style={{ transform: `translate(${knobPos.x}px, ${knobPos.y}px)` }}
          >
            <div className="w-3 h-3 rounded-full bg-white/80" />
          </div>
        </div>
        <span className="text-[9px] font-mono uppercase tracking-wider text-neutral-400 bg-neutral-950/80 px-2 py-0.5 rounded">
          Move Stick
        </span>
      </div>

      {/* Right Thumb: Ergonomic Arc Action Cluster */}
      <div
        className="flex flex-col gap-2.5 pointer-events-auto items-end touch-manipulation"
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Upper Arc: Dodge Roll, Sprint Lock, Jump */}
        <div className="flex items-center gap-2">
          <button
            onClick={onRollPress}
            title="Tactical Dodge Roll"
            className="w-12 h-12 rounded-full bg-neutral-950/85 border border-sky-500/80 text-sky-300 flex flex-col items-center justify-center shadow-xl active:scale-90 transition"
          >
            <Wind className="w-4 h-4" />
            <span className="text-[8px] font-mono font-bold uppercase mt-0.5">Roll</span>
          </button>

          <button
            onClick={() => onSprintToggle(!isSprinting)}
            title="Toggle Sprint"
            className={`w-12 h-12 rounded-full border flex flex-col items-center justify-center shadow-xl transition active:scale-90 ${
              isSprinting
                ? 'bg-emerald-600 border-emerald-300 text-white'
                : 'bg-neutral-950/85 border-neutral-700 text-neutral-300'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span className="text-[8px] font-mono font-bold uppercase mt-0.5">Run</span>
          </button>

          <button
            onClick={onJumpPress}
            title="Jump"
            className="w-12 h-12 rounded-full bg-neutral-950/85 border border-neutral-600 text-neutral-100 flex flex-col items-center justify-center shadow-xl active:scale-90 transition"
          >
            <ArrowUp className="w-4 h-4" />
            <span className="text-[8px] font-mono font-bold uppercase mt-0.5">Jump</span>
          </button>
        </div>

        {/* Lower Primary Row: Interact + Primary Harvest/Strike */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onInteractPress}
            title="Interact / Talk / Rest"
            className="w-14 h-14 rounded-full bg-neutral-950/90 border-2 border-amber-500/80 text-amber-300 flex flex-col items-center justify-center shadow-2xl active:scale-90 transition"
          >
            <Hand className="w-5 h-5" />
            <span className="text-[9px] font-mono font-bold uppercase mt-0.5">Use</span>
          </button>

          <button
            onClick={onActionPress}
            title="Harvest / Strike"
            className="w-16 h-16 rounded-full bg-amber-600 active:bg-amber-500 border-2 border-amber-300 text-neutral-950 flex flex-col items-center justify-center shadow-2xl active:scale-90 transition"
          >
            <Axe className="w-6 h-6 stroke-[2.2]" />
            <span className="text-[9px] font-mono font-black uppercase mt-0.5">Strike</span>
          </button>
        </div>
      </div>
    </div>
  );
};

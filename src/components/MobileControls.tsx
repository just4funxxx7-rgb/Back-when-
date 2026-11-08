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
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  onJoystickMove,
  onActionPress,
  onInteractPress,
  onJumpPress,
  onRollPress,
  onSprintToggle,
  isSprinting,
}) => {
  const joystickRef = useRef<HTMLDivElement>(null);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    updateKnob(e.touches[0]);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    updateKnob(e.touches[0]);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setKnobPos({ x: 0, y: 0 });
    onJoystickMove({ x: 0, y: 0 });
  };

  const updateKnob = (touch: React.Touch) => {
    if (!joystickRef.current) return;
    const rect = joystickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = touch.clientX - centerX;
    let dy = touch.clientY - centerY;
    const maxRadius = rect.width / 2;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    setKnobPos({ x: dx, y: dy });
    onJoystickMove({ x: dx / maxRadius, y: dy / maxRadius });
  };

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-20 flex justify-between p-6 items-end pb-24 md:hidden">
      {/* Virtual Analog Joystick (Bottom Left) */}
      <div
        ref={joystickRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="w-28 h-28 rounded-full bg-neutral-900/60 border-2 border-neutral-700/80 pointer-events-auto relative flex items-center justify-center touch-none"
      >
        <div
          className="w-12 h-12 rounded-full bg-amber-500/80 shadow-lg border border-amber-300 pointer-events-none transition-transform"
          style={{ transform: `translate(${knobPos.x}px, ${knobPos.y}px)` }}
        />
      </div>

      {/* Action Buttons Cluster (Bottom Right) */}
      <div className="flex flex-col gap-3 pointer-events-auto items-end">
        <div className="flex gap-2">
          {/* Dodge Roll */}
          <button
            onClick={onRollPress}
            title="Tactical Dodge Roll"
            className="w-12 h-12 rounded-full bg-neutral-900/80 border border-sky-500/70 text-sky-300 flex items-center justify-center shadow-lg active:scale-95 transition"
          >
            <Wind className="w-5 h-5" />
          </button>

          {/* Sprint Toggle */}
          <button
            onClick={() => onSprintToggle(!isSprinting)}
            className={`w-12 h-12 rounded-full border flex items-center justify-center shadow-lg transition active:scale-95 ${
              isSprinting
                ? 'bg-emerald-600 border-emerald-400 text-white'
                : 'bg-neutral-900/80 border-neutral-700 text-neutral-300'
            }`}
          >
            <Zap className="w-5 h-5" />
          </button>

          {/* Jump */}
          <button
            onClick={onJumpPress}
            className="w-12 h-12 rounded-full bg-neutral-900/80 border border-neutral-700 text-neutral-200 flex items-center justify-center shadow-lg active:scale-95 transition"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2">
          {/* Interact */}
          <button
            onClick={onInteractPress}
            className="w-13 h-13 rounded-full bg-neutral-900/90 border border-amber-500/80 text-amber-300 flex items-center justify-center shadow-xl active:scale-95 transition font-bold text-xs"
          >
            <Hand className="w-6 h-6" />
          </button>

          {/* Attack / Chop / Action */}
          <button
            onClick={onActionPress}
            className="w-14 h-14 rounded-full bg-amber-600 border border-amber-400 text-white flex items-center justify-center shadow-xl active:scale-95 transition"
          >
            <Axe className="w-7 h-7" />
          </button>
        </div>
      </div>
    </div>
  );
};

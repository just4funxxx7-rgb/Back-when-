import React, { useState } from 'react';
import { WeatherType } from '../types/game';
import {
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
  Snowflake,
  Wind,
  Users,
  Volume2,
  VolumeX,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

interface WeatherHUDProps {
  timeOfDay: number;
  dayCount: number;
  currentWeather: WeatherType;
  onWeatherChange: (weather: WeatherType) => void;
  isCoopActive: boolean;
  onToggleCoop: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const WeatherHUD: React.FC<WeatherHUDProps> = ({
  timeOfDay,
  dayCount,
  currentWeather,
  onWeatherChange,
  isCoopActive,
  onToggleCoop,
  isMuted,
  onToggleMute,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  const formatTime = (hours: number) => {
    const h = Math.floor(hours) % 24;
    const m = Math.floor((hours % 1) * 60);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const weatherIcons: Record<WeatherType, React.ReactNode> = {
    clear: <Sun className="w-3.5 h-3.5 text-amber-400" />,
    overcast: <Cloud className="w-3.5 h-3.5 text-neutral-400" />,
    rain: <CloudRain className="w-3.5 h-3.5 text-sky-400" />,
    storm: <CloudLightning className="w-3.5 h-3.5 text-yellow-400" />,
    blizzard: <Snowflake className="w-3.5 h-3.5 text-cyan-200" />,
    ash_tempest: <Wind className="w-3.5 h-3.5 text-orange-500" />,
  };

  const weatherCycle: WeatherType[] = [
    'clear',
    'overcast',
    'rain',
    'storm',
    'blizzard',
    'ash_tempest',
  ];

  const handleCycleWeather = () => {
    const idx = weatherCycle.indexOf(currentWeather);
    const next = weatherCycle[(idx + 1) % weatherCycle.length];
    onWeatherChange(next);
  };

  return (
    <div className="flex items-center gap-1.5 bg-neutral-900/90 text-neutral-100 px-2.5 py-1.5 rounded-xl border border-neutral-800 shadow-xl select-none">
      {/* Day & Clock */}
      <div className="flex items-center gap-1.5 pr-1.5 border-r border-neutral-800">
        <span className="text-[10px] font-mono uppercase text-amber-400 font-bold">
          D{dayCount}
        </span>
        <span className="text-xs font-mono font-semibold">
          {formatTime(timeOfDay)}
        </span>
      </div>

      {!isMinimized && (
        <>
          {/* Cycle Weather Button */}
          <button
            onClick={handleCycleWeather}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium transition cursor-pointer"
            title="Tap to cycle dynamic weather"
          >
            {weatherIcons[currentWeather]}
            <span className="hidden sm:inline capitalize text-[11px]">
              {currentWeather.replace('_', ' ')}
            </span>
          </button>

          {/* Co-Op Toggle */}
          <button
            onClick={onToggleCoop}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              isCoopActive
                ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
                : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:text-white'
            }`}
            title="Toggle Multiplayer Co-Op Partner"
          >
            <Users className="w-3.5 h-3.5" />
            <span className="hidden md:inline text-[11px]">
              {isCoopActive ? 'Co-Op Live' : 'Co-Op'}
            </span>
          </button>

          {/* Audio Mute */}
          <button
            onClick={onToggleMute}
            className="p-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition cursor-pointer"
            title={isMuted ? 'Unmute 3D Audio' : 'Mute 3D Audio'}
          >
            {isMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            )}
          </button>
        </>
      )}

      <button
        onClick={() => setIsMinimized(!isMinimized)}
        className="p-0.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition cursor-pointer"
        title={isMinimized ? 'Expand Weather HUD' : 'Minimize Weather HUD'}
      >
        {isMinimized ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
};

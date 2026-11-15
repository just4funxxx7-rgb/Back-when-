import React, { useState } from 'react';
import { WeatherType } from '../types/game';
import { Sun, Cloud, CloudRain, CloudLightning, Snowflake, Flame, Volume2, VolumeX, Users, ChevronDown } from 'lucide-react';

interface WeatherHUDProps {
  timeOfDay: number;
  dayCount: number;
  currentWeather: WeatherType;
  onWeatherChange: (weather: WeatherType) => void;
  isCoopActive: boolean;
  onToggleCoop: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  activePresetLabel?: string;
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
  activePresetLabel = '8K ULTRA HD',
}) => {
  const [showMobileWeatherMenu, setShowMobileWeatherMenu] = useState(false);

  // Format hours and minutes
  const totalMinutes = Math.floor(timeOfDay * 60);
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = Math.floor(totalMinutes % 60);
  const timeFormatted = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

  const weatherIcons: Record<WeatherType, React.ReactNode> = {
    clear: <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />,
    overcast: <Cloud className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-300" />,
    rain: <CloudRain className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />,
    storm: <CloudLightning className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-300" />,
    blizzard: <Snowflake className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-300" />,
    ash_tempest: <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-500" />,
  };

  const weatherLabels: Record<WeatherType, string> = {
    clear: 'Clear',
    overcast: 'Overcast',
    rain: 'Rain',
    storm: 'Storm',
    blizzard: 'Blizzard',
    ash_tempest: 'Ash Storm',
  };

  return (
    <div className="flex flex-col items-end gap-1.5 p-2 sm:p-3 bg-neutral-900/95 text-neutral-100 rounded-xl border border-neutral-800 shadow-2xl select-none">
      {/* Top Row: Time, Weather Toggle, Mute */}
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        <div className="text-right leading-tight">
          <div className="text-[9px] sm:text-[10px] font-mono font-bold text-amber-400 tracking-wider">
            DAY {dayCount} · <span className="text-cyan-400">{activePresetLabel}</span>
          </div>
          <div className="text-sm sm:text-lg font-mono tabular-nums font-extrabold tracking-widest text-neutral-100">
            {timeFormatted}
          </div>
        </div>

        {/* Weather Button (Toggles selector on mobile) */}
        <button
          onClick={() => setShowMobileWeatherMenu((prev) => !prev)}
          className="flex items-center gap-1 px-2 py-1.5 sm:px-2.5 sm:py-1.5 bg-neutral-800/90 hover:bg-neutral-700 border border-neutral-700 rounded-lg transition min-h-[36px]"
          title="Change Weather"
        >
          {weatherIcons[currentWeather]}
          <span className="text-[11px] sm:text-xs font-semibold text-neutral-200">
            {weatherLabels[currentWeather]}
          </span>
          <ChevronDown className="w-3 h-3 text-neutral-400 sm:hidden" />
        </button>

        {/* Audio Mute Button */}
        <button
          onClick={onToggleMute}
          className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg border border-neutral-700 transition min-w-[36px] min-h-[36px] flex items-center justify-center"
          title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
        </button>
      </div>

      {/* Desktop & Expandable Mobile Row: Co-op & Weather Switcher */}
      <div className={`${showMobileWeatherMenu ? 'flex' : 'hidden sm:flex'} flex-wrap items-center justify-end gap-1.5 text-xs pt-0.5`}>
        {/* Co-op Button */}
        <button
          onClick={onToggleCoop}
          className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] sm:text-[11px] font-semibold transition ${
            isCoopActive
              ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
              : 'bg-neutral-800/80 border-neutral-700 text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Users className="w-3 h-3" />
          <span>{isCoopActive ? 'Co-op Live' : 'Solo'}</span>
        </button>

        {/* Weather Quick Selector */}
        <div className="flex items-center gap-0.5 bg-neutral-800/80 p-0.5 rounded border border-neutral-700 text-[10px]">
          {(['clear', 'rain', 'storm', 'blizzard', 'ash_tempest'] as WeatherType[]).map((w) => (
            <button
              key={w}
              onClick={() => {
                onWeatherChange(w);
                setShowMobileWeatherMenu(false);
              }}
              className={`px-1.5 py-0.5 rounded transition uppercase ${
                currentWeather === w
                  ? 'bg-amber-500/30 text-amber-300 font-bold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {w === 'ash_tempest' ? 'Ash' : w}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

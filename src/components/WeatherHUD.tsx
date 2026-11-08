import React from 'react';
import { WeatherType } from '../types/game';
import { Sun, Cloud, CloudRain, CloudLightning, Snowflake, Flame, Volume2, VolumeX, Users } from 'lucide-react';
import { audioEngine } from '../game/audioEngine';

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
  // Format hours and minutes
  const totalMinutes = Math.floor(timeOfDay * 60);
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = Math.floor(totalMinutes % 60);
  const timeFormatted = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

  const weatherIcons: Record<WeatherType, React.ReactNode> = {
    clear: <Sun className="w-4 h-4 text-amber-400" />,
    overcast: <Cloud className="w-4 h-4 text-neutral-300" />,
    rain: <CloudRain className="w-4 h-4 text-blue-400" />,
    storm: <CloudLightning className="w-4 h-4 text-yellow-300" />,
    blizzard: <Snowflake className="w-4 h-4 text-cyan-300" />,
    ash_tempest: <Flame className="w-4 h-4 text-orange-500" />,
  };

  const weatherLabels: Record<WeatherType, string> = {
    clear: 'Clear Skies',
    overcast: 'Overcast Gloom',
    rain: 'Torrential Rain',
    storm: 'Thunderstorm',
    blizzard: 'Sub-Zero Blizzard',
    ash_tempest: 'Ash Tempest',
  };

  return (
    <div className="flex flex-col items-end gap-2 p-3 bg-neutral-900/90 text-neutral-100 rounded-xl border border-neutral-800 shadow-2xl select-none">
      {/* Time & Day Counter */}
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="text-xs font-mono font-bold text-amber-400 tracking-wider">
            DAY {dayCount}
          </div>
          <div className="text-lg font-mono font-extrabold tracking-widest text-neutral-100">
            {timeFormatted}
          </div>
        </div>

        {/* Current Weather Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800/90 border border-neutral-700 rounded-lg">
          {weatherIcons[currentWeather]}
          <span className="text-xs font-semibold capitalize text-neutral-200">
            {weatherLabels[currentWeather]}
          </span>
        </div>

        {/* Audio Mute Button */}
        <button
          onClick={onToggleMute}
          className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg border border-neutral-700 transition"
          title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
        </button>
      </div>

      {/* Co-op Session & Weather Quick Switcher */}
      <div className="flex items-center gap-2 text-xs">
        {/* Co-op Button */}
        <button
          onClick={onToggleCoop}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-semibold transition ${
            isCoopActive
              ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
              : 'bg-neutral-800/80 border-neutral-700 text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>{isCoopActive ? 'Co-op: Connected' : 'Solo Mode'}</span>
        </button>

        {/* Weather Selector dropdown / buttons */}
        <div className="flex items-center gap-1 bg-neutral-800/80 p-0.5 rounded border border-neutral-700 text-[10px]">
          {(['clear', 'rain', 'storm', 'blizzard', 'ash_tempest'] as WeatherType[]).map((w) => (
            <button
              key={w}
              onClick={() => onWeatherChange(w)}
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

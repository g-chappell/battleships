import { useEffect } from 'react';
import { useSettingsStore } from '../../store/settingsStore';

const labelStyle = { fontFamily: "'IM Fell English SC', serif" };
const pirateStyle = { fontFamily: "'Pirata One', serif" };

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const masterVolume = useSettingsStore((s) => s.masterVolume);
  const sfxVolume = useSettingsStore((s) => s.sfxVolume);
  const musicVolume = useSettingsStore((s) => s.musicVolume);
  const muted = useSettingsStore((s) => s.muted);
  const musicEnabled = useSettingsStore((s) => s.musicEnabled);

  const setMaster = useSettingsStore((s) => s.setMasterVolume);
  const setSfx = useSettingsStore((s) => s.setSfxVolume);
  const setMusic = useSettingsStore((s) => s.setMusicVolume);
  const toggleMuted = useSettingsStore((s) => s.toggleMuted);
  const toggleMusic = useSettingsStore((s) => s.toggleMusic);
  const loadFromStorage = useSettingsStore((s) => s.loadFromStorage);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  return (
    <div className="absolute inset-0 bg-black/85 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-gradient-to-b from-[#221210] to-[#2a1410] border-2 border-[#8b0000] rounded p-8 w-96 panel-glow"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-3xl text-[#c41e3a]" style={{ ...pirateStyle, textShadow: '0 0 10px rgba(196,30,58,0.4)' }}>
            Settings
          </h2>
          <button onClick={onClose} className="text-[#d4c4a1]/40 hover:text-[#d4c4a1] text-2xl leading-none">×</button>
        </div>

        <div className="space-y-5">
          <SliderControl label="Master Volume" value={masterVolume} onChange={setMaster} />
          <SliderControl label="SFX Volume" value={sfxVolume} onChange={setSfx} />
          <SliderControl label="Music Volume" value={musicVolume} onChange={setMusic} />

          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-[#d4c4a1] text-sm" style={labelStyle}>Mute All</span>
            <button
              onClick={toggleMuted}
              className={`w-12 h-6 rounded-full border ${muted ? 'bg-[#c41e3a] border-[#c41e3a]' : 'bg-[#4d2e22] border-[#8b0000]/40'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-[#e8dcc8] transition-transform ${muted ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-[#d4c4a1] text-sm" style={labelStyle}>Background Music</span>
            <button
              onClick={toggleMusic}
              className={`w-12 h-6 rounded-full border ${musicEnabled ? 'bg-[#2ecc71]/40 border-[#2ecc71]/60' : 'bg-[#4d2e22] border-[#8b0000]/40'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-[#e8dcc8] transition-transform ${musicEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </label>
        </div>
      </div>
    </div>
  );
}

function SliderControl({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[#d4c4a1] text-sm" style={labelStyle}>{label}</span>
        <span className="text-[#d4a040] text-xs" style={pirateStyle}>{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-[#c41e3a]"
      />
    </div>
  );
}

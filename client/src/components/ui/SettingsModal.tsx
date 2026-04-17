import { useEffect } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../shadcn/dialog';
import { Switch } from '../shadcn/switch';
import { Slider } from '../shadcn/slider';
import { Separator } from '../shadcn/separator';

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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="border border-blood/60 panel-glow bg-gradient-to-b from-coal to-[#2a1410] sm:max-w-md"
      >
        <DialogHeader className="pr-8">
          <DialogTitle
            className="font-pirate text-3xl text-blood-bright"
            style={{ textShadow: '0 0 10px rgba(196,30,58,0.4)' }}
          >
            Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-1 pt-1">
          <SectionLabel>Audio</SectionLabel>
          <Separator className="mb-4" />

          <div className="space-y-5 pb-2">
            <SliderControl label="Master Volume" value={masterVolume} onChange={setMaster} />
            <SliderControl label="SFX Volume" value={sfxVolume} onChange={setSfx} />
            <SliderControl label="Music Volume" value={musicVolume} onChange={setMusic} />

            <div className="flex items-center justify-between">
              <span className="text-parchment text-sm font-label">Mute All</span>
              <Switch
                checked={muted}
                onCheckedChange={() => toggleMuted()}
                aria-label="Toggle mute all"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-parchment text-sm font-label">Background Music</span>
              <Switch
                checked={musicEnabled}
                onCheckedChange={() => toggleMusic()}
                aria-label="Toggle background music"
              />
            </div>
          </div>

          <div className="pt-4">
            <SectionLabel>Display</SectionLabel>
            <Separator className="mt-1" />
            <p className="text-parchment/50 text-xs font-body mt-3 italic">
              Display options coming soon.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-gold text-xs font-label tracking-widest uppercase">
      {children}
    </span>
  );
}

function SliderControl({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-parchment text-sm font-label">{label}</span>
        <span className="text-gold text-xs font-pirate">{Math.round(value * 100)}%</span>
      </div>
      <Slider
        min={0}
        max={1}
        step={0.05}
        value={[value]}
        onValueChange={(vals) => onChange(vals[0])}
      />
    </div>
  );
}

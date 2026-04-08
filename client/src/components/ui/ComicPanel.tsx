import type { ComicPanel as ComicPanelType } from '@shared/index';

export function ComicPanel({ panel }: { panel: ComicPanelType }) {
  return (
    <div
      className={`rounded border-2 border-[#d4a040]/60 p-6 ${panel.background} relative shadow-2xl shadow-black/60`}
      style={{ minHeight: 180 }}
    >
      <div className="absolute inset-0 pointer-events-none rounded" style={{
        boxShadow: 'inset 0 0 30px rgba(0,0,0,0.6), inset 0 0 60px rgba(196,30,58,0.1)',
      }} />
      <div className="relative flex flex-col items-center text-center gap-3">
        {panel.iconHint && (
          <div className="text-6xl drop-shadow-2xl" style={{ filter: 'drop-shadow(0 0 12px rgba(196,30,58,0.5))' }}>
            {panel.iconHint}
          </div>
        )}
        {panel.speaker && (
          <div className="text-sm uppercase tracking-widest text-[#d4a040] font-bold" style={{ fontFamily: "'IM Fell English SC', serif" }}>
            {panel.speaker}
          </div>
        )}
        <div className="text-base text-[#e8dcc8] italic leading-relaxed max-w-md" style={{ fontFamily: "'IM Fell English', serif" }}>
          "{panel.caption}"
        </div>
      </div>
    </div>
  );
}

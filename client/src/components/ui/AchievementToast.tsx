import { useEffect } from 'react';
import { useAchievementsStore } from '../../store/achievementsStore';
import { playAchievementChime } from '../../services/audio';

export function AchievementToast() {
  const queue = useAchievementsStore((s) => s.toastQueue);
  const dismiss = useAchievementsStore((s) => s.dismissToast);

  const current = queue[0];

  useEffect(() => {
    if (!current) return;
    playAchievementChime();
    const id = setTimeout(dismiss, 4500);
    return () => clearTimeout(id);
  }, [current, dismiss]);

  if (!current) return null;

  return (
    <div
      className="fixed top-20 right-4 z-50 w-80 bg-gradient-to-r from-[#1a0a0a] to-[#3d1f17] border-2 border-[#d4a040] rounded p-4 shadow-2xl shadow-[#d4a040]/40 panel-glow"
      style={{ animation: 'slideInRight 0.4s ease-out' }}
    >
      <div className="flex items-start gap-3">
        <div className="text-4xl">{current.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-widest text-[#d4a040]" style={{ fontFamily: "'IM Fell English SC', serif" }}>
            Achievement Unlocked
          </div>
          <div className="text-lg font-bold text-[#e8dcc8] truncate" style={{ fontFamily: "'Pirata One', serif" }}>
            {current.title}
          </div>
          <div className="text-sm text-[#d4c4a1]/80 italic" style={{ fontFamily: "'IM Fell English', serif" }}>
            {current.description}
          </div>
          <div className="text-xs text-[#a06820] mt-1">+{current.points} pts</div>
        </div>
        <button
          onClick={dismiss}
          className="text-[#d4c4a1]/40 hover:text-[#d4c4a1] text-lg leading-none"
        >
          ×
        </button>
      </div>
      {queue.length > 1 && (
        <div className="text-xs text-[#a06820]/60 text-center mt-2" style={{ fontFamily: "'IM Fell English', serif" }}>
          +{queue.length - 1} more
        </div>
      )}
    </div>
  );
}

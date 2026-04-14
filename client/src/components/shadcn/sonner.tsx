/**
 * Custom Toaster — Sonner-compatible API without the sonner npm package.
 * Uses a module-level pub/sub so toast() can be called from anywhere.
 *
 * Usage:
 *   toast("System message")
 *   toast.achievement(def)
 *   toast.error("Something went wrong")
 *
 * Place <Toaster /> once in App.tsx.
 */
import { useState, useEffect, useCallback } from 'react';
import type { AchievementDef } from '@shared/index';
import { playAchievementChime } from '../../services/audio';
import { cn } from '../../lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type ToastVariant = 'system' | 'achievement' | 'error';

interface ToastItem {
  id: number;
  variant: ToastVariant;
  message?: string;
  achievement?: AchievementDef;
  duration: number;
}

// ── Pub/sub ───────────────────────────────────────────────────────────────────

type Listener = (item: ToastItem) => void;
const listeners: Listener[] = [];
let counter = 0;

function fire(item: Omit<ToastItem, 'id'>) {
  const full: ToastItem = { ...item, id: ++counter };
  for (const fn of listeners) fn(full);
}

// ── Public API ────────────────────────────────────────────────────────────────

function toastFn(message: string, opts?: { duration?: number }) {
  fire({ variant: 'system', message, duration: opts?.duration ?? 4000 });
}

toastFn.achievement = (def: AchievementDef) => {
  fire({ variant: 'achievement', achievement: def, duration: 4500 });
};

toastFn.error = (message: string, opts?: { duration?: number }) => {
  fire({ variant: 'error', message, duration: opts?.duration ?? 6000 });
};

export const toast = toastFn;

// ── Individual toast card ──────────────────────────────────────────────────────

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  useEffect(() => {
    if (item.variant === 'achievement') playAchievementChime();
    const id = setTimeout(onDismiss, item.duration);
    return () => clearTimeout(id);
  }, [item, onDismiss]);

  return (
    <div
      className="w-80 bg-coal border-2 border-gold rounded p-4 shadow-2xl shadow-gold/40 panel-glow"
      style={{ animation: 'slideInRight 0.4s ease-out' }}
      role="status"
      aria-live="polite"
    >
      {item.variant === 'achievement' && item.achievement ? (
        <div className="flex items-start gap-3">
          <div className="text-4xl">{item.achievement.icon}</div>
          <div className="flex-1 min-w-0">
            <div
              className="text-xs uppercase tracking-widest text-gold"
              style={{ fontFamily: "'IM Fell English SC', serif" }}
            >
              Achievement Unlocked
            </div>
            <div
              className="text-lg font-bold text-bone truncate"
              style={{ fontFamily: "'Pirata One', serif" }}
            >
              {item.achievement.title}
            </div>
            <div
              className="text-sm text-parchment/80 italic"
              style={{ fontFamily: "'IM Fell English', serif" }}
            >
              {item.achievement.description}
            </div>
            <div className="text-xs text-aged-gold mt-1">+{item.achievement.points} pts</div>
          </div>
          <button
            onClick={onDismiss}
            className="text-parchment/40 hover:text-parchment text-lg leading-none transition-colors"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div
              className={cn(
                'text-sm italic',
                item.variant === 'error' ? 'text-blood-bright' : 'text-bone',
              )}
              style={{ fontFamily: "'IM Fell English', serif" }}
            >
              {item.message}
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="text-parchment/40 hover:text-parchment text-lg leading-none transition-colors"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

// ── Toaster ───────────────────────────────────────────────────────────────────

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const listener: Listener = (item) => {
      setToasts((prev) => [...prev, item]);
    };
    listeners.push(listener);
    return () => {
      const idx = listeners.indexOf(listener);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastCard item={t} onDismiss={() => dismiss(t.id)} />
        </div>
      ))}
    </div>
  );
}

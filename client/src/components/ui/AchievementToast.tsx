/**
 * AchievementToast — bridge component.
 * Watches the achievementsStore toast queue and fires each achievement
 * into the global Toaster (via toast.achievement). Returns no JSX.
 */
import { useEffect } from 'react';
import { useAchievementsStore } from '../../store/achievementsStore';
import { toast } from '../shadcn/sonner';

export function AchievementToast() {
  const current = useAchievementsStore((s) => s.toastQueue[0]);
  const dismiss = useAchievementsStore((s) => s.dismissToast);

  useEffect(() => {
    if (!current) return;
    toast.achievement(current);
    dismiss();
  }, [current?.id, dismiss]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

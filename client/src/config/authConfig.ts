import type { AppScreen } from '../store/gameStore';

export const RESTRICTED_SCREENS: Set<AppScreen> = new Set([
  'campaign',
  'shop',
  'tournaments',
  'clans',
  'leaderboard',
  'friends',
  'dashboard',
]);

export function isRestrictedScreen(screen: AppScreen): boolean {
  return RESTRICTED_SCREENS.has(screen);
}

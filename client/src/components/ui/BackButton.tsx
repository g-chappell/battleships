import { Button } from './Button';
import { useGameStore } from '../../store/gameStore';
import type { AppScreen } from '../../store/gameStore';

interface BackButtonProps {
  /** If provided, navigates to this screen. Otherwise calls onClick. */
  to?: AppScreen;
  onClick?: () => void;
  label?: string;
}

/**
 * Standard "← Back" button used by every page header.
 *
 * Wraps the Button component with `variant="secondary"` and a consistent label.
 * Pass `to="menu"` for navigation to a specific screen, or `onClick` for
 * custom behavior (e.g. clearing a selected tournament detail).
 */
export function BackButton({ to = 'menu', onClick, label = '← Back' }: BackButtonProps) {
  const setScreen = useGameStore((s) => s.setScreen);

  const handleClick = () => {
    if (onClick) onClick();
    else setScreen(to);
  };

  return (
    <Button variant="secondary" size="sm" onClick={handleClick}>
      {label}
    </Button>
  );
}

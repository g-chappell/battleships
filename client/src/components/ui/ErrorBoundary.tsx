import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useGameStore } from '../../store/gameStore';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  handleReturnToMenu = () => {
    this.setState({ hasError: false });
    useGameStore.getState().resetGame();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback !== undefined) {
      return this.props.fallback;
    }

    const pirateStyle = { fontFamily: "'Pirata One', serif" };
    const bodyStyle = { fontFamily: "'IM Fell English', serif" };

    return (
      <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-[#1a0d0d]/95 border-2 border-[#8b0000] rounded p-8 text-center max-w-sm panel-glow">
          <h2 className="text-3xl text-[#c41e3a] mb-3" style={pirateStyle}>
            Something Went Wrong
          </h2>
          <p className="text-[#d4c4a1]/70 mb-6 text-sm" style={bodyStyle}>
            A fatal error occurred in the game. Your progress cannot be recovered.
          </p>
          <button
            onClick={this.handleReturnToMenu}
            className="px-6 py-2 bg-[#8b0000] hover:bg-[#a00000] text-[#d4c4a1] rounded border border-[#c41e3a] transition-colors"
            style={pirateStyle}
          >
            Return to Menu
          </button>
        </div>
      </div>
    );
  }
}

import { useEffect } from 'react';
import { MainMenu } from './pages/MainMenu';
import { PreGameSetup } from './pages/PreGameSetup';
import { GamePage } from './pages/GamePage';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { Dashboard } from './pages/Dashboard';
import { MultiplayerLobby } from './pages/MultiplayerLobby';
import { Leaderboard } from './pages/Leaderboard';
import { CampaignMap } from './pages/CampaignMap';
import { Friends } from './pages/Friends';
import { Shop } from './pages/Shop';
import { Tournaments } from './pages/Tournaments';
import { Clans } from './pages/Clans';
import { ReplayViewer } from './pages/ReplayViewer';
import { SpectatorView } from './pages/SpectatorView';
import { GuidePage } from './pages/GuidePage';
import { AdminPage } from './pages/AdminPage';
import { TopNav } from './components/ui/TopNav';
import { TopRightControls } from './components/ui/TopRightControls';
import { AuthGate } from './components/ui/AuthGate';
import { AchievementToast } from './components/ui/AchievementToast';
import { Toaster, toast } from './components/shadcn/sonner';
import { LoadingSplash } from './components/ui/LoadingSplash';
import { useGameStore } from './store/gameStore';
import { useAuthStore } from './store/authStore';
import { useAchievementsStore } from './store/achievementsStore';
import { useSettingsStore } from './store/settingsStore';
import { useCosmeticsStore } from './store/cosmeticsStore';
import { useSeasonsStore } from './store/seasonsStore';
import { useSocketStore } from './store/socketStore';

function App() {
  const screen = useGameStore((s) => s.screen);
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);
  const token = useAuthStore((s) => s.token);
  const loadAchievementsFromServer = useAchievementsStore((s) => s.loadFromServer);
  const loadSettings = useSettingsStore((s) => s.loadFromStorage);
  const loadCosmeticsLocal = useCosmeticsStore((s) => s.loadFromStorage);
  const loadCosmeticsServer = useCosmeticsStore((s) => s.loadFromServer);
  const fetchActiveSeason = useSeasonsStore((s) => s.fetchActive);

  useEffect(() => {
    loadFromStorage();
    loadSettings();
    loadCosmeticsLocal();
    fetchActiveSeason();
  }, [loadFromStorage, loadSettings, loadCosmeticsLocal, fetchActiveSeason]);

  const resetGoldForGuest = useCosmeticsStore((s) => s.resetGoldForGuest);

  useEffect(() => {
    if (token) {
      loadCosmeticsServer(token);
      loadAchievementsFromServer(token);
    } else {
      // Guest users should not retain gold
      resetGoldForGuest();
    }
  }, [token, loadCosmeticsServer, loadAchievementsFromServer, resetGoldForGuest]);

  // System toasts: connection lost / found opponent
  const socketStatus = useSocketStore((s) => s.status);
  const matchmakingState = useSocketStore((s) => s.matchmakingState);

  useEffect(() => {
    if (socketStatus === 'error') {
      toast.error('Connection lost — return to menu');
    }
  }, [socketStatus]);

  useEffect(() => {
    if (matchmakingState === 'matched') {
      toast('Opponent found! Ready yer cannons!');
    }
  }, [matchmakingState]);

  // Hide nav during active game (in-game UI is its own thing)
  const showNav = screen !== 'game' && screen !== 'spectate';

  return (
    <div className="w-full h-full relative">
      {showNav && <TopNav />}
      <TopRightControls />
      <div className="w-full h-full">
        {screen === 'menu' && <MainMenu />}
        {screen === 'setup_ai' && <PreGameSetup />}
        {screen === 'game' && <ErrorBoundary><GamePage /></ErrorBoundary>}
        {screen === 'guide' && <GuidePage />}
        {screen === 'dashboard' && <AuthGate featureName="Dashboard"><Dashboard /></AuthGate>}
        {screen === 'lobby' && <MultiplayerLobby />}
        {screen === 'leaderboard' && <AuthGate featureName="Leaderboard"><Leaderboard /></AuthGate>}
        {screen === 'campaign' && <AuthGate featureName="Campaign"><CampaignMap /></AuthGate>}
        {screen === 'friends' && <AuthGate featureName="Friends"><Friends /></AuthGate>}
        {screen === 'shop' && <AuthGate featureName="Shop"><Shop /></AuthGate>}
        {screen === 'tournaments' && <AuthGate featureName="Tournaments"><Tournaments /></AuthGate>}
        {screen === 'clans' && <AuthGate featureName="Clans"><Clans /></AuthGate>}
        {screen === 'replay' && <ReplayViewer />}
        {screen === 'spectate' && <SpectatorView />}
        {screen === 'multiplayer' && <MultiplayerLobby />}
        {screen === 'admin' && <AdminPage />}
      </div>
      <AchievementToast />
      <Toaster />
      <LoadingSplash />
    </div>
  );
}

export default App;

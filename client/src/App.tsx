import { useEffect } from 'react';
import { MainMenu } from './pages/MainMenu';
import { GamePage } from './pages/GamePage';
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
import { TopNav } from './components/ui/TopNav';
import { AchievementToast } from './components/ui/AchievementToast';
import { LoadingSplash } from './components/ui/LoadingSplash';
import { useGameStore } from './store/gameStore';
import { useAuthStore } from './store/authStore';
import { useAchievementsStore } from './store/achievementsStore';
import { useSettingsStore } from './store/settingsStore';
import { useCosmeticsStore } from './store/cosmeticsStore';
import { useSeasonsStore } from './store/seasonsStore';

function App() {
  const screen = useGameStore((s) => s.screen);
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);
  const token = useAuthStore((s) => s.token);
  const loadAchievements = useAchievementsStore((s) => s.loadFromStorage);
  const loadSettings = useSettingsStore((s) => s.loadFromStorage);
  const loadCosmeticsLocal = useCosmeticsStore((s) => s.loadFromStorage);
  const loadCosmeticsServer = useCosmeticsStore((s) => s.loadFromServer);
  const fetchActiveSeason = useSeasonsStore((s) => s.fetchActive);

  useEffect(() => {
    loadFromStorage();
    loadAchievements();
    loadSettings();
    loadCosmeticsLocal();
    fetchActiveSeason();
  }, [loadFromStorage, loadAchievements, loadSettings, loadCosmeticsLocal, fetchActiveSeason]);

  useEffect(() => {
    if (token) loadCosmeticsServer(token);
  }, [token, loadCosmeticsServer]);

  // Hide nav during active game (in-game UI is its own thing)
  const showNav = screen !== 'game' && screen !== 'spectate';

  return (
    <div className="w-full h-full relative">
      {showNav && <TopNav />}
      <div className="w-full h-full">
        {screen === 'menu' && <MainMenu />}
        {screen === 'game' && <GamePage />}
        {screen === 'dashboard' && <Dashboard />}
        {screen === 'lobby' && <MultiplayerLobby />}
        {screen === 'leaderboard' && <Leaderboard />}
        {screen === 'campaign' && <CampaignMap />}
        {screen === 'friends' && <Friends />}
        {screen === 'shop' && <Shop />}
        {screen === 'tournaments' && <Tournaments />}
        {screen === 'clans' && <Clans />}
        {screen === 'replay' && <ReplayViewer />}
        {screen === 'spectate' && <SpectatorView />}
        {screen === 'multiplayer' && <MultiplayerLobby />}
      </div>
      <AchievementToast />
      <LoadingSplash />
    </div>
  );
}

export default App;

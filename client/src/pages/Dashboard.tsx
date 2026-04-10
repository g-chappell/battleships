import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { useAchievementsStore } from '../store/achievementsStore';
import { useReplayStore } from '../store/replayStore';
import { ACHIEVEMENT_DEFS } from '@shared/index';
import { apiFetchSafe } from '../services/apiClient';
import { FONT_STYLES } from '../styles/fonts';
import { PageShell } from '../components/ui/PageShell';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

interface Stats {
  username: string;
  rating: number;
  wins: number;
  losses: number;
  totalGamesAI: number;
  totalGamesMP: number;
  accuracy: number;
  shipsSunk: number;
  shipsLost: number;
  avgGameTimeSec: number;
}

interface MatchEntry {
  id: string;
  mode: string;
  turns: number;
  durationSec: number;
  accuracy: number;
  shipsSunk: number;
  shipsLost: number;
  won: boolean;
  createdAt: string;
}

interface MatchHistoryResponse {
  matches: MatchEntry[];
}

export function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const setScreen = useGameStore((s) => s.setScreen);
  const startNewGame = useGameStore((s) => s.startNewGame);
  const loadReplay = useReplayStore((s) => s.load);

  const openReplay = async (matchId: string) => {
    await loadReplay(matchId);
    setScreen('replay');
  };

  const [stats, setStats] = useState<Stats | null>(null);
  const [matches, setMatches] = useState<MatchEntry[]>([]);

  useEffect(() => {
    if (!user || !token) return;
    apiFetchSafe<Stats>(`/stats/${user.id}`).then((data) => data && setStats(data));
    apiFetchSafe<MatchHistoryResponse>(`/matches/history/${user.id}`).then((data) => data && setMatches(data.matches));
  }, [user, token]);

  if (!user) return null;

  const winRate = stats && (stats.wins + stats.losses > 0)
    ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100)
    : 0;

  return (
    <PageShell maxWidth="4xl">
      <PageHeader
        title={user.username}
        subtitle={user.email}
        actions={
          <Button variant="ghost" size="sm" onClick={logout}>
            Logout
          </Button>
        }
      />

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Rating" value={stats?.rating ?? 1200} color="#d4a040" />
        <StatCard label="Win Rate" value={`${winRate}%`} color="#2ecc71" />
        <StatCard label="Wins" value={stats?.wins ?? 0} color="#2ecc71" />
        <StatCard label="Losses" value={stats?.losses ?? 0} color="#c41e3a" />
        <StatCard label="Accuracy" value={`${stats?.accuracy ?? 0}%`} color="#8ab0d4" />
        <StatCard label="Ships Sunk" value={stats?.shipsSunk ?? 0} color="#2ecc71" />
        <StatCard label="Ships Lost" value={stats?.shipsLost ?? 0} color="#c41e3a" />
        <StatCard label="Avg Game" value={`${stats?.avgGameTimeSec ?? 0}s`} color="#d4a040" />
      </div>

      {/* Quick actions */}
      <div className="flex gap-4 mb-8">
        <Button variant="primary" size="md" onClick={startNewGame}>
          Quick Play vs AI
        </Button>
      </div>

      {/* Achievements */}
      <AchievementsSection />

      {/* Match history */}
      <div>
        <h2 className="text-2xl text-blood-bright mb-4" style={FONT_STYLES.pirate}>Recent Matches</h2>
        {matches.length === 0 ? (
          <p className="text-parchment/40 italic" style={FONT_STYLES.body}>No matches yet. Start playing!</p>
        ) : (
          <div className="space-y-2">
            {matches.map((m) => (
              <Card
                key={m.id}
                variant={m.won ? 'glow' : 'muted'}
                padding="sm"
                onClick={() => openReplay(m.id)}
                title="Click to view replay"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className={`font-bold text-sm ${m.won ? 'text-[#2ecc71]' : 'text-blood-bright'}`} style={FONT_STYLES.labelSC}>
                      {m.won ? 'WIN' : 'LOSS'}
                    </span>
                    <span className="text-parchment/70 text-sm" style={FONT_STYLES.labelSC}>{m.mode}</span>
                  </div>
                  <div className="flex gap-6 text-sm text-parchment/60" style={FONT_STYLES.labelSC}>
                    <span>{m.turns} turns</span>
                    <span>{Math.round(m.accuracy * 100)}% acc</span>
                    <span>{m.durationSec}s</span>
                    <span className="text-gold">▶ Replay</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <Card variant="glow" padding="md">
      <div className="text-xs text-aged-gold uppercase tracking-wider mb-1" style={FONT_STYLES.labelSC}>{label}</div>
      <div className="text-2xl font-bold" style={{ color, ...FONT_STYLES.pirate }}>{value}</div>
    </Card>
  );
}

function AchievementsSection() {
  const unlocked = useAchievementsStore((s) => s.unlocked);
  const all = Object.values(ACHIEVEMENT_DEFS);
  const totalPoints = all.filter(a => unlocked.has(a.id)).reduce((sum, a) => sum + a.points, 0);

  return (
    <div className="mb-8">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-2xl text-blood-bright" style={FONT_STYLES.pirate}>
          Achievements
        </h2>
        <div className="text-sm text-aged-gold" style={FONT_STYLES.labelSC}>
          {unlocked.size} / {all.length} unlocked · {totalPoints} pts
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {all.map((ach) => {
          const isUnlocked = unlocked.has(ach.id);
          return (
            <div
              key={ach.id}
              className={`p-3 rounded-lg border ${
                isUnlocked
                  ? 'bg-blood-dark/30 border-blood-bright/60'
                  : 'bg-coal/40 border-mahogany-light opacity-50'
              }`}
              title={ach.description}
            >
              <div className="flex items-start gap-2">
                <div className="text-2xl">{isUnlocked ? ach.icon : '\u{1F512}'}</div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-bold truncate ${isUnlocked ? 'text-bone' : 'text-parchment/40'}`} style={FONT_STYLES.labelSC}>
                    {ach.title}
                  </div>
                  <div className={`text-xs ${isUnlocked ? 'text-parchment/70' : 'text-parchment/30'} truncate italic`} style={FONT_STYLES.body}>
                    {ach.description}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

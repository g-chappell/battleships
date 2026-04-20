import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useSeasonsStore } from '../store/seasonsStore';
import { getSeasonTimeRemaining } from '@shared/index';
import { apiFetchSafe } from '../services/apiClient';
import { FONT_STYLES } from '../styles/fonts';
import { PageShell } from '../components/ui/PageShell';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { AuthPage } from './AuthPage';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  clanTag?: string | null;
  rating: number;
  wins: number;
  losses: number;
  winRate: number;
  peakRating?: number;
}

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
}

export function Leaderboard() {
  const user = useAuthStore((s) => s.user);
  const activeSeason = useSeasonsStore((s) => s.activeSeason);
  const fetchActive = useSeasonsStore((s) => s.fetchActive);
  const selectedSeasonId = useSeasonsStore((s) => s.selectedSeasonId);
  const selectSeason = useSeasonsStore((s) => s.selectSeason);

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');

  useEffect(() => {
    fetchActive();
  }, [fetchActive]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const seasonQuery = selectedSeasonId === 'lifetime' ? 'lifetime' : 'active';
    apiFetchSafe<LeaderboardResponse>(`/leaderboard?seasonId=${seasonQuery}`)
      .then((data) => {
        if (data) {
          setEntries(data.leaderboard ?? []);
        } else {
          setError('Could not reach the server');
        }
        setLoading(false);
      });
  }, [selectedSeasonId]);

  const timeLeft = activeSeason ? getSeasonTimeRemaining(activeSeason.endAt) : null;

  return (
    <PageShell>
      <PageHeader
        title="Leaderboard"
        subtitle="The fiercest captains on the seas"
      />

      {/* Season switcher + countdown */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-2">
          <Button
            variant={selectedSeasonId === 'active' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => selectSeason('active')}
          >
            Current Season
          </Button>
          <Button
            variant={selectedSeasonId === 'lifetime' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => selectSeason('lifetime')}
          >
            Lifetime
          </Button>
        </div>
        {activeSeason && selectedSeasonId === 'active' && timeLeft && (
          <div className="px-4 py-1.5 rounded-full bg-coal/60 border border-gold/50 text-gold text-xs" style={FONT_STYLES.labelSC}>
            <span style={FONT_STYLES.pirate} className="text-sm mr-2">{activeSeason.name}</span>
            ends in {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m
          </div>
        )}
        {!activeSeason && selectedSeasonId === 'active' && (
          <div className="px-4 py-1.5 rounded-full bg-mahogany-light/60 border border-blood/40 text-parchment/60 text-xs italic" style={FONT_STYLES.body}>
            No active season
          </div>
        )}
      </div>

      {loading && <p className="text-parchment/60 italic" style={FONT_STYLES.body}>Loading the rankings...</p>}

      {error && (
        <Card variant="default" padding="md" className="!bg-blood-dark/40 !border-blood/60">
          <p className="italic text-blood-bright" style={FONT_STYLES.body}>{error}</p>
        </Card>
      )}

      {!loading && !error && entries.length === 0 && (
        <Card variant="glow" padding="lg" className="text-center">
          <p className="text-parchment/60 italic text-lg" style={FONT_STYLES.body}>
            No captains have proven themselves yet. Be the first!
          </p>
        </Card>
      )}

      {!loading && entries.length > 0 && (
        <Card variant="glow" padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm md:text-base" style={FONT_STYLES.labelSC}>
              <thead>
                <tr className="bg-mahogany-light text-aged-gold text-xs uppercase tracking-wider">
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left">Rank</th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-left">Captain</th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-right">Rating</th>
                  <th className="px-2 md:px-4 py-2 md:py-3 text-right">Wins</th>
                  <th className="hidden md:table-cell px-4 py-3 text-right">Losses</th>
                  <th className="hidden md:table-cell px-4 py-3 text-right">Win %</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const isMe = user?.id === entry.userId;
                  return (
                    <tr
                      key={entry.userId}
                      className={`border-t border-mahogany-light ${
                        isMe ? 'bg-blood-dark/30' : 'hover:bg-mahogany-light/40'
                      }`}
                    >
                      <td className="px-2 md:px-4 py-2 md:py-3">
                        <span className={`text-base md:text-lg font-bold ${
                          entry.rank === 1 ? 'text-gold' :
                          entry.rank === 2 ? 'text-parchment' :
                          entry.rank === 3 ? 'text-copper' :
                          'text-parchment'
                        }`} style={FONT_STYLES.pirate}>
                          #{entry.rank}
                        </span>
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-3">
                        <span className={`font-bold text-sm md:text-base ${isMe ? 'text-blood-bright' : 'text-bone'}`}>
                          {entry.username}{isMe && ' (you)'}
                        </span>
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-3 text-right text-gold font-bold" style={FONT_STYLES.pirate}>{entry.rating}</td>
                      <td className="px-2 md:px-4 py-2 md:py-3 text-right text-gold">{entry.wins}</td>
                      <td className="hidden md:table-cell px-4 py-3 text-right text-blood-bright">{entry.losses}</td>
                      <td className="hidden md:table-cell px-4 py-3 text-right text-parchment">{entry.winRate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Guest CTA — sign up to appear on the leaderboard */}
      {!user && (
        <Card variant="default" padding="lg" className="mt-6 text-center">
          <div className="text-3xl mb-3">⚓</div>
          <h3 className="text-xl text-gold mb-2" style={FONT_STYLES.pirate}>
            Track Your Stats
          </h3>
          <p className="text-parchment/70 mb-5 max-w-sm mx-auto" style={FONT_STYLES.body}>
            Sign up to earn a rating, track your wins, and appear on the leaderboard.
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              variant="primary"
              size="md"
              onClick={() => { setAuthMode('register'); setShowAuth(true); }}
            >
              Join the Crew
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setAuthMode('login'); setShowAuth(true); }}
            >
              Sign In
            </Button>
          </div>
        </Card>
      )}

      {showAuth && <AuthPage onClose={() => setShowAuth(false)} initialMode={authMode} />}
    </PageShell>
  );
}

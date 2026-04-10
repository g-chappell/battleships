import { useEffect, useState } from 'react';
import { useTournamentsStore } from '../store/tournamentsStore';
import { useAuthStore } from '../store/authStore';
import { VALID_TOURNAMENT_SIZES } from '@shared/index';
import type { TournamentSize, TournamentBracketMatch } from '@shared/index';
import { FONT_STYLES } from '../styles/fonts';
import { Button } from '../components/ui/Button';
import { PageShell } from '../components/ui/PageShell';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { FormField } from '../components/ui/FormField';

export function Tournaments() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const list = useTournamentsStore((s) => s.list);
  const current = useTournamentsStore((s) => s.current);
  const loading = useTournamentsStore((s) => s.loading);
  const error = useTournamentsStore((s) => s.error);
  const fetchList = useTournamentsStore((s) => s.fetchList);
  const fetchOne = useTournamentsStore((s) => s.fetchOne);
  const createTournament = useTournamentsStore((s) => s.create);
  const joinTournament = useTournamentsStore((s) => s.join);

  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createName, setCreateName] = useState('');
  const [createSize, setCreateSize] = useState<TournamentSize>(4);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    if (selectedId) fetchOne(selectedId);
  }, [selectedId, fetchOne]);

  const handleCreate = async () => {
    if (!token || !createName.trim()) {
      setFeedback('Sign in and enter a name');
      return;
    }
    const result = await createTournament(createName.trim(), createSize, token);
    if ('error' in result) {
      setFeedback(result.error);
    } else {
      setShowCreate(false);
      setCreateName('');
      setSelectedId(result.id);
      setFeedback(null);
    }
  };

  const handleJoin = async (id: string) => {
    if (!token) {
      setFeedback('Sign in to join');
      return;
    }
    const result = await joinTournament(id, token);
    if ('error' in result) {
      setFeedback(result.error);
    } else {
      setSelectedId(id);
      setFeedback(null);
    }
  };

  return (
    <PageShell maxWidth="5xl">
      <PageHeader
        title="Tournaments"
        subtitle="Single-elimination brackets for ruthless captains"
        actions={
          token ? (
            <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
              Create
            </Button>
          ) : undefined
        }
      />

      {feedback && (
        <div className="mb-4 text-gold italic" style={FONT_STYLES.body}>
          {feedback}
        </div>
      )}
      {error && (
        <Card variant="default" padding="md" className="!bg-blood-dark/30 !border-blood/60 mb-4">
          <p className="italic text-blood-bright" style={FONT_STYLES.body}>{error}</p>
        </Card>
      )}

      {!selectedId && (
        <>
          <h2 className="text-2xl text-gold mb-3" style={FONT_STYLES.pirate}>
            Open Tournaments
          </h2>
          {loading && <p className="text-parchment/60 italic">Loading...</p>}
          {!loading && list.length === 0 && (
            <p className="text-parchment/40 italic" style={FONT_STYLES.body}>
              No tournaments yet. Be the first to create one!
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {list.map((t) => (
              <Card key={t.id} variant="glow" padding="md">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-xl text-bone font-bold" style={FONT_STYLES.pirate}>
                      {t.name}
                    </h3>
                    <p className="text-xs text-aged-gold" style={FONT_STYLES.labelSC}>
                      {t.status.toUpperCase()} · {t.playerCount}/{t.maxPlayers} players
                    </p>
                  </div>
                  <span className="text-xs text-gold">{t.maxPlayers}-player</span>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button variant="pill" size="sm" onClick={() => setSelectedId(t.id)}>
                    View
                  </Button>
                  {t.status === 'lobby' && t.playerCount < t.maxPlayers && (
                    <Button variant="primary" size="sm" onClick={() => handleJoin(t.id)}>
                      Join
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Tournament detail */}
      {selectedId && current && (
        <div>
          <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
            ← All tournaments
          </Button>
          <h2 className="text-3xl text-blood-bright mt-2" style={FONT_STYLES.pirate}>
            {current.name}
          </h2>
          <p className="text-sm text-aged-gold mb-4" style={FONT_STYLES.labelSC}>
            {current.status.toUpperCase()} · {current.playerCount}/{current.maxPlayers}
          </p>

          <h3 className="text-xl text-gold mt-4 mb-2" style={FONT_STYLES.pirate}>
            Entries
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
            {current.entries.map((e) => (
              <div
                key={e.userId}
                className={`p-2 rounded-full text-center text-sm border ${
                  e.eliminated
                    ? 'bg-mahogany-light/40 border-mahogany-light text-aged-gold/40 line-through'
                    : 'bg-blood-dark/30 border-blood-bright/40 text-bone'
                }`}
                style={FONT_STYLES.labelSC}
              >
                #{e.seed + 1} {e.username}
              </div>
            ))}
          </div>

          <h3 className="text-xl text-gold mt-4 mb-2" style={FONT_STYLES.pirate}>
            Bracket
          </h3>
          <Bracket matches={current.matches} myUserId={user?.id} />
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4">
          <Card variant="glow" padding="lg" className="max-w-md w-full border-2 border-blood">
            <h2 className="text-3xl text-blood-bright mb-4" style={FONT_STYLES.pirate}>
              Create Tournament
            </h2>
            <div className="space-y-4">
              <FormField
                label="Name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Tortuga Open"
              />
              <div>
                <label className="block text-xs text-aged-gold uppercase tracking-wider mb-1" style={FONT_STYLES.labelSC}>
                  Bracket Size
                </label>
                <div className="flex gap-2">
                  {VALID_TOURNAMENT_SIZES.map((size) => (
                    <button
                      key={size}
                      onClick={() => setCreateSize(size)}
                      className={`flex-1 py-2 rounded-full text-sm transition ${
                        createSize === size
                          ? 'bg-gradient-to-b from-blood-bright to-blood text-bone'
                          : 'bg-mahogany-light text-parchment border border-blood/40'
                      }`}
                      style={FONT_STYLES.pirate}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="ghost" size="md" onClick={() => setShowCreate(false)} fullWidth>
                Cancel
              </Button>
              <Button variant="primary" size="md" onClick={handleCreate} fullWidth>
                Create
              </Button>
            </div>
          </Card>
        </div>
      )}
    </PageShell>
  );
}

function Bracket({ matches, myUserId }: { matches: TournamentBracketMatch[]; myUserId?: string }) {
  const byRound = new Map<number, TournamentBracketMatch[]>();
  matches.forEach((m) => {
    if (!byRound.has(m.round)) byRound.set(m.round, []);
    byRound.get(m.round)!.push(m);
  });
  const rounds = Array.from(byRound.keys()).sort((a, b) => a - b);

  return (
    <div className="flex gap-6 overflow-x-auto pb-4">
      {rounds.map((r) => (
        <div key={r} className="flex flex-col justify-around gap-3 min-w-[180px]">
          <div className="text-xs text-aged-gold uppercase tracking-widest text-center" style={FONT_STYLES.labelSC}>
            Round {r + 1}
          </div>
          {byRound.get(r)!.sort((a, b) => a.bracketIdx - b.bracketIdx).map((m) => (
            <div
              key={m.id}
              className={`p-2 rounded-lg border ${
                m.status === 'done'
                  ? 'bg-mahogany-light/50 border-mahogany-mid'
                  : m.status === 'ready'
                  ? 'bg-blood-dark/40 border-blood-bright/60'
                  : 'bg-pitch/60 border-mahogany-light'
              }`}
            >
              <div className="flex items-center justify-between text-sm" style={FONT_STYLES.labelSC}>
                <span className={m.winnerUserId === m.p1UserId ? 'text-gold font-bold' : 'text-bone'}>
                  {m.p1Username ?? '—'}
                  {m.p1UserId === myUserId && ' (you)'}
                </span>
              </div>
              <div className="border-t border-mahogany-light my-1" />
              <div className="flex items-center justify-between text-sm" style={FONT_STYLES.labelSC}>
                <span className={m.winnerUserId === m.p2UserId ? 'text-gold font-bold' : 'text-bone'}>
                  {m.p2Username ?? '—'}
                  {m.p2UserId === myUserId && ' (you)'}
                </span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

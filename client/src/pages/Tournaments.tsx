import { useEffect, useRef, useState } from 'react';
import { useTournamentsStore } from '../store/tournamentsStore';
import { useAuthStore } from '../store/authStore';
import { useSocketStore } from '../store/socketStore';
import { VALID_TOURNAMENT_SIZES } from '@shared/index';
import type { TournamentSize, TournamentBracketMatch } from '@shared/index';
import { FONT_STYLES } from '../styles/fonts';
import { Button } from '../components/ui/Button';
import { PageShell } from '../components/ui/PageShell';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { FormField } from '../components/ui/FormField';
import { Dialog, DialogContent, DialogTitle } from '../components/shadcn/dialog';

export function Tournaments() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const list = useTournamentsStore((s) => s.list);
  const current = useTournamentsStore((s) => s.current);
  const loading = useTournamentsStore((s) => s.loading);
  const error = useTournamentsStore((s) => s.error);
  const tournamentChat = useTournamentsStore((s) => s.tournamentChat);
  const fetchList = useTournamentsStore((s) => s.fetchList);
  const fetchOne = useTournamentsStore((s) => s.fetchOne);
  const fetchTournamentChat = useTournamentsStore((s) => s.fetchTournamentChat);
  const createTournament = useTournamentsStore((s) => s.create);
  const joinTournament = useTournamentsStore((s) => s.join);
  const subscribeTournament = useSocketStore((s) => s.subscribeTournament);
  const unsubscribeTournament = useSocketStore((s) => s.unsubscribeTournament);
  const sendTournamentChat = useSocketStore((s) => s.sendTournamentChat);
  const socketStatus = useSocketStore((s) => s.status);

  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createName, setCreateName] = useState('');
  const [createSize, setCreateSize] = useState<TournamentSize>(4);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    if (selectedId) {
      fetchOne(selectedId);
      fetchTournamentChat(selectedId);
    }
  }, [selectedId, fetchOne, fetchTournamentChat]);

  // Subscribe to tournament socket room when viewing a tournament
  useEffect(() => {
    if (!selectedId || socketStatus !== 'connected') return;
    subscribeTournament(selectedId);
    return () => { unsubscribeTournament(selectedId); };
  }, [selectedId, socketStatus, subscribeTournament, unsubscribeTournament]);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tournamentChat]);

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

  const handleSendChat = () => {
    if (!chatInput.trim() || !selectedId) return;
    sendTournamentChat(selectedId, chatInput.trim());
    setChatInput('');
  };

  const isInTournament = user && current?.entries.some((e) => e.userId === user.id);

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

          {current.status === 'lobby' ? (
            <LobbyView
              current={current}
              userId={user?.id}
              token={token}
              isInTournament={!!isInTournament}
              onJoinSlot={() => handleJoin(current.id)}
              chatMessages={tournamentChat}
              chatInput={chatInput}
              onChatInputChange={setChatInput}
              onSendChat={handleSendChat}
              chatEndRef={chatEndRef}
            />
          ) : (
            <>
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
            </>
          )}
        </div>
      )}

      {/* Create modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent showCloseButton={false} className="max-w-md sm:max-w-md p-0 bg-transparent ring-0 shadow-none border-0">
          <Card variant="glow" padding="lg" className="border-2 border-blood">
            <DialogTitle className="text-3xl text-blood-bright mb-4" style={FONT_STYLES.pirate}>
              Create Tournament
            </DialogTitle>
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
                    <Button
                      key={size}
                      variant={createSize === size ? 'primary' : 'secondary'}
                      size="sm"
                      className="flex-1"
                      onClick={() => setCreateSize(size)}
                    >
                      {size}
                    </Button>
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
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

interface LobbyViewProps {
  current: import('@shared/index').TournamentDetail;
  userId?: string;
  token: string | null;
  isInTournament: boolean;
  onJoinSlot: () => void;
  chatMessages: import('@shared/index').TournamentChatMessage[];
  chatInput: string;
  onChatInputChange: (v: string) => void;
  onSendChat: () => void;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
}

function LobbyView({
  current,
  userId,
  token,
  isInTournament,
  onJoinSlot,
  chatMessages,
  chatInput,
  onChatInputChange,
  onSendChat,
  chatEndRef,
}: LobbyViewProps) {
  const slots = Array.from({ length: current.maxPlayers }, (_, i) => {
    const entry = current.entries.find((e) => e.seed === i);
    return { index: i, entry: entry ?? null };
  });
  const isFull = current.playerCount >= current.maxPlayers;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Left: slot cards */}
      <div className="flex-1">
        <h3 className="text-xl text-gold mb-3" style={FONT_STYLES.pirate}>
          Crew Roster
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {slots.map(({ index, entry }) => {
            const isMe = entry?.userId === userId;
            const canJoin = !isInTournament && !isFull && !!token && !entry;

            return (
              <Card
                key={index}
                variant={entry ? 'glow' : 'default'}
                padding="md"
                className={`relative transition-colors ${
                  canJoin
                    ? 'cursor-pointer hover:border-blood-bright/60 hover:bg-blood-dark/20'
                    : ''
                } ${isMe ? '!border-gold/60' : ''}`}
                onClick={canJoin ? onJoinSlot : undefined}
              >
                <div className="text-xs text-aged-gold mb-1" style={FONT_STYLES.labelSC}>
                  Berth {index + 1}
                </div>
                {entry ? (
                  <div className="flex items-center gap-2">
                    <span
                      className="text-base text-bone font-bold truncate"
                      style={FONT_STYLES.pirate}
                    >
                      {entry.username}
                    </span>
                    {isMe && (
                      <span className="text-xs text-gold" style={FONT_STYLES.labelSC}>
                        (you)
                      </span>
                    )}
                  </div>
                ) : (
                  <div
                    className={`text-sm italic ${canJoin ? 'text-blood-bright' : 'text-parchment/30'}`}
                    style={FONT_STYLES.body}
                  >
                    {canJoin ? 'Click to join' : 'Empty'}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {!token && (
          <p className="mt-4 text-sm text-parchment/50 italic" style={FONT_STYLES.body}>
            Sign in to claim a berth.
          </p>
        )}
        {isInTournament && (
          <p className="mt-4 text-sm text-gold italic" style={FONT_STYLES.body}>
            You&apos;re enrolled. Waiting for the admiral&apos;s signal…
          </p>
        )}
        {isFull && !isInTournament && (
          <p className="mt-4 text-sm text-parchment/50 italic" style={FONT_STYLES.body}>
            All berths claimed — come back for the next voyage.
          </p>
        )}
      </div>

      {/* Right: chat panel */}
      <div className="w-full lg:w-80">
        <h3 className="text-xl text-gold mb-3" style={FONT_STYLES.pirate}>
          Parley
        </h3>
        <Card variant="glow" padding="none" className="flex flex-col h-[400px] overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {chatMessages.length === 0 ? (
              <p className="text-parchment/40 italic text-center mt-4" style={FONT_STYLES.body}>
                No messages yet
              </p>
            ) : (
              chatMessages.map((msg) => (
                <div key={msg.id} className="text-sm">
                  <span className="text-gold font-bold mr-2" style={FONT_STYLES.pirate}>
                    {msg.username}:
                  </span>
                  <span className="text-bone" style={FONT_STYLES.body}>
                    {msg.text}
                  </span>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="p-3 border-t border-mahogany-light flex gap-2">
            <FormField
              value={chatInput}
              onChange={(e) => onChatInputChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSendChat()}
              placeholder={token ? 'Say yer piece…' : 'Sign in to chat'}
              disabled={!token || !isInTournament}
              className="flex-1"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={onSendChat}
              disabled={!token || !isInTournament}
            >
              Send
            </Button>
          </div>
        </Card>
      </div>
    </div>
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

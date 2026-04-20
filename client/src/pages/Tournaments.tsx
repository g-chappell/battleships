import { Fragment, useEffect, useRef, useState } from 'react';
import { useTournamentsStore } from '../store/tournamentsStore';
import { useAuthStore } from '../store/authStore';
import { useSocketStore } from '../store/socketStore';
import { useSpectatorStore } from '../store/spectatorStore';
import { useGameStore } from '../store/gameStore';
import { VALID_TOURNAMENT_SIZES, totalRounds } from '@shared/index';
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
  const joinAsSpectator = useSpectatorStore((s) => s.joinAsSpectator);
  const setScreen = useGameStore((s) => s.setScreen);

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

  const handleSpectate = async (matchId: string) => {
    const res = await joinAsSpectator(matchId);
    if ('ok' in res) setScreen('spectate');
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
              <Bracket matches={current.matches} maxPlayers={current.maxPlayers} myUserId={user?.id} onSpectate={handleSpectate} />
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

// Bracket layout constants
const B_SLOT_H = 116; // vertical space per round-0 match slot
const B_MATCH_H = 96; // fixed height per match card
const B_COL_W = 180; // round column width
const B_CONN_W = 36; // connector SVG width

function getRoundLabel(round: number, numRounds: number): string {
  const fromEnd = numRounds - 1 - round;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Semi-Final';
  if (fromEnd === 2) return 'Quarter-Final';
  return `Round ${round + 1}`;
}

const MATCH_STATUS_CLS: Record<string, string> = {
  pending: 'bg-pitch/70 border-mahogany-light/40',
  ready: 'bg-blood-dark/50 border-blood/70',
  in_progress: 'bg-blood/20 border-blood-bright/80',
  done: 'bg-mahogany-mid/40 border-mahogany-light/50',
};

function BracketMatchCard({
  match,
  myUserId,
  onSpectate,
}: {
  match: TournamentBracketMatch;
  myUserId?: string;
  onSpectate?: (matchId: string) => void;
}) {
  const isP1Win = match.winnerUserId != null && match.winnerUserId === match.p1UserId;
  const isP2Win = match.winnerUserId != null && match.winnerUserId === match.p2UserId;

  return (
    <div
      className={`rounded-lg border flex flex-col px-2.5 py-2 ${MATCH_STATUS_CLS[match.status] ?? MATCH_STATUS_CLS.pending}`}
      style={{ height: B_MATCH_H }}
    >
      {/* Player 1 */}
      <div className="flex items-center justify-between gap-1">
        <span
          className={`text-xs truncate ${isP1Win ? 'text-gold font-bold' : 'text-bone/80'}`}
          style={FONT_STYLES.labelSC}
        >
          {match.p1Username ?? <span className="text-parchment/30 italic text-[10px]">TBD</span>}
          {match.p1UserId === myUserId && (
            <span className="text-copper/70 ml-0.5 text-[10px]"> (you)</span>
          )}
        </span>
        {isP1Win && <span className="text-gold text-xs shrink-0">★</span>}
      </div>

      {/* Divider */}
      <div className="border-t border-mahogany-light/40 my-1.5" />

      {/* Player 2 */}
      <div className="flex items-center justify-between gap-1">
        <span
          className={`text-xs truncate ${isP2Win ? 'text-gold font-bold' : 'text-bone/80'}`}
          style={FONT_STYLES.labelSC}
        >
          {match.p2Username ?? <span className="text-parchment/30 italic text-[10px]">TBD</span>}
          {match.p2UserId === myUserId && (
            <span className="text-copper/70 ml-0.5 text-[10px]"> (you)</span>
          )}
        </span>
        {isP2Win && <span className="text-gold text-xs shrink-0">★</span>}
      </div>

      {/* Status / action area — always rendered to keep card height uniform */}
      <div className="mt-auto pt-1">
        {match.status === 'in_progress' && match.matchId && onSpectate ? (
          <Button
            variant="ghost"
            size="sm"
            className="!h-5 text-[10px] px-2 w-full text-blood-bright hover:text-bone"
            onClick={() => onSpectate(match.matchId!)}
          >
            Watch live
          </Button>
        ) : match.status === 'in_progress' ? (
          <div className="text-[10px] text-blood-bright/60 text-center" style={FONT_STYLES.labelSC}>
            In progress
          </div>
        ) : match.status === 'ready' ? (
          <div className="text-[10px] text-aged-gold/50 text-center" style={FONT_STYLES.labelSC}>
            Awaiting start
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BracketConnector({
  matchesInRound,
  totalHeight,
}: {
  matchesInRound: number;
  totalHeight: number;
}) {
  const matchesInNext = matchesInRound / 2;
  const midX = B_CONN_W / 2;
  const parts: string[] = [];

  for (let i = 0; i < matchesInNext; i++) {
    const yTop = ((2 * i + 0.5) / matchesInRound) * totalHeight;
    const yBot = ((2 * i + 1.5) / matchesInRound) * totalHeight;
    const yOut = ((i + 0.5) / matchesInNext) * totalHeight;
    // Top feeder line → midpoint → output
    parts.push(`M 0,${yTop} H ${midX} V ${yOut} H ${B_CONN_W}`);
    // Bottom feeder line → midpoint (vertical already drawn above)
    parts.push(`M 0,${yBot} H ${midX} V ${yOut}`);
  }

  return (
    <svg width={B_CONN_W} height={totalHeight} style={{ flexShrink: 0 }}>
      <path d={parts.join(' ')} stroke="#5c2525" strokeWidth={1.5} fill="none" strokeLinejoin="round" />
    </svg>
  );
}

function Bracket({
  matches,
  maxPlayers,
  myUserId,
  onSpectate,
}: {
  matches: TournamentBracketMatch[];
  maxPlayers: number;
  myUserId?: string;
  onSpectate?: (matchId: string) => void;
}) {
  const numRounds = totalRounds(maxPlayers);
  const matchesInRound0 = maxPlayers / 2;
  const totalHeight = matchesInRound0 * B_SLOT_H;

  const byRound = new Map<number, TournamentBracketMatch[]>();
  matches.forEach((m) => {
    if (!byRound.has(m.round)) byRound.set(m.round, []);
    byRound.get(m.round)!.push(m);
  });

  return (
    <div className="overflow-x-auto pb-4">
      {/* Round header labels */}
      <div className="flex mb-2">
        {Array.from({ length: numRounds }, (_, r) => (
          <div
            key={r}
            style={{ width: r < numRounds - 1 ? B_COL_W + B_CONN_W : B_COL_W, flexShrink: 0 }}
          >
            <div
              className="text-center text-[10px] text-aged-gold uppercase tracking-widest"
              style={FONT_STYLES.labelSC}
            >
              {getRoundLabel(r, numRounds)}
            </div>
          </div>
        ))}
      </div>

      {/* Bracket columns + connectors */}
      <div className="flex" style={{ height: totalHeight }}>
        {Array.from({ length: numRounds }, (_, r) => {
          const matchesInRound = matchesInRound0 / Math.pow(2, r);
          const roundMatches = (byRound.get(r) ?? []).sort((a, b) => a.bracketIdx - b.bracketIdx);

          return (
            <Fragment key={r}>
              <div
                className="flex flex-col justify-around shrink-0"
                style={{ width: B_COL_W, height: totalHeight }}
              >
                {roundMatches.map((m) => (
                  <BracketMatchCard
                    key={m.id}
                    match={m}
                    myUserId={myUserId}
                    onSpectate={onSpectate}
                  />
                ))}
              </div>
              {r < numRounds - 1 && (
                <BracketConnector matchesInRound={matchesInRound} totalHeight={totalHeight} />
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

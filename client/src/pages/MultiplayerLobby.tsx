import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { useSocketStore } from '../store/socketStore';
import { useAuthStore } from '../store/authStore';
import { AbilityType, ABILITY_DEFS } from '@shared/index';

const labelStyle = { fontFamily: "'IM Fell English SC', serif" };
const pirateStyle = { fontFamily: "'Pirata One', serif" };

export function MultiplayerLobby() {
  const setScreen = useGameStore((s) => s.setScreen);
  const startMultiplayerGame = useGameStore((s) => s.startMultiplayerGame);
  const selectedAbilities = useGameStore((s) => s.selectedAbilityTypes);
  const toggleAbility = useGameStore((s) => s.toggleAbilitySelection);

  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  const status = useSocketStore((s) => s.status);
  const matchmakingState = useSocketStore((s) => s.matchmakingState);
  const queueElapsed = useSocketStore((s) => s.queueElapsed);
  const roomId = useSocketStore((s) => s.roomId);
  const privateCode = useSocketStore((s) => s.privateCode);
  const opponent = useSocketStore((s) => s.opponent);
  const errorMessage = useSocketStore((s) => s.errorMessage);

  const connect = useSocketStore((s) => s.connect);
  const disconnect = useSocketStore((s) => s.disconnect);
  const joinMatchmaking = useSocketStore((s) => s.joinMatchmaking);
  const leaveMatchmaking = useSocketStore((s) => s.leaveMatchmaking);
  const createPrivateRoom = useSocketStore((s) => s.createPrivateRoom);
  const joinPrivateRoom = useSocketStore((s) => s.joinPrivateRoom);
  const resetRoom = useSocketStore((s) => s.resetRoom);

  const [mode, setMode] = useState<'choice' | 'quick' | 'private_create' | 'private_join'>('choice');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [elapsedTick, setElapsedTick] = useState(0);
  const [createdAt, setCreatedAt] = useState(0);

  // Connect on mount
  useEffect(() => {
    if (status === 'disconnected') {
      connect(token, user?.username);
    }
    return () => {
      // Don't disconnect when component unmounts — we'll need it in the game
    };
  }, [status, token, user, connect]);

  // Tick elapsed counter while queueing
  useEffect(() => {
    if (matchmakingState !== 'queueing') return;
    setCreatedAt(Date.now());
    const id = setInterval(() => setElapsedTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [matchmakingState]);

  // Transition to game when matched
  useEffect(() => {
    if (matchmakingState === 'matched' && roomId) {
      startMultiplayerGame();
    }
  }, [matchmakingState, roomId, startMultiplayerGame]);

  // Transition to game when both players in private room
  useEffect(() => {
    if (roomId && opponent && (mode === 'private_create' || mode === 'private_join')) {
      startMultiplayerGame();
    }
  }, [roomId, opponent, mode, startMultiplayerGame]);

  const handleQuickMatch = () => {
    setMode('quick');
    joinMatchmaking(selectedAbilities);
  };

  const handleCancelQuick = () => {
    leaveMatchmaking();
    setMode('choice');
  };

  const handleCreatePrivate = async () => {
    setMode('private_create');
    const res = await createPrivateRoom(selectedAbilities);
    if ('error' in res) {
      setJoinError(res.error);
      setMode('choice');
    }
  };

  const handleJoinPrivate = async () => {
    setJoinError(null);
    if (!joinCode.trim()) return;
    const res = await joinPrivateRoom(joinCode.trim().toUpperCase(), selectedAbilities);
    if ('error' in res) {
      setJoinError(res.error);
    } else {
      setMode('private_join');
    }
  };

  const handleBack = () => {
    if (mode === 'quick') {
      leaveMatchmaking();
    }
    resetRoom();
    setMode('choice');
    setScreen('menu');
  };

  const elapsed = createdAt ? Math.floor((Date.now() - createdAt) / 1000) + elapsedTick * 0 : 0;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#0d0606] via-[#1a0a0a] to-[#2a1410] p-8 pt-24">
      <div className="text-center mb-8">
        <h1 className="text-5xl text-[#c41e3a] mb-2" style={{ ...pirateStyle, textShadow: '0 0 20px rgba(196,30,58,0.4)' }}>
          Multiplayer
        </h1>
        <p className="text-[#a06820] tracking-widest" style={labelStyle}>
          Battle other captains
        </p>
      </div>

      {status !== 'connected' && (
        <div className="mb-4 text-[#c41e3a] italic" style={{ fontFamily: "'IM Fell English', serif" }}>
          {status === 'connecting' ? 'Connecting to the high seas...' : 'Disconnected'}
          {errorMessage && <div className="text-xs mt-1">{errorMessage}</div>}
        </div>
      )}

      {/* Choice screen */}
      {mode === 'choice' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl w-full mb-6">
            <div className="bg-[#1a0a0a]/80 border border-[#8b0000]/60 rounded p-6 panel-glow">
              <h2 className="text-2xl text-[#c41e3a] mb-2" style={pirateStyle}>Quick Match</h2>
              <p className="text-[#d4c4a1]/70 text-sm mb-4 italic" style={{ fontFamily: "'IM Fell English', serif" }}>
                Find a random opponent of similar skill. Ranked match.
              </p>
              <button
                onClick={handleQuickMatch}
                disabled={status !== 'connected' || selectedAbilities.length !== 2}
                className="w-full px-4 py-3 bg-gradient-to-b from-[#c41e3a] to-[#8b0000] text-[#e8dcc8] font-bold rounded border border-[#c41e3a] hover:from-[#e74c3c] hover:to-[#c41e3a] transition-colors disabled:opacity-50"
                style={pirateStyle}
              >
                Find Opponent
              </button>
            </div>

            <div className="bg-[#1a0a0a]/80 border border-[#8b0000]/60 rounded p-6 panel-glow">
              <h2 className="text-2xl text-[#c41e3a] mb-2" style={pirateStyle}>Private Match</h2>
              <p className="text-[#d4c4a1]/70 text-sm mb-4 italic" style={{ fontFamily: "'IM Fell English', serif" }}>
                Play with a friend using an invite code. Unranked.
              </p>
              <button
                onClick={handleCreatePrivate}
                disabled={status !== 'connected' || selectedAbilities.length !== 2}
                className="w-full px-4 py-2 bg-[#3d1f17] text-[#e8dcc8] font-bold rounded border border-[#8b0000]/40 hover:bg-[#5c2820] mb-2"
                style={pirateStyle}
              >
                Create Room
              </button>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="CODE"
                  maxLength={6}
                  className="flex-1 px-3 py-2 bg-[#0d0606] border border-[#8b0000]/40 rounded text-[#e8dcc8] uppercase tracking-widest text-center"
                  style={pirateStyle}
                />
                <button
                  onClick={handleJoinPrivate}
                  disabled={status !== 'connected' || joinCode.length < 4 || selectedAbilities.length !== 2}
                  className="px-4 py-2 bg-[#3d1f17] text-[#e8dcc8] font-bold rounded border border-[#8b0000]/40 hover:bg-[#5c2820] disabled:opacity-50"
                  style={pirateStyle}
                >
                  Join
                </button>
              </div>
              {joinError && <p className="text-[#c41e3a] text-xs mt-2 italic">{joinError}</p>}
            </div>
          </div>

          {/* Ability selection (must pick 2 to play) */}
          <div className="text-center max-w-md w-full mb-4">
            <p className="text-[#a06820]/70 text-xs uppercase tracking-[0.2em] mb-2" style={labelStyle}>
              Choose 2 Abilities ({selectedAbilities.length}/2)
            </p>
            <div className="grid grid-cols-2 gap-2">
              {Object.values(AbilityType).map((type) => {
                const def = ABILITY_DEFS[type];
                const isSelected = selectedAbilities.includes(type);
                return (
                  <button
                    key={type}
                    onClick={() => toggleAbility(type)}
                    className={`px-3 py-2 text-left rounded border transition-colors ${
                      isSelected
                        ? 'bg-[#5c0000]/40 border-[#c41e3a]/60 text-[#c41e3a]'
                        : 'bg-[#1a0a0a]/40 border-[#3d1f17] text-[#d4c4a1]/60 hover:bg-[#3d1f17]/40'
                    }`}
                    style={labelStyle}
                  >
                    <div className="text-sm font-bold">{def.name}</div>
                    <div className="text-xs opacity-70" style={{ fontFamily: "'IM Fell English', serif" }}>
                      {def.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Quick match queueing */}
      {mode === 'quick' && matchmakingState === 'queueing' && (
        <div className="text-center bg-[#1a0a0a]/80 border border-[#8b0000]/60 rounded p-8 panel-glow">
          <div className="text-[#c41e3a] text-2xl mb-2 animate-pulse" style={pirateStyle}>
            Searching the seas...
          </div>
          <div className="text-[#d4c4a1] mb-4" style={labelStyle}>
            Elapsed: {elapsed}s
          </div>
          <button
            onClick={handleCancelQuick}
            className="px-4 py-2 bg-[#3d1f17] text-[#d4c4a1] rounded border border-[#8b0000]/40 hover:bg-[#5c2820]"
            style={pirateStyle}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Private match created — waiting for opponent */}
      {mode === 'private_create' && privateCode && !opponent && (
        <div className="text-center bg-[#1a0a0a]/80 border border-[#8b0000]/60 rounded p-8 panel-glow">
          <p className="text-[#a06820] text-sm uppercase tracking-widest mb-2" style={labelStyle}>
            Share this code with yer mate
          </p>
          <div className="text-6xl text-[#c41e3a] mb-4 tracking-[0.3em] font-bold" style={{ ...pirateStyle, textShadow: '0 0 20px rgba(196,30,58,0.5)' }}>
            {privateCode}
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(privateCode)}
            className="px-4 py-2 bg-[#3d1f17] text-[#e8dcc8] rounded border border-[#8b0000]/40 hover:bg-[#5c2820] mb-2"
            style={pirateStyle}
          >
            Copy Code
          </button>
          <p className="text-[#d4c4a1]/60 text-sm italic mt-4" style={{ fontFamily: "'IM Fell English', serif" }}>
            Waiting for opponent to join...
          </p>
        </div>
      )}

      {/* Back button */}
      {mode !== 'quick' && (
        <button
          onClick={handleBack}
          className="mt-6 px-4 py-2 text-[#d4c4a1]/50 hover:text-[#e8dcc8] transition-colors text-sm"
          style={labelStyle}
        >
          ← Back to Menu
        </button>
      )}
    </div>
  );
}

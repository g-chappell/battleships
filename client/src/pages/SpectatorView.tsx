import { useEffect, useState, useRef } from 'react';
import { useSpectatorStore } from '../store/spectatorStore';
import { useGameStore } from '../store/gameStore';
import type { PublicBoardView } from '@shared/sockets';

const GRID = 10;
const CELL_PX = 32;

const labelStyle = { fontFamily: "'IM Fell English SC', serif" };
const pirateStyle = { fontFamily: "'Pirata One', serif" };

function SpectatorBoard({ board, label }: { board: PublicBoardView; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="text-[#a06820] text-sm uppercase tracking-wider mb-2" style={labelStyle}>
        {label}
      </div>
      <div
        className="border-2 border-[#8b0000]/40 rounded overflow-hidden"
        style={{ width: GRID * CELL_PX, height: GRID * CELL_PX }}
      >
        {board.cells.map((row, r) => (
          <div key={r} className="flex">
            {row.map((cell, c) => {
              let bg = '#0a1929'; // ocean
              if (cell === 'hit') bg = '#c41e3a';
              else if (cell === 'miss') bg = '#2c3e50';
              return (
                <div
                  key={c}
                  style={{
                    width: CELL_PX,
                    height: CELL_PX,
                    backgroundColor: bg,
                    border: '1px solid rgba(139,0,0,0.15)',
                  }}
                  className="flex items-center justify-center text-xs"
                >
                  {cell === 'hit' && <span className="text-white">X</span>}
                  {cell === 'miss' && <span className="text-gray-500">o</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {/* Sunk ships */}
      {board.sunkShips.length > 0 && (
        <div className="mt-1 text-xs text-[#c41e3a]/70" style={labelStyle}>
          Sunk: {board.sunkShips.map((s) => s.type).join(', ')}
        </div>
      )}
    </div>
  );
}

export function SpectatorView() {
  const gameState = useSpectatorStore((s) => s.gameState);
  const chat = useSpectatorStore((s) => s.chat);
  const spectatorCount = useSpectatorStore((s) => s.spectatorCount);
  const ended = useSpectatorStore((s) => s.ended);
  const winnerId = useSpectatorStore((s) => s.winnerId);
  const leaveSpectating = useSpectatorStore((s) => s.leaveSpectating);
  const sendChat = useSpectatorStore((s) => s.sendChat);
  const setScreen = useGameStore((s) => s.setScreen);

  const [chatInput, setChatInput] = useState('');
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chat]);

  const handleLeave = () => {
    leaveSpectating();
    setScreen('multiplayer');
  };

  const handleSendChat = () => {
    if (chatInput.trim()) {
      sendChat(chatInput);
      setChatInput('');
    }
  };

  if (!gameState) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-[#0d0606] via-[#1a0a0a] to-[#2a1410]">
        <div className="text-[#d4c4a1] text-xl" style={pirateStyle}>Connecting to match...</div>
      </div>
    );
  }

  const winnerName = ended && winnerId
    ? (winnerId === 'player1' ? gameState.player1.username : gameState.player2.username)
    : null;

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-b from-[#0d0606] via-[#1a0a0a] to-[#2a1410] p-4 pt-20">
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-3xl text-[#c41e3a] mb-1" style={{ ...pirateStyle, textShadow: '0 0 20px rgba(196,30,58,0.4)' }}>
          Spectating
        </h1>
        <p className="text-[#a06820] text-sm" style={labelStyle}>
          {gameState.player1.username} ({gameState.player1.rating}) vs {gameState.player2.username} ({gameState.player2.rating})
        </p>
        <div className="flex items-center justify-center gap-4 text-xs text-[#d4c4a1]/50 mt-1" style={labelStyle}>
          <span>Turn {gameState.turnCount}</span>
          <span>{spectatorCount} watching</span>
          <span className={gameState.phase === 'playing' ? 'text-[#2ecc71]' : 'text-[#a06820]'}>
            {gameState.phase === 'placement' ? 'Setting up' : gameState.phase === 'playing' ? 'In progress' : 'Finished'}
          </span>
        </div>
      </div>

      {/* Match ended overlay */}
      {ended && winnerName && (
        <div className="text-center mb-4 bg-[#1a0a0a]/80 border border-[#c41e3a]/40 rounded p-4">
          <div className="text-2xl text-[#c41e3a]" style={pirateStyle}>{winnerName} wins!</div>
        </div>
      )}

      {/* Boards */}
      <div className="flex-1 flex items-start justify-center gap-8 overflow-auto">
        <SpectatorBoard board={gameState.board1} label={gameState.player1.username} />
        <div className="flex flex-col items-center justify-center h-full">
          <div className="text-3xl text-[#c41e3a]" style={pirateStyle}>VS</div>
          <div className="text-xs text-[#a06820] mt-1" style={labelStyle}>
            {gameState.currentTurn === 'player1' ? gameState.player1.username : gameState.player2.username}'s turn
          </div>
        </div>
        <SpectatorBoard board={gameState.board2} label={gameState.player2.username} />
      </div>

      {/* Chat panel */}
      <div className="mt-4 max-w-md mx-auto w-full">
        <div
          ref={chatRef}
          className="h-28 overflow-y-auto bg-[#0d0606]/60 border border-[#8b0000]/20 rounded-t p-2 text-xs"
        >
          {chat.length === 0 && (
            <div className="text-[#d4c4a1]/30 italic" style={labelStyle}>Spectator chat...</div>
          )}
          {chat.map((msg) => (
            <div key={msg.id} className="text-[#d4c4a1]/70">
              <span className="text-[#a06820] font-bold">{msg.username}: </span>
              {msg.text}
            </div>
          ))}
        </div>
        <div className="flex">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
            placeholder="Chat..."
            maxLength={200}
            className="flex-1 px-3 py-2 bg-[#0d0606] border border-[#8b0000]/20 border-t-0 rounded-bl text-[#e8dcc8] text-sm"
          />
          <button
            onClick={handleSendChat}
            className="px-4 py-2 bg-[#3d1f17] text-[#d4c4a1] text-sm border border-[#8b0000]/20 border-t-0 border-l-0 rounded-br hover:bg-[#5c2820]"
            style={labelStyle}
          >
            Send
          </button>
        </div>
      </div>

      {/* Leave button */}
      <div className="text-center mt-4">
        <button
          onClick={handleLeave}
          className="px-6 py-2 text-[#d4c4a1]/50 hover:text-[#e8dcc8] transition-colors text-sm"
          style={labelStyle}
        >
          Leave
        </button>
      </div>
    </div>
  );
}

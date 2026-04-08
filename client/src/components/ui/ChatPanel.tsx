import { useEffect, useRef, useState } from 'react';
import { useSocketStore } from '../../store/socketStore';
import { useGameStore } from '../../store/gameStore';

const labelStyle = { fontFamily: "'IM Fell English SC', serif" };
const bodyStyle = { fontFamily: "'IM Fell English', serif" };

export function ChatPanel() {
  const gameMode = useGameStore((s) => s.gameMode);
  const messages = useSocketStore((s) => s.chatMessages);
  const opponent = useSocketStore((s) => s.opponent);
  const muted = useSocketStore((s) => s.mutedOpponent);
  const sendChat = useSocketStore((s) => s.sendChat);
  const toggleMute = useSocketStore((s) => s.toggleMuteOpponent);

  const [text, setText] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (gameMode !== 'multiplayer') return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    sendChat(trimmed);
    setText('');
  };

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="absolute top-20 right-4 z-30 px-3 py-2 bg-[#1a0a0a]/90 border border-[#8b0000]/60 rounded text-[#c41e3a] hover:bg-[#3d1f17] transition-colors panel-glow"
        style={labelStyle}
      >
        Chat ({messages.length})
      </button>
    );
  }

  return (
    <div className="absolute top-20 right-4 w-72 h-80 bg-gradient-to-b from-[#0d0606]/95 to-[#1a0a0a]/95 border border-[#8b0000]/60 rounded flex flex-col z-30 panel-glow">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#8b0000]/40">
        <h3 className="text-[#c41e3a] text-sm font-bold uppercase tracking-wider" style={labelStyle}>
          Parley
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            title={muted ? 'Unmute opponent' : 'Mute opponent'}
            className={`text-xs px-2 py-0.5 rounded ${muted ? 'bg-[#8b0000] text-[#e8dcc8]' : 'text-[#d4c4a1]/50 hover:text-[#d4c4a1]'}`}
            style={labelStyle}
          >
            {muted ? 'Muted' : 'Mute'}
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="text-[#d4c4a1]/50 hover:text-[#d4c4a1] text-lg leading-none"
          >
            ×
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2 text-sm" style={bodyStyle}>
        {messages.length === 0 && (
          <p className="text-[#d4c4a1]/30 italic text-center mt-8">No messages yet. Greet yer opponent!</p>
        )}
        {messages.map((msg) => {
          const isOwn = opponent ? msg.fromId !== opponent.id : true;
          return (
            <div key={msg.id} className={`${isOwn ? 'text-right' : 'text-left'}`}>
              <div className={`inline-block max-w-[85%] px-2 py-1 rounded ${
                isOwn
                  ? 'bg-[#5c0000]/40 text-[#e8dcc8] border border-[#8b0000]/40'
                  : 'bg-[#3d1f17]/60 text-[#d4a040] border border-[#a06820]/30'
              }`}>
                <div className="text-xs opacity-60" style={labelStyle}>{msg.fromUsername}</div>
                <div>{msg.text}</div>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSend} className="border-t border-[#8b0000]/40 p-2 flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={200}
          placeholder="Type a message..."
          className="flex-1 px-2 py-1 bg-[#0d0606] border border-[#8b0000]/40 rounded text-[#e8dcc8] text-sm focus:border-[#c41e3a] focus:outline-none"
          style={bodyStyle}
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="px-3 py-1 bg-[#8b0000] text-[#e8dcc8] rounded border border-[#c41e3a] hover:bg-[#c41e3a] disabled:opacity-50 text-sm font-bold"
          style={labelStyle}
        >
          Send
        </button>
      </form>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useClanStore } from '../store/clanStore';
import { useAuthStore } from '../store/authStore';
import { FONT_STYLES } from '../styles/fonts';
import { Button } from '../components/ui/Button';
import { PageShell } from '../components/ui/PageShell';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { FormField } from '../components/ui/FormField';
import { Dialog, DialogContent, DialogTitle } from '../components/shadcn/dialog';

export function Clans() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const myClan = useClanStore((s) => s.myClan);
  const myClanId = useClanStore((s) => s.myClanId);
  const browse = useClanStore((s) => s.browse);
  const chatMessages = useClanStore((s) => s.chatMessages);
  const fetchBrowse = useClanStore((s) => s.fetchBrowse);
  const fetchMyClan = useClanStore((s) => s.fetchMyClan);
  const createClan = useClanStore((s) => s.createClan);
  const joinClan = useClanStore((s) => s.joinClan);
  const leaveClan = useClanStore((s) => s.leaveClan);
  const sendChat = useClanStore((s) => s.sendChat);

  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createTag, setCreateTag] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [search, setSearch] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (myClanId) {
      fetchMyClan(myClanId);
    } else {
      fetchBrowse();
    }
  }, [myClanId, fetchBrowse, fetchMyClan]);

  const handleCreate = async () => {
    if (!token) {
      setFeedback('Sign in to create a clan');
      return;
    }
    const result = await createClan(createName.trim(), createTag.trim().toUpperCase(), createDesc.trim() || undefined, token);
    if ('error' in result) {
      setFeedback(result.error);
    } else {
      setShowCreate(false);
      setFeedback(null);
    }
  };

  const handleJoin = async (id: string) => {
    if (!token) {
      setFeedback('Sign in to join a clan');
      return;
    }
    const result = await joinClan(id, token);
    if ('error' in result) setFeedback(result.error);
  };

  const handleLeave = async () => {
    if (!token) return;
    await leaveClan(token);
    setFeedback(null);
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || !token) return;
    await sendChat(chatInput.trim(), token);
    setChatInput('');
    if (myClanId) fetchMyClan(myClanId);
  };

  return (
    <PageShell maxWidth="5xl">
      <PageHeader
        title="Clans"
        subtitle="Band together. Share the spoils."
      />

      {feedback && (
        <div className="mb-4 text-gold italic" style={FONT_STYLES.body}>
          {feedback}
        </div>
      )}

      {!myClan && (
        <>
          <div className="flex gap-2 mb-6">
            <FormField
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clans..."
              className="flex-1"
            />
            <Button variant="secondary" size="md" onClick={() => fetchBrowse(search)}>
              Search
            </Button>
            {token && (
              <Button variant="primary" size="md" onClick={() => setShowCreate(true)}>
                Create Clan
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {browse.map((c) => (
              <Card key={c.id} variant="glow" padding="md">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-xl text-bone font-bold" style={FONT_STYLES.pirate}>
                      [{c.tag}] {c.name}
                    </h3>
                    <p className="text-xs text-aged-gold" style={FONT_STYLES.labelSC}>
                      {c.memberCount} members · {c.totalWins}W / {c.totalLosses}L
                    </p>
                  </div>
                </div>
                {c.description && (
                  <p className="text-xs text-parchment/70 italic mt-2 mb-3" style={FONT_STYLES.body}>
                    {c.description}
                  </p>
                )}
                <Button variant="pill" size="sm" onClick={() => handleJoin(c.id)}>
                  Join
                </Button>
              </Card>
            ))}
          </div>

          {browse.length === 0 && (
            <p className="text-parchment/40 italic text-center py-8" style={FONT_STYLES.body}>
              No clans yet. Create the first one!
            </p>
          )}
        </>
      )}

      {myClan && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <Card variant="active" padding="md" className="mb-4">
              <h2 className="text-3xl text-blood-bright" style={FONT_STYLES.pirate}>
                [{myClan.tag}] {myClan.name}
              </h2>
              {myClan.description && (
                <p className="text-sm text-parchment/80 italic mt-1" style={FONT_STYLES.body}>
                  {myClan.description}
                </p>
              )}
              <div className="grid grid-cols-3 gap-2 mt-4">
                <div className="text-center p-2 bg-pitch/60 rounded-lg">
                  <div className="text-2xl text-gold font-bold" style={FONT_STYLES.pirate}>
                    {myClan.memberCount}
                  </div>
                  <div className="text-xs text-aged-gold uppercase" style={FONT_STYLES.labelSC}>
                    Members
                  </div>
                </div>
                <div className="text-center p-2 bg-pitch/60 rounded-lg">
                  <div className="text-2xl text-[#2ecc71] font-bold" style={FONT_STYLES.pirate}>
                    {myClan.totalWins}
                  </div>
                  <div className="text-xs text-aged-gold uppercase" style={FONT_STYLES.labelSC}>
                    Wins
                  </div>
                </div>
                <div className="text-center p-2 bg-pitch/60 rounded-lg">
                  <div className="text-2xl text-blood-bright font-bold" style={FONT_STYLES.pirate}>
                    {myClan.totalLosses}
                  </div>
                  <div className="text-xs text-aged-gold uppercase" style={FONT_STYLES.labelSC}>
                    Losses
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <Button variant="secondary" size="sm" onClick={handleLeave}>
                  Leave Clan
                </Button>
              </div>
            </Card>

            <h3 className="text-xl text-gold mb-2" style={FONT_STYLES.pirate}>
              Crew Roster
            </h3>
            <div className="space-y-1">
              {myClan.members.map((m) => (
                <div
                  key={m.userId}
                  className="flex items-center justify-between p-2 bg-coal/60 border border-mahogany-light rounded-full"
                  style={FONT_STYLES.labelSC}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs uppercase px-2 py-0.5 rounded-full ${
                        m.role === 'leader'
                          ? 'bg-blood-bright/30 text-blood-bright'
                          : m.role === 'officer'
                          ? 'bg-gold/30 text-gold'
                          : 'bg-mahogany-light/60 text-parchment/60'
                      }`}
                    >
                      {m.role}
                    </span>
                    <span className="text-bone">{m.username}</span>
                    {m.userId === user?.id && <span className="text-aged-gold text-xs">(you)</span>}
                  </div>
                  <span className="text-xs text-gold" style={FONT_STYLES.pirate}>
                    {m.rating}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Chat panel */}
          <Card variant="glow" padding="none" className="flex flex-col h-[500px] overflow-hidden">
            <div className="p-3 border-b border-mahogany-light">
              <h3 className="text-lg text-gold" style={FONT_STYLES.pirate}>
                Parley
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {chatMessages.length === 0 ? (
                <p className="text-parchment/40 italic text-center" style={FONT_STYLES.body}>
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
            </div>
            <div className="p-3 border-t border-mahogany-light flex gap-2">
              <FormField
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                placeholder="Message yer crew..."
                className="flex-1"
              />
              <Button variant="primary" size="sm" onClick={handleSendChat}>
                Send
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Create clan modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent showCloseButton={false} className="max-w-md sm:max-w-md p-0 bg-transparent ring-0 shadow-none border-0">
          <Card variant="glow" padding="lg" className="border-2 border-blood">
            <DialogTitle className="text-3xl text-blood-bright mb-4" style={FONT_STYLES.pirate}>
              Raise the Colors
            </DialogTitle>
            <div className="space-y-3">
              <FormField
                label="Clan Name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Iron Kraken"
              />
              <FormField
                label="Tag (2-5 chars)"
                value={createTag}
                onChange={(e) => setCreateTag(e.target.value.toUpperCase().slice(0, 5))}
                placeholder="IKRAK"
                className="uppercase"
              />
              <FormField
                label="Description (optional)"
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                placeholder="A crew of the fiercest..."
                multiline
                rows={3}
              />
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="ghost" size="md" fullWidth onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="md" fullWidth onClick={handleCreate}>
                Found Clan
              </Button>
            </div>
          </Card>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

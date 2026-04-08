import { useEffect, useState } from 'react';
import { useFriendsStore } from '../store/friendsStore';
import { useAuthStore } from '../store/authStore';
import { FONT_STYLES } from '../styles/fonts';
import { Button } from '../components/ui/Button';
import { PageShell } from '../components/ui/PageShell';
import { PageHeader } from '../components/ui/PageHeader';
import { BackButton } from '../components/ui/BackButton';
import { Card } from '../components/ui/Card';
import { FormField } from '../components/ui/FormField';

export function Friends() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  const friends = useFriendsStore((s) => s.friends);
  const incoming = useFriendsStore((s) => s.pendingIncoming);
  const outgoing = useFriendsStore((s) => s.pendingOutgoing);

  const loadLocal = useFriendsStore((s) => s.loadLocal);
  const loadFromServer = useFriendsStore((s) => s.loadFromServer);
  const sendRequest = useFriendsStore((s) => s.sendRequest);
  const acceptRequest = useFriendsStore((s) => s.acceptRequest);
  const declineRequest = useFriendsStore((s) => s.declineRequest);
  const removeFriend = useFriendsStore((s) => s.removeFriend);

  const [searchInput, setSearchInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    loadLocal();
    if (token) loadFromServer(token);
  }, [token, loadLocal, loadFromServer]);

  const handleSend = async () => {
    setFeedback(null);
    const res = await sendRequest(searchInput, token);
    if (res.ok) {
      setFeedback('Request sent!');
      setSearchInput('');
    } else {
      setFeedback(res.error || 'Failed to send request');
    }
  };

  return (
    <PageShell maxWidth="3xl">
      <PageHeader
        title="Friends"
        subtitle="Yer trusted crew"
        actions={<BackButton />}
      />

      {!user && (
        <Card variant="default" padding="md" className="!bg-blood-dark/30 !border-blood/60 mb-6">
          <p className="text-parchment italic" style={FONT_STYLES.body}>
            Sign in to use friends across devices. Local friends list is being used.
          </p>
        </Card>
      )}

      {/* Add friend */}
      <Card variant="glow" padding="md" className="mb-6">
        <h2 className="text-xl text-blood-bright mb-3" style={FONT_STYLES.pirate}>Add a Friend</h2>
        <div className="flex gap-2">
          <FormField
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Username"
            className="flex-1"
          />
          <Button variant="primary" size="md" onClick={handleSend}>
            Send Request
          </Button>
        </div>
        {feedback && <p className="text-sm text-gold mt-2 italic" style={FONT_STYLES.body}>{feedback}</p>}
      </Card>

      {/* Pending incoming */}
      {incoming.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl text-blood-bright mb-3" style={FONT_STYLES.pirate}>Incoming Requests</h2>
          <div className="space-y-2">
            {incoming.map((req) => (
              <Card key={req.id} variant="default" padding="sm">
                <div className="flex items-center justify-between">
                  <span className="text-bone" style={FONT_STYLES.labelSC}>{req.fromUsername}</span>
                  <div className="flex gap-2">
                    <Button variant="primary" size="sm" onClick={() => acceptRequest(req.id, token)}>
                      Accept
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => declineRequest(req.id, token)}>
                      Decline
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Pending outgoing */}
      {outgoing.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl text-aged-gold mb-3" style={FONT_STYLES.pirate}>Sent Requests</h2>
          <div className="space-y-2">
            {outgoing.map((req) => (
              <Card key={req.id} variant="muted" padding="sm" className="opacity-70">
                <div className="flex items-center justify-between">
                  <span className="text-parchment" style={FONT_STYLES.labelSC}>{req.fromUsername}</span>
                  <span className="text-xs text-aged-gold italic">Pending...</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Friends list */}
      <div>
        <h2 className="text-xl text-blood-bright mb-3" style={FONT_STYLES.pirate}>Crew ({friends.length})</h2>
        {friends.length === 0 ? (
          <p className="text-parchment/40 italic" style={FONT_STYLES.body}>
            No friends yet. Send a request above to start yer crew.
          </p>
        ) : (
          <div className="space-y-2">
            {friends.map((friend) => (
              <Card key={friend.id} variant="glow" padding="sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${friend.online ? 'bg-[#2ecc71]' : 'bg-mahogany-light'}`} />
                    <span className="text-bone font-bold" style={FONT_STYLES.labelSC}>{friend.username}</span>
                    {friend.rating && (
                      <span className="text-xs text-gold" style={FONT_STYLES.pirate}>{friend.rating}</span>
                    )}
                  </div>
                  <button
                    onClick={() => removeFriend(friend.id, token)}
                    className="text-parchment/40 hover:text-blood-bright text-xs transition-colors"
                    style={FONT_STYLES.labelSC}
                  >
                    Remove
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}

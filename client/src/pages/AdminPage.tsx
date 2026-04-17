import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { FONT_STYLES } from '../styles/fonts';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { apiFetch } from '../services/apiClient';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/shadcn/dialog';
import { Input } from '../components/shadcn/input';

type AdminSection = 'users' | 'seasons' | 'tournaments' | 'telemetry';

const NAV_ITEMS: { id: AdminSection; label: string; icon: string }[] = [
  { id: 'users', label: 'Users', icon: '⚓' },
  { id: 'seasons', label: 'Seasons', icon: '🌊' },
  { id: 'tournaments', label: 'Tournaments', icon: '⚔️' },
  { id: 'telemetry', label: 'Telemetry', icon: '🔭' },
];

const STUB_DESCRIPTIONS: Record<Exclude<AdminSection, 'users'>, string> = {
  seasons: 'Create seasons, view standings, and manually close active seasons.',
  tournaments: 'Create tournaments, seed brackets, and advance rounds.',
  telemetry: 'View active players, games in progress, and recent match outcomes.',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: string;
  gold: number;
  bannedAt: string | null;
  createdAt: string;
}

interface AdminUserDetail extends AdminUser {
  mustChangePassword: boolean;
  stats: {
    rating: number;
    wins: number;
    losses: number;
    totalGamesAI: number;
    totalGamesMP: number;
    shotsFired: number;
    shotsHit: number;
    shipsSunk: number;
    shipsLost: number;
  } | null;
}

type DialogAction =
  | { type: 'reset-password'; userId: string; username: string }
  | { type: 'reset-stats'; userId: string; username: string }
  | { type: 'adjust-gold'; userId: string; username: string; currentGold: number }
  | { type: 'ban'; userId: string; username: string }
  | { type: 'unban'; userId: string; username: string };

// ─── ConfirmDialog ────────────────────────────────────────────────────────────

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
  danger,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  danger?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle style={FONT_STYLES.pirate}>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-parchment/80 text-sm py-2" style={FONT_STYLES.body}>{description}</p>
        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} size="sm" onClick={onConfirm}>
            {confirmLabel ?? 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── AdjustGoldDialog ─────────────────────────────────────────────────────────

function AdjustGoldDialog({
  open,
  username,
  currentGold,
  onConfirm,
  onClose,
}: {
  open: boolean;
  username: string;
  currentGold: number;
  onConfirm: (amount: number, type: 'delta' | 'absolute') => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'delta' | 'absolute'>('delta');

  const handleConfirm = () => {
    const n = parseInt(amount, 10);
    if (!isNaN(n)) onConfirm(n, type);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle style={FONT_STYLES.pirate}>Adjust Gold — {username}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex gap-2">
            <button
              onClick={() => setType('delta')}
              className={`flex-1 py-2 text-sm border rounded transition-colors ${
                type === 'delta'
                  ? 'bg-blood/30 border-blood-bright text-bone'
                  : 'border-mahogany text-parchment/60 hover:border-blood'
              }`}
              style={FONT_STYLES.body}
            >
              Delta (±)
            </button>
            <button
              onClick={() => setType('absolute')}
              className={`flex-1 py-2 text-sm border rounded transition-colors ${
                type === 'absolute'
                  ? 'bg-blood/30 border-blood-bright text-bone'
                  : 'border-mahogany text-parchment/60 hover:border-blood'
              }`}
              style={FONT_STYLES.body}
            >
              Set to
            </button>
          </div>
          <p className="text-parchment/60 text-xs" style={FONT_STYLES.body}>
            Current gold: {currentGold.toLocaleString()}
          </p>
          <Input
            type="number"
            placeholder={type === 'delta' ? 'e.g. -500 or +1000' : 'e.g. 2000'}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={handleConfirm} disabled={!amount || isNaN(parseInt(amount, 10))}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── TempPasswordDialog ───────────────────────────────────────────────────────

function TempPasswordDialog({
  open,
  tempPassword,
  onClose,
}: {
  open: boolean;
  tempPassword: string;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle style={FONT_STYLES.pirate}>Temporary Password</DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-2">
          <p className="text-parchment/70 text-sm" style={FONT_STYLES.body}>
            Share this password with the user. It will not be shown again.
          </p>
          <div className="bg-coal border border-blood/40 rounded px-4 py-3 font-mono text-bone text-center text-lg tracking-widest select-all">
            {tempPassword}
          </div>
        </div>
        <DialogFooter>
          <Button variant="primary" size="sm" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── UserDetailPanel ──────────────────────────────────────────────────────────

function UserDetailPanel({
  user,
  token,
  onAction,
  onClose,
}: {
  user: AdminUserDetail;
  token: string;
  onAction: () => void;
  onClose: () => void;
}) {
  const [pendingDialog, setPendingDialog] = useState<DialogAction | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async (action: DialogAction) => {
    setBusy(true);
    setError(null);
    try {
      if (action.type === 'reset-password') {
        const res = await apiFetch<{ tempPassword: string }>(`/admin/users/${action.userId}/reset-password`, {
          method: 'POST',
          token,
        });
        setTempPassword(res.tempPassword);
      } else if (action.type === 'reset-stats') {
        await apiFetch(`/admin/users/${action.userId}/reset-stats`, { method: 'POST', token });
        onAction();
      } else if (action.type === 'adjust-gold') {
        // should not reach here from confirm dialog directly
      } else if (action.type === 'ban') {
        await apiFetch(`/admin/users/${action.userId}/ban`, { method: 'POST', token });
        onAction();
      } else if (action.type === 'unban') {
        await apiFetch(`/admin/users/${action.userId}/unban`, { method: 'POST', token });
        onAction();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
      setPendingDialog(null);
    }
  };

  const handleAdjustGold = async (amount: number, type: 'delta' | 'absolute') => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/admin/users/${user.id}/adjust-gold`, {
        method: 'POST',
        token,
        json: { amount, type },
      });
      onAction();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
      setPendingDialog(null);
    }
  };

  const isBanned = !!user.bannedAt;
  const accuracy = user.stats && user.stats.shotsFired > 0
    ? ((user.stats.shotsHit / user.stats.shotsFired) * 100).toFixed(1)
    : '—';

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl text-gold" style={FONT_STYLES.pirate}>{user.username}</h3>
          <p className="text-parchment/50 text-xs" style={FONT_STYLES.body}>{user.email}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
      </div>

      {/* Status badges */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {user.role === 'admin' && (
          <span className="px-2 py-0.5 text-xs bg-blood/30 text-blood-bright border border-blood/60 rounded" style={FONT_STYLES.labelSC}>
            Admin
          </span>
        )}
        {isBanned && (
          <span className="px-2 py-0.5 text-xs bg-mahogany text-parchment border border-blood/40 rounded" style={FONT_STYLES.labelSC}>
            Banned
          </span>
        )}
        {user.mustChangePassword && (
          <span className="px-2 py-0.5 text-xs bg-coal text-parchment/60 border border-mahogany rounded" style={FONT_STYLES.labelSC}>
            Must Change Pwd
          </span>
        )}
      </div>

      {/* Stats */}
      {user.stats ? (
        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            ['Rating', user.stats.rating],
            ['W / L', `${user.stats.wins} / ${user.stats.losses}`],
            ['Gold', user.gold.toLocaleString()],
            ['Accuracy', `${accuracy}%`],
            ['MP Games', user.stats.totalGamesMP],
            ['AI Games', user.stats.totalGamesAI],
          ].map(([label, value]) => (
            <div key={String(label)} className="bg-coal/60 border border-mahogany/60 rounded px-3 py-2">
              <p className="text-parchment/40 text-xs" style={FONT_STYLES.labelSC}>{label}</p>
              <p className="text-bone text-sm" style={FONT_STYLES.body}>{value}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-parchment/40 text-sm mb-4" style={FONT_STYLES.body}>No stats yet.</p>
      )}

      {error && (
        <p className="text-blood-bright text-xs mb-3" style={FONT_STYLES.body}>{error}</p>
      )}

      {/* Actions */}
      <div className="space-y-2 mt-auto">
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          disabled={busy}
          onClick={() => setPendingDialog({ type: 'reset-password', userId: user.id, username: user.username })}
        >
          Reset Password
        </Button>
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          disabled={busy}
          onClick={() => setPendingDialog({ type: 'reset-stats', userId: user.id, username: user.username })}
        >
          Reset Stats
        </Button>
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          disabled={busy}
          onClick={() => setPendingDialog({ type: 'adjust-gold', userId: user.id, username: user.username, currentGold: user.gold })}
        >
          Adjust Gold
        </Button>
        <Button
          variant={isBanned ? 'secondary' : 'danger'}
          size="sm"
          fullWidth
          disabled={busy}
          onClick={() =>
            setPendingDialog(
              isBanned
                ? { type: 'unban', userId: user.id, username: user.username }
                : { type: 'ban', userId: user.id, username: user.username }
            )
          }
        >
          {isBanned ? 'Unban User' : 'Ban User'}
        </Button>
      </div>

      {/* Confirm dialogs */}
      {pendingDialog?.type === 'reset-password' && (
        <ConfirmDialog
          open
          title="Reset Password"
          description={`Generate a temporary password for "${pendingDialog.username}"? They will be required to change it on next login.`}
          confirmLabel="Reset"
          onConfirm={() => handleAction(pendingDialog)}
          onClose={() => setPendingDialog(null)}
        />
      )}
      {pendingDialog?.type === 'reset-stats' && (
        <ConfirmDialog
          open
          danger
          title="Reset Stats"
          description={`Zero out all stats and reset rating to 1200 for "${pendingDialog.username}"? This cannot be undone.`}
          confirmLabel="Reset Stats"
          onConfirm={() => handleAction(pendingDialog)}
          onClose={() => setPendingDialog(null)}
        />
      )}
      {pendingDialog?.type === 'adjust-gold' && (
        <AdjustGoldDialog
          open
          username={pendingDialog.username}
          currentGold={pendingDialog.currentGold}
          onConfirm={handleAdjustGold}
          onClose={() => setPendingDialog(null)}
        />
      )}
      {pendingDialog?.type === 'ban' && (
        <ConfirmDialog
          open
          danger
          title="Ban User"
          description={`Ban "${pendingDialog.username}"? They will not be able to log in.`}
          confirmLabel="Ban"
          onConfirm={() => handleAction(pendingDialog)}
          onClose={() => setPendingDialog(null)}
        />
      )}
      {pendingDialog?.type === 'unban' && (
        <ConfirmDialog
          open
          title="Unban User"
          description={`Restore access for "${pendingDialog.username}"?`}
          confirmLabel="Unban"
          onConfirm={() => handleAction(pendingDialog)}
          onClose={() => setPendingDialog(null)}
        />
      )}

      {tempPassword && (
        <TempPasswordDialog
          open
          tempPassword={tempPassword}
          onClose={() => setTempPassword(null)}
        />
      )}
    </div>
  );
}

// ─── UsersSection ─────────────────────────────────────────────────────────────

function UsersSection({ token }: { token: string }) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchUsers = useCallback(async (q: string, p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' });
      if (q) params.set('q', q);
      const res = await apiFetch<{ users: AdminUser[]; total: number; page: number }>(
        `/admin/users?${params}`,
        { token }
      );
      setUsers(res.users);
      setTotal(res.total);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUsers(query, page);
  }, [fetchUsers, query, page]);

  const handleSearch = (q: string) => {
    setQuery(q);
    setPage(1);
  };

  const loadDetail = async (userId: string) => {
    setDetailLoading(true);
    try {
      const user = await apiFetch<AdminUserDetail>(`/admin/users/${userId}`, { token });
      setSelectedUser(user);
    } catch {
      // ignore
    } finally {
      setDetailLoading(false);
    }
  };

  const handleActionDone = () => {
    fetchUsers(query, page);
    if (selectedUser) loadDetail(selectedUser.id);
  };

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="flex gap-4 h-full min-h-0">
      {/* User list */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="mb-3">
          <Input
            placeholder="Search by username or email…"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        <p className="text-parchment/40 text-xs mb-2" style={FONT_STYLES.labelSC}>
          {total} user{total !== 1 ? 's' : ''} found
        </p>

        {loading ? (
          <p className="text-parchment/40 text-sm py-4 text-center" style={FONT_STYLES.body}>Loading…</p>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-1">
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => loadDetail(u.id)}
                className={[
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded border text-left transition-colors',
                  selectedUser?.id === u.id
                    ? 'bg-blood/20 border-blood/60'
                    : 'bg-coal/40 border-mahogany/40 hover:bg-coal/70 hover:border-blood/40',
                ].join(' ')}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-bone text-sm truncate" style={FONT_STYLES.body}>{u.username}</p>
                  <p className="text-parchment/40 text-xs truncate">{u.email}</p>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-0.5">
                  <span className="text-gold text-xs" style={FONT_STYLES.labelSC}>{u.gold.toLocaleString()} g</span>
                  {u.bannedAt && (
                    <span className="text-blood-bright text-xs" style={FONT_STYLES.labelSC}>banned</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-mahogany/40">
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              ← Prev
            </Button>
            <span className="text-parchment/50 text-xs" style={FONT_STYLES.labelSC}>
              {page} / {totalPages}
            </span>
            <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              Next →
            </Button>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {(selectedUser || detailLoading) && (
        <div className="w-64 shrink-0 border-l border-blood/20 pl-4 overflow-y-auto">
          {detailLoading ? (
            <p className="text-parchment/40 text-sm py-8 text-center" style={FONT_STYLES.body}>Loading…</p>
          ) : selectedUser ? (
            <UserDetailPanel
              user={selectedUser}
              token={token}
              onAction={handleActionDone}
              onClose={() => setSelectedUser(null)}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

// ─── StubContent ──────────────────────────────────────────────────────────────

function StubContent({ section }: { section: Exclude<AdminSection, 'users'> }) {
  const item = NAV_ITEMS.find((n) => n.id === section)!;
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[320px] text-center gap-4">
      <div className="text-6xl">{item.icon}</div>
      <h2 className="text-3xl text-gold" style={FONT_STYLES.pirate}>{item.label}</h2>
      <p className="text-parchment/70 text-sm max-w-xs" style={FONT_STYLES.body}>
        {STUB_DESCRIPTIONS[section]}
      </p>
      <p className="text-blood/60 text-xs tracking-widest uppercase mt-2" style={FONT_STYLES.labelSC}>
        Coming soon
      </p>
    </div>
  );
}

// ─── AdminPage ────────────────────────────────────────────────────────────────

export function AdminPage() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const setScreen = useGameStore((s) => s.setScreen);
  const [activeSection, setActiveSection] = useState<AdminSection>('users');

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      setScreen('dashboard');
    }
  }, [user, setScreen]);

  if (!user || user.role !== 'admin') return null;

  return (
    <div
      className="w-full h-full flex bg-gradient-to-b from-pitch via-coal to-mahogany overflow-hidden"
      style={{ paddingTop: 60 }}
    >
      {/* Left sidebar */}
      <aside className="w-52 shrink-0 flex flex-col border-r border-blood/30 bg-pitch/60 overflow-y-auto">
        <div className="px-4 py-5 border-b border-blood/30">
          <p className="text-xs tracking-widest uppercase text-blood/60" style={FONT_STYLES.labelSC}>
            Admin Panel
          </p>
          <h1 className="text-xl text-gold mt-1" style={FONT_STYLES.pirate}>
            Command Deck
          </h1>
        </div>

        <nav className="flex-1 py-3">
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={[
                  'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                  isActive
                    ? 'bg-blood/20 border-r-2 border-blood-bright text-bone'
                    : 'text-parchment/60 hover:bg-coal/60 hover:text-parchment',
                ].join(' ')}
                style={FONT_STYLES.body}
              >
                <span className="text-lg leading-none">{item.icon}</span>
                <span className="text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-blood/30">
          <Button
            variant="ghost"
            size="sm"
            fullWidth
            onClick={() => setScreen('dashboard')}
          >
            ← Back
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto px-8 py-6 flex flex-col min-h-0">
        <div className="mb-6 flex items-center gap-3">
          <span className="text-3xl">
            {NAV_ITEMS.find((n) => n.id === activeSection)?.icon}
          </span>
          <div>
            <h2
              className="text-3xl text-blood-bright"
              style={{
                ...FONT_STYLES.pirate,
                textShadow: '0 0 16px rgba(196, 30, 58, 0.4)',
              }}
            >
              {NAV_ITEMS.find((n) => n.id === activeSection)?.label}
            </h2>
            <p className="text-parchment/50 text-xs tracking-widest uppercase mt-0.5" style={FONT_STYLES.labelSC}>
              Admin › {NAV_ITEMS.find((n) => n.id === activeSection)?.label}
            </p>
          </div>
        </div>

        <Card variant="default" padding="lg" className="flex-1 overflow-hidden flex flex-col">
          {activeSection === 'users' ? (
            token ? (
              <UsersSection token={token} />
            ) : null
          ) : (
            <StubContent section={activeSection} />
          )}
        </Card>
      </main>
    </div>
  );
}

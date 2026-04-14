import { useEffect, useState } from 'react';
import { useCosmeticsStore } from '../store/cosmeticsStore';
import { useAuthStore } from '../store/authStore';
import { COSMETIC_CATALOG } from '@shared/index';
import type { CosmeticKind, CosmeticDef } from '@shared/index';
import { FONT_STYLES } from '../styles/fonts';
import { Button } from '../components/ui/Button';
import { PageShell } from '../components/ui/PageShell';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';

const TABS: { kind: CosmeticKind; label: string }[] = [
  { kind: 'ship_skin', label: 'Ships' },
  { kind: 'board_theme', label: 'Boards' },
  { kind: 'explosion_fx', label: 'Effects' },
];

const RARITY_COLOR: Record<string, string> = {
  common: '#a06820',
  rare: '#b87333',
  legendary: '#d4a040',
};

export function Shop() {
  const token = useAuthStore((s) => s.token);
  const gold = useCosmeticsStore((s) => s.gold);
  const owned = useCosmeticsStore((s) => s.owned);
  const equipped = useCosmeticsStore((s) => s.equipped);
  const buy = useCosmeticsStore((s) => s.buy);
  const equip = useCosmeticsStore((s) => s.equip);
  const loadFromServer = useCosmeticsStore((s) => s.loadFromServer);
  const loadFromStorage = useCosmeticsStore((s) => s.loadFromStorage);

  const [tab, setTab] = useState<CosmeticKind>('ship_skin');
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    loadFromStorage();
    if (token) loadFromServer(token);
  }, [token, loadFromServer, loadFromStorage]);

  const visible = COSMETIC_CATALOG.filter((c) => c.kind === tab);
  const equippedId =
    tab === 'ship_skin' ? equipped.shipSkin : tab === 'board_theme' ? equipped.boardTheme : equipped.explosionFx;

  const handleBuy = async (def: CosmeticDef) => {
    setFeedback(null);
    const result = await buy(def.id, def.price, token);
    if (result === 'ok') setFeedback(`Purchased ${def.name}!`);
    else if (result === 'insufficient') setFeedback('Not enough gold');
    else if (result === 'owned') setFeedback('Already owned');
    else setFeedback('Purchase failed');
  };

  const handleEquip = (def: CosmeticDef) => {
    equip(def.id, def.kind, token);
    setFeedback(`Equipped ${def.name}`);
  };

  return (
    <PageShell maxWidth="5xl">
      <PageHeader
        title="Ye Olde Shoppe"
        subtitle="Customize yer fleet with hard-earned gold"
      />

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {TABS.map((t) => (
          <Button
            key={t.kind}
            variant={tab === t.kind ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setTab(t.kind)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {feedback && (
        <div className="mb-4 text-gold italic" style={FONT_STYLES.body}>
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visible.map((def) => {
          const isOwned = owned.has(def.id) || def.price === 0;
          const isEquipped = equippedId === def.id;
          const canAfford = gold >= def.price;
          return (
            <Card
              key={def.id}
              variant={isEquipped ? 'active' : 'glow'}
              padding="md"
            >
              <div
                className="w-full h-24 rounded-lg mb-3 flex items-center justify-center border border-mahogany-light"
                style={{
                  background: `linear-gradient(135deg, ${def.previewColor}, #150c0c)`,
                  boxShadow: `inset 0 0 20px ${def.previewColor}40`,
                }}
              >
                <span className="text-bone/80 text-4xl" style={FONT_STYLES.pirate}>
                  {def.kind === 'ship_skin' ? '⚓' : def.kind === 'board_theme' ? '🌊' : '💥'}
                </span>
              </div>
              <div className="flex items-baseline justify-between mb-1">
                <h3 className="text-lg text-bone font-bold" style={FONT_STYLES.pirate}>
                  {def.name}
                </h3>
                <span
                  className="text-xs uppercase tracking-wider"
                  style={{ ...FONT_STYLES.labelSC, color: RARITY_COLOR[def.rarity] }}
                >
                  {def.rarity}
                </span>
              </div>
              <p
                className="text-xs text-parchment/70 italic mb-3 min-h-[32px]"
                style={FONT_STYLES.body}
              >
                {def.description}
              </p>
              {isEquipped ? (
                <Button variant="secondary" size="sm" fullWidth disabled>
                  Equipped
                </Button>
              ) : isOwned ? (
                <Button variant="pill" size="sm" fullWidth onClick={() => handleEquip(def)}>
                  Equip
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  fullWidth
                  disabled={!canAfford}
                  onClick={() => handleBuy(def)}
                >
                  {def.price} ⛃ {canAfford ? '' : '(insufficient)'}
                </Button>
              )}
            </Card>
          );
        })}
      </div>
    </PageShell>
  );
}

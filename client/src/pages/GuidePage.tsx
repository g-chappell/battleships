import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { PageShell } from '../components/ui/PageShell';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { AuthPage } from './AuthPage';
import { FONT_STYLES } from '../styles/fonts';

const LOCK_BADGE = (
  <span
    className="text-[10px] bg-blood/40 text-gold px-2 py-0.5 rounded-full ml-2 align-middle"
    style={FONT_STYLES.labelSC}
  >
    Requires Account
  </span>
);

interface GuideSection {
  title: string;
  description: string;
  requiresAuth?: boolean;
}

const SECTIONS: GuideSection[] = [
  {
    title: 'AI Battles',
    description:
      'Test yer mettle against three AI difficulty levels — Easy, Medium, and Hard. Choose yer Captain before each battle, each with a unique loadout of three abilities.',
  },
  {
    title: 'Ship Traits',
    description:
      'Every ship carries a passive trait that fires automatically in battle. Carrier — Spotter: on every hit, reveals a random enemy cell. Battleship — Ironclad: the first hit is deflected, the cell stays targetable for a follow-up shot. Cruiser — Kraken Ward: Summon Kraken can never target the Cruiser, even if she is the last ship afloat. Destroyer — Depth Charge: the first hit triggers six random retaliatory shots on the attacker\'s board. Submarine — Silent Running: invisible to Sonar Ping\'s precise reveal; an attacker only sees a coarse "something nearby" signal.',
  },
  {
    title: 'Coastal Cover',
    description:
      'Any ship placed with at least one cell adjacent to a land tile gains Coastal Cover — one free deflect on its first hit, signalling the presence of the ship without letting the shot land. Coastal Cover and Ironclad do NOT stack; a Battleship placed near land trades its armor for coastal protection. Place strategically: Ironclad likes open water, other ships welcome the shoals.',
  },
  {
    title: 'Captains & Abilities',
    description:
      'Four captains await yer command. Ironbeard brings firepower with Cannon Barrage, Chain Shot, and Boarding Party. Mistral is a phantom of recon with Sonar Ping, Spyglass, and Smoke Screen. Blackheart endures with Repair Kit, Cannon Barrage, and Sonar Ping. Seawitch Morgana, Keeper of the Deep, commands Summon Kraken (ritual: forfeit 2 turns, then sink a random enemy ship — but never the Cruiser), Sonar Ping, and Smoke Screen.',
  },
  {
    title: 'Multiplayer',
    description:
      'Battle other captains in real-time. Queue for ranked matchmaking or create a private room with an invite code. Chat with yer opponent and request rematches.',
  },
  {
    title: 'Campaign',
    description:
      'Embark on fifteen high-seas missions with escalating difficulty. Each mission features unique objectives, star ratings, and comic-panel storytelling. Earn gold and unlock the next chapter.',
    requiresAuth: true,
  },
  {
    title: 'Tournaments',
    description:
      'Compete in bracket-style tournaments against other captains. Prove yer worth and climb the rankings for glory and gold rewards.',
    requiresAuth: true,
  },
  {
    title: 'Clans',
    description:
      'Form a crew with other captains. Create or join a clan, chat with yer mates, and track collective victories on the clan leaderboard.',
    requiresAuth: true,
  },
  {
    title: 'Shop & Cosmetics',
    description:
      'Spend yer hard-earned gold on ship skins, board themes, and explosion effects. From the pitch-black Blackbeard\'s Fury to the spectral Ghost Fleet — customize yer fleet.',
    requiresAuth: true,
  },
  {
    title: 'Leaderboard & Rankings',
    description:
      'An ELO-based ranking system tracks the fiercest captains on the seas. Climb the seasonal and lifetime leaderboards through ranked multiplayer victories.',
    requiresAuth: true,
  },
  {
    title: 'Friends',
    description:
      'Add friends, see who is online, and challenge them to private matches. Build yer network of rival captains.',
    requiresAuth: true,
  },
];

export function GuidePage() {
  const user = useAuthStore((s) => s.user);
  const setScreen = useGameStore((s) => s.setScreen);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');

  return (
    <PageShell maxWidth="3xl">
      <PageHeader title="Captain's Guide" subtitle="Everything ye need to know" />

      <div className="space-y-4 mb-12">
        {SECTIONS.map((section) => (
          <Card key={section.title} variant="default" padding="md">
            <h3 className="text-xl text-blood-bright mb-2" style={FONT_STYLES.pirate}>
              {section.title}
              {section.requiresAuth && LOCK_BADGE}
            </h3>
            <p className="text-parchment/70 text-sm leading-relaxed" style={FONT_STYLES.body}>
              {section.description}
            </p>
          </Card>
        ))}
      </div>

      {/* Guest CTA */}
      {!user && (
        <div className="bg-coal/80 border-2 border-blood rounded-lg p-8 text-center mb-8">
          <h2 className="text-2xl text-blood-bright mb-3" style={FONT_STYLES.pirate}>
            Ready to Unlock the Full Experience?
          </h2>
          <p className="text-parchment/60 text-sm mb-6 max-w-md mx-auto" style={FONT_STYLES.body}>
            Register a free account to access Campaign, Tournaments, Clans, the Shop, and more.
            Yer progress, gold, and cosmetics will be saved across sessions.
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              variant="primary"
              size="lg"
              onClick={() => { setAuthMode('register'); setShowAuth(true); }}
            >
              Join the Crew
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => { setAuthMode('login'); setShowAuth(true); }}
            >
              Sign In
            </Button>
          </div>
        </div>
      )}

      <div className="text-center">
        <Button variant="ghost" size="sm" onClick={() => setScreen('menu')}>
          ← Back to Menu
        </Button>
      </div>

      {showAuth && <AuthPage onClose={() => setShowAuth(false)} initialMode={authMode} />}
    </PageShell>
  );
}

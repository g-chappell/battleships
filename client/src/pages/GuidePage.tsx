import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { PageShell } from '../components/ui/PageShell';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { AuthPage } from './AuthPage';
import { ShipShowcase } from '../components/three/ShipShowcase';
import { FONT_STYLES } from '../styles/fonts';

const LOCK_BADGE = (
  <span
    className="text-[10px] bg-blood/40 text-gold px-2 py-0.5 rounded-full ml-2 align-middle"
    style={FONT_STYLES.labelSC}
  >
    Requires Account
  </span>
);

function SectionDivider({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="flex items-center gap-3 my-6">
      <div className="flex-1 h-px bg-blood/30" />
      <span className="text-blood-bright text-sm tracking-widest uppercase flex items-center gap-1.5" style={FONT_STYLES.labelSC}>
        <span>{icon}</span>
        <span>{title}</span>
      </span>
      <div className="flex-1 h-px bg-blood/30" />
    </div>
  );
}

function DiagramImage({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  return (
    <div className="my-4">
      <img
        src={src}
        alt={alt}
        className="w-full rounded-lg border border-blood/20 max-w-xl mx-auto block"
        loading="lazy"
      />
      {caption && (
        <p className="text-center text-parchment/40 text-xs mt-1" style={FONT_STYLES.body}>
          {caption}
        </p>
      )}
    </div>
  );
}

function ScreenshotImage({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  return (
    <div className="my-4">
      <img
        src={src}
        alt={alt}
        className="w-full rounded-lg border border-mahogany/60 shadow-lg max-w-lg mx-auto block"
        loading="lazy"
      />
      {caption && (
        <p className="text-center text-parchment/40 text-xs mt-1 italic" style={FONT_STYLES.body}>
          {caption}
        </p>
      )}
    </div>
  );
}

function AbilityClipCard({ name, description, icon }: { name: string; description: string; icon: string }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-coal/60 rounded-lg border border-mahogany/40">
      <span className="text-2xl flex-shrink-0 mt-0.5">{icon}</span>
      <div>
        <p className="text-gold text-sm font-semibold" style={FONT_STYLES.pirate}>{name}</p>
        <p className="text-parchment/60 text-xs mt-0.5 leading-relaxed" style={FONT_STYLES.body}>{description}</p>
      </div>
    </div>
  );
}

const SHIP_TABLE = [
  { type: 'Carrier',    size: 5, color: '#9a6d40', trait: 'Spotter',      traitDesc: 'Reveals a random cell on each hit' },
  { type: 'Battleship', size: 4, color: '#6e7d92', trait: 'Ironclad',     traitDesc: 'Negates the very first hit received' },
  { type: 'Cruiser',    size: 3, color: '#bb7a52', trait: 'Kraken Ward',  traitDesc: 'Cannot be targeted by Summon Kraken' },
  { type: 'Submarine',  size: 3, color: '#4a5a68', trait: 'Silent Running', traitDesc: 'Hidden from Sonar Ping precise reveal' },
  { type: 'Destroyer',  size: 2, color: '#8a6a42', trait: 'Depth Charge', traitDesc: 'Returns 6 retaliatory shots on first hit' },
];

export function GuidePage() {
  const user = useAuthStore((s) => s.user);
  const setScreen = useGameStore((s) => s.setScreen);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');

  return (
    <PageShell maxWidth="3xl">
      <PageHeader title="Captain's Guide" subtitle="Everything ye need to know" />

      {/* ── Intro: R3F Ship Showcase ─────────────────────────────────── */}
      <Card variant="default" padding="md" className="mb-6">
        <ShipShowcase />
        <p className="text-parchment/60 text-sm text-center mt-3" style={FONT_STYLES.body}>
          Ironclad Waters is a 3D pirate battleships game — turn-based naval combat with abilities,
          ship traits, and a fifteen-mission campaign. Choose yer captain and set sail.
        </p>
      </Card>

      {/* ══════════════════════════════════════════════════════════════ */}
      <SectionDivider title="Basics" icon="⚓" />

      <Card variant="default" padding="md" className="mb-4">
        <h3 className="text-xl text-blood-bright mb-2 text-center" style={FONT_STYLES.pirate}>How to Play</h3>
        <p className="text-parchment/70 text-sm leading-relaxed text-left mb-3" style={FONT_STYLES.body}>
          Each captain commands a fleet of five ships hidden on a 10×10 grid. Take turns firing at
          each other's grid — a hit earns a follow-up shot, a miss passes the turn. The first captain
          to sink all five enemy ships wins.
        </p>
        <DiagramImage
          src="/guide/diagrams/turn-flow.svg"
          alt="Turn flow diagram"
          caption="Hits keep the turn, misses switch it"
        />
        <p className="text-parchment/70 text-sm leading-relaxed text-left" style={FONT_STYLES.body}>
          Ships can be placed horizontally or vertically during the placement phase. Drag or click to
          position them, then press <em className="text-gold">Ready for Battle</em> to begin.
        </p>
        <ScreenshotImage
          src="/guide/screenshots/placement.svg"
          alt="Ship placement screen"
          caption="Place yer fleet before battle begins"
        />
      </Card>

      <Card variant="default" padding="md" className="mb-4">
        <h3 className="text-xl text-blood-bright mb-3 text-center" style={FONT_STYLES.pirate}>Your Fleet</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={FONT_STYLES.body}>
            <thead>
              <tr className="border-b border-blood/30">
                <th className="text-left text-gold/80 py-2 pr-4">Ship</th>
                <th className="text-center text-gold/80 py-2 pr-4">Size</th>
                <th className="text-left text-gold/80 py-2 pr-4">Passive Trait</th>
                <th className="text-left text-gold/80 py-2">Effect</th>
              </tr>
            </thead>
            <tbody>
              {SHIP_TABLE.map((ship) => (
                <tr key={ship.type} className="border-b border-mahogany/20">
                  <td className="py-2 pr-4 font-semibold" style={{ color: ship.color }}>{ship.type}</td>
                  <td className="py-2 pr-4 text-center text-parchment/60">
                    {'■'.repeat(ship.size)}
                  </td>
                  <td className="py-2 pr-4 text-parchment/80">{ship.trait}</td>
                  <td className="py-2 text-parchment/50 text-xs">{ship.traitDesc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card variant="default" padding="md" className="mb-4">
        <h3 className="text-xl text-blood-bright mb-2 text-center" style={FONT_STYLES.pirate}>Coastal Cover</h3>
        <p className="text-parchment/70 text-sm leading-relaxed text-left" style={FONT_STYLES.body}>
          Any ship placed adjacent to a land tile gains <em className="text-gold">Coastal Cover</em> — a
          free deflect on its first hit. The attacker learns the ship is nearby, but no damage is dealt.
          Coastal Cover and Ironclad do not stack: a Battleship placed near land trades its armor for
          coastal protection instead. Place strategically — Ironclad prefers open water.
        </p>
      </Card>

      {/* ══════════════════════════════════════════════════════════════ */}
      <SectionDivider title="Abilities" icon="⚡" />

      <Card variant="default" padding="md" className="mb-4">
        <h3 className="text-xl text-blood-bright mb-3 text-center" style={FONT_STYLES.pirate}>Captains & Loadouts</h3>
        <p className="text-parchment/70 text-sm leading-relaxed text-left mb-4" style={FONT_STYLES.body}>
          Choose yer captain before each battle. Missions may lock a specific captain or forbid certain
          abilities — check the pre-mission briefing for constraints.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { name: 'Ironbeard', color: '#c41e3a', title: 'The Iron Cannon', abilities: 'Cannon Barrage · Chain Shot · Boarding Party', desc: 'Relentless firepower — built for swift decisive victories.' },
            { name: 'Mistral',   color: '#4a9ad4', title: 'The Ghost Captain', abilities: 'Sonar Ping · Spyglass · Smoke Screen',         desc: 'Recon and misdirection — know the sea before firing.' },
            { name: 'Blackheart',color: '#8a4a9a', title: 'The Survivor',      abilities: 'Repair Kit · Cannon Barrage · Sonar Ping',    desc: 'Endurance and information — outlast every storm.' },
            { name: 'Seawitch',  color: '#2a8a6a', title: 'Keeper of the Deep', abilities: 'Summon Kraken · Sonar Ping · Smoke Screen',  desc: 'Ritual power — sacrifice turns to call the deep.' },
          ].map((cap) => (
            <div key={cap.name} className="p-3 bg-coal/60 rounded-lg border border-mahogany/40">
              <p className="text-sm font-bold mb-0.5" style={{ color: cap.color, ...FONT_STYLES.pirate }}>{cap.name}</p>
              <p className="text-gold/60 text-xs italic mb-1" style={FONT_STYLES.body}>{cap.title}</p>
              <p className="text-parchment/80 text-xs mb-1" style={FONT_STYLES.labelSC}>{cap.abilities}</p>
              <p className="text-parchment/50 text-xs leading-relaxed" style={FONT_STYLES.body}>{cap.desc}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card variant="default" padding="md" className="mb-4">
        <h3 className="text-xl text-blood-bright mb-2 text-center" style={FONT_STYLES.pirate}>Ability Reference</h3>
        <p className="text-parchment/70 text-sm leading-relaxed text-left mb-3" style={FONT_STYLES.body}>
          Select two abilities before each battle (unless the mission pre-assigns them). Each ability
          has a cooldown in turns and a maximum number of uses per match.
        </p>
        <DiagramImage
          src="/guide/diagrams/ability-ranges.svg"
          alt="Ability range reference"
          caption="Area of effect for each ability"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
          <AbilityClipCard icon="💥" name="Cannon Barrage" description="Fire three shots in a row on the enemy board. Cooldown: 3 turns · Uses: 3." />
          <AbilityClipCard icon="⛓" name="Chain Shot" description="Fire one cell; if it hits, chain to a random adjacent cell for free. Cooldown: 2 turns · Uses: 3." />
          <AbilityClipCard icon="🔭" name="Sonar Ping" description="Reveal the centre cell and all 4 adjacent cells (Submarine shows only a vague signal). Cooldown: 2 · Uses: unlimited." />
          <AbilityClipCard icon="💨" name="Smoke Screen" description="Cloak a 2×2 area — enemy shots into the fog miss automatically for 2 turns. Cooldown: 3 · Uses: 2." />
          <AbilityClipCard icon="🔬" name="Spyglass" description="Reveal a 3-cell column or row of yer choosing. Cooldown: 3 · Uses: 2." />
          <AbilityClipCard icon="🛠" name="Repair Kit" description="Undo one hit on yer own fleet, restoring the cell to undamaged. Cooldown: 4 · Uses: 1." />
          <AbilityClipCard icon="🐙" name="Summon Kraken" description="Ritual: forfeit 2 consecutive turns, then the Kraken sinks a random enemy ship. Cannot target the Cruiser. Uses: 1." />
          <AbilityClipCard icon="🗡" name="Boarding Party" description="Reveal the exact cells of one enemy ship chosen by type. Cooldown: 4 · Uses: 1." />
        </div>
      </Card>

      {/* ══════════════════════════════════════════════════════════════ */}
      <SectionDivider title="Traits" icon="⚜" />

      <Card variant="default" padding="md" className="mb-4">
        <h3 className="text-xl text-blood-bright mb-2 text-center" style={FONT_STYLES.pirate}>Passive Ship Traits</h3>
        <p className="text-parchment/70 text-sm leading-relaxed text-left mb-3" style={FONT_STYLES.body}>
          Every ship carries a passive trait that fires automatically — no activation required. Traits
          fire at most once per match (except Spotter, which triggers on every hit).
        </p>
        <DiagramImage
          src="/guide/diagrams/trait-effects.svg"
          alt="Ship trait reference"
          caption="Each ship's passive trait and its effect"
        />
        <p className="text-parchment/60 text-xs leading-relaxed text-left mt-2" style={FONT_STYLES.body}>
          <em className="text-gold">Tip:</em> Ironclad is wasted near land — if ye place the Battleship
          adjacent to a coastal tile, it receives Coastal Cover instead. Save Ironclad for open-water
          ambush setups.
        </p>
      </Card>

      {/* ══════════════════════════════════════════════════════════════ */}
      <SectionDivider title="Campaign" icon="★" />

      <Card variant="default" padding="md" className="mb-4">
        <h3 className="text-xl text-blood-bright mb-2 text-center" style={FONT_STYLES.pirate}>
          Fifteen Missions, Three Acts
          {LOCK_BADGE}
        </h3>
        <p className="text-parchment/70 text-sm leading-relaxed text-left mb-3" style={FONT_STYLES.body}>
          The campaign follows three captains across escalating seas. Act I (missions 1–5) follows
          Ironbeard through his iron-fisted conquest. Act II (6–10) shadows Mistral through fog and
          deception. Act III (11–15) tracks Blackheart across the final, deadly straits.
        </p>
        <ScreenshotImage
          src="/guide/screenshots/campaign-map.svg"
          alt="Campaign map with 15 missions"
          caption="The Campaign Chart — unlock missions in sequence"
        />
        <p className="text-parchment/70 text-sm leading-relaxed text-left" style={FONT_STYLES.body}>
          Each mission may lock a specific captain, forbid certain abilities, or add modifiers like
          limited turns, Kraken patrols, or restricted placement zones.
        </p>
      </Card>

      <Card variant="default" padding="md" className="mb-4">
        <h3 className="text-xl text-blood-bright mb-2 text-center" style={FONT_STYLES.pirate}>Star Objectives</h3>
        <p className="text-parchment/70 text-sm leading-relaxed text-left mb-2" style={FONT_STYLES.body}>
          Every mission awards up to three stars based on how well ye completed optional objectives.
          Stars unlock bonus gold, cosmetics, and story beats.
        </p>
        <div className="grid grid-cols-3 gap-2 text-center mt-3">
          {[
            { star: '🥉 Bronze', color: '#b87333', desc: 'Meet the primary win condition' },
            { star: '🥈 Silver', color: '#e8dcc8', desc: 'Win under a stricter constraint' },
            { star: '🥇 Gold',   color: '#d4a040', desc: 'Master the mission entirely' },
          ].map((tier) => (
            <div key={tier.star} className="p-3 bg-coal/50 rounded-lg border border-mahogany/30">
              <p className="text-sm font-bold" style={{ color: tier.color, ...FONT_STYLES.pirate }}>{tier.star}</p>
              <p className="text-parchment/50 text-xs mt-1 leading-relaxed" style={FONT_STYLES.body}>{tier.desc}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* ══════════════════════════════════════════════════════════════ */}
      <SectionDivider title="Multiplayer" icon="⚔" />

      <Card variant="default" padding="md" className="mb-4">
        <h3 className="text-xl text-blood-bright mb-2 text-center" style={FONT_STYLES.pirate}>Ranked Matchmaking</h3>
        <p className="text-parchment/70 text-sm leading-relaxed text-left" style={FONT_STYLES.body}>
          Queue for ranked matchmaking to face captains near yer ELO rating. Wins raise yer rating,
          losses lower it. Compete on the seasonal and lifetime leaderboards.
          Create a private room with an invite code to challenge a specific captain.
          After a match, request a rematch — yer opponent gets a notification and can accept.
        </p>
      </Card>

      <Card variant="default" padding="md" className="mb-4">
        <h3 className="text-xl text-blood-bright mb-2 text-center" style={FONT_STYLES.pirate}>
          Tournaments
          {LOCK_BADGE}
        </h3>
        <p className="text-parchment/70 text-sm leading-relaxed text-left" style={FONT_STYLES.body}>
          Compete in single-elimination brackets with 4, 8, or 16 captains. Join an open tournament
          from the Tournaments page. Rounds are released by the admin once all current-round matches
          are complete. Finals winners earn the largest gold purses.
        </p>
      </Card>

      {/* ══════════════════════════════════════════════════════════════ */}
      <SectionDivider title="Achievements" icon="🏆" />

      <Card variant="default" padding="md" className="mb-4">
        <h3 className="text-xl text-blood-bright mb-2 text-center" style={FONT_STYLES.pirate}>
          20+ Achievements
          {LOCK_BADGE}
        </h3>
        <p className="text-parchment/70 text-sm leading-relaxed text-left mb-3" style={FONT_STYLES.body}>
          Achievements unlock automatically as ye play and are stored on yer profile. Browse yer
          unlocked achievements in the Dashboard under the Achievements tab.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs" style={FONT_STYLES.body}>
          {[
            { cat: 'Combat',      icon: '⚔', desc: 'Accuracy, ability use, and killing blows' },
            { cat: 'Campaign',    icon: '★', desc: 'Complete missions and earn gold stars' },
            { cat: 'Social',      icon: '🤝', desc: 'Clans, friends, and tournaments' },
            { cat: 'Exploration', icon: '🗺', desc: 'Try every captain, ability, and ship skin' },
            { cat: 'Persistence', icon: '⚓', desc: 'Play streaks and ranked milestones' },
            { cat: 'Hidden',      icon: '?', desc: 'Secret feats — find them yerself' },
          ].map((cat) => (
            <div key={cat.cat} className="p-2 bg-coal/50 rounded border border-mahogany/30">
              <p className="text-gold text-sm">{cat.icon} <strong>{cat.cat}</strong></p>
              <p className="text-parchment/50 mt-0.5 leading-relaxed">{cat.desc}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* ══════════════════════════════════════════════════════════════ */}
      <SectionDivider title="Social & Progression" icon="⚓" />

      {[
        {
          title: 'Clans',
          lock: true,
          body: 'Form a crew with other captains. Create or join a clan, chat with yer mates in the clan channel, and track collective victories on the clan leaderboard.',
        },
        {
          title: 'Friends',
          lock: false,
          body: 'Add friends, see who is online, and challenge them to private matches. Build yer network of rival captains across the seas.',
        },
        {
          title: 'Shop & Cosmetics',
          lock: true,
          body: "Spend hard-earned gold on ship skins, board themes, and explosion effects. From Blackbeard's Fury to the spectral Ghost Fleet — customize yer fleet.",
        },
        {
          title: 'Leaderboard & Rankings',
          lock: false,
          body: 'An ELO-based ranking system tracks the fiercest captains. Climb seasonal and lifetime leaderboards through ranked multiplayer victories.',
        },
      ].map((section) => (
        <Card key={section.title} variant="default" padding="md" className="mb-4">
          <h3 className="text-xl text-blood-bright mb-2 text-center" style={FONT_STYLES.pirate}>
            {section.title}
            {section.lock && LOCK_BADGE}
          </h3>
          <p className="text-parchment/70 text-sm leading-relaxed text-left" style={FONT_STYLES.body}>
            {section.body}
          </p>
        </Card>
      ))}

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
            <Button variant="primary" size="lg" onClick={() => { setAuthMode('register'); setShowAuth(true); }}>
              Join the Crew
            </Button>
            <Button variant="secondary" size="md" onClick={() => { setAuthMode('login'); setShowAuth(true); }}>
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

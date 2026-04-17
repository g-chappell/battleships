/**
 * Campaign mission definitions: 15 missions across three captain-driven acts.
 *
 * Act I  (1–5):  The Iron Tide     — Ironbeard's ruthless rise
 * Act II (6–10): The Phantom Straits — Mistral's cunning passage
 * Act III (11–15): The Undying Flame — Blackheart's final reckoning
 */

import { AbilityType } from './abilities';

export type AIPersonality = 'standard' | 'aggressive' | 'cautious' | 'kraken';

export type DifficultyLabel =
  | 'Calm Waters'
  | 'Rough Seas'
  | 'Storm Warning'
  | 'Kraken Waters'
  | 'No Mercy';

export interface ComicPanel {
  background: string;   // tailwind/css gradient class
  caption: string;
  speaker?: string;
  iconHint?: string;    // emoji
}

export interface MissionModifiers {
  foggyVision?: boolean;
  krakenAttack?: boolean;
  fixedAbilities?: AbilityType[];
}

export interface MissionStarRequirements {
  twoStars: { maxTurns?: number; minAccuracyPct?: number };
  threeStars: { maxTurns?: number; minAccuracyPct?: number; noShipsLost?: boolean };
}

export interface CampaignMission {
  id: number;
  title: string;
  subtitle: string;
  difficultyLabel: DifficultyLabel;
  introPanels: ComicPanel[];
  outroPanels: ComicPanel[];
  difficulty: 'easy' | 'medium' | 'hard';
  aiPersonality: AIPersonality;
  modifiers: MissionModifiers;
  starRequirements: MissionStarRequirements;
}

const RED_GRAD   = 'bg-gradient-to-br from-[#5c0000] to-[#1a0a0a]';
const SEA_GRAD   = 'bg-gradient-to-br from-[#1a0a0a] to-[#0d0606]';
const GOLD_GRAD  = 'bg-gradient-to-br from-[#3d1f17] to-[#2a1410]';
const NIGHT_GRAD = 'bg-gradient-to-br from-[#0d0606] to-[#1a0a0a]';
const STORM_GRAD = 'bg-gradient-to-br from-[#1a0d0a] to-[#0a0a1a]';

// ─────────────────────────────────────────────────────────
// ACT I — THE IRON TIDE (Ironbeard, Missions 1–5)
// ─────────────────────────────────────────────────────────

export const CAMPAIGN_MISSIONS: CampaignMission[] = [
  {
    id: 1,
    title: 'Blood at Dawn',
    subtitle: "A captain's first kill",
    difficultyLabel: 'Calm Waters',
    introPanels: [
      {
        background: SEA_GRAD,
        speaker: 'Quartermaster Bones',
        caption:
          "Cap'n Ironbeard. A Royal Navy cutter crosses our bow at first light. Small. Arrogant. Perfect for a first lesson in what iron and fire can do.",
        iconHint: '⚓',
      },
      {
        background: GOLD_GRAD,
        caption:
          "Place yer ships. Signal when ready. The sea gives no quarter to the hesitant.",
        iconHint: '🗡️',
      },
    ],
    outroPanels: [
      {
        background: RED_GRAD,
        speaker: 'Ironbeard',
        caption:
          "First blood. The crew's eyes shine with something new — faith in their captain. We sail on.",
        iconHint: '🏴‍☠️',
      },
    ],
    difficulty: 'easy',
    aiPersonality: 'standard',
    modifiers: {},
    starRequirements: {
      twoStars:   { maxTurns: 35 },
      threeStars: { maxTurns: 25, noShipsLost: true },
    },
  },

  {
    id: 2,
    title: "The Cannon's Roar",
    subtitle: 'Raining fire on the arrogant',
    difficultyLabel: 'Calm Waters',
    introPanels: [
      {
        background: GOLD_GRAD,
        speaker: 'Ironbeard',
        caption:
          "We salvaged something magnificent from that cutter — a Cannon Barrage blueprint. Fires a 2×2 area at once. Let's try it on this merchant frigate.",
        iconHint: '💣',
      },
      {
        background: SEA_GRAD,
        caption:
          'A fat merchant sails heavy with Royal Navy supplies. Sink her and take the haul.',
        iconHint: '⛵',
      },
    ],
    outroPanels: [
      {
        background: RED_GRAD,
        speaker: 'Quartermaster Bones',
        caption:
          "Ha! Cannon Barrage makes short work of clustered hulls. Crates of Navy gold now fill our hold.",
        iconHint: '💥',
      },
    ],
    difficulty: 'easy',
    aiPersonality: 'standard',
    modifiers: { fixedAbilities: [AbilityType.CannonBarrage, AbilityType.RepairKit] },
    starRequirements: {
      twoStars:   { maxTurns: 32 },
      threeStars: { maxTurns: 22 },
    },
  },

  {
    id: 3,
    title: 'Whispers from the Deep',
    subtitle: 'Sonar and shadow',
    difficultyLabel: 'Calm Waters',
    introPanels: [
      {
        background: NIGHT_GRAD,
        speaker: 'Old Salt',
        caption:
          "Fished a sonar device from the wreck, Cap'n. Press it against the hull — it sings back the shape of whatever lurks below the surface. Pair it with Smoke to vanish after ye strike.",
        iconHint: '📡',
      },
      {
        background: SEA_GRAD,
        caption:
          'A cautious patrol boat hides in the shallows. Root it out before it radios our position.',
        iconHint: '🌫️',
      },
    ],
    outroPanels: [
      {
        background: GOLD_GRAD,
        speaker: 'Ironbeard',
        caption:
          "Precision and patience. They never knew we were there until the hull split. Remember that lesson.",
        iconHint: '👁️',
      },
    ],
    difficulty: 'easy',
    aiPersonality: 'cautious',
    modifiers: { fixedAbilities: [AbilityType.SonarPing, AbilityType.SmokeScreen] },
    starRequirements: {
      twoStars:   { maxTurns: 30 },
      threeStars: { maxTurns: 22, minAccuracyPct: 40 },
    },
  },

  {
    id: 4,
    title: 'Chain and Fire',
    subtitle: 'Break the line',
    difficultyLabel: 'Rough Seas',
    introPanels: [
      {
        background: GOLD_GRAD,
        speaker: 'Quartermaster Bones',
        caption:
          "Two Navy frigates sailing in tight formation — broadside to broadside. Our armourer has forged Chain Shot: three balls linked by chain, raking a full row in one volley.",
        iconHint: '⛓️',
      },
      {
        background: RED_GRAD,
        caption:
          'Break their line and sink them separately. A formation that cannot manoeuvre is already defeated.',
        iconHint: '💣',
      },
    ],
    outroPanels: [
      {
        background: RED_GRAD,
        speaker: 'Ironbeard',
        caption:
          "The chain tore through their mast like paper. Formation shattered. We hunted the stragglers at our leisure.",
        iconHint: '💥',
      },
    ],
    difficulty: 'medium',
    aiPersonality: 'standard',
    modifiers: { fixedAbilities: [AbilityType.ChainShot, AbilityType.CannonBarrage] },
    starRequirements: {
      twoStars:   { maxTurns: 35 },
      threeStars: { maxTurns: 24, noShipsLost: true },
    },
  },

  {
    id: 5,
    title: 'The Boarding Party',
    subtitle: 'Take what is ours by iron right',
    difficultyLabel: 'Rough Seas',
    introPanels: [
      {
        background: GOLD_GRAD,
        speaker: 'Ironbeard',
        caption:
          "A Crown galleon carries a season's worth of gold — and intelligence on every Navy patrol route. We board her. Send scouts first to map her decks; Chain Shot to soften the escort.",
        iconHint: '🏴‍☠️',
      },
    ],
    outroPanels: [
      {
        background: GOLD_GRAD,
        speaker: 'Quartermaster Bones',
        caption:
          "Patrol maps in hand, chests of gold in the hold. Act I is done, Cap'n. But the Navy will not forgive this. They will send someone better.",
        iconHint: '💰',
      },
    ],
    difficulty: 'medium',
    aiPersonality: 'aggressive',
    modifiers: { fixedAbilities: [AbilityType.BoardingParty, AbilityType.ChainShot] },
    starRequirements: {
      twoStars:   { maxTurns: 38 },
      threeStars: { maxTurns: 28 },
    },
  },

  // ─────────────────────────────────────────────────────────
  // ACT II — THE PHANTOM STRAITS (Mistral, Missions 6–10)
  // ─────────────────────────────────────────────────────────

  {
    id: 6,
    title: 'Eyes in the Fog',
    subtitle: 'Knowledge is the sharpest blade',
    difficultyLabel: 'Rough Seas',
    introPanels: [
      {
        background: NIGHT_GRAD,
        speaker: 'Mistral',
        caption:
          "Ironbeard's fire served well. But the Phantom Straits demand a different art. I have taken the helm. The Spyglass will name our targets; Smoke will hide our retreat. Watch and learn.",
        iconHint: '🔭',
      },
      {
        background: SEA_GRAD,
        caption:
          'A Navy corvette patrols the fog-draped channel. She cannot see us. Let us make sure she never does.',
        iconHint: '🌫️',
      },
    ],
    outroPanels: [
      {
        background: GOLD_GRAD,
        speaker: 'Mistral',
        caption:
          "They fired blindly at smoke. We fired at facts. The channel is open.",
        iconHint: '🌟',
      },
    ],
    difficulty: 'medium',
    aiPersonality: 'cautious',
    modifiers: { fixedAbilities: [AbilityType.Spyglass, AbilityType.SmokeScreen] },
    starRequirements: {
      twoStars:   { maxTurns: 32 },
      threeStars: { maxTurns: 22, noShipsLost: true },
    },
  },

  {
    id: 7,
    title: 'The Silent Hunt',
    subtitle: 'Hear what cannot be seen',
    difficultyLabel: 'Rough Seas',
    introPanels: [
      {
        background: NIGHT_GRAD,
        speaker: 'Mistral',
        caption:
          "A destroyer hides in the mist — running silent, no lanterns. The sonar will hear her heartbeat. The Spyglass will place her exact position. Then we strike once, cleanly.",
        iconHint: '🎯',
      },
    ],
    outroPanels: [
      {
        background: GOLD_GRAD,
        speaker: 'Mistral',
        caption:
          "Precision, not power. Every shot that struck was deliberate. That is the Phantom way.",
        iconHint: '✨',
      },
    ],
    difficulty: 'medium',
    aiPersonality: 'cautious',
    modifiers: { fixedAbilities: [AbilityType.SonarPing, AbilityType.Spyglass] },
    starRequirements: {
      twoStars:   { maxTurns: 30 },
      threeStars: { maxTurns: 20, minAccuracyPct: 40 },
    },
  },

  {
    id: 8,
    title: 'The Awakening Deep',
    subtitle: 'A leviathan stirs',
    difficultyLabel: 'Kraken Waters',
    introPanels: [
      {
        background: NIGHT_GRAD,
        speaker: 'Old Salt',
        caption:
          "These are cursed waters, Cap'n Mistral. The kraken sleeps below — but a battle above wakes it. It strikes friend and foe without thought. Every few turns, tentacles will slam into the fleet.",
        iconHint: '🐙',
      },
      {
        background: SEA_GRAD,
        caption:
          "A Navy cruiser blocks the far exit of the Straits. Sink her before the kraken takes too heavy a toll on both sides.",
        iconHint: '🌊',
      },
    ],
    outroPanels: [
      {
        background: RED_GRAD,
        speaker: 'Mistral',
        caption:
          "The cruiser sinks. The kraken retreats, satisfied with the carnage. We sail on — scarred but breathing.",
        iconHint: '👑',
      },
    ],
    difficulty: 'hard',
    aiPersonality: 'kraken',
    modifiers: { krakenAttack: true },
    starRequirements: {
      twoStars:   { maxTurns: 42 },
      threeStars: { maxTurns: 30 },
    },
  },

  {
    id: 9,
    title: 'Blind Fire',
    subtitle: 'Trust the sea, not your eyes',
    difficultyLabel: 'Storm Warning',
    introPanels: [
      {
        background: NIGHT_GRAD,
        speaker: 'Mistral',
        caption:
          "The fog is absolute now. Yer shots will vanish into it — no splash, no smoke ring, nothing. Ye'll not know what ye hit. Fire by memory, by pattern, by instinct.",
        iconHint: '🌫️',
      },
    ],
    outroPanels: [
      {
        background: GOLD_GRAD,
        speaker: 'Mistral',
        caption:
          "Blind, and still victorious. The sea does not hide from those who listen to it.",
        iconHint: '🌟',
      },
    ],
    difficulty: 'hard',
    aiPersonality: 'standard',
    modifiers: { foggyVision: true },
    starRequirements: {
      twoStars:   { maxTurns: 45 },
      threeStars: { maxTurns: 32 },
    },
  },

  {
    id: 10,
    title: 'Smoke and Mirrors',
    subtitle: 'Illusion is the deadliest weapon',
    difficultyLabel: 'Storm Warning',
    introPanels: [
      {
        background: STORM_GRAD,
        speaker: 'Mistral',
        caption:
          "The Navy's vice admiral sails these waters personally, hunting us. We will not meet her with force. We vanish into smoke. We board her escort and read her signals. She will fire at shadows.",
        iconHint: '🎭',
      },
    ],
    outroPanels: [
      {
        background: GOLD_GRAD,
        speaker: 'Mistral',
        caption:
          "The vice admiral returns to port in shame, her flagship hulled. Act II ends here. The Straits are ours. Now comes the fire.",
        iconHint: '🌊',
      },
    ],
    difficulty: 'hard',
    aiPersonality: 'aggressive',
    modifiers: { fixedAbilities: [AbilityType.SmokeScreen, AbilityType.BoardingParty] },
    starRequirements: {
      twoStars:   { maxTurns: 40 },
      threeStars: { maxTurns: 28 },
    },
  },

  // ─────────────────────────────────────────────────────────
  // ACT III — THE UNDYING FLAME (Blackheart, Missions 11–15)
  // ─────────────────────────────────────────────────────────

  {
    id: 11,
    title: 'Trial by Storm',
    subtitle: 'Nature hunts all equally',
    difficultyLabel: 'Kraken Waters',
    introPanels: [
      {
        background: STORM_GRAD,
        speaker: 'Blackheart',
        caption:
          "I am Blackheart. The Undying. I have survived things that would break lesser captains — and I am taking the helm for what comes next. Fog. Kraken. A Navy dreadnought. All at once.",
        iconHint: '⚔️',
      },
      {
        background: NIGHT_GRAD,
        speaker: 'Quartermaster Bones',
        caption:
          "The storm rages, the leviathan circles below, and the dreadnought approaches through the murk. There is no escape — only through.",
        iconHint: '🐙',
      },
    ],
    outroPanels: [
      {
        background: RED_GRAD,
        speaker: 'Blackheart',
        caption:
          "Storm, kraken, dreadnought — and we still float. The sea knows who it cannot break.",
        iconHint: '🌊',
      },
    ],
    difficulty: 'hard',
    aiPersonality: 'kraken',
    modifiers: { foggyVision: true, krakenAttack: true },
    starRequirements: {
      twoStars:   { maxTurns: 50 },
      threeStars: { maxTurns: 35 },
    },
  },

  {
    id: 12,
    title: "The King's Armada",
    subtitle: 'No quarter given or asked',
    difficultyLabel: 'No Mercy',
    introPanels: [
      {
        background: RED_GRAD,
        speaker: 'Blackheart',
        caption:
          "The Crown has had enough. They send the full Northern Armada — eight warships, battle-hardened veterans all. No tricks. No terrain to hide in. Just iron against iron.",
        iconHint: '⚔️',
      },
    ],
    outroPanels: [
      {
        background: GOLD_GRAD,
        speaker: 'Blackheart',
        caption:
          "Eight ships sent. Eight ships sunk. Let every Navy port know the name Ironclad Waters. Let them fear the flag.",
        iconHint: '🏆',
      },
    ],
    difficulty: 'hard',
    aiPersonality: 'aggressive',
    modifiers: {},
    starRequirements: {
      twoStars:   { maxTurns: 40 },
      threeStars: { maxTurns: 28, noShipsLost: true },
    },
  },

  {
    id: 13,
    title: "The Traitor's Signal",
    subtitle: 'Betrayal from within',
    difficultyLabel: 'No Mercy',
    introPanels: [
      {
        background: NIGHT_GRAD,
        speaker: 'Old Salt',
        caption:
          "Word reaches us — a turncoat among the crew has signalled our bearing to the Navy. The ambush is already set. They know our position, our formation, our course.",
        iconHint: '👁️',
      },
      {
        background: RED_GRAD,
        speaker: 'Blackheart',
        caption:
          "Let them come. Knowing where we are doesn't tell them what we are. We sail straight into their trap — and we spring it back on them.",
        iconHint: '😈',
      },
    ],
    outroPanels: [
      {
        background: GOLD_GRAD,
        speaker: 'Blackheart',
        caption:
          "Their ambush lies scattered across the seabed. The traitor's name will die here with them.",
        iconHint: '🗡️',
      },
    ],
    difficulty: 'hard',
    aiPersonality: 'aggressive',
    modifiers: { foggyVision: true },
    starRequirements: {
      twoStars:   { maxTurns: 42 },
      threeStars: { maxTurns: 30 },
    },
  },

  {
    id: 14,
    title: 'Last Stand at Tortuga',
    subtitle: 'Defend what we have bled for',
    difficultyLabel: 'No Mercy',
    introPanels: [
      {
        background: RED_GRAD,
        speaker: 'Quartermaster Bones',
        caption:
          "They've found Tortuga, Cap'n! Navy warships in the harbour mouth. If they take the port, we lose our base, our stores, our wounded. Everything.",
        iconHint: '🏛️',
      },
      {
        background: NIGHT_GRAD,
        speaker: 'Blackheart',
        caption:
          "And the kraken wakes at the cannon fire. Two enemies at once. We hold the line or we lose everything we have built.",
        iconHint: '🐙',
      },
    ],
    outroPanels: [
      {
        background: GOLD_GRAD,
        speaker: 'Blackheart',
        caption:
          "Tortuga stands. The harbour runs red with Navy blood and kraken ink. We stand. One mission remains.",
        iconHint: '🏴‍☠️',
      },
    ],
    difficulty: 'hard',
    aiPersonality: 'aggressive',
    modifiers: { krakenAttack: true },
    starRequirements: {
      twoStars:   { maxTurns: 45 },
      threeStars: { maxTurns: 32, noShipsLost: true },
    },
  },

  {
    id: 15,
    title: 'Admiral Ironclad',
    subtitle: 'The final reckoning',
    difficultyLabel: 'No Mercy',
    introPanels: [
      {
        background: RED_GRAD,
        speaker: 'Admiral Ironclad',
        caption:
          "So you are the pirate that shook the Crown from one end of these seas to the other. I am Admiral Ironclad — the Navy's finest, and your end.",
        iconHint: '💀',
      },
      {
        background: STORM_GRAD,
        speaker: 'Blackheart',
        caption:
          "Fog. Kraken. The greatest Navy commander alive — all three at once. Every lesson from every battle has led here. Do not waste it.",
        iconHint: '⚔️',
      },
      {
        background: NIGHT_GRAD,
        speaker: 'Quartermaster Bones',
        caption:
          "All yer iron, all yer cunning — ye'll need every drop. The crew stands behind ye, Cap'n. Make us proud.",
        iconHint: '⚓',
      },
    ],
    outroPanels: [
      {
        background: RED_GRAD,
        speaker: 'Blackheart',
        caption:
          "Admiral Ironclad sinks beneath the waves. The Crown's grip on these seas is broken. Forever.",
        iconHint: '🏆',
      },
      {
        background: GOLD_GRAD,
        caption:
          "The three captains stand together on the quarterdeck as the last Navy colours sink below the horizon. These are Ironclad Waters now.",
        iconHint: '🌅',
      },
    ],
    difficulty: 'hard',
    aiPersonality: 'aggressive',
    modifiers: { foggyVision: true, krakenAttack: true },
    starRequirements: {
      twoStars:   { maxTurns: 50 },
      threeStars: { maxTurns: 35, noShipsLost: true },
    },
  },
];

export function calculateStars(
  mission: CampaignMission,
  result: { won: boolean; turns: number; accuracyPct: number; shipsLost: number }
): number {
  if (!result.won) return 0;
  let stars = 1;
  const two = mission.starRequirements.twoStars;
  const three = mission.starRequirements.threeStars;

  const meetsTwo =
    (two.maxTurns === undefined || result.turns <= two.maxTurns) &&
    (two.minAccuracyPct === undefined || result.accuracyPct >= two.minAccuracyPct);
  if (meetsTwo) stars = 2;

  const meetsThree =
    (three.maxTurns === undefined || result.turns <= three.maxTurns) &&
    (three.minAccuracyPct === undefined || result.accuracyPct >= three.minAccuracyPct) &&
    (three.noShipsLost !== true || result.shipsLost === 0);
  if (stars === 2 && meetsThree) stars = 3;

  return stars;
}

export function getMission(id: number): CampaignMission | undefined {
  return CAMPAIGN_MISSIONS.find((m) => m.id === id);
}

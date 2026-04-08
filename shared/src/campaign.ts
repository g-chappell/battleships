/**
 * Campaign mission definitions: 15 missions with a pirate-vs-Royal-Navy plot.
 */

import { AbilityType } from './abilities';

export type AIPersonality = 'standard' | 'aggressive' | 'cautious' | 'kraken';

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
  introPanels: ComicPanel[];
  outroPanels: ComicPanel[];
  difficulty: 'easy' | 'medium' | 'hard';
  aiPersonality: AIPersonality;
  modifiers: MissionModifiers;
  starRequirements: MissionStarRequirements;
}

const RED_GRAD = 'bg-gradient-to-br from-[#5c0000] to-[#1a0a0a]';
const SEA_GRAD = 'bg-gradient-to-br from-[#1a0a0a] to-[#0d0606]';
const GOLD_GRAD = 'bg-gradient-to-br from-[#3d1f17] to-[#2a1410]';
const NIGHT_GRAD = 'bg-gradient-to-br from-[#0d0606] to-[#1a0a0a]';

export const CAMPAIGN_MISSIONS: CampaignMission[] = [
  {
    id: 1,
    title: 'Maiden Voyage',
    subtitle: 'A captain is born',
    introPanels: [
      { background: SEA_GRAD, speaker: 'Quartermaster Bones', caption: "Welcome aboard, Cap'n. The Iron Marauder is yours now. The Royal Navy patrols these waters \u2014 we'll need to learn their ways before we strike.", iconHint: '\u{2693}' },
      { background: GOLD_GRAD, caption: "A lone scout vessel has been spotted. Easy prey for our first hunt. Place yer ships and signal when ready.", iconHint: '\u{1F50D}' },
    ],
    outroPanels: [
      { background: RED_GRAD, speaker: 'Quartermaster Bones', caption: "First blood, Cap'n! The crew's spirits soar. They'll follow ye to the depths now.", iconHint: '\u{1F5E1}\uFE0F' },
    ],
    difficulty: 'easy',
    aiPersonality: 'standard',
    modifiers: {},
    starRequirements: {
      twoStars: { maxTurns: 35 },
      threeStars: { maxTurns: 25, noShipsLost: true },
    },
  },
  {
    id: 2,
    title: 'The Brass Compass',
    subtitle: 'Tools of the trade',
    introPanels: [
      { background: GOLD_GRAD, speaker: 'Quartermaster Bones', caption: "Found a crate of gunpowder! Time to teach ye the Cannon Barrage. Fire on a 2x2 area \u2014 perfect fer hunting clusters of foes.", iconHint: '\u{1F4A3}' },
      { background: SEA_GRAD, caption: "A merchant frigate approaches. Use yer new toy and show 'em who rules these waters.", iconHint: '\u{26F5}' },
    ],
    outroPanels: [
      { background: RED_GRAD, caption: "Cannon Barrage works wonders, eh? Their hull splintered like dry kindling.", iconHint: '\u{1F4A5}' },
    ],
    difficulty: 'easy',
    aiPersonality: 'standard',
    modifiers: { fixedAbilities: [AbilityType.CannonBarrage, AbilityType.RepairKit] },
    starRequirements: {
      twoStars: { maxTurns: 32 },
      threeStars: { maxTurns: 22 },
    },
  },
  {
    id: 3,
    title: 'Whispers Below',
    subtitle: 'Sonar and secrets',
    introPanels: [
      { background: NIGHT_GRAD, speaker: 'Old Salt', caption: "We've fished out an old sonar device from a wreck. Use the Sonar Ping to find hidden ships before they find ye.", iconHint: '\u{1F4E1}' },
      { background: SEA_GRAD, caption: "A patrol boat lurks in the fog. Use yer wits.", iconHint: '\u{1F32B}\uFE0F' },
    ],
    outroPanels: [
      { background: GOLD_GRAD, caption: "The Royal Navy will know our name now.", iconHint: '\u{1F441}\uFE0F' },
    ],
    difficulty: 'easy',
    aiPersonality: 'cautious',
    modifiers: { fixedAbilities: [AbilityType.SonarPing, AbilityType.RepairKit] },
    starRequirements: {
      twoStars: { maxTurns: 30 },
      threeStars: { maxTurns: 22, minAccuracyPct: 40 },
    },
  },
  {
    id: 4,
    title: 'The Smoke and the Fury',
    subtitle: 'Hide and strike',
    introPanels: [
      { background: NIGHT_GRAD, speaker: 'Quartermaster Bones', caption: "An ambush awaits! Use the Smoke Screen to mask yer fleet from the enemy gunners.", iconHint: '\u{1F32B}\uFE0F' },
    ],
    outroPanels: [
      { background: RED_GRAD, caption: "They never saw us coming.", iconHint: '\u{1F608}' },
    ],
    difficulty: 'medium',
    aiPersonality: 'standard',
    modifiers: { fixedAbilities: [AbilityType.SmokeScreen, AbilityType.CannonBarrage] },
    starRequirements: {
      twoStars: { maxTurns: 35 },
      threeStars: { maxTurns: 24, noShipsLost: true },
    },
  },
  {
    id: 5,
    title: 'Iron and Honor',
    subtitle: 'The first ironclad',
    introPanels: [
      { background: GOLD_GRAD, speaker: 'Quartermaster Bones', caption: "The Royal Navy's pride: the HMS Implacable. An ironclad. Their armor will deflect yer first shot. Be patient.", iconHint: '\u{1F6E1}\uFE0F' },
    ],
    outroPanels: [
      { background: RED_GRAD, caption: "Ironclads bleed too, when struck enough.", iconHint: '\u{1F5E1}\uFE0F' },
    ],
    difficulty: 'medium',
    aiPersonality: 'aggressive',
    modifiers: { fixedAbilities: [AbilityType.CannonBarrage, AbilityType.SonarPing] },
    starRequirements: {
      twoStars: { maxTurns: 38 },
      threeStars: { maxTurns: 28 },
    },
  },
  {
    id: 6,
    title: 'Chain of Fools',
    subtitle: 'A new weapon',
    introPanels: [
      { background: GOLD_GRAD, speaker: 'Old Salt', caption: "We've forged Chain Shot rounds. Three cannonballs linked by chain \u2014 hits a whole row at once. Devastating.", iconHint: '\u{26D3}\uFE0F' },
    ],
    outroPanels: [
      { background: RED_GRAD, caption: "Their formation crumbled like rotten wood.", iconHint: '\u{1F4A5}' },
    ],
    difficulty: 'medium',
    aiPersonality: 'standard',
    modifiers: { fixedAbilities: [AbilityType.ChainShot, AbilityType.RepairKit] },
    starRequirements: {
      twoStars: { maxTurns: 32 },
      threeStars: { maxTurns: 22 },
    },
  },
  {
    id: 7,
    title: 'The Spyglass',
    subtitle: 'Eyes on the horizon',
    introPanels: [
      { background: SEA_GRAD, speaker: 'Quartermaster Bones', caption: "A captured spyglass shows ye the row of any cell ye target. Knowledge is power.", iconHint: '\u{1F50D}' },
    ],
    outroPanels: [
      { background: GOLD_GRAD, caption: "Information wins wars.", iconHint: '\u{1F4DC}' },
    ],
    difficulty: 'medium',
    aiPersonality: 'cautious',
    modifiers: { fixedAbilities: [AbilityType.Spyglass, AbilityType.SmokeScreen] },
    starRequirements: {
      twoStars: { maxTurns: 30 },
      threeStars: { maxTurns: 20, noShipsLost: true },
    },
  },
  {
    id: 8,
    title: 'The Kraken Awakes',
    subtitle: 'A leviathan stirs',
    introPanels: [
      { background: NIGHT_GRAD, speaker: 'Old Salt', caption: "We're in cursed waters now, Cap'n. The kraken roams here. It strikes friend and foe alike.", iconHint: '\u{1F419}' },
      { background: SEA_GRAD, caption: "Ye must defeat the navy AND survive the beast's wrath. Every few turns, tentacles will damage a random ship.", iconHint: '\u{1F30A}' },
    ],
    outroPanels: [
      { background: RED_GRAD, caption: "Ye survived the kraken. Few can claim that.", iconHint: '\u{1F451}' },
    ],
    difficulty: 'hard',
    aiPersonality: 'kraken',
    modifiers: { krakenAttack: true },
    starRequirements: {
      twoStars: { maxTurns: 40 },
      threeStars: { maxTurns: 28 },
    },
  },
  {
    id: 9,
    title: 'Fog of War',
    subtitle: 'Where shots vanish',
    introPanels: [
      { background: NIGHT_GRAD, caption: "A thick fog rolls in. Ye won't see where yer shots land. Trust yer instincts.", iconHint: '\u{1F32B}\uFE0F' },
    ],
    outroPanels: [
      { background: GOLD_GRAD, caption: "Even blind, ye are deadly.", iconHint: '\u{1F31F}' },
    ],
    difficulty: 'hard',
    aiPersonality: 'standard',
    modifiers: { foggyVision: true },
    starRequirements: {
      twoStars: { maxTurns: 45 },
      threeStars: { maxTurns: 32 },
    },
  },
  {
    id: 10,
    title: 'Boarding Action',
    subtitle: 'Gather intel',
    introPanels: [
      { background: GOLD_GRAD, speaker: 'Quartermaster Bones', caption: "A Boarding Party can sneak aboard the enemy and report ship details. Use it wisely \u2014 only one chance.", iconHint: '\u{1F3F4}\u200D\u2620\uFE0F' },
    ],
    outroPanels: [
      { background: RED_GRAD, caption: "The crew brings back tales of riches.", iconHint: '\u{1F4B0}' },
    ],
    difficulty: 'hard',
    aiPersonality: 'aggressive',
    modifiers: { fixedAbilities: [AbilityType.BoardingParty, AbilityType.CannonBarrage] },
    starRequirements: {
      twoStars: { maxTurns: 35 },
      threeStars: { maxTurns: 25, noShipsLost: true },
    },
  },
  {
    id: 11,
    title: 'The Storm Front',
    subtitle: 'Nature\'s fury',
    introPanels: [
      { background: NIGHT_GRAD, caption: "A storm rages. Visibility is nil and the kraken hunts. Hold yer course.", iconHint: '\u{26C8}\uFE0F' },
    ],
    outroPanels: [
      { background: GOLD_GRAD, caption: "The seas themselves bow to ye now.", iconHint: '\u{1F30A}' },
    ],
    difficulty: 'hard',
    aiPersonality: 'kraken',
    modifiers: { foggyVision: true, krakenAttack: true },
    starRequirements: {
      twoStars: { maxTurns: 50 },
      threeStars: { maxTurns: 35 },
    },
  },
  {
    id: 12,
    title: 'The Royal Armada',
    subtitle: 'A fleet of ironclads',
    introPanels: [
      { background: RED_GRAD, speaker: 'Quartermaster Bones', caption: "The Royal Navy sends an entire armada. Their flagship is fast and deadly. We can't outrun \u2014 we must outfight.", iconHint: '\u{2694}\uFE0F' },
    ],
    outroPanels: [
      { background: GOLD_GRAD, caption: "Their flagship sinks. The Navy reels.", iconHint: '\u{1F3C6}' },
    ],
    difficulty: 'hard',
    aiPersonality: 'aggressive',
    modifiers: {},
    starRequirements: {
      twoStars: { maxTurns: 40 },
      threeStars: { maxTurns: 28, noShipsLost: true },
    },
  },
  {
    id: 13,
    title: 'Whispers of Treason',
    subtitle: 'A traitor among us',
    introPanels: [
      { background: NIGHT_GRAD, speaker: 'Old Salt', caption: "Word reaches us \u2014 a turncoat has leaked our position. The Navy knows where we are.", iconHint: '\u{1F441}\uFE0F' },
      { background: RED_GRAD, caption: "Their AI commander is unpredictable, ruthless. Adapt.", iconHint: '\u{1F608}' },
    ],
    outroPanels: [
      { background: GOLD_GRAD, caption: "The traitor's name dies with them.", iconHint: '\u{1F5E1}\uFE0F' },
    ],
    difficulty: 'hard',
    aiPersonality: 'aggressive',
    modifiers: { foggyVision: true },
    starRequirements: {
      twoStars: { maxTurns: 42 },
      threeStars: { maxTurns: 30 },
    },
  },
  {
    id: 14,
    title: 'The Siege of Tortuga',
    subtitle: 'Defend the homeport',
    introPanels: [
      { background: RED_GRAD, speaker: 'Quartermaster Bones', caption: "They've found our home, Cap'n. We must defend Tortuga or lose everything we've built.", iconHint: '\u{1F3D8}\uFE0F' },
    ],
    outroPanels: [
      { background: GOLD_GRAD, caption: "Tortuga stands. Ye are a legend.", iconHint: '\u{1F3F4}\u200D\u2620\uFE0F' },
    ],
    difficulty: 'hard',
    aiPersonality: 'aggressive',
    modifiers: { krakenAttack: true },
    starRequirements: {
      twoStars: { maxTurns: 45 },
      threeStars: { maxTurns: 32, noShipsLost: true },
    },
  },
  {
    id: 15,
    title: 'Admiral Ironclad',
    subtitle: 'The final reckoning',
    introPanels: [
      { background: RED_GRAD, speaker: 'Admiral Ironclad', caption: "So ye are the pirate that shook the Crown. Ye'll find I am no patrol scout, no merchant. I am yer end.", iconHint: '\u{1F480}' },
      { background: NIGHT_GRAD, speaker: 'Quartermaster Bones', caption: "All yer skills, all yer cunning \u2014 ye'll need every drop. The kraken hunts. The fog rolls. The Navy's finest stands ready. This is it, Cap'n.", iconHint: '\u{2694}\uFE0F' },
      { background: GOLD_GRAD, caption: "Make us proud.", iconHint: '\u{2693}' },
    ],
    outroPanels: [
      { background: RED_GRAD, speaker: 'Quartermaster Bones', caption: "Admiral Ironclad sinks beneath the waves. The Crown's grip on these seas is broken. Forever.", iconHint: '\u{1F3C6}' },
      { background: GOLD_GRAD, caption: "Ye are the Pirate King. The seas are yours, Cap'n.", iconHint: '\u{1F451}' },
    ],
    difficulty: 'hard',
    aiPersonality: 'aggressive',
    modifiers: { foggyVision: true, krakenAttack: true },
    starRequirements: {
      twoStars: { maxTurns: 50 },
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

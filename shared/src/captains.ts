import { AbilityType } from './abilities';

export interface CaptainDef {
  id: string;
  name: string;
  title: string;
  description: string;
  abilities: [AbilityType, AbilityType, AbilityType];
  color: string;
}

export const CAPTAIN_DEFS: Record<string, CaptainDef> = {
  ironbeard: {
    id: 'ironbeard',
    name: 'Ironbeard',
    title: 'The Iron Fist',
    description: 'A ruthless warmonger who rains fire and boards enemy vessels without mercy.',
    abilities: [AbilityType.CannonBarrage, AbilityType.ChainShot, AbilityType.BoardingParty],
    color: '#c41e3a',
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral',
    title: 'The Phantom',
    description: 'A cunning strategist who reads the seas and vanishes into fog.',
    abilities: [AbilityType.SonarPing, AbilityType.Spyglass, AbilityType.SmokeScreen],
    color: '#4a90d9',
  },
  blackheart: {
    id: 'blackheart',
    name: 'Blackheart',
    title: 'The Undying',
    description: 'A grizzled survivor who outlasts every foe through sheer resilience.',
    abilities: [AbilityType.RepairKit, AbilityType.CannonBarrage, AbilityType.SonarPing],
    color: '#a06820',
  },
  seawitch: {
    id: 'seawitch',
    name: 'Seawitch Morgana',
    title: 'Keeper of the Deep',
    description: 'A storm-witch who parleys with leviathans. Commands sea beasts but slow to wield them.',
    abilities: [AbilityType.SummonKraken, AbilityType.SonarPing, AbilityType.SmokeScreen],
    color: '#4a2858',
  },
};

export const CAPTAIN_IDS = Object.keys(CAPTAIN_DEFS);
export const DEFAULT_CAPTAIN = 'ironbeard';

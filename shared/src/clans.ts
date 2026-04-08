/**
 * Clan types shared between client and server.
 */

export type ClanRole = 'leader' | 'officer' | 'member';

export interface ClanSummary {
  id: string;
  name: string;
  tag: string;
  description: string | null;
  memberCount: number;
  totalWins: number;
  totalLosses: number;
  createdAt: string;
}

export interface ClanMember {
  userId: string;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  role: ClanRole;
}

export interface ClanChatMessage {
  id: string;
  clanId: string;
  userId: string;
  username: string;
  text: string;
  createdAt: string;
}

export interface ClanDetail extends ClanSummary {
  members: ClanMember[];
  recentChat: ClanChatMessage[];
}

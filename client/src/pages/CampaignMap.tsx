import { useEffect } from 'react';
import { useCampaignStore } from '../store/campaignStore';
import { useAuthStore } from '../store/authStore';
import { CAMPAIGN_MISSIONS } from '@shared/index';
import type { CampaignMission, DifficultyLabel, ObjectiveThresholds } from '@shared/index';
import { MissionBriefing } from '../components/ui/MissionBriefing';
import { FONT_STYLES } from '../styles/fonts';
import { PageShell } from '../components/ui/PageShell';
import { PageHeader } from '../components/ui/PageHeader';

const DIFFICULTY_COLOR: Record<DifficultyLabel, string> = {
  'Calm Waters':   '#e8dcc8',
  'Rough Seas':    '#d4a040',
  'Storm Warning': '#b87333',
  'Kraken Waters': '#c41e3a',
  'No Mercy':      '#c41e3a',
};

const DIFFICULTY_ICON: Record<DifficultyLabel, string> = {
  'Calm Waters':   '⚓',
  'Rough Seas':    '🌊',
  'Storm Warning': '🌩️',
  'Kraken Waters': '🐙',
  'No Mercy':      '💀',
};

function formatThreshold(t: ObjectiveThresholds): string {
  const parts: string[] = [];
  if (t.maxTurns !== undefined) parts.push(`Under ${t.maxTurns} turns`);
  if (t.minAccuracyPct !== undefined) parts.push(`≥${t.minAccuracyPct}% accuracy`);
  if (t.noShipsLost) parts.push('No ships lost');
  return parts.length > 0 ? parts.join(' · ') : 'Win the battle';
}

interface TierRow {
  label: string;
  medal: string;
  description: string;
  color: string;
  starIndex: number;
}

function buildTierRows(mission: CampaignMission): TierRow[] {
  const tiers = mission.modifiers.starTiers;
  if (tiers) {
    return [
      { label: 'Bronze', medal: '🥉', description: formatThreshold(tiers.bronze), color: '#b87333', starIndex: 1 },
      { label: 'Silver', medal: '🥈', description: formatThreshold(tiers.silver), color: '#e8dcc8', starIndex: 2 },
      { label: 'Gold',   medal: '🥇', description: formatThreshold(tiers.gold),   color: '#d4a040', starIndex: 3 },
    ];
  }
  return [
    { label: 'Bronze', medal: '🥉', description: 'Win the battle',                                       color: '#b87333', starIndex: 1 },
    { label: 'Silver', medal: '🥈', description: formatThreshold(mission.starRequirements.twoStars),      color: '#e8dcc8', starIndex: 2 },
    { label: 'Gold',   medal: '🥇', description: formatThreshold(mission.starRequirements.threeStars),    color: '#d4a040', starIndex: 3 },
  ];
}

const ACT_BREAKS = [
  {
    afterMissionId: 5,
    actNumber: 'II',
    title: 'The Phantom Straits',
    captain: 'Mistral',
    caption: 'A cunning captain takes the helm — patience and deception replace raw power.',
    icon: '🔭',
  },
  {
    afterMissionId: 10,
    actNumber: 'III',
    title: 'The Undying Flame',
    captain: 'Blackheart',
    caption: 'The final reckoning begins. No quarter. No retreat. Only the undying.',
    icon: '⚔️',
  },
];

export function CampaignMap() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  const loadProgress = useCampaignStore((s) => s.loadProgress);
  const isMissionUnlocked = useCampaignStore((s) => s.isMissionUnlocked);
  const getStars = useCampaignStore((s) => s.getStars);
  const totalStars = useCampaignStore((s) => s.totalStars);
  const showBriefing = useCampaignStore((s) => s.showBriefing);
  const openBriefing = useCampaignStore((s) => s.openBriefing);

  useEffect(() => {
    loadProgress(token, user?.id ?? null);
  }, [loadProgress, token, user]);

  return (
    <PageShell maxWidth="5xl">
      <PageHeader
        title="Campaign"
        subtitle={`The pirate's saga · ${totalStars()}/${CAMPAIGN_MISSIONS.length * 3} stars earned`}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CAMPAIGN_MISSIONS.flatMap((mission) => {
          const unlocked = isMissionUnlocked(mission.id);
          const stars = getStars(mission.id);
          const tierRows = buildTierRows(mission);
          const diffColor = DIFFICULTY_COLOR[mission.difficultyLabel];
          const actBreak = ACT_BREAKS.find((b) => b.afterMissionId === mission.id - 1);

          const items: React.ReactNode[] = [];

          if (actBreak) {
            items.push(
              <div
                key={`act-${actBreak.actNumber}`}
                className="col-span-1 md:col-span-2 lg:col-span-3 my-2"
              >
                <div className="flex items-center gap-4 py-3 px-5 bg-gradient-to-r from-transparent via-coal/80 to-transparent border-y border-blood/30 rounded">
                  <span className="text-2xl flex-shrink-0">{actBreak.icon}</span>
                  <div className="min-w-0">
                    <div className="text-xs text-aged-gold tracking-[0.3em] uppercase" style={FONT_STYLES.labelSC}>
                      Act {actBreak.actNumber} · {actBreak.captain}
                    </div>
                    <div className="text-lg text-blood-bright" style={FONT_STYLES.pirate}>
                      {actBreak.title}
                    </div>
                    <div className="text-xs text-bone/60 italic" style={FONT_STYLES.body}>
                      {actBreak.caption}
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          items.push(
            <button
              key={mission.id}
              onClick={() => unlocked && openBriefing(mission.id)}
              disabled={!unlocked}
              className={`group text-left p-4 rounded-lg border-2 transition-all ${
                unlocked
                  ? 'bg-gradient-to-br from-coal to-mahogany border-blood/60 hover:border-blood-bright hover:scale-105 cursor-pointer panel-glow'
                  : 'bg-pitch/60 border-mahogany-light opacity-50 cursor-not-allowed'
              }`}
            >
              {/* Header: mission number + difficulty badge */}
              <div className="flex items-start justify-between mb-2">
                <div className="text-xs text-aged-gold uppercase tracking-wider" style={FONT_STYLES.labelSC}>
                  Mission {mission.id}
                </div>
                {!unlocked ? (
                  <span className="text-2xl">🔒</span>
                ) : (
                  <div
                    className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border"
                    style={{
                      color: diffColor,
                      borderColor: diffColor + '60',
                      backgroundColor: diffColor + '12',
                      ...FONT_STYLES.labelSC,
                    }}
                  >
                    <span>{DIFFICULTY_ICON[mission.difficultyLabel]}</span>
                    <span>{mission.difficultyLabel}</span>
                  </div>
                )}
              </div>

              {/* Title + subtitle */}
              <h3 className="text-xl text-blood-bright mb-1" style={FONT_STYLES.pirate}>{mission.title}</h3>
              <p className="text-xs text-gold italic mb-3" style={FONT_STYLES.body}>
                {mission.subtitle}
              </p>

              {/* Stars earned */}
              <div className="flex items-center justify-between mb-1">
                <div className="text-base">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <span key={i} className={i < stars ? 'text-gold' : 'text-parchment/40'}>★</span>
                  ))}
                </div>
                {stars > 0 && (
                  <span className="text-xs text-parchment/50" style={FONT_STYLES.labelSC}>
                    {stars}/3 stars
                  </span>
                )}
              </div>

              {/* Per-objective breakdown — revealed on card hover */}
              {unlocked && (
                <div className="overflow-hidden max-h-0 group-hover:max-h-24 opacity-0 group-hover:opacity-100 transition-all duration-300">
                  <div className="border-t border-blood/20 pt-2 mt-1 flex flex-col gap-0.5">
                    {tierRows.map((row) => {
                      const achieved = stars >= row.starIndex;
                      return (
                        <div key={row.label} className="flex items-center gap-1.5 text-xs" style={FONT_STYLES.labelSC}>
                          <span className="text-sm leading-none">{row.medal}</span>
                          <span className="w-11" style={{ color: achieved ? row.color : '#3d2010', fontWeight: 'bold' }}>
                            {row.label}
                          </span>
                          <span className="flex-1 min-w-0 truncate" style={{ color: achieved ? '#c8b89a' : '#3d2010' }}>
                            {row.description}
                          </span>
                          {achieved && <span className="text-gold ml-1 flex-shrink-0">✓</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </button>
          );

          return items;
        })}
      </div>

      {showBriefing && <MissionBriefing />}
    </PageShell>
  );
}

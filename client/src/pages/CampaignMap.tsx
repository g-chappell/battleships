import { useEffect } from 'react';
import { useCampaignStore } from '../store/campaignStore';
import { useAuthStore } from '../store/authStore';
import { CAMPAIGN_MISSIONS } from '@shared/index';
import { MissionBriefing } from '../components/ui/MissionBriefing';
import { FONT_STYLES } from '../styles/fonts';
import { PageShell } from '../components/ui/PageShell';
import { PageHeader } from '../components/ui/PageHeader';

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
        {CAMPAIGN_MISSIONS.map((mission) => {
          const unlocked = isMissionUnlocked(mission.id);
          const stars = getStars(mission.id);
          return (
            <button
              key={mission.id}
              onClick={() => unlocked && openBriefing(mission.id)}
              disabled={!unlocked}
              className={`text-left p-4 rounded-lg border-2 transition-all ${
                unlocked
                  ? 'bg-gradient-to-br from-coal to-mahogany border-blood/60 hover:border-blood-bright hover:scale-105 cursor-pointer panel-glow'
                  : 'bg-pitch/60 border-mahogany-light opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="text-xs text-aged-gold uppercase tracking-wider" style={FONT_STYLES.labelSC}>
                  Mission {mission.id}
                </div>
                {!unlocked && <span className="text-2xl">🔒</span>}
              </div>
              <h3 className="text-xl text-blood-bright mb-1" style={FONT_STYLES.pirate}>{mission.title}</h3>
              <p className="text-xs text-gold italic mb-3" style={FONT_STYLES.body}>
                {mission.subtitle}
              </p>
              <div className="flex items-center justify-between">
                <div className="text-base">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <span key={i} className={i < stars ? 'text-gold' : 'text-parchment/40'}>★</span>
                  ))}
                </div>
                <div className={`text-xs uppercase ${
                  mission.difficulty === 'easy' ? 'text-parchment' :
                  mission.difficulty === 'medium' ? 'text-gold' :
                  'text-blood-bright'
                }`} style={FONT_STYLES.labelSC}>
                  {mission.difficulty}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {showBriefing && <MissionBriefing />}
    </PageShell>
  );
}

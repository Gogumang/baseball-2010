import { AbilityBars, HeadingSprite, Notice, Panel, PixelScreen, StatGrid, TitleTag } from '@/shared/ui'
import { battingAverageOf, formatBattingAverage } from '@/entities/career/model/seasonStats'
import type { SeasonStats } from '@/entities/career/model/seasonStats'
import { currentTitleOf } from '@/entities/career/model/titles'
import { HEROINES } from '@/shared/config/heroines'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import * as styles from '@/pages/record/ui/RecordScreen.css'
import { detail } from '@/shared/ui/MenuList/MenuList.css'

export function RecordScreen({
  career,
  onBack,
}: {
  readonly career: PlayerCareer
  readonly onBack: () => void
}) {
  return (
    <PixelScreen
      title="성적"
      badge={`${career.wins}승 ${career.draws}무 ${career.losses}패`}
      rightKey={{ label: '돌아가기', onPress: onBack }}
    >
      <Panel heading={<>{career.season}시즌</>}>
        <StatsGrid stats={career.stats} />
      </Panel>

      <Panel heading="통산">
        <StatsGrid stats={career.careerStats} />
      </Panel>

      <Panel heading="능력치">
        <AbilityBars ability={career.ability} />
      </Panel>

      <Panel heading="칭호">
        <p style={{ marginTop: 0 }}>{currentTitleOf(career)}</p>
        {career.titleIds.length === 0 ? (
          <Notice>아직 얻은 칭호가 없습니다.</Notice>
        ) : (
          career.titleIds.map((title) => (
            <TitleTag key={title}>
              {title}
            </TitleTag>
          ))
        )}
      </Panel>

      <Panel>
        <HeadingSprite name="마선수선택" />
        <div className={styles.aceGrid}>
          {HEROINES.map((heroine) => (
            <div className={styles.aceCard} key={heroine.id}>
              <img
                src={
                  heroine.frameCount > 0 ? `${heroine.framesUrl}/000.png` : heroine.iconUrl
                }
                alt={heroine.name}
              />
              <span style={{ color: heroine.accentColor }}>{heroine.name}</span>
              <span className={detail}>
                {heroine.role} · {heroine.burst}
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </PixelScreen>
  )
}

function StatsGrid({ stats }: { readonly stats: SeasonStats }) {
  return (
    <StatGrid
      entries={[
        { label: '경기', value: stats.games },
        { label: '타율', value: formatBattingAverage(battingAverageOf(stats)) },
        { label: '타수', value: stats.atBats },
        { label: '안타', value: stats.hits },
        { label: '2루타', value: stats.doubles },
        { label: '홈런', value: stats.homeRuns },
        { label: '타점', value: stats.runsBattedIn },
        { label: '볼넷', value: stats.walks },
        { label: '삼진', value: stats.strikeouts },
      ]}
    />
  )
}

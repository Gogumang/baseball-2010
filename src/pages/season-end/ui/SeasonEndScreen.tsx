import { BigResult, Notice, Panel, PixelScreen, StatGrid } from '@/shared/ui'
import { battingAverageOf, formatBattingAverage } from '@/entities/career/model/seasonStats'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'

export function SeasonEndScreen({
  career,
  onStartNextSeason,
}: {
  readonly career: PlayerCareer
  readonly onStartNextSeason: () => void
}) {
  const average = battingAverageOf(career.stats)

  return (
    <PixelScreen
      title={`${career.season}시즌 종료`}
      leftKey={{ label: '다음', onPress: onStartNextSeason }}
    >
      <Panel>
        <BigResult>
          {career.wins}승 {career.draws}무 {career.losses}패
        </BigResult>
      </Panel>

      <Panel heading={<>{career.name} 선수 시즌 성적</>}>
        <StatGrid
          entries={[
            { label: '타율', value: formatBattingAverage(average) },
            { label: '안타', value: career.stats.hits },
            { label: '홈런', value: career.stats.homeRuns },
            { label: '타점', value: career.stats.runsBattedIn },
            { label: '볼넷', value: career.stats.walks },
            { label: '삼진', value: career.stats.strikeouts },
          ]}
        />
      </Panel>

      <Notice>
        {average !== null && average >= 0.3
          ? '3할 타자로 시즌을 마쳤습니다. 다음 시즌에는 더 큰 기대가 따라붙습니다.'
          : '아쉬움이 남는 시즌이었습니다. 비시즌 훈련으로 다시 시작합시다.'}
      </Notice>
    </PixelScreen>
  )
}

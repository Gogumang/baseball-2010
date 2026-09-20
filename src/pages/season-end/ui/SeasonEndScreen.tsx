import { useState } from 'react'
import { BigResult, Notice, Panel, PixelScreen, StatGrid } from '@/shared/ui'
import { battingAverageOf, formatBattingAverage } from '@/entities/career/model/seasonStats'
import { PostseasonBracket } from '@/pages/season-end/ui/PostseasonBracket'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'

/**
 * 시즌 끝 화면.
 *
 * 원본 시즌모드는 시즌이 끝나면 장면 0xef → `0xb7b8` 로 **포스트시즌 대진표 0x853ac**(P6 4a-1) 를
 * 띄운다. 그래서 포스트시즌 기록이 있으면 대진표를 먼저 보여 주고, 웹에만 있는 시즌 성적 요약은
 * 오른쪽 위 단추로 넘어가게 뒀다 (원본에 없는 길 — 웹판 요약 화면을 버리지 않으려는 것).
 */
export function SeasonEndScreen({
  career,
  onStartNextSeason,
}: {
  readonly career: PlayerCareer
  readonly onStartNextSeason: () => void
}) {
  const average = battingAverageOf(career.stats)
  const [view, setView] = useState<'대진표' | '성적'>(career.postseason === null ? '성적' : '대진표')

  if (view === '대진표') {
    return (
      <PostseasonBracket
        series={career.postseason}
        nextLabel="다음"
        onNext={onStartNextSeason}
        onShowStats={() => setView('성적')}
      />
    )
  }

  return (
    <PixelScreen
      title={`${career.season}시즌 종료`}
      leftKey={{ label: '다음', onPress: onStartNextSeason }}
      rightKey={
        career.postseason === null ? undefined : { label: '대진표', onPress: () => setView('대진표') }
      }
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

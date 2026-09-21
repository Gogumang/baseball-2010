import { useState } from 'react'
import { BigResult, Notice, Panel, PixelScreen, StatGrid } from '@/shared/ui'
import type { StatEntry } from '@/shared/ui'
import { PostseasonBracket } from '@/pages/season-end/ui/PostseasonBracket'
import type { PitcherCareer, PitcherSeasonStats } from '@/entities/pitcher-career/model/pitcherCareer'
import { seasonEarnedRunAverageOf } from '@/entities/pitcher-career/model/pitcherCareer'

/**
 * 나만의리그 **투수편 시즌 끝 화면** — 45경기를 다 치른 뒤(0xb818c) 연말 사슬로 들어가는 자리다.
 *
 * 타자편 `pages/season-end/ui/SeasonEndScreen.tsx` 와 같은 짜임이고, **대진표는 그 파일의
 * `PostseasonBracket` 을 그대로 가져다 쓴다**(0x853ac — 모드로 갈리지 않는 공용 화면이다).
 * 다른 것은 성적 칸뿐이다: 타율·안타·홈런 자리에 투수 레코드의
 * 아웃 +0x20 · 실점 +0x22 · 세이브 +0x24 · 탈삼진 +0x26 · 승 +0x2e · 패 +0x2f 가 들어간다 (P1 6절).
 *
 * ⚠️ 원본 시즌 끝 사슬은 136(올해의 목표 평가) → 130(타이틀) → 131(MVP) → 132(연말) 인데,
 * 투수편은 목표 표(0xd7e9a)와 리그 투수 성적표가 웹에 없어 136·130·131 을 건너뛴다 —
 * 자세한 까닭은 `entities/pitcher-career/model/pitcherSeasonFlow.ts` 머리글에 적었다.
 */
export function PitcherSeasonEndScreen({
  career,
  onYearEnd,
}: {
  readonly career: PitcherCareer
  readonly onYearEnd: () => void
}) {
  const [view, setView] = useState<'대진표' | '성적'>(career.postseason === null ? '성적' : '대진표')

  if (view === '대진표') {
    return (
      <PostseasonBracket
        series={career.postseason}
        nextLabel="다음"
        onNext={onYearEnd}
        onShowStats={() => setView('성적')}
      />
    )
  }

  const average = seasonEarnedRunAverageOf(career.stats)
  return (
    <PixelScreen
      title={`${career.season}시즌 종료`}
      leftKey={{ label: '다음', onPress: onYearEnd }}
      rightKey={career.postseason === null ? undefined : { label: '대진표', onPress: () => setView('대진표') }}
    >
      <Panel>
        <BigResult>
          {career.wins}승 {career.draws}무 {career.losses}패
        </BigResult>
      </Panel>

      <Panel heading={<>{career.name} 선수 시즌 성적</>}>
        <StatGrid entries={seasonEntriesOf(career.stats)} />
      </Panel>

      <Notice>
        {average > 0 && average < 300
          ? '방어율 3점대 안쪽으로 시즌을 마쳤습니다. 다음 시즌에는 더 큰 기대가 따라붙습니다.'
          : '아쉬움이 남는 시즌이었습니다. 비시즌 훈련으로 다시 시작합시다.'}
      </Notice>
    </PixelScreen>
  )
}

/** 아웃 카운트 → "N.M 이닝" (한 이닝 = 아웃 3) — 기록실 패널과 같은 표기다 */
function inningsTextOf(outs: number): string {
  return `${Math.trunc(outs / 3)}.${outs % 3}`
}

function seasonEntriesOf(stats: PitcherSeasonStats): readonly StatEntry[] {
  return [
    { label: '등판', value: stats.games },
    { label: '승', value: stats.wins },
    { label: '패', value: stats.losses },
    { label: '세이브', value: stats.saves },
    { label: '이닝', value: inningsTextOf(stats.outs) },
    { label: '실점', value: stats.runsAllowed },
    { label: '탈삼진', value: stats.strikeouts },
    { label: '투구', value: stats.pitches },
    // 방어율 0xb6ce8 = 실점 × 2700 / 아웃 (9999 상한) — 100 으로 나눠 보여 준다
    { label: '방어율', value: (seasonEarnedRunAverageOf(stats) / 100).toFixed(2) },
  ]
}

import { seasonGoalsOf, winRatePercentOf } from '@/entities/season-mode/model/seasonGoals'
import type { SeasonGoalInput } from '@/entities/season-mode/model/seasonGoals'
import { ORIGINAL_USER_EVENTS } from '@/shared/config/original/userEvents'
import { battingAverageTextOf, earnedRunAverageTextOf } from '@/widgets/season/lib/seasonText'

/** 목표 한 줄 — 이름 · 목표 · 지금 값 · 달성 */
export interface SeasonGoalLine {
  readonly name: string
  readonly goal: string
  readonly current: string
  readonly achieved: boolean
}

/** 달성 표시 (**근사** — 원본 표시 기호는 확인하지 못했다) */
export const SEASON_GOAL_MARK = { done: '○', yet: '×' } as const

/**
 * 올해의 목표 다섯 줄 — 표 `0xd7cf6` 와 판정 `0xa37bc` 의 다섯 비교를 그대로 줄로 편다.
 * ⚠️ 줄 글(이름·"이상"·"이하")과 타율·방어율 표기는 **근사**다 — 목표를 그리는 함수(0x86fdc 창)의 글을 아직 풀지 못했다.
 * (시즌정보 0xcd 는 목표 화면이 아니라 네 칸 하위 메뉴다 — `widgets/season/lib/seasonInfoMenu.ts`.)
 */
export function seasonGoalLinesOf(yearIndex: number, input: SeasonGoalInput): readonly SeasonGoalLine[] {
  const [rank, winRate, battingAverage, earnedRunAverage, popularityGain] = seasonGoalsOf(yearIndex)
  const currentWinRate = winRatePercentOf(input.wins, input.losses)
  return [
    { name: '순위', goal: `${rank + 1}위 이내`, current: `${input.rank + 1}위`, achieved: input.rank <= rank },
    { name: '승률', goal: `${winRate}% 이상`, current: `${currentWinRate}%`, achieved: currentWinRate >= winRate },
    {
      name: '팀 타율',
      goal: `${battingAverageTextOf(battingAverage)} 이상`,
      current: battingAverageTextOf(input.teamBattingAverage),
      achieved: input.teamBattingAverage >= battingAverage,
    },
    {
      name: '팀 방어율',
      goal: `${earnedRunAverageTextOf(earnedRunAverage)} 이하`,
      current: earnedRunAverageTextOf(input.teamEarnedRunAverage),
      achieved: input.teamEarnedRunAverage <= earnedRunAverage,
    },
    {
      name: '인기도 상승',
      goal: `${popularityGain} 이상`,
      current: `${input.popularityGain}`,
      achieved: input.popularityGain >= popularityGain,
    },
  ]
}

/** StrUSER_EVT[0] "올해의 목표" — 창 제목 (색 표시 그대로) */
const GOAL_WINDOW_TITLE = 0

/**
 * 이벤트의 SYS(sub 1) **올해의 목표 창**(0x741a1 팝업 id 0 → 그리기 0x86fdc) 글.
 * 연초 목표 0xd4 의 내장 이벤트와 정규시즌 끝 392 가 같은 창을 연다.
 * ⚠️ 창 배치는 미해독이라 **근사**: 제목 StrUSER_EVT[0] 아래에 다섯 줄을 글로 편다.
 */
export function seasonGoalWindowText(yearIndex: number, input: SeasonGoalInput): string {
  const title = ORIGINAL_USER_EVENTS[GOAL_WINDOW_TITLE] ?? ''
  const lines = seasonGoalLinesOf(yearIndex, input).map((line) =>
    `${line.achieved ? SEASON_GOAL_MARK.done : SEASON_GOAL_MARK.yet} ${line.name} ${line.goal} (${line.current})`)
  return [title, ...lines].join('!N')
}

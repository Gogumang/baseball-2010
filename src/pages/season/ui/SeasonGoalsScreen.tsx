import { RawScreen } from '@/shared/ui'
import {
  SEASON_GOAL_REWARDS, achievedSeasonGoalCount, seasonGoalResultEventId, seasonGoalYearBonusOf,
} from '@/entities/season-mode/model/seasonGoals'
import type { SeasonGoalInput } from '@/entities/season-mode/model/seasonGoals'
import { SeasonListWindow } from '@/widgets/season/ui/SeasonListWindow'
import type { SeasonListRow } from '@/widgets/season/ui/SeasonListWindow'
import { useSeasonCursor } from '@/widgets/season/model/useSeasonCursor'
import { SEASON_GOAL_MARK, seasonGoalLinesOf } from '@/pages/season/lib/seasonGoalLines'

export interface SeasonGoalsScreenProps {
  /** 0-기준 연차 (SR+0xb3). 표 `0xd7cf6` 는 `[연차idx × 5 + i]` 로 읽는다 */
  readonly yearIndex: number
  /** 지금 성적 — 그대로 `achievedSeasonGoalCount` 에 넘긴다 */
  readonly input: SeasonGoalInput
  readonly onBack: () => void
}

/**
 * 올해의 목표 — 표 `0xd7cf6`, 판정 `0xa37bc` (P4 2b 확정).
 *
 * 정규시즌이 끝나면 이벤트 **392** 가 이 표를 확인하고, 달성 수로 393~396 이 갈린다(`0x8d0e0`).
 * 표·판정식은 `entities/season-mode/model/seasonGoals.ts` 가 가진다 — 여기서는 보여 주기만 한다.
 *
 * ⚠️ 나리(마이플레이어)의 올해의 목표(`0xa3de8`, 표 `0xd7f9e`)와는 **다른 표**다.
 * ⚠️ **원본 배치 미해독 — 근사**: 시즌정보(0xcd) 쪽 화면의 좌표가 안 풀려 공용 판 목록으로 그린다.
 *    팀 타율(×1000)·팀 방어율(×100)의 표기도 근사다 (`seasonText.ts`).
 */
export function SeasonGoalsScreen({ yearIndex, input, onBack }: SeasonGoalsScreenProps) {
  const rows: readonly SeasonListRow[] = seasonGoalLinesOf(yearIndex, input).map((line) => ({
    id: line.name,
    label: `${line.achieved ? SEASON_GOAL_MARK.done : SEASON_GOAL_MARK.yet} ${line.name} ${line.goal}`,
    value: line.current,
  }))

  const achieved = achievedSeasonGoalCount(yearIndex, input)
  const eventId = seasonGoalResultEventId(achieved)
  const reward = SEASON_GOAL_REWARDS[eventId]
  const bonus = seasonGoalYearBonusOf(eventId, yearIndex)
  const rewardText = [
    ['인기도', reward.popularity + bonus.popularity],
    ['평판', reward.reputation + bonus.reputation],
    ['소지금', reward.money + bonus.money],
  ]
    .filter(([, value]) => value !== 0)
    .map(([name, value]) => `${name} ${(value as number) > 0 ? '+' : ''}${value}`)
    .join(' · ')

  const { cursor, moveTo } = useSeasonCursor({ count: rows.length, onSelect: () => undefined, onCancel: onBack })

  return (
    <RawScreen>
      <SeasonListWindow
        title={`${yearIndex + 1}년차 목표`}
        rows={rows}
        cursor={cursor}
        onMoveCursor={moveTo}
        onSelect={() => undefined}
        onBack={onBack}
        footer={
          `달성 ${achieved}/5 → 이벤트 ${eventId}` +
          (rewardText === '' ? '\n보상 없음' : `\n${rewardText}`)
        }
      />
    </RawScreen>
  )
}

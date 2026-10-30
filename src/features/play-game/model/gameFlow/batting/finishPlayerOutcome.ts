import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { DefensePlayResult } from '@/features/play-game/model/gameFlow/batting/finishPlayerOutcome/otherSlices'
import { advanceUntilPlayerTurn } from '@/features/play-game/model/gameFlow/autoPlay/advance'
import { myAtBatFactsOf } from '@/features/play-game/model/gameFlow/batting/finishPlayerOutcome/myAtBatFacts'
import { myAtBatLogOf, myAtBatProgressOf } from '@/features/play-game/model/gameFlow/batting/finishPlayerOutcome/myAtBatProgress'
import { appendLog } from '@/features/play-game/model/gameFlow/log/appendLog'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/**
 * 타석 하나를 경기 상태에 먹이고 다음 내 차례까지 자동 진행한다 — 예전 `applyPlayerOutcome` 의 몸통이다.
 *
 * `defensePlay` 가 있으면 그 결과로 진루·아웃·득점을 갈아 끼운다. `playback` 은 화면에 재생시킬 것 —
 * 실시간으로 이미 다 보여 준 플레이는 null 이고, 홈런은 여기서 비행 틱을 따로 만든다.
 */
export function finishPlayerOutcome(
  progress: GameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
  defensePlay: DefensePlayResult | null,
  /**
   * 화면에 재생시킬 틱 묶음. 홈런 비행이거나, 미리 다 돌려 버린 갈래의 그 결과다.
   * **실시간으로 이미 다 보여 준 플레이는 null** — 넣으면 같은 장면을 한 번 더 튼다.
   */
  playback: DefensePlayResult | null,
  /** 타자 게이트 [sp+0x34] (`resolveDefensePlay` 의 `isRecorded`). 안 넘기면 참 */
  options: { readonly isRecorded?: boolean } = {},
): GameProgress {
  const facts = myAtBatFactsOf(progress, outcome, defensePlay, options.isRecorded !== false)
  const afterMyAtBat = appendLog(
    myAtBatProgressOf(progress, outcome, defensePlay, playback, facts),
    myAtBatLogOf(progress, outcome, defensePlay, facts.runsBattedIn),
    true,
  )
  return advanceUntilPlayerTurn(afterMyAtBat, random)
}

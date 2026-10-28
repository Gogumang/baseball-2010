import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { type GameState, applyAtBatOutcome } from '@/entities/game/model/gameState'
import { survivorsFromBaseOfFates } from '@/features/defense-play/model/runnerFates'
import { advanceRunners } from '@/entities/game/model/baseState'
import { homeRunCountedOf } from '@/features/play-team-game/model/teamGameFlow/records/settlementRecords'
import type { StealArrivalPlay } from '@/features/play-team-game/model/teamGameFlow/types/plays'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/** 사람 타석 하나가 경기에 남기는 사실 — 정산 0xa8024 의 칸들이 모두 이 값에서 나온다 */
export interface OurAtBatFacts {
  readonly before: GameState
  /** `defensePlay` 가 있으면 그 결과로 진루·아웃·득점을 갈아 끼운 경기 */
  readonly game: GameState
  readonly runsBattedIn: number
  /** 판의 아웃 — 반 이닝이 넘어가면 경기 아웃은 0 으로 되돌아가므로 진행 결과에서 직접 읽는다 (`gameFlow` 와 같은 길) */
  readonly outsAdded: number
  /** 우리 타순 커서 */
  readonly slot: number
  /**
   * 이 삼진과 **한 정산**인 도루 판(종류 5)이 있다 — 종류 4·5 가 건너뛰는 칸(범타·삼진 갈래 a8a04 의 결과 링 · ctx+0x162 지우기 ·
   * 시즌 코드 6, a8ac8 타석 칸 +0x14, a8852 리그 타수 +0x20, 돌발 비트 0xa599c)을 안 센다
   */
  readonly runnerPlay: boolean
  /**
   * 낫아웃(state[0x1a]) — 0x3e09e 갈래의 삼진 콜 0xa7c4c 가 사건 5 를 넣고 판(타자주자 포함)을 돈다. 정산 [sp+0x30] 에 그 사건이
   * 판의 아웃 사건 앞에 하나 더 든다 — 상대 투수 +0x20(a8cb0)은 보정 없이 더한다
   */
  readonly droppedThirdStrike: boolean
  /** 정산 홈런 수 [sp+0x24] > 0 — 장내 홈런은 타자 게이트 [sp+0x34](a84d6)가 참일 때만 (`homeRunCountedOf`) */
  readonly homeRunCounted: boolean
}

export function ourAtBatFactsOf(
  progress: TeamGameProgress,
  outcome: AtBatOutcome,
  defensePlay: DefensePlayResult | null,
  stealPlay: StealArrivalPlay | undefined,
): OurAtBatFacts {
  const before = progress.game
  const runnerHint = defensePlay === null ? undefined : { survivorsFromBase: survivorsFromBaseOfFates(defensePlay.runnerFates) }
  const game = applyAtBatOutcome(before, outcome, defensePlay?.advance, runnerHint)
  const runnerPlay = stealPlay !== undefined
  return {
    before,
    game,
    runsBattedIn: game.ourScore - before.ourScore,
    outsAdded: defensePlay?.advance.outsAdded ?? advanceRunners(before.bases, outcome, before.outs).outsAdded,
    slot: before.battingOrderIndex,
    runnerPlay,
    droppedThirdStrike: outcome.kind === '삼진' && defensePlay !== null && !runnerPlay,
    homeRunCounted: homeRunCountedOf(progress, outcome, defensePlay, true),
  }
}

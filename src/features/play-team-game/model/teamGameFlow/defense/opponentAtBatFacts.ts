import { type AtBatOutcome, isHit, isFreePass } from '@/entities/at-bat/model/atBatOutcome'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { type AdvanceResult, advanceRunners } from '@/entities/game/model/baseState'
import type { BaseRunners } from '@/entities/game/model/baseRunners'
import type { GameState } from '@/entities/game/model/gameState'
import type { PitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import { type OpponentAtBatResult, applyOpponentAtBat } from '@/features/play-pitcher-game/model/pitcherGameState'
import { survivorsFromBaseOfFates } from '@/features/defense-play/model/runnerFates'
import { homeRunCountedOf } from '@/features/play-team-game/model/teamGameFlow/records/settlementRecords'
import type { StealArrivalPlay } from '@/features/play-team-game/model/teamGameFlow/types/plays'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * 자동으로 넘긴 간이 타석(`playQuickPlateAppearance`)이 먹인 주자와 도루 — 볼넷 모든 주자 +1(c1918) · 도루(c1982) · 땅볼 진루
 * (0xc15b8)까지. 있으면 결과 링 아웃이 5 이고, 도루 주자마다 리그 기록 +0x2c 를 쌓는다.
 */
export interface QuickAtBatPlay {
  readonly advance: AdvanceResult
  readonly runners: BaseRunners
  readonly stolenRunners: readonly number[]
}

/** 상대 타석 하나가 경기에 남기는 사실 — 정산 0xa8024 의 칸들이 모두 이 값에서 나온다 */
export interface OpponentAtBatFacts {
  readonly before: GameState
  readonly applied: OpponentAtBatResult
  /** 상대 타순 칸 */
  readonly slot: number
  readonly hit: boolean
  /** 투수 +0x2a 는 볼넷·사구를 함께 센다 */
  readonly walk: boolean
  readonly quick: QuickAtBatPlay | undefined
  readonly stealPlay: StealArrivalPlay | undefined
  readonly stealPlayOuts: number | undefined
  readonly wildPitchPlay: PitchArrivalPlay | undefined
  /** 이 정산의 주자 목록을 낸 판 — 종류 5 · 종류 9 판이 함께 선 삼진이면 그 판(a8c5c 는 판의 목록을 본다) */
  readonly runnerListPlay: DefensePlayResult | undefined
  /** 정산 홈런 수 [sp+0x24] > 0 — 상대 타자의 장내 홈런도 타자 게이트 [sp+0x34](a84d6)를 본다 (`homeRunCountedOf`) */
  readonly homeRunCounted: boolean
  /** 낫아웃(state[0x1a]) — 판 운명을 진루로 먹이는 삼진은 0x3e09e 갈래뿐이다. 삼진 콜이 넣은 사건 5 가 [sp+0x30] 에 하나 더 든다 */
  readonly droppedThirdStrike: boolean
}

export function opponentAtBatFactsOf(
  progress: TeamGameProgress,
  outcome: AtBatOutcome,
  defensePlay: DefensePlayResult | null,
  quick: QuickAtBatPlay | undefined,
  stealPlay: StealArrivalPlay | undefined,
  wildPitchPlay: PitchArrivalPlay | undefined,
): OpponentAtBatFacts {
  const before = progress.game
  const applied = applyOpponentAtBat(
    before,
    progress.opponentOrderIndex,
    outcome,
    opponentAdvanceOf(before, outcome, defensePlay, quick),
    opponentRunnerHintOf(defensePlay, quick),
  )
  return {
    before,
    applied,
    slot: progress.opponentOrderIndex,
    hit: isHit(outcome),
    walk: isFreePass(outcome),
    quick,
    stealPlay,
    stealPlayOuts: stealPlay?.result.advance.outsAdded,
    wildPitchPlay,
    runnerListPlay: stealPlay?.result ?? wildPitchPlay?.result,
    homeRunCounted: homeRunCountedOf(progress, outcome, defensePlay, false),
    droppedThirdStrike: outcome.kind === '삼진' && defensePlay !== null,
  }
}

/** 진루 — 판이 있으면 판, 간이 타석이면 그 진루, 아니면 간이 엔진 규칙(**간이 엔진에는 희생플라이가 없다** — E-2 확정) */
function opponentAdvanceOf(
  before: GameState,
  outcome: AtBatOutcome,
  defensePlay: DefensePlayResult | null,
  quick: QuickAtBatPlay | undefined,
): AdvanceResult {
  if (defensePlay !== null) return defensePlay.advance
  if (quick !== undefined) return quick.advance
  return advanceRunners(before.bases, outcome, before.outs, { quickEngine: true })
}

/** 주자 신원 실마리 — 판이 있으면 살아남은 주자, 간이 타석이면 그 주자 목록 */
function opponentRunnerHintOf(defensePlay: DefensePlayResult | null, quick: QuickAtBatPlay | undefined) {
  if (defensePlay !== null) return { survivorsFromBase: survivorsFromBaseOfFates(defensePlay.runnerFates) }
  if (quick !== undefined) return { runners: quick.runners }
  return undefined
}

import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { batterRunnerSafeOfFates } from '@/features/defense-play/model/runnerFates'
import { resolveBurst } from '@/entities/burst-mission/model/burstMissionSession'
import { burstResultBitsOf } from '@/entities/burst-mission/model/burstResultBits'
import { withSeasonBurstMorale } from '@/features/play-team-game/model/teamGameFlow/context/abilityContext'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/** 타석이 끝나는 자리에서 돌발을 판정한다 (0x8f414) */
export function resolveBurstFor(
  progress: TeamGameProgress,
  play: {
    outcome: AtBatOutcome
    runsBattedIn: number
    outsBefore: number
    outsAdded: number
    humanTeamWalkOff: boolean
    /** B5 — 안타 없이 살아 나간 타자주자(야수 선택)도 출루다 (0xa87ba r5). 판 없는 타석은 undefined */
    batterRunnerSafe?: boolean
    /** B6 — 번트 타구(state[0x13]) */
    isBunt?: boolean
    /** B6 — 희생 [sp+8] (`DefensePlayResult.sacrifice`) */
    runnersAdvanced?: boolean
    /** B7 — 0xb68dc 파울 (`DefensePlayResult.buntFoulOut`) */
    foulBall?: boolean
    /** B7 — 판 끝 2·3루의 산 앞 주자 (`DefensePlayResult.scoringBaseRunnerAfter`) */
    runnerInScoringPositionAfter?: boolean
    /** B0 — 정산 홈런 수 [sp+0x24] > 0 (`homeRunCountedOf`) */
    homeRunCounted?: boolean
    /** B9 — 낫아웃(state[0x1a])이면 삼진이어도 안 켠다 (a8fc6) */
    strikeoutWhileRunning?: boolean
  },
): TeamGameProgress {
  if (progress.burst === null) return progress
  // 사구도 B5(출루)·B11 을 켠다 (0xa882a "볼 4개 || 사구" · 0xa8bf4) — burstResultBitsOf 가 '사구' 를 직접 받는다
  const resolution = resolveBurst(progress.burst, burstResultBitsOf(play))
  // 시즌모드 사기(종류 1)는 판정 그 경기 중에 팀 레코드 +2 에 쌓인다 — 다음 공부터 용량 · 사기 감소가 본다 (`withSeasonBurstMorale`)
  const options = resolution.deltas.length === 0 ? progress.options : withSeasonBurstMorale(progress.options, resolution.deltas)
  return {
    ...progress,
    ...(options === progress.options ? {} : { options }),
    burst: resolution.session,
    lastBurstResolution: resolution.judgement !== null ? resolution : null,
    burstRewardDeltas: resolution.deltas.length === 0 ? progress.burstRewardDeltas : [...progress.burstRewardDeltas, ...resolution.deltas],
  }
}


export type BurstPlay = Parameters<typeof resolveBurstFor>[1]

/**
 * 타석 정산 0xa8024 한 번이 돌발 판정 0x8f414 에 넘기는 타석 — 사람 공격 · 사람 수비 정산이 같은 칸을 같은 원본 자리에서 읽는다.
 * `outsAdded` 는 판의 아웃이다 — [sp+0x30] 은 낫아웃이면 삼진 사건이 하나 더 들고 B9 를 안 켠다 (a8fc6)
 */
export function settlementBurstPlayOf(settlement: {
  readonly outcome: AtBatOutcome
  readonly runsBattedIn: number
  readonly outsBefore: number
  readonly outsAdded: number
  readonly droppedThirdStrike: boolean
  readonly humanTeamWalkOff: boolean
  readonly defensePlay: DefensePlayResult | null
  readonly homeRunCounted: boolean
}): BurstPlay {
  const { defensePlay, droppedThirdStrike } = settlement
  return {
    outcome: settlement.outcome,
    runsBattedIn: settlement.runsBattedIn,
    outsBefore: settlement.outsBefore,
    outsAdded: settlement.outsAdded + (droppedThirdStrike ? 1 : 0),
    strikeoutWhileRunning: droppedThirdStrike,
    humanTeamWalkOff: settlement.humanTeamWalkOff,
    batterRunnerSafe: defensePlay === null ? undefined : batterRunnerSafeOfFates(defensePlay.runnerFates),
    // B6 — 번트 타구(state[0x13]) && (희생 [sp+8] || 득점) (a88e0 · a88f8)
    isBunt: defensePlay?.buntBall === true,
    runnersAdvanced: defensePlay?.sacrifice === true,
    // B7 — 루프 a88fc: !0xb68dc(파울 — 정산에 오는 판은 번트 파울 아웃뿐) && 2·3루 첫 산 주자가 타자 아님 && 번트
    foulBall: defensePlay?.buntFoulOut === true,
    runnerInScoringPositionAfter: defensePlay?.scoringBaseRunnerAfter === true,
    homeRunCounted: settlement.homeRunCounted,
  }
}

/** 돌발 결과 창을 닫는다 (보상은 앱이 시즌 레코드에 얹는다 — 판정에 변화량이 들어 있다) */
export function closeBurstWindow(progress: TeamGameProgress): TeamGameProgress {
  return progress.lastBurstResolution === null ? progress : { ...progress, lastBurstResolution: null }
}


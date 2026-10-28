import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { batterRunnerSafeOfFates } from '@/features/defense-play/model/runnerFates'
import { resolveBurst } from '@/entities/burst-mission/model/burstMissionSession'
import { withMoraleAbilityCut } from '@/entities/pitcher-career/model/pitcherCareer'
import { nariMoraleAfterBurst } from '@/entities/career/model/nariMorale'
import { burstResultBitsOf } from '@/entities/burst-mission/model/burstResultBits'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/** 타석이 끝나는 자리에서 돌발을 판정한다 (0x8f414) */
export function resolveBurstFor(
  progress: PitcherGameProgress,
  outcome: AtBatOutcome,
  runsScored: number,
  outsBefore: number,
  outsAdded: number,
  defensePlay: DefensePlayResult | null,
  /** 정산 홈런 수 [sp+0x24] > 0 — B0 을 켜는 홈런 갈래에 드는가 (`applyDefensivePlay`) */
  homeRunCounted: boolean,
  /** state[0x1a] 낫아웃 — B9 를 안 켠다 (a8fc6) */
  strikeoutWhileRunning = false,
): PitcherGameProgress {
  if (progress.burst === null) return progress
  const resolution = resolveBurst(
    progress.burst,
    burstResultBitsOf({
      // 사구도 B5(출루)·B11 을 켠다 (0xa882a "볼 4개 || 사구" · 0xa8bf4) — burstResultBitsOf 가 직접 받는다
      outcome,
      runsBattedIn: runsScored,
      outsBefore,
      outsAdded,
      ...defensePlayBitsOf(defensePlay),
      homeRunCounted,
      strikeoutWhileRunning,
      // ⚠️ 0xa89f0 — 사람 팀 승리로 경기가 끝나면 홈런·볼넷 비트를 함께 켠다 (P7 K1)
      humanTeamWalkOff: progress.game.isFinished && progress.game.ourScore > progress.game.opponentScore,
    }),
  )
  return withBurstResolution(progress, resolution)
}

function withBurstResolution(progress: PitcherGameProgress, resolution: ReturnType<typeof resolveBurst>): PitcherGameProgress {
  const resolved: PitcherGameProgress = {
    ...progress,
    burst: resolution.session,
    lastBurstResolution: resolution.judgement !== null ? resolution : null,
  }
  if (resolution.deltas.length === 0) return resolved
  // 0x8e34c 종류 1 사기 — 8e410 0xa3a24(R) + 양 → 8e420 0xa3a44(R, …)(0..100). 다음 공부터 두 팀 용량 · 내 능력치가 새 값을 본다
  const morale = nariMoraleAfterBurst(progress.options.teamMorale, resolution.deltas)
  return {
    ...withPitcherGameMorale(resolved, morale),
    burstRewardDeltas: [...(progress.burstRewardDeltas ?? []), ...resolution.deltas],
  }
}

/** 판이 켜는 결과비트 재료 — 판 없는 타석(삼진 · 볼넷 · 간이 엔진)은 모두 거짓 */
function defensePlayBitsOf(defensePlay: DefensePlayResult | null) {
  return {
    // B5 — 안타 없이 살아 나간 타자주자(야수 선택)도 출루다 (0xa87ba r5)
    batterRunnerSafe: defensePlay === null ? undefined : batterRunnerSafeOfFates(defensePlay.runnerFates),
    // B6 — 번트 타구(state[0x13]) && (희생 [sp+8] || 득점) (a88e0 · a88f8)
    isBunt: defensePlay?.buntBall === true,
    runnersAdvanced: defensePlay?.sacrifice === true,
    // B7 — 루프 a88fc: !0xb68dc(파울 — 정산에 오는 판은 번트 파울 아웃뿐) && 2·3루 첫 산 주자가 타자 아님 && 번트
    foulBall: defensePlay?.buntFoulOut === true,
    runnerInScoringPositionAfter: defensePlay?.scoringBaseRunnerAfter === true,
  }
}

/**
 * **경기 중 나리 사기가 바뀌었다** — 두 팀 레코드 +2(0x66e44 용량)와 내 투수 능력치의 사기 감소(0xb570c b57c4 — b5768 이 쓴 같은 칸)가
 * 다음 계산부터 새 값을 본다. 사기 감소 앞 능력치(`statsBeforeMoraleCut`)가 없으면 능력치는 그대로 둔다
 */
export function withPitcherGameMorale(progress: PitcherGameProgress, morale: number): PitcherGameProgress {
  const { options } = progress
  if (options.teamMorale === morale) return progress
  return {
    ...progress,
    options: {
      ...options,
      teamMorale: morale,
      ...(options.statsBeforeMoraleCut === undefined ? {} : { stats: withMoraleAbilityCut(options.statsBeforeMoraleCut, morale) }),
    },
  }
}

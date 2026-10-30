import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { resolveBurst, type BurstResolution } from '@/entities/burst-mission/model/burstMissionSession'
import { burstResultBitsOf } from '@/entities/burst-mission/model/burstResultBits'
import { batterRunnerSafeOfFates, type DefensePlayResult } from '@/features/play-game/model/gameFlow/batting/finishPlayerOutcome/otherSlices'
import type { MyAtBatFacts } from '@/features/play-game/model/gameFlow/batting/finishPlayerOutcome/myAtBatFacts'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/** 정산 결과비트 0xa599c — 판 칸에서 */
function myAtBatResultBitsOf(progress: GameProgress, outcome: AtBatOutcome, defensePlay: DefensePlayResult | null, facts: MyAtBatFacts): number {
  return burstResultBitsOf({
    // 사구도 B5(출루)·B11 을 켠다 — burstResultBitsOf 가 '사구' 를 받는다 (0xa882a · 0xa8bf4)
    outcome,
    runsBattedIn: facts.runsBattedIn,
    outsBefore: progress.game.outs,
    // [sp+0x30] — 낫아웃은 삼진 사건이 하나 더 들고 B9 를 안 켠다 (a8fc6)
    outsAdded: facts.settledOuts,
    strikeoutWhileRunning: facts.droppedThirdStrike,
    humanTeamWalkOff: facts.isWalkOff,
    // B5 — 안타 없이 살아 나간 타자주자(야수 선택)도 출루다 (0xa87ba r5)
    batterRunnerSafe: defensePlay === null ? undefined : batterRunnerSafeOfFates(defensePlay.runnerFates),
    // B6 — 번트 타구(state[0x13]) && (희생 [sp+8] || 득점) (a88e0 · a88f8)
    isBunt: defensePlay?.buntBall === true,
    runnersAdvanced: defensePlay?.sacrifice === true,
    // B7 — 루프 a88fc: !0xb68dc(파울 — 정산에 오는 판은 번트 파울 아웃뿐) && 2·3루 첫 산 주자가 타자 아님 && 번트
    foulBall: defensePlay?.buntFoulOut === true,
    runnerInScoringPositionAfter: defensePlay?.scoringBaseRunnerAfter === true,
    homeRunCounted: facts.homeRunCounted,
  })
}

/**
 * 돌발 판정은 타석이 끝나는 자리에서 한다 (0x4e6d4 → 0x8f414). 결과비트가 0 이거나
 * 목표 5번이면 판정이 나지 않고 돌발이 남지만, 다음 타석은 늘 자동진행(0x21)이라 그 진입(0x8f628)에서
 * 판정 없이 내려간다 (`withoutPendingBurst`). 돌발이 없으면 null
 */
export function myAtBatBurstOf(
  progress: GameProgress,
  outcome: AtBatOutcome,
  defensePlay: DefensePlayResult | null,
  facts: MyAtBatFacts,
): BurstResolution | null {
  if (progress.burst === null) return null
  return resolveBurst(progress.burst, myAtBatResultBitsOf(progress, outcome, defensePlay, facts))
}

/**
 * 돌발 칸 — 아직 안 보여 준 판정을 지우지 않는다(지우는 것은 창을 닫을 때뿐이다).
 * (판정은 이제 내 타석 끝에서만 나므로 앞 판정이 안 보인 채 남을 일은 없다 — 안전하게 둔다)
 */
export function burstFieldsOf(progress: GameProgress, resolution: BurstResolution | null): Pick<GameProgress, 'burst' | 'lastBurstResolution'> {
  if (resolution === null) return { burst: progress.burst, lastBurstResolution: progress.lastBurstResolution }
  return { burst: resolution.session, lastBurstResolution: resolution.judgement !== null ? resolution : progress.lastBurstResolution }
}

import { applyPitchResolution } from '@/entities/at-bat/model/atBatState'
import { type DefensePlayResult, recordedOutcomeOf } from '@/features/defense-play/model/runDefensePlay'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { enterPitchSelection } from '@/features/play-pitcher-game/model/pitcherGameFlow/atBat/pitchSelection'
import { advance } from '@/features/play-pitcher-game/model/pitcherGameFlow/auto/advance'
import { applyDefensivePlay } from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/defensivePlay'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/**
 * 화면이 다 돌린 수비 플레이를 **그때** 경기 상태에 먹인다.
 *
 * `result.advance`(진루·아웃·실점)가 여기서 비로소 경기 상태가 된다. 이미 눈으로 다 본 플레이라
 * `playback` 을 안 주면 `lastDefensePlay` 에 넣지 않는다 — 넣으면 같은 장면을 한 번 더 재생한다.
 */
export function resolveDefensePlay(
  progress: PitcherGameProgress,
  result: DefensePlayResult,
  random: RandomPort,
  /** 화면에 재생시킬 틱 묶음. 미리 다 돌려 버린 갈래(`throwPitch`)만 준다 */
  playback: DefensePlayResult | null = null,
): PitcherGameProgress {
  if (progress.pendingDefensePlay === null) return progress
  // 파울로 닫힌 판 — 판 끝 판정 B 0xae3e8 ae568 이 정산 0xa8024 를 건너뛰고 0xf(같은 타석 다음 공)로, 0x35108 이
  // 0xa975c(주자를 판 앞 자리로) · 0xb6b58(스트라이크 ≤ 1 이면 +1)을 부른다 — 웹 타석 칸의 '파울' 과 같은 규칙이다
  if (result.foulEnded === true) {
    return enterPitchSelection(
      {
        ...progress,
        pendingDefensePlay: null,
        atBat: applyPitchResolution(progress.atBat, { kind: '파울' }),
        lastDefensePlay: playback ?? progress.lastDefensePlay,
        defenseScene: result.scene,
      },
      random,
    )
  }
  // 파울 각 공을 낙구 전에 잡은 판(파울 뜬공 아웃)은 타석 칸에 결과가 없다 — 판 끝 정산의 뜬공 아웃이 타석 결과다
  const atBatOutcome = progress.atBat.outcome ?? result.outcome ?? null
  // 타석이 안 끝났는데 붙들려 있을 수는 없다 — 그래도 칸은 비워 경기가 멈추지 않게 한다
  if (atBatOutcome === null) return { ...progress, pendingDefensePlay: null, defenseScene: result.scene }
  // 기록은 판 끝 정산(0xa8024)이 낸 결과다 — 타석에 실린 결과는 타석을 끝낸 임시 값이다(`battedContact`)
  const outcome = recordedOutcomeOf(progress.pendingDefensePlay, result)
  return advance(applyDefensivePlay({ ...progress, pendingDefensePlay: null }, outcome, true, progress.atBat.balls, result, playback), random)
}

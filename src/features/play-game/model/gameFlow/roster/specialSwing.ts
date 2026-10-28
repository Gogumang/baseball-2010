import { specialSwingCountOf } from '@/entities/batting/model/specialSwing'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/**
 * 내 타순 칸의 필살 남은 횟수 `0xaea30(팀)` — 아직 안 채웠으면 `0xaebe4` 가 채울 값으로 읽는다.
 *
 * ```
 * aef28  B = 0xae89c(팀) ; B+0x18 == 0 → 0xae9e8(팀, 0)
 * aef36  0xaea30(팀) ≥ 0 → 그대로
 * aef3e  마타자(0xb633d) → s8 0xd84fa[레벨] · 아니면 u8 0xd84f0[B+0x18]   ; 내 선수는 마선수가 아니다
 * aefec  0xb62b4(B, 0x17) 무자비(장착 비트) → +1
 * ```
 */
export function mySpecialSwingRemainingOf(
  progress: GameProgress,
  batter: {
    /** 고른 필살 번호 (선수 +0x18) */
    readonly swingNumber: number
    /** 타자 스킬 23 무자비 장착 */
    readonly hasRuthlessSkill: boolean
  },
): number {
  if (progress.specialSwingRemaining >= 0) return progress.specialSwingRemaining
  return specialSwingCountOf({
    swingNumber: batter.swingNumber,
    isAceBatter: false,
    hasRuthlessSkill: batter.hasRuthlessSkill,
  })
}

/**
 * 필살 스윙이 나간 틱 `0x4e136` — `0xae9e8(팀, 남은 − 1)`. 줄인 값은 타석 그림(`BattingStage.onSpecialSwingUsed`)이
 * `remainingAfterSpecialSwing` 으로 이미 계산해 넘긴다. 난수 없음.
 */
export function spendMySpecialSwing(progress: GameProgress, remaining: number): GameProgress {
  if (progress.specialSwingRemaining === remaining) return progress
  return { ...progress, specialSwingRemaining: remaining }
}

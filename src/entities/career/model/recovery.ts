import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'

/**
 * 휴식·입원 뒤 회복 판정 (0x1b308 휴식 — 질병 60% · 부상 30%, G 2-2 확정).
 *   질병: 난수 ≥ 확률이고 남은 기간 > 0 이면 기간만 −1, 아니면 낫는다 (StrMODE[206])
 *   부상: 기간을 먼저 −1, 난수 < 확률이거나 기간이 0 이면 낫는다 (문자열 0xcca04)
 * 입원(0x1575c)은 같은 구조에 질병 90% · 부상 70% 다 (G 3-3 확정).
 *
 * **타자편·투수편이 함께 쓴다.** 원본은 모드 3·4 를 한 벌의 코드로 돌리고 병·부상 칸도
 * 같은 자리(+5·+6·+0x7c · +0x1b5·+0x1ce·+0x1b6)라, 여기서도 커리어 타입을 묶지 않고
 * **아픈 칸만 가진 것이면 무엇이든** 받는다 (`PlayerCareer`·`PitcherCareer` 둘 다 들어맞는다).
 */

/** 회복 판정이 읽고 쓰는 칸만 추린 것 — 타자·투수 커리어가 둘 다 이 모양이다 */
export interface RecoverableCareer {
  readonly isSick: boolean
  readonly illnessName: string | null
  readonly illnessRemaining: number
  readonly illnessCooldown: number
  readonly isInjured: boolean
  readonly injuryRemaining: number
  readonly injuredGamesPlayed: number
}
export interface RecoveryChance {
  readonly illness: number
  readonly injury: number
}

export const REST_RECOVERY: RecoveryChance = { illness: 60, injury: 30 }
export const HOSPITAL_RECOVERY: RecoveryChance = { illness: 90, injury: 70 }
/** 치료 뒤 질병 이벤트 쿨다운 (+0x7c = 20) */
const CURE_COOLDOWN = 20
const PERCENT = 100

export interface RecoveryRoll<TCareer extends RecoverableCareer> {
  readonly career: TCareer
  /** 회복 알림 문구 */
  readonly recoveries: readonly string[]
}

export function rollRecovery<TCareer extends RecoverableCareer>(
  career: TCareer,
  chance: RecoveryChance,
  random: RandomPort,
): RecoveryRoll<TCareer> {
  let next = career
  const recoveries: string[] = []
  if (next.isSick) {
    const roll = randomIntegerBelow(random, 0, PERCENT)
    if (roll >= chance.illness && next.illnessRemaining > 0) {
      next = { ...next, illnessRemaining: next.illnessRemaining - 1 }
    } else {
      recoveries.push(`다음 질병이 치료되었습니다 [${next.illnessName ?? ''}]`)
      next = { ...next, isSick: false, illnessName: null, illnessRemaining: 0, illnessCooldown: CURE_COOLDOWN }
    }
  }
  if (next.isInjured) {
    const remaining = Math.max(0, next.injuryRemaining - 1)
    const roll = randomIntegerBelow(random, 0, PERCENT)
    if (roll < chance.injury || remaining === 0) {
      recoveries.push('부상에서 회복 되었습니다.')
      // 부상에서 회복되면 누적 경기 수도 0 으로 (G-2)
      next = { ...next, isInjured: false, injuryRemaining: 0, injuredGamesPlayed: 0 }
    } else {
      next = { ...next, injuryRemaining: remaining }
    }
  }
  return { career: next, recoveries }
}

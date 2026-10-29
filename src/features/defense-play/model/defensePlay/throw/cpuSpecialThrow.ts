import { horizontalDistance } from '@/entities/fielding/model/fieldGeometry'
import { BOUNCE_THROW_DISTANCE } from '@/entities/fielding/model/fieldingErrors'
import { type FielderState, NONE } from '@/entities/fielding/model/fieldingState'
import { planThrow, thrownWith } from '@/entities/fielding/model/throwPlan'

/** CPU 홈 특수 송구가 0xa1620 에 무엇을 넘기는가 (`cpuSpecialThrowOf`) */
interface CpuSpecialThrow {
  /** 계획 [1] — 0xa1620 다섯째 인자. 거짓이면 특수 굴림이 아무 효과도 없다 */
  readonly special: true
  /** 거리 상한(20400)을 넘어 원바운드로 던진다 — 악송구 굴림을 건너뛴다 */
  readonly bounce: boolean
  /** 송구 속도 +0xdc 를 +0xd8(= +0xd4 × 130%)로 바꿔 끼운 던지는 야수 (`thrownWith`) */
  readonly thrower: FielderState
}

export const NO_CPU_SPECIAL_THROW = { special: false, bounce: false } as const

/** 특수 송구를 고른 결과 — 특수가 아니면 `NO_CPU_SPECIAL_THROW` */
export type CpuSpecialThrowChoice = CpuSpecialThrow | typeof NO_CPU_SPECIAL_THROW

/**
 * **CPU 홈 송구 20% 특수 송구의 효과** — `0xafa60` 이 굴린 특수 값이 어디까지 내려가는가 (직접 뜬 것).
 *
 * ```
 * afad2: b == 0 이면 r6 = (rand(0,100) ≤ 19)          ; 0xbfa54, 홈이 아니면 굴림 없음
 * afae6: 플레이.vt58(b, r6)                            ; = 0xb2c90
 * b2c9e: [sp+0x1c] = 특수
 * b2cc4: C = +0xf0[b] ; C == −1 → 공 가진 야수가 직접 들고 뛴다(특수 버려짐)
 * b2de8: 플레이.vt5c(C, [sp+0x1c])                      ; = 0xb2e38
 * b2e78: 플레이.vt8c(결과, 플레이, 던지는야수, C, 특수)   ; = 0xb3444 송구 계획 → +0x14c..+0x153
 * b3528: 외야수(칸>5) && 특수 → 중계 안 함
 * b368a: [1] = 외야수(+0x88 > 5) && 특수 && 송구틱(vtb8) > 0x11
 * b2f06: +0x1f4(사람 레이저) == 0 이면 던지는야수.vtac(받는야수 +0x2c 목표점, [+0x14d] = [1])  ; = 0xa1620
 * a165c: 특수 → 야수+0xe8 = 4
 * a16be: 특수 && 거리 > cfg(17000)×120/100 → 거리 = 상한, 원바운드 표시
 * a16dc: +0xdc(송구 속도) = 특수 ? +0xd8 : +0xd4      ; 0xa0fc4: +0xd8 = +0xd4 × 130 / 100
 * a17fc: 원바운드면 +0xc0 = 4, 각도 ±1 (0xbfaa0 = rand(0,2)) → **악송구 굴림 건너뜀**
 * a1828: 아니면 악송구 굴림 기준 = +0xe4 + 특수×100 + 100 (`rollThrowError`)
 * ```
 * 곧 **"레이저급 속도"는 맞다** — 다만 계획 [1] 을 거치므로 **외야수가, 중계 없이, 17틱 넘게 걸리는
 * 홈 송구**일 때만 효과가 난다. 내야수의 홈 송구는 20% 를 맞혀도 아무 차이가 없다(굴림만 먹는다).
 *
 * 원본은 0xb2c90 이 실패하면(직접 뛰는 게 빠름·거리 ≤ 600) 다음 틱에 `0xafa60` 이 다시 돌아 또 굴린다 —
 * 웹도 준비가 끝난 틱부터 4c 절이 매 틱 다시 고르므로 같다.
 * 원바운드 거리는 웹 관례대로 수평 거리로 잰다(원본 0xbf9f1 은 던지는 쪽 높이 1000 을 넣는다).
 */
export function cpuSpecialThrowOf(fielders: readonly FielderState[], throwerSlot: number, receiverSlot: number): CpuSpecialThrowChoice {
  if (receiverSlot === NONE) return NO_CPU_SPECIAL_THROW
  const plan = planThrow({ fielders, fromSlot: throwerSlot, finalSlot: receiverSlot, base: 0, special: true })
  if (!plan.special) return NO_CPU_SPECIAL_THROW
  const holder = fielders[throwerSlot]
  return {
    special: true,
    bounce: horizontalDistance(holder.position, fielders[receiverSlot].target) > BOUNCE_THROW_DISTANCE,
    thrower: thrownWith(holder, true),
  }
}

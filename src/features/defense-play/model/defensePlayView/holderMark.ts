import type { HolderMark } from '@/entities/fielding/model/defenseView/holderMark'
import { HOLDER_MARK_ANIM } from '@/shared/config/original/defenseAnimations'

/**
 * 공 가진 야수 고리를 띄울지와 그 애니 (0x43cb0 머리 0x43cb0~0x43d28, 직접 뜬 것).
 * ```
 * 43cc6: [[경기+0x200]+0x118](플레이 종류) == 8 이면 끝        ; 더비 판 종류 — 웹 수비 판에는 없는 종류다
 * 43cd4: H = 0xb0c91(플레이) = 야수[플레이+0x130] ; 없으면 끝
 * 43cfc: 경기+0x19ac == 0 이면 끝                              ; 쥐기 0xb2710 의 메시지 0x15 가 세움, 0x17 진입 0x467de 가 지움
 * 43ce2: 애니 = state[0x31 + state[9]] == 0 (공격이 사람) ? 3 : 1
 * 43d1c: 경기+0x19ad(레이저 반짝임)면 애니 = 2
 * ```
 * ⚠️ 레이저 반짝임 야수 칠하기(0x43406)와 달리 deadly_effect A(+0x1990)를 **안 본다**.
 */
export function holderMarkOf(input: {
  /** 경기+0x19ac — 이 판에 누가 한 번이라도 쥐었나 */
  readonly grabbed: boolean
  /** 플레이+0x130 — 마지막으로 쥔 야수 칸. 없으면 −1 */
  readonly holderSlot: number
  /** state[0x31 + state[9]] == 1 */
  readonly offenseIsCpu: boolean
  /** 경기+0x19ad */
  readonly isShining: boolean
}): HolderMark | null {
  if (!input.grabbed) return null
  if (!isFielderSlot(input.holderSlot)) return null
  const anim = input.isShining ? HOLDER_MARK_ANIM.shining : offenseMarkAnimOf(input.offenseIsCpu)
  return { slot: input.holderSlot, anim }
}

/** 43ce2 — 공격이 사람이면 3(빨강), 컴퓨터면 1(하늘) */
function offenseMarkAnimOf(offenseIsCpu: boolean): number {
  return offenseIsCpu ? HOLDER_MARK_ANIM.cpuOffense : HOLDER_MARK_ANIM.humanOffense
}

/** 수비 칸 0~8 인가 */
export function isFielderSlot(slot: number): boolean {
  return Number.isInteger(slot) && slot >= 0 && slot <= 8
}

/** 반짝일 야수 칸 고르기 — 0~8 밖이면 아무도 안 반짝이는 것으로 본다(−1 이 "없음" 이다) */
export function laserShiningSlotOf(slot: number | null | undefined): number | null {
  if (slot == null || !isFielderSlot(slot)) return null
  return slot
}

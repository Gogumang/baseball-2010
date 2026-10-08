import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'

/**
 * ============================================================================
 * **홈런 효과 객체 종류 2 — 알갱이 칸 7 개의 불꽃** (원본 [0x1400064], 2026-10-07 직접 뜸)
 * ============================================================================
 *
 * ## 다시 깔기 — `0x90190(객체, 2, 1)` → 0x8fe58
 * ```
 * 90190  +4(종류) = 2 · +0x20(자리 인자 켬) = 1
 * 8fe5c  +8(켜짐) = 0 · 0x8fc70(앞 칸 · 버퍼 모두 해제)
 * 8ff12  종류 2: 칸 수 7 · 칸 버퍼 +0x14(칸 0x18 바이트)
 * 8ff6e  s = W/8 · r = Σ(8 번) (s − 1) = 8(s − 1) · x0 = W/2 − r/2 · y0 = H + 70
 * 8ffbc  칸 i = 0..6 마다 0x8f97c(칸, x0 + i·s, y0, 3i)        ; +0x20 == 1 이라 인자 그대로 — **굴림 없음**
 * 90056  +0x20 = 0
 * ```
 * 부르는 곳(`0x90191` xref 전수): 장면 초기화 3ef6e(종류 0) · **일반 홈런 0x51d1e(2, 1)** · **홈런더비 0x527be(2, 1)** · 경기 정산
 * 0x4ea0c 의 0x4f4cc(2, **0**)와 0x4f51c(0, 0). 부른 뒤 +8 = +9 = 1 로 켠다(0x51d1e · 0x527be · 0x4f4d8 · 0x4f52a).
 * ⚠️ 0x4f4d8 은 홈런이 아니라 **경기 정산 상태 0x19 진입 0x4ea0c** 다: 갈래 [sp+0x50] 이면 +8 = +9 = 0(0x4f428) 뒤 표 0xcfc98 이 6 넘으면
 * 종류 2 를 **인자 0**(자리를 굴린다 — 칸마다 rand 2 번)으로, 아니면 종류 0(비 — 1202 굴림, 바람 0x8fd28)을 켠다. 결과 화면 그리기
 * 0x4a384(0x4a452)가 조건 없이 틱을 부른다. → 경기 끝 결과 화면도 난수를 쓴다(이 일감 밖 — 미이식).
 *
 * ## 틱 — `0x901a0` 종류 2 갈래 0x90372 (칸 차례 0..6)
 * ```
 * 90394  칸.vt = 0x8fa00:
 *          상태 1: 기다림 +0x10 −1 ; ≤ 0 이면 상태 2 · 파티클 0xbbc84(x, y, id 16, 그림 10)        ; 붙잡지 않는다
 *          상태 2: r = rand(0, 2) · 상태 3 · +0x14 = 0xbbc84(x, y − 270, r == 0 ? 13 : 14, 그림 10)
 *          상태 3: +0x14 ≠ 0 이고 이미터+0x58 == 3(끝) 이면 상태 4 · +0x11 = 5
 *          상태 4: 0 을 돌려준다 (그 밖은 1)
 * 903a0  0 이면 +0x11 −1 ; ≤ 0 이면 칸을 비우고 첫 빈 칸(= 같은 칸)에 새로 깔아 0x8f97c(칸, 0, 0, 0)       ; +0x20 == 0
 * 8f99a    → x = rand(40, W − 40) · y = rand(H + 50, H + 100) · 기다림 50                         ; 굴림 2 번
 * ```
 * 그래서 칸마다 한 바퀴 = 굴림 1(상태 2) + 다시 깔기 2 이고, **꺼지지 않고 끝없이 돈다** — +8 을 0 으로 내리는 곳은 0x8fe58(다시 깔기)
 * · 경기 정산 0x4f428 뿐이다.
 *
 * ## 틱을 부르는 때
 * - 0x40b18(HOMERUN 글자)이 **유지 단계(+0x1961 ≥ 4)를 그린 그림에서만** 0x40faa 로 부른다. 0x40b18 은 0x17 그리기 0x46c88 이
 *   `0x33c98 && 관문 0xb0d28 열림 && (state[0x1d] || 플레이+0x129)` 이고 +0x1960 이 켜졌을 때만 부른다.
 *   → 일반 홈런은 글자를 켠 뒤 29번째 그림(날아 들어오기 22 + 흔들기 6)부터, 더비는 9 − (남은 +0x1963)번째 그림부터.
 * - 경기 정산 결과 화면 0x4a384 는 조건 없이 부른다(위 0x4ea0c 가 깐 것).
 * - 키 건너뛰기 0x519cc 는 0x8fc70 으로 칸 버퍼를 버리고(+0x14 = 0) +0x1960 을 끈다 — 그 뒤엔 0x40b18 이 안 불려 틱도 없다.
 *
 * ## 상태 3 이 읽는 +0x58 — 지운 이미터의 자리 (2026-10-08 자체 힙 해독, entities/particle `particleScene` 머리말)
 * 터짐 이미터가 끝나면(상태 3) 프레임 끝 0x6de84 가 그 틱에 지운다(0x6de30 → delete 0x26ec). 칸은 **다음 그림**의 상태 3 에서
 * 그 자리의 +0x58 을 읽는다. 자체 힙은 머리 4 바이트만 고쳐 몸이 남고, 등급 3(0x3c < 크기 ≤ 0x7c) 안에서 **주소가 가장 낮은 빈 자리**를
 * 준다(할당기 0x28b8 · 0x26ec 를 그대로 돌려 확인). 그래서
 * - 그 사이에 새 이미터가 안 생기면 남은 3 을 읽고 상태 4 로 간다.
 * - 같은 그림에서 앞 칸(0..i−1)이 새 이미터(오름 16 · 터짐 13/14)를 만들 때 지운 자리가 가장 낮은 빈 자리면 새 이미터가 그 자리를
 *   받아(0 채움 → +0x58 = 0) 칸은 3 이 아닌 값을 읽고 상태 3 에 머문다 — 그 새 이미터가 끝나 3 을 남길 때까지.
 * - 치우기 0x6dee4 로 지운 이미터의 자리는 그때의 상태(0 · 1 · 2)가 남아 칸이 그 자리를 다른 이미터가 받아 끝낼 때까지 머문다.
 * 웹은 이 자리를 파티클 장면의 블록 번호(`emitParticles` 의 되돌림)로 들고 `blockStateOf` 로 읽는다. ⚠️ 가정은 그 머리말(등급 3 에
 * 이미터 말고 다른 것이 오가지 않는다 · 관리자 벡터 버퍼 용량 16 은 따르지 않는다).
 *
 * ## 웹 — 이 파일은 칸 기계만 (`initHomeRunFireworks` · `tickHomeRunFireworks`)
 * 파티클 자리(`FireworksParticlePort`)는 부르는 쪽이 파티클 장면으로 잇는다 — 틱은 0x40b18 이 유지 단계를 그린 그림마다,
 * 파티클 틱은 그 그림 뒤 프레임 끝(0x53048 → 0x6de84)이다.
 * 붙인 곳: 홈런더비(타석 화면 — widgets/batting-stage `homeRunEffects` 가 글자 창대로) · 일반 · 팀 · 투수 · 미션 모드의 0x17 수비 판 화면
 * (pages/defense `defenseHomeRunEffects` — 실시간 수비 재생이 진행기 틱마다 경기 난수로 돈다).
 */

/** 원본 화면 크기 — 0x14008b8 · 0x14008c8 */
const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320
/** 0x8ff12 — 종류 2 의 칸 수 */
export const FIREWORK_SLOT_COUNT = 7
/** 0x8f9e0 — 다시 깐 칸의 기다림 */
const RESPAWN_DELAY = 50
/** 0x8fab6 — 상태 4 로 머무는 틱 (+0x11) */
const LINGER_TICKS = 5
/** 0x8fa4e · 0x8fa82 — 파티클 id 와 그림(ptcimg 프레임 10) */
export const FIREWORK_PARTICLES = { rise: 16, burstA: 13, burstB: 14, image: 10 } as const
/** 0x8fa6e — 터지는 자리는 y − 270 */
const BURST_RISE = 270

export interface FireworkSlot<E> {
  /** +0xc — 1 기다림 · 2 쏘기 · 3 터짐 지켜보기 · 4 머묾 */
  readonly state: 1 | 2 | 3 | 4
  /** +4 · +8 */
  readonly x: number
  readonly y: number
  /** +0x10 — s8 기다림 */
  readonly delay: number
  /** +0x11 — 상태 4 남은 틱 */
  readonly linger: number
  /** +0x14 — 터짐 이미터의 자리 (0xbbc84 가 64 개를 넘어 안 만들었으면 null — 상태 3 에 그대로 머문다) */
  readonly burst: E | null
}

export interface HomeRunFireworks<E> {
  readonly slots: readonly FireworkSlot<E>[]
}

/** 파티클 관리자(0xbbc84 · 이미터+0x58) 에 닿는 자리 — 웹 파티클 장면을 넘긴다 */
export interface FireworksParticlePort<E> {
  /** 0xbbc84(x, y, id, 그림, 0, −1, 0, 0) — 이미터 자리(블록), 못 만들면 null */
  emit(id: number, x: number, y: number, image: number): E | null
  /** 그 자리의 +0x58 == 3 — 지운 이미터의 자리면 남은 값, 새 이미터가 받았으면 그 값(머리말) */
  isFinished(emitter: E): boolean
}

/** 0x90190(객체, 2, 1) — 홈런이 까는 일곱 칸. 굴림 없음 */
export function initHomeRunFireworks<E>(): HomeRunFireworks<E> {
  const step = Math.trunc(SCREEN_WIDTH / 8)
  const span = 8 * (step - 1)
  const left = Math.trunc(SCREEN_WIDTH / 2) - Math.trunc(span / 2)
  return {
    slots: Array.from({ length: FIREWORK_SLOT_COUNT }, (_unused, index) => ({
      state: 1 as const,
      x: left + index * step,
      y: SCREEN_HEIGHT + 70,
      delay: 3 * index,
      linger: 0,
      burst: null,
    })),
  }
}

/** 0x8f97c(칸, 0, 0, 0) — 인자 꺼짐(+0x20 == 0): 자리를 굴린다 (x 먼저, y 다음) · 기다림 50. 경기 정산 0x4f4cc 도 이것으로 깐다 */
export function respawnFireworkSlot<E>(random: RandomPort): FireworkSlot<E> {
  const x = randomIntegerBelow(random, 40, SCREEN_WIDTH - 40)
  const y = randomIntegerBelow(random, SCREEN_HEIGHT + 50, SCREEN_HEIGHT + 100)
  return { state: 1, x, y, delay: RESPAWN_DELAY, linger: 0, burst: null }
}

/** s8 로 자른다 (+0x10 · +0x11 은 바이트 칸) */
function signedByte(value: number): number {
  return ((value & 0xff) << 24) >> 24
}

/** 0x901a0 종류 2 한 틱 — 칸 차례대로 */
export function tickHomeRunFireworks<E>(
  fireworks: HomeRunFireworks<E>,
  port: FireworksParticlePort<E>,
  random: RandomPort,
): HomeRunFireworks<E> {
  const slots = fireworks.slots.map((slot) => {
    const { alive, next } = tickSlot(slot, port, random)
    if (alive) return next
    const linger = signedByte(next.linger - 1)
    if (linger > 0) return { ...next, linger }
    return respawnFireworkSlot<E>(random)
  })
  return { slots }
}

/** 0x8fa00 — 칸 하나. 0 을 돌려주면(alive 거짓) 부르는 쪽이 +0x11 을 센다 */
function tickSlot<E>(
  slot: FireworkSlot<E>,
  port: FireworksParticlePort<E>,
  random: RandomPort,
): { readonly alive: boolean; readonly next: FireworkSlot<E> } {
  switch (slot.state) {
    case 1: {
      const delay = signedByte(slot.delay - 1)
      if (delay > 0) return { alive: true, next: { ...slot, delay } }
      port.emit(FIREWORK_PARTICLES.rise, slot.x, slot.y, FIREWORK_PARTICLES.image)
      return { alive: true, next: { ...slot, delay: 0, state: 2 } }
    }
    case 2: {
      const roll = randomIntegerBelow(random, 0, 2)
      const id = roll === 0 ? FIREWORK_PARTICLES.burstA : FIREWORK_PARTICLES.burstB
      const burst = port.emit(id, slot.x, slot.y - BURST_RISE, FIREWORK_PARTICLES.image)
      return { alive: true, next: { ...slot, state: 3, burst } }
    }
    case 3:
      if (slot.burst === null || !port.isFinished(slot.burst)) return { alive: true, next: slot }
      return { alive: true, next: { ...slot, state: 4, linger: LINGER_TICKS } }
    case 4:
      return { alive: false, next: slot }
  }
}

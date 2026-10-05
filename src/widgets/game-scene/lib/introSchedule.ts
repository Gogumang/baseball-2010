/**
 * **경기 시작 인트로** — 경기 장면 상태 0xc (진입 0x3b084 · 갱신 0x39e3c · 키 0x39b54 · 그리기 0x417ac, R10 3절).
 *
 * ```
 * 진입 0x3b084: 카운터 +0x17e2 = 270, 알파 +0x17e4 = 255, +0x17e6 = 15, 효과음 61 (0x6e498(음, 0x3d, 0))
 * 갱신 0x39e3c: 카운터 −= 5 (0 밑으로 안 감)                      → 270 / 5 = 54틱
 *               카운터 ≤ 59 면 k = (60 − 카운터) / 15 :
 *                 알파 = max(1, 255 − 30k) · +0x17e6 = max(0, 15 − 2k)  → 마지막 12틱 네 계단
 *               카운터 0 이면 끝 → 모드 1·이닝/전체 ? 0xd : 0x18(1회초 판)
 * 키 0x39b54:   OK(−5)·'5' → 같은 끝 처리를 곧바로 (건너뛰기)
 * ```
 * 들어오는 길은 적재 상태 8 의 끝 하나 — **모드 1·2·3·4** 만(0x48b20). 타자편(4)·일반(1)·시즌(2) 모두 서고,
 * 대전(8·9)은 인트로 없이 0x18 로 간다. 난수는 쓰지 않는다 (진입·갱신·키·그리기 호출 그래프 확인).
 */

export const INTRO_START_COUNTER = 270
export const INTRO_COUNTER_STEP = 5
/** 270 / 5 */
export const INTRO_TICKS = INTRO_START_COUNTER / INTRO_COUNTER_STEP
const FADE_FROM_COUNTER = 59
const FADE_BASE = 60
const FADE_STEP_COUNTER = 15

/** 인트로가 서는 모드 — 적재 상태 8 끝 `0x48b20~0x48b38` */
export function hasGameIntro(mode: number): boolean {
  return mode >= 1 && mode <= 4
}

/** 틱 t 의 카운터 (+0x17e2) — 진입이 틱 0 이고 갱신마다 5 씩 준다 */
export function introCounterAt(tick: number): number {
  return Math.max(0, INTRO_START_COUNTER - INTRO_COUNTER_STEP * tick)
}

export interface IntroFade {
  /** +0x17e4 — 띠·그림의 알파 (255 → 1) */
  readonly alpha: number
  /** +0x17e6 — 15 → 0. 14 를 넘을 때만 라이벌전 띠(0x3b80c)를 그린다 */
  readonly level: number
}

/** 카운터 하나에서 흐려지기 단계 (0x39e3c) */
export function introFadeOf(counter: number): IntroFade {
  if (counter > FADE_FROM_COUNTER) return { alpha: 255, level: 15 }
  const step = Math.trunc((FADE_BASE - counter) / FADE_STEP_COUNTER)
  return { alpha: Math.max(1, 255 - 30 * step), level: Math.max(0, 15 - 2 * step) }
}

/** 띠 0x6a9f0 의 알파 — `max(1, +0x17e4 − 0x55)` 를 색 0x304ea2 의 윗바이트에 (0x4180a) */
export function introBandAlphaOf(fade: IntroFade): number {
  return Math.max(1, fade.alpha - 0x55)
}

/**
 * **경기 시작 인트로** — 경기 장면 상태 0xc (진입 0x3b084 · 갱신 0x39e3c · 키 0x39b54 · 그리기 0x417ac, R10 3절).
 *
 * ```
 * 진입 0x3b084: 카운터 +0x17e2 = 270, 알파 +0x17e4 = 255, +0x17e6 = 15, 효과음 61 (0x6e498(음, 0x3d, 0))
 * 갱신 0x39e3c: 카운터 −= 5 (0 밑으로 안 감)                      → 270 / 5 = 54틱
 *               카운터 ≤ 59 면 k = (60 − 카운터) / 15 :
 *                 알파 −= 30k (1 밑으로 안 감) · +0x17e6 −= 2k (0 밑으로 안 감) — **틱마다 앞 값에서 뺀다**(39e6c ldrsh → subs → strh)
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

/**
 * 틱 t 의 그림이 보는 카운터 (+0x17e2). 진입 0x3b084 가 270 을 넣은 그 틀에도 갱신 0x39e3c 가 돈다 — 프레임 0x52c50 은 진입(52cee 표)
 * 뒤 키 · 갱신(52e14 표)을 상태 바뀐 틀도 가리지 않고 부르고, 그리기(0xd05a0)는 그 뒤다. 그래서 틱 t 의 그림은 t + 1 번 뺀 값이다
 * (첫 그림 265 · 틱 53 의 마지막 그림 0 — 그 갱신이 다음 상태를 예약한다).
 * (r334 정정: 예전 웹은 틱 t 에 270 − 5t 를 그려 배경 · 흐려짐이 한 틀 늦었다)
 */
export function introCounterAt(tick: number): number {
  return Math.max(0, INTRO_START_COUNTER - INTRO_COUNTER_STEP * (Math.max(0, Math.floor(tick)) + 1))
}

export interface IntroFade {
  /** +0x17e4 — 띠·그림의 알파 (255 → 1) */
  readonly alpha: number
  /** +0x17e6 — 15 → 0. 14 를 넘을 때만 라이벌전 띠(0x3b80c)를 그린다 */
  readonly level: number
}

const START_FADE: IntroFade = { alpha: 255, level: 15 }

/**
 * 틱 t 의 그림이 보는 흐려지기 칸 (0x39e3c 39e52~39e8c). 진입 0x3b084 가 알파 255 · +0x17e6 15 를 넣고, 갱신마다 그 틀의 카운터가
 * 59 이하면 k = (60 − 카운터) / 15 를 **앞 값에서** 뺀다 — 알파 −30k(1 밑으로 안 감) · +0x17e6 −2k(0 밑으로 안 감).
 * 카운터 55 · 50 은 k 0, 45 부터 1 · 30 부터 2 · 15 부터 3 · 0 이 4 라 알파는 255 · 255 · 225 · 195 · 165 · 105 · 45 · 1 …,
 * +0x17e6 은 15 · 15 · 13 · 11 · 9 · 5 · 1 · 0 … 으로 내려간다.
 * (r334 정정: 예전 웹은 `255 − 30k` · `15 − 2k` 로 셈해 마지막 그림까지 알파 135 · 칸 7 에 머물렀다)
 */
export function introFadeAt(tick: number): IntroFade {
  let { alpha, level } = START_FADE
  const last = Math.max(0, Math.floor(tick))
  for (let step = 0; step <= last; step += 1) {
    const counter = introCounterAt(step)
    if (counter > FADE_FROM_COUNTER) continue
    const k = Math.trunc((FADE_BASE - counter) / FADE_STEP_COUNTER)
    alpha = Math.max(1, alpha - 30 * k)
    level = Math.max(0, level - 2 * k)
  }
  return { alpha, level }
}

/** 띠 0x6a9f0 의 알파 — `max(1, +0x17e4 − 0x55)` 를 색 0x304ea2 의 윗바이트에 (0x4180a) */
export function introBandAlphaOf(fade: IntroFade): number {
  return Math.max(1, fade.alpha - 0x55)
}

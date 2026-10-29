/** 진행기가 이 틱을 넘기면 끊는다 — 우리 쪽 안전망 (타구 진행기 240 과 같다) */
export const DEFAULT_MAXIMUM_TICKS = 240
/** 능력치를 안 주면 쓰는 값 — 원본 평균대(등급 3) */
export const DEFAULT_ABILITY = 500
export const HOME_BASE = 4
/** 0xb2c90: 받는 야수까지 이 거리 이하면 던지지 않는다 */
export const MINIMUM_THROW_DISTANCE = 600

/** 슬롯 2 의 0x52602 — [sp+0x14] = 0xae61c(판 종류 ∉ 마스크 0x58c = 2 · 3 · 7 · 8 · 10)가 참일 때만 플레이 vt4c 0xb45dc 를 부른다 */
export const VT4C_BLOCKED_PLAY_KINDS: readonly number[] = [2, 3, 7, 8, 10]

/**
 * **결과 창 뒤 구장 밀기** — 장면 +0x17e2 (홈런더비 결과 창, 상태 0x1a):
 * ```
 * 진입 0x4f574  4f6b4  +0x17e2 = 0
 * 갱신 0x3c0b8  3c0c0  +0x17e2 += 5 ; > 150(0x96) 이면 150
 * 그리기 0x45c18  45c4c 0x78448(구름 흐르기) · 45c62 0x78578(구장, (s16)+0x17e2, 1)
 * ```
 * 한 틱 안에서 진입 → 갱신 → 그리기 차례라(0x52c50) 들어선 틱의 그림부터 5 다. 값만큼 구장·바닥이 **아래로** 내려간다
 * (0x77974 위 = 구장+8 + 값 + 3 · 0x7725c 위 = 구장+8 + 값 + 0xe2) — 하늘만 남기고 30틱에 걸쳐 가라앉는다.
 */
const RESULT_BACKDROP_STEP = 5

export const RESULT_BACKDROP_LIMIT = 150

/** 결과 창에 들어선 뒤 틱 t(0 = 들어선 틱)의 그림에 쓰는 +0x17e2 */
export function resultBackdropOffsetAt(tick: number): number {
  return Math.min(RESULT_BACKDROP_LIMIT, RESULT_BACKDROP_STEP * (Math.max(0, tick) + 1))
}

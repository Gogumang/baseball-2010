/** 판이 닫힌 뒤 갱신(+0x1094 셈 · 그리기 · 파티클 틱) — 탭이 잠들었다 돌아와도 한 번에 이만큼만 따라잡는다 */
export const MAX_CLOSED_CATCH_UP = 30

/** 원작 경기 루프는 한 갱신에 한 틱이다 (0xc2198) */
export const UPDATES_PER_TICK = 1

/** 화면(`DefenseScreen`)이 마지막으로 그린 카메라 오프셋 (+0xfec, +0xff0) — 공 그리기 파티클의 화면 좌표 */
export type CameraOffset = { readonly x: number; readonly y: number } | null

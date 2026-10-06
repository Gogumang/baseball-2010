import { RESULT_BACKDROP_LIMIT } from '@/widgets/batting-stage/lib/stageScenery'

/**
 * **팀경기 정산(상태 0x19) 뒤 배경** — 홈런더비 결과 창(0x1a)과 같은 구름·구장 배경이 가라앉는 양 +0x17e2 (직접 떴다).
 * ```
 * 진입 0x4ea0c  4eb48  +0x17e2 = 0 (r6 = 0, 4eab4)
 * 갱신 0x4b100  4b108~4b13a  r7 = 사람 팀이 이겼나 — 0xb6c20(st, 0)(측 0 이 CPU 인가)이 0 이면 점수(측 0) > 점수(측 1),
 *                            아니면 점수(측 0) < 점수(측 1). 비기면 0
 *               4b13e~4b15c  모드 5·6 이면 r7 = [미션 객체 +0xbc](성공했나)
 *               4b15e~4b178  r7 이면 +0x17e2 += 3 ; > 150(0x96) 이면 150
 * 그리기 0x4a384 4a38a 0x457cc · 4a3be 0x78448(구름 흐르기) · 4a3ce 0x40ff0(장면, (s16)+0x17e2) — 배경 고르기:
 *               시즌 홈·대전이면 시즌 구장(0x77fe8 · 0x77494 · 0x7725c · 0x78490), 아니면 0x78578(…, 값, 상태 ≠ 0x11 = 1)
 * ```
 * 한 틱 안에서 진입 → 갱신 → 그리기 차례라(0x52c50) 이긴 판은 들어선 틱의 그림부터 3 이다. 지거나 비기면 0 그대로 —
 * 구장이 가라앉지 않는다.
 */
export const SETTLEMENT_BACKDROP_STEP = 3

/** 정산에 들어선 뒤 틱 t(0 = 들어선 틱)의 그림에 쓰는 +0x17e2 */
export function settlementBackdropOffsetAt(tick: number, isHumanWin: boolean): number {
  if (!isHumanWin) return 0
  return Math.min(RESULT_BACKDROP_LIMIT, SETTLEMENT_BACKDROP_STEP * (Math.max(0, tick) + 1))
}

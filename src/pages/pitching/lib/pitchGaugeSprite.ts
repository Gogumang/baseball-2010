/**
 * 투구 게이지 그림 (`ui/slt_pitch.pzx` 프레임 0x3a~0x43 — S5 U-15 3절, 실제로 렌더해 확인한 값).
 *
 * 게이지는 **원 한 장**이다. 커서 칸이 오를수록 원이 작아지고 빨강 → 분홍 → 노랑으로 밝아진다.
 * ⚠️ **원본에 PERFECT·GOOD·BAD 같은 글자는 없다** — 그 말은 설명서 StrHOWTO[3] 에만 있다.
 *
 * 그리는 규칙 (0x4d412~0x4d51a — 등급 t `+0x17c0` 이 아직 0 일 때):
 *   칸 0      → 프레임 0x3a 한 장
 *   칸 1~8    → 프레임 0x3b 를 깔고 그 위에 `min(0x3b + 칸, 0x43)`
 *   칸 > 8    → 커서 원은 없고 프레임 0x3a 한 장만 (`cmp r2,#8; bgt` → 0x4d4e8 이 t == 0 이면 0x3a 를 그린다)
 * t 가 정해지면(0x4d52e~) 커서 칸이 멈춘 채 `min(0x3b + 칸, 0x43)` 을 그리고, 0x4d6aa 의 결과 원이 4틱 떠오른다.
 */

export interface GaugeFrame {
  /** 프레임 번호 */
  readonly frame: number
  /** 한 변 픽셀 */
  readonly size: number
  /** 원 색. null 이면 반투명 테두리만 있는 칸이다 */
  readonly color: string | null
}

/** 프레임 0x3a ~ 0x43 */
export const GAUGE_FRAMES: readonly GaugeFrame[] = [
  { frame: 0x3a, size: 43, color: null }, // 반투명 어두운 테두리 원 (첫 칸)
  { frame: 0x3b, size: 43, color: 'rgba(120, 20, 20, 0.55)' }, // 반투명 짙은 빨강 (늘 깔림)
  { frame: 0x3c, size: 41, color: '#ef4d42' },
  { frame: 0x3d, size: 37, color: '#ff615a' },
  { frame: 0x3e, size: 33, color: '#ff6d63' },
  { frame: 0x3f, size: 29, color: '#ff8a84' },
  { frame: 0x40, size: 25, color: '#ffaaa5' },
  { frame: 0x41, size: 21, color: '#ffdb5a' },
  { frame: 0x42, size: 17, color: '#ffe75a' },
  { frame: 0x43, size: 13, color: '#fffb5a' },
]

/** 바깥 테두리 (늘 깔리는 프레임 0x3b) */
export const GAUGE_OUTER_FRAME = GAUGE_FRAMES[1]
/** 가장 작은 원 (0x43). 칸 8 과 9 가 **둘 다** 이 그림이라 화면에서 구별되지 않는다 */
export const GAUGE_SMALLEST_FRAME = GAUGE_FRAMES[9]

/** 커서 칸 c 가 (바닥 0x3b 위에) 그리는 프레임. 0 이거나 8 을 넘으면 바닥 없이 0x3a 한 장이다 (`isGaugeOutlineCell`) */
export function gaugeFrameForCell(cell: number): GaugeFrame {
  if (isGaugeOutlineCell(cell)) return GAUGE_FRAMES[0]
  return GAUGE_FRAMES[Math.min(1 + cell, GAUGE_FRAMES.length - 1)]
}

/** 칸 0 과 칸 > 8 은 프레임 0x3a 한 장만 그린다 (0x4d43c · 0x4d4e8) — 바닥 0x3b 도 없다 */
export function isGaugeOutlineCell(cell: number): boolean {
  return cell <= 0 || cell > 8
}

/** 누른 칸을 보여 주는 결과 그림의 프레임 = `min(0x3b + g, 0x43)` (0x4d6c0) */
export function gaugeResultFrameForCell(cell: number): GaugeFrame {
  return GAUGE_FRAMES[Math.min(Math.max(1 + cell, 1), GAUGE_FRAMES.length - 1)]
}

/** 결과 그림이 떠 있는 틱 수 — `+0x17c4` 가 0~3 인 동안만 그린다 (0x4d6aa) */
export const GAUGE_RESULT_TICKS = 4

/** 결과 그림이 떠오르는 y 오프셋 = `max(15 − 3·틱, 0)` → 15, 12, 9, 6 */
export function gaugeResultOffsetY(tick: number): number {
  return Math.max(15 - 3 * tick, 0)
}

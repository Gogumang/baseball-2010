/**
 * **효과기 종류 8 — 화면 밀기** (142 ↔ 143). 직접 떴다:
 * ```
 * 142 키 0x13c30   '4'/왼 → 장면+0x164 = 1 · 0xbdae9([0x140007c], 8, 0, 4, 1000) → 143 (13d0c~13d26)
 *                  '6'/오른 → 장면+0x164 = 0 · 0xbdae9(…, 8, 0, 3, 1000) → 143 (13d28~13d40)
 * 143 키 0x1457c   끝 코드(편집기 +0x338) 1 → 장면+0x164 ? 3 : 4 · 2 → (+0x164 == 0 일 때만) 4 · 3 → (+0x164 일 때만) 3
 *                  → 0xbdae9(…, 8, 0, 방향, 1000) → 142 (145b2~1461e)
 * 0xbdae8 시작     +4 종류 · +0x18 방향(5 면 0x9d468(3) 굴림 — 여기선 안 쓴다) · +0x24 길이 1000 · +0x1c 밀린 거리 0 ·
 *  (종류 8)        +0x20 보폭 = 크기 × 200 / 길이 (방향 1·2 는 화면 높이, 3·4 는 너비, 0xca7b5 버림) ·
 *                  0xbda00 이 **지금 화면을 떠 둔다**(W·H·2 바이트 — 못 잡으면 효과 없음)
 * 0xbd844 갱신     종류 8 (bd966): 0xbd740 그리기 → 거리 += 보폭 → 크기 이상이면 크기로 · 끝(+0x10 = 2) · 뜬 화면 버림.
 *                  끝 다음 프레임에 효과기를 비운다(bd852) — 그 프레임부터 새 화면 그대로
 * 0xbd740 그리기   d = 거리 · 0xba888(g, dx, dy) 로 지금 그린 새 화면을 옮기고 0xbd704 로 뜬 옛 화면을 그 위에:
 *                  1 → 새 (0, H − d − 1) · 옛 (0, −d)      2 → 새 (0, d − H + 1) · 옛 (0, d)
 *                  3 → 새 (W − d, 0) · 옛 (−d, 0)          4 → 새 (d − W, 0) · 옛 (d, 0)
 * ```
 * 3 은 새 화면이 오른쪽에서 들어오며 옛 화면을 왼쪽으로 밀고, 4 는 그 반대다. 1·2 의 한 줄 겹침(−1 · +1)도 원본 그대로.
 * 240 너비 · 길이 1000 이면 보폭 48 — 거리 0 · 48 · 96 · 144 · 192 다섯 프레임을 그리고 여섯째 프레임부터 새 화면이다.
 * ⚠️ 유력: `0xba888` 을 "이미 그린 화면을 옮기기"로 읽었다 — 흔들기(종류 9, 표 0xd8c4c)가 같은 함수로 화면을 흔드는 것과 같은 쓰임이다.
 */

export type ScreenPushDirection = 1 | 2 | 3 | 4

/** 효과기 종류 8 의 길이 — 142 · 143 둘 다 1000 (`0xfa << 2`) */
export const NARI_SCREEN_PUSH_DURATION = 1000
/** 보폭 식의 곱수 (0xbdb84 `movs r3, #0xc8`) */
const STEP_SCALE = 200

export const ORIGINAL_SCREEN_WIDTH = 240
export const ORIGINAL_SCREEN_HEIGHT = 320

const isVertical = (direction: ScreenPushDirection) => direction === 1 || direction === 2

/** +0x20 보폭 = 크기 × 200 / 길이 (0 쪽 버림) */
export function screenPushStepOf(
  direction: ScreenPushDirection,
  duration: number,
  width = ORIGINAL_SCREEN_WIDTH,
  height = ORIGINAL_SCREEN_HEIGHT,
): number {
  return Math.trunc(((isVertical(direction) ? height : width) * STEP_SCALE) / duration)
}

export interface ScreenPushFrame {
  /** 새 화면(지금 상태가 그린 것)을 옮길 자리 */
  readonly newX: number
  readonly newY: number
  /** 떠 둔 옛 화면을 그릴 자리 */
  readonly oldX: number
  readonly oldY: number
}

/** 효과를 건 뒤 n 번째 갱신의 그림 — 끝났으면(거리 ≥ 크기) null */
export function screenPushFrameAt(
  direction: ScreenPushDirection,
  frame: number,
  duration = NARI_SCREEN_PUSH_DURATION,
  width = ORIGINAL_SCREEN_WIDTH,
  height = ORIGINAL_SCREEN_HEIGHT,
): ScreenPushFrame | null {
  const step = screenPushStepOf(direction, duration, width, height)
  const size = isVertical(direction) ? height : width
  if (step <= 0) return null
  const d = frame * step
  if (d >= size) return null
  switch (direction) {
    case 1:
      return { newX: 0, newY: height - d - 1, oldX: 0, oldY: -d }
    case 2:
      return { newX: 0, newY: d - height + 1, oldX: 0, oldY: d }
    case 3:
      return { newX: width - d, newY: 0, oldX: -d, oldY: 0 }
    case 4:
      return { newX: d - width, newY: 0, oldX: d, oldY: 0 }
  }
}

/** 142 · 143(내 팀 / 상대 팀) 중 지금 선 화면 */
export type NariMatchPushView = '142' | '143:내팀' | '143:상대'

/** 화면이 바뀔 때의 밀기 방향 — 142 → 143 은 내 팀 4 · 상대 3, 143 → 142 는 내 팀 3 · 상대 4. 그 밖은 없음 */
export function nariMatchPushDirectionOf(from: NariMatchPushView, to: NariMatchPushView): ScreenPushDirection | null {
  if (from === '142' && to === '143:내팀') return 4
  if (from === '142' && to === '143:상대') return 3
  if (from === '143:내팀' && to === '142') return 3
  if (from === '143:상대' && to === '142') return 4
  return null
}

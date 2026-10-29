import { SCREEN } from '@/pages/settings/lib/settingsLayout/settingsRows'

/**
 * **판 펼침·접힘** — 공용 페이지 0x593c8 이 그릴 때마다 판 높이 skin+0x90 으로 판을 그리고(0x55e60, 화면 가운데),
 * 그린 **뒤에** 0x5a6fe 가 높이를 한 걸음 옮긴다:
 * ```
 * 펼침(+0x99 = 1): 끝(+0x98)이면 높이 = 목표. 아니면 걸음 +0x94 ×= 4, 높이 += 걸음, 목표 이상이면 목표 · 끝 = 1
 * 접힘(+0x99 = 0): 끝이면 높이 = 1.    아니면 걸음 ×= 4, 높이 −= 걸음, 10 이하면 10 · 끝 = 1
 * ```
 * 들어옴 0x259fc(상태 8, 앞 상태가 0x20~0x22 가 아닐 때) · 경기 중 0x3c3bc 가 높이 0x20 · 걸음 1 · 끝 0 · 펼침 1 로 둔다 →
 * 그려지는 높이는 32 · 36 · 52 · 116 · 목표(212, 경기 중 130).
 * 첫 화면 OK 칸·CLR(0x295e2)은 저장 0x1f1b9 뒤 끝 0 · 걸음 1 · 접힘 으로 두고, 갱신 끝(0x29688~0x296b2)이
 * "접힘이고 끝" 이면 상태 4(처음 메뉴)로 간다 → 212 · 208 · 192 · 128 을 그리고 나간다.
 * 펼치는 동안(높이 < 목표)은 고른 줄 흰 테두리를 끄고(0x59548 `[sp+0x9c] = 0`), 잘라내기 0xbae25 를
 * (x0, H/2 − h/2 + 5, 192, h − 10) 로 좁힌다(0x5951e~0x59544). 다 펴지면 (x0, H/2 − h/2 − 5, 192, h + 10)(0x594d4).
 */
export interface PanelFold {
  readonly isOpening: boolean
  /** 이번에 그릴 판 높이 (skin+0x90) */
  readonly height: number
  /** 걸음 (skin+0x94) */
  readonly step: number
  /** 끝 (skin+0x98) */
  readonly isDone: boolean
}

/** 들어옴 0x259fc · 0x3c3bc — 높이 0x20 · 걸음 1 */
export const PANEL_UNFOLD_START_HEIGHT = 0x20

const FOLD_GROWTH = 4

/** 접힘이 멈추는 높이 (0x5a766 `cmp r3,#0xa`) */
const FOLD_END_HEIGHT = 10

export const openingFold = (): PanelFold => ({ isOpening: true, height: PANEL_UNFOLD_START_HEIGHT, step: 1, isDone: false })

/** 0x295e2 — 끝 0 · 걸음 1 · 접힘. 높이는 지금 그대로다 */
export const closingFold = (from: PanelFold): PanelFold => ({ isOpening: false, height: from.height, step: 1, isDone: false })

/** 한 번 그린 뒤의 다음 높이 (0x5a6fe~0x5a770) */
export function nextPanelFold(fold: PanelFold, fullHeight: number): PanelFold {
  if (fold.isOpening) {
    if (fold.isDone) return { ...fold, height: fullHeight }
    const step = fold.step * FOLD_GROWTH
    const height = fold.height + step
    return height >= fullHeight ? { isOpening: true, height: fullHeight, step, isDone: true } : { ...fold, height, step }
  }
  if (fold.isDone) return { ...fold, height: 1 }
  const step = fold.step * FOLD_GROWTH
  const height = fold.height - step
  return height <= FOLD_END_HEIGHT ? { isOpening: false, height: FOLD_END_HEIGHT, step, isDone: true } : { ...fold, height, step }
}

/** 잘라내기 사각형 (0xbae25) — 펼치는 중이면 판 안쪽 5px, 다 펴졌으면 판 바깥 5px */
export function panelClipOf(height: number, fullHeight: number): { readonly y: number; readonly height: number } {
  const top = SCREEN.height / 2 - Math.trunc(height / 2)
  return height < fullHeight ? { y: top + 5, height: height - 10 } : { y: top - 5, height: height + 10 }
}

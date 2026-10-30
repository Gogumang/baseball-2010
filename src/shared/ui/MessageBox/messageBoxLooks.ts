import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import type { MessageBoxProps } from '@/shared/ui/MessageBox/messageBoxProps'

export const POPUP = assetUrl('./sprites/popup/frames')
/**
 * 버튼은 글자가 아니라 `ui/popup.pzx` 프레임 그림이다 (F-1 확정).
 *   알림(버튼 하나) = 프레임 0 "OK" · 예/아니오 = 1 "예" · 2 "아니오" (41×15)
 *   고른 칸은 주황 그림 6·7 (49×23) 로 바뀐다 — 노란 글자색이 아니었다.
 */
const NOTICE_FRAME = 0
const YES_NO_FRAMES = [1, 2]
const YES_NO_SELECTED_FRAMES = [6, 7]
/** 선택 그림 원점 (−4,−4) */
export const SELECTED_OVERFLOW = 4

/**
 * 보통 그림의 크기 (`popup/frames/origins.json`) — 격자 칸 크기는 버튼 그림의 가장 큰 폭·높이다(0x74824).
 * 고른 그림(6~10 · 13·14)은 사방 4px 큰 같은 꼴이고 원점이 (−4,−4) 다.
 */
const NORMAL_FRAME_SIZES: Readonly<Record<number, { readonly width: number; readonly height: number }>> = {
  0: { width: 41, height: 15 },
  1: { width: 41, height: 15 },
  2: { width: 41, height: 15 },
  3: { width: 59, height: 15 },
  4: { width: 59, height: 15 },
  5: { width: 59, height: 15 },
  11: { width: 35, height: 53 },
  12: { width: 35, height: 53 },
}

/** 버튼 칸 → 그림 프레임. 버튼이 하나면 알림이라 "OK" 한 장뿐이고 고른 그림이 따로 없다 */
function buttonFrameOf(count: number, index: number, isSelected: boolean): number | undefined {
  if (count <= 1) return NOTICE_FRAME
  return (isSelected ? YES_NO_SELECTED_FRAMES : YES_NO_FRAMES)[index]
}

/** 버튼 그림 프레임 — 글자 목록이면 그림을 안 쓰고(예/아니오 그림으로는 다른 것을 고를 수 없다), 자리가 준 그림 · 아니면 OK/예/아니오 그림 */
export function buttonPictureOf(
  props: Pick<MessageBoxProps, 'listItems' | 'buttonFrames' | 'buttons'>,
  index: number,
  isSelected: boolean,
): number | undefined {
  if (props.listItems !== undefined) return undefined
  const pictures = props.buttonFrames?.[index]
  if (pictures === undefined) return buttonFrameOf(props.buttons.length, index, isSelected)
  return isSelected ? pictures.selected : pictures.normal
}

/** 격자 칸 크기 = 버튼 그림의 가장 큰 폭·높이(0x74824 의 0x7484e~0x74888) — 그림을 고른 자리만 다르다 */
export function cellSizeOf(props: Pick<MessageBoxProps, 'listItems' | 'buttonFrames'>): { readonly width: number; readonly height: number } | null {
  if (props.buttonFrames === undefined || props.listItems !== undefined) return null
  return props.buttonFrames.reduce(
    (size, pictures) => ({
      width: Math.max(size.width, NORMAL_FRAME_SIZES[pictures.normal]?.width ?? 0),
      height: Math.max(size.height, NORMAL_FRAME_SIZES[pictures.normal]?.height ?? 0),
    }),
    { width: 0, height: 0 },
  )
}

/** 격자를 준 자리만 칸을 열·줄로 놓는다 — 간격은 [+0x264] 가로 · [+0x268] 세로, 가운데 맞춤(0x74824) */
export function gridStyleOf(grid: MessageBoxProps['grid'], columns: number) {
  if (grid === undefined) return undefined
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, auto)`,
    columnGap: `${grid.gapX}px`,
    rowGap: `${grid.gapY}px`,
    justifyContent: 'center',
  }
}

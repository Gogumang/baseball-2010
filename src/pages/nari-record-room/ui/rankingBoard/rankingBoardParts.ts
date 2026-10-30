import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { yearLabelOffsetOf } from '@/pages/nari-record-room/lib/nariRecordRoom'
import { RANKING_BOARD, rankingColumnXOf } from '@/pages/nari-record-room/lib/rankingBoard'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

export const IMG_TEXT = assetUrl('./sprites/img_text/frames')
export const GAME_UI_FRAMES = assetUrl('./sprites/game_ui/frames')
export const SLT_FRAME = assetUrl('./sprites/slt_frame')
export const NUM = assetUrl('./sprites/num')
export const imageOf = (folder: string, index: number) => `${folder}/${String(index).padStart(3, '0')}.png`
export const pixel = { position: 'absolute', pointerEvents: 'none' } as const
/** 0x6aff8 의 점 — 흰 1×2 */
export const DOT_COLOR = '#ffffff'

/** 열 칸 가운데(0x5650c 꼴 0x22)에 img_text 글을 놓을 자리 — 크기를 모르면 null */
export function centeredLabelPlaceOf(origins: FrameOrigins | null, frame: number, column: number, top: number) {
  const origin = origins?.[String(frame).padStart(3, '0')]
  if (origin === undefined) return null
  const box = RANKING_BOARD.columns[column]
  const offset = yearLabelOffsetOf(box.width, origin.width, origin.height)
  return { left: rankingColumnXOf(column) + offset.x, top: top + offset.y }
}

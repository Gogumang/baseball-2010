import type { YearCellNumber, YearRecordKey } from '@/pages/nari-record-room/lib/nariRecordRoom'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

export const IMG_TEXT = assetUrl('./sprites/img_text/frames')
export const frameSrc = (frame: number) => `${IMG_TEXT}/${String(frame).padStart(3, '0')}.png`
export const isCancelKey = (key: string) => key === 'Escape' || key === 'Backspace'

export const GAME_UI_FRAMES = assetUrl('./sprites/game_ui/frames')
export const SLT_FRAME = assetUrl('./sprites/slt_frame')
export const NUM = assetUrl('./sprites/num')
export const imageOf = (folder: string, index: number) => `${folder}/${String(index).padStart(3, '0')}.png`
/** game_ui 프레임 — 번호 칸 0x1b(25×15) · 넘기는 칸 0x23(36×15) */
export const NUMBER_CELL_FRAME = 0x1b
export const STAT_CELL_FRAME = 0x23
/** slt_frame 이미지 — ◀ 20(5×8, 뒤집으면 ▶) · ▲ 0x20 · ▼ 0x21 (13×8) */
export const SIDE_ARROW_IMAGE = 20
export const UP_ARROW_IMAGE = 0x20
export const DOWN_ARROW_IMAGE = 0x21
/** 커서 색 — 0x56234 의 0xffff00 · 0x80ffff00(알파 0x80) */
export const CURSOR_COLOR = '#ffff00'
export const CURSOR_INSET_COLOR = 'rgba(255, 255, 0, 0.502)'
/** 0x6aff8 의 점 — 흰(0x1400748(255, 255, 255)) 점 두 개를 위아래로 */
export const DOT_COLOR = '#ffffff'

export const pixel = { position: 'absolute', pointerEvents: 'none' } as const

/** 줄 하나 — 칸 글(접근성 · 시험) · 칸 숫자(0x6aff8 입력). null 은 웹이 세지 않는 칸(비운다) */
export interface YearRow {
  readonly textOf: (bit: number) => string | null
  readonly numberOf: (bit: number) => YearCellNumber | null
}

export const YEAR_KEYS: Readonly<Record<string, YearRecordKey>> = {
  ArrowUp: '위',
  2: '위',
  ArrowDown: '아래',
  8: '아래',
  ArrowLeft: '왼',
  4: '왼',
  ArrowRight: '오른',
  6: '오른',
  Enter: '기타',
  5: '기타',
  1: '기타',
  3: '기타',
  7: '기타',
  9: '기타',
  '#': '기타',
}

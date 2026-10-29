import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import { FONT_SPACING, LINE_HEIGHT } from '@/shared/lib/font/layout'

export const MODE_UI = assetUrl('./sprites/mode_ui/frames')
export const IMG_TEXT = assetUrl('./sprites/img_text/frames')
export const NUM = assetUrl('./sprites/num')
/** 그림 폴더의 세 자리 이름 */
export const frameNameOf = (frame: number) => String(frame).padStart(3, '0')
export const imageOf = (folder: string, frame: number) => `${folder}/${frameNameOf(frame)}.png`
export const pixel = { position: 'absolute', pointerEvents: 'none' } as const
/** 투명 누름 칸 — 부위 · 칸 줄 */
export const pressable = { background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' } as const
/** num "+" 105 크기 */
export const PLUS_SIZE = 6
/**
 * 설명 글 줄 간격 — 0xba411(박스 4, 글, 정렬 0x11, 5, 5) → 0xba2e4 가 글상자 0x6ecd0 으로 그려 **앱 전역 글꼴**(줄 11 + 줄간 3)이다.
 * 정렬 0x11 의 비트 0x1 · 0x10 은 0xba2e4 가 안 본다(0x2 · 0x4 · 0x20 · 0x40 만) — (x + 5, y + 5) 왼쪽 위 그대로.
 */
export const TEXT_LINE = LINE_HEIGHT + FONT_SPACING.app.lineGap

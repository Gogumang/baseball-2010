import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

export const MODE_UI = assetUrl('./sprites/mode_ui/frames')
export const IMG_TEXT = assetUrl('./sprites/img_text/frames')

/** 누름 칸이 보내는 키 — 키 처리(window 듣개, 0x16f28 꼴)가 그대로 받는다 */
export const pressKey = (key: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key }))
/** ⚠️ 웹 자리: OK — 바닥띠 왼쪽 표시 자리 (x 2, 47×12, 다 내려온 바닥띠 B = 320 의 B − 18) */
export const OK_PRESS_RECT = { x: 2, y: 320 - 18, width: 47, height: 12 } as const

export const frameSrc = (folder: string, frame: number) => `${folder}/${String(frame).padStart(3, '0')}.png`

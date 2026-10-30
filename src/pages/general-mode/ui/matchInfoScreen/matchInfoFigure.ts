import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

export const SLT_IMAGE = assetUrl('./sprites/slt_frame')
export const SLT_FRAME = assetUrl('./sprites/slt_frame/frames')
export const IMG_TEXT_FRAME = assetUrl('./sprites/img_text/frames')

export const imageSrc = (folder: string, index: number) => `${folder}/${String(index).padStart(3, '0')}.png`

/** 누름 칸이 보내는 키 — 키 처리(`useMatchInfoKeys` 의 window 듣개)가 그대로 받는다 */
export const pressKey = (key: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key }))

/**
 * 바닥비트 — 그림 0x2e0c4 의 모드 1(일반모드, [메뉴+0x13c] == 1) 갈래 (0x2e128~0x2e15e, 직접 떴다):
 * 기본 0x44(되돌아가기 + "0경기설정"), 빠른실행([메뉴+0x14c])이고 재굴림이 안 돌 때([skin+0xf4] == 0) +0x20 "#재선택".
 * 설정 창([skin+0x2ba])이 떠 있으면 0x20 을 끄고 0x40 을 뒤집는다 → 4.
 * [skin+0xf4] 는 '*' 재굴림이 도는 20틱 동안 서는 칸이다(0x31424 가 세우고 0x3128c 가 내림) — 그동안은 0x44.
 * 설정 창은 도는 동안 열릴 수 없다(키를 안 받는다). "#재선택" 표시지만 재굴림 키는 '*'(0x312e6 `cmp r4, #0x2a`)다. 원본 그대로 둔다.
 * (모드 8·9 대전 갈래 0x2e162~ 는 4 / 빠른실행 0x24 — 웹에 대전모드가 없다.)
 */
export const generalMatchInfoFooterOf = (isQuickStart: boolean, isRespinning: boolean, isSettingsOpen: boolean): number => {
  let footer = isQuickStart && !isRespinning ? 0x64 : 0x44
  if (isSettingsOpen) footer = (footer & ~0x20) ^ 0x40
  return footer
}

import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

export const SLT_FRAME = assetUrl('./sprites/slt_frame')
export const SLT_FRAMES = `${SLT_FRAME}/frames`
/** 값 줄 왼 화살 투명 칸 — 화살(x0 + 91) 앞으로 더 잡는 폭. 칸 끝은 막대 왼끝(x0 + 98) */
export const VALUE_ARROW_TOUCH_PAD = 4
export const IMG_TEXT = assetUrl('./sprites/img_text/frames')
export const POPUP = assetUrl('./sprites/popup/frames')

export const imageSrc = (folder: string, id: number) => `${folder}/${String(id).padStart(3, '0')}.png`

/** 고르지 않은 줄 — 까딱임 없음 */
export const NO_SHIFT = { dx: 0, dy: 0 } as const

/** 세로 키 → 커서 한 칸 (그 밖 키는 0) */
const VERTICAL_STEP: ReadonlyMap<string, number> = new Map([
  ['ArrowDown', 1],
  ['ArrowUp', -1],
])
export const verticalStepOf = (key: string) => VERTICAL_STEP.get(key) ?? 0

/** 가로 키 → 값 한 칸 (그 밖 키는 0) */
const HORIZONTAL_STEP: ReadonlyMap<string, number> = new Map([
  ['ArrowRight', 1],
  ['ArrowLeft', -1],
])
export const horizontalStepOf = (key: string) => HORIZONTAL_STEP.get(key) ?? 0

export const CONFIRM_KEYS: ReadonlySet<string> = new Set(['Enter', ' '])
export const BACK_KEYS: ReadonlySet<string> = new Set(['Escape', 'Backspace'])

/**
 * 숫자키 꼴 1 격자 키 — 격자 키 처리 0x6c031 이 숫자를 방향 · OK 로 바꿔 **바꾼 값을 돌려준다**(표 0xd2e7c, r197 직접 뜸):
 * '2' → −1(↑) · '8' → −2(↓) · '4' → −3(←) · '6' → −4(→) · '5' → −5(OK). 세 페이지의 격자가 모두 이 꼴이다 —
 * 환경설정(8) [this+0x70] 진입 0x259fc `vt+0x10(1, 7, 1, 0x20)` · 상세 설정(32) [this+0x84] 0x2421c `(1, 4, 1, 0x20)` ·
 * 모드 초기화(33) 0x242a4 `(1, 3, 1, 0x20)`. 갱신(8 0x29550 · 32 0x288ac · 33 0x2c6d8 · 경기 중 0x3cae0~)은 격자가 돌려준 키로
 * 가르고 0x5550d 에도 그 키를 넘긴다 — 그래서 숫자키도 화살표와 같이 까딱인다. 8 · 32 는 '4'(0x34) · '6'(0x36) 도 따로 견준다(같은 갈래).
 */
const GRID_NUMERIC_KEYS: ReadonlyMap<string, string> = new Map([
  ['2', 'ArrowUp'],
  ['8', 'ArrowDown'],
  ['4', 'ArrowLeft'],
  ['6', 'ArrowRight'],
  ['5', 'Enter'],
])
export const gridKeyOf = (key: string): string => GRID_NUMERIC_KEYS.get(key) ?? key

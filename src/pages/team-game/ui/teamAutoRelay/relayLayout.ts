import type { CSSProperties } from 'react'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import { POPUP_DIM_OPACITY } from '@/shared/ui/MessageBox/popupDim'

/** 화면 240×320 */
export const SCREEN_WIDTH = 240
export const SCREEN_HEIGHT = 320
/** 상태 0x21 진입 0x3abf0 의 배경음 (모드 ∈ {1, 2, 8, 9} · 속도 ≠ 2) */
export const AUTO_RELAY_BGM = 33
/** 0xc2198 이 반 이닝을 넘기면 거는 연출 대기 sim+0x9d */
export const AUTO_RELAY_CHANGE_WAIT = 10
/** StrGAME[6] — CLR 중단 질문 (`base/extracted/StrGAME.json` [6] 원문 그대로) */
export const AUTO_RELAY_STOP_QUESTION = '!C!cFFFFFF자동진행을 중단하시겠습니까?'

export const GAME_UI = assetUrl('./sprites/game_ui')
export const GAME_UI_FRAMES = assetUrl('./sprites/game_ui/frames')
export const IMG_TEXT_FRAMES = assetUrl('./sprites/img_text/frames')
/** game_ui 프레임 92 — 아래 안내 띠 (W/2 − w/2, H − h − 1) */
export const GUIDE_FRAME = 92
/** game_ui 프레임 33 — 속도 칸 바탕 (W/2 − w/2, 216), 효과 (1, 0xc) */
export const SPEED_PLATE_FRAME = 33
/** 0xba759 효과 1 · 인자 L = 반투명 겹치기, 그림 몫 L/16 (R6 3a) — 속도 칸 바탕 (1, 0xc) · 꺼진 세모 (1, 6) */
export const SPEED_PLATE_EFFECT_LEVEL = 0xc
export const SPEED_MARK_DIM_EFFECT_LEVEL = 6
export const SPEED_PLATE_Y = 216
/** img_text 프레임 386 — 속도 글 (W/2 − w/2, 218) */
export const SPEED_LABEL_FRAME = 386
export const SPEED_LABEL_Y = 218
/** game_ui 그림 97 (5×8) — 깜빡이는 좌우 화살표(y 219) · 속도 세모 세 개 */
export const ARROW_IMAGE = 97
export const ARROW_SIZE = { width: 5, height: 8 } as const
export const ARROW_Y = 219
/** 세모 줄 y = 196 + 18 + 프레임 33 높이 + 4 */
const SPEED_PLATE_HEIGHT = 15
export const SPEED_MARKS_Y = 196 + 18 + SPEED_PLATE_HEIGHT + 4
/** 속도 세모 세 개의 차례 (속도 0 · 1 · 2) */
export const SPEED_MARK_INDEXES = [0, 1, 2] as const
/** game_ui 그림 93 (98×19) "CHANGE" — 화면 가운데 */
export const CHANGE_IMAGE = 93
const CHANGE_SIZE = { width: 98, height: 19 } as const
/**
 * "CHANGE" 자리 (42b44~42bba, U-57 — 직접 뜸): 0xba815(game_ui, 0x5d, 종류 0) 상자 뒤 `x = W/2 − (w / 2)` · `y = H/2 − (h / 2)` —
 * 반은 부호 있는 정수 나눗셈(`lsrs #0x1f ; adds ; asrs #1`)이라 19 → 9 · (71, 151). (앞서 웹은 `trunc(160 − 9.5)` = 150 이었다)
 */
export const changeImagePosition = {
  x: (SCREEN_WIDTH >> 1) - Math.trunc(CHANGE_SIZE.width / 2),
  y: (SCREEN_HEIGHT >> 1) - Math.trunc(CHANGE_SIZE.height / 2),
} as const

/**
 * 질문 창 뒤 어둡게 — 경기 장면은 [창+0x24f] = 1(0x3301c)이라 창을 연 그림에 한 번만 0x746cc 가 검정 단계 5 = (5 + 1)/16 로 덮는다
 * (+0x24d 를 지움). 그 뒤로는 장면을 안 그려(0x52efe — [+0x250] 도 그 그림에 지워진다) 멈춘 장면 + 어둡게 위에 창만 그린다.
 * 단계 5 의 칠하기([0x15605d0] = 0x9b3f4)는 색 몫 (단계 + 1)/16 = 6/16 이다 (`POPUP_DIM_OPACITY`).
 */
export const GAME_POPUP_DIM_OPACITY = POPUP_DIM_OPACITY

/** game_ui 그림 한 장의 경로 */
export const gameUiImageSrc = (image: number) => `${GAME_UI}/${String(image).padStart(3, '0')}.png`

/** 그림(종류 0) 한 장 — 원점 없이 왼쪽 위 */
export function imageStyle(x: number, y: number, extra?: CSSProperties): CSSProperties {
  return { position: 'absolute', left: x, top: y, imageRendering: 'pixelated', ...extra }
}

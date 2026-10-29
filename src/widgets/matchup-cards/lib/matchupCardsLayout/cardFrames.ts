/** 소개 판이 쓰는 그림 폴더 · 프레임 크기 표 · 그림 글자 번호 · 색 · 숫자 기준 그림 */
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

export const GAME_UI_FOLDER = assetUrl('./sprites/game_ui/frames')

export const IMG_TEXT_FOLDER = assetUrl('./sprites/img_text/frames')

export const NUM_FOLDER = assetUrl('./sprites/num')

/** 판 바탕 그림 — game_ui 프레임 1(투수) · 2(타자) */
export const PITCHER_CARD_FRAME = 1

export const BATTER_CARD_FRAME = 2

/** 프레임 크기 — `[+0xe]`·`[+0x10]`(그림이 놓이는 원점) · `[+0x12]`·`[+0x14]`(폭·높이) = origins.json 의 x·y·width·height */
export interface FrameSize {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export const frame = (width: number, height: number, x = 0, y = 0): FrameSize => ({ x, y, width, height })

/** game_ui 프레임 크기 (쓰는 것만) */
export const GAME_UI_FRAMES: Readonly<Record<number, FrameSize>> = {
  0: frame(79, 46),
  1: frame(135, 56, 1, 1),
  2: frame(135, 56, 1, 1),
  4: frame(27, 15),
  5: frame(27, 15),
  7: frame(27, 15),
  69: frame(32, 15),
  70: frame(32, 15),
  71: frame(32, 15),
}

/** img_text 프레임 크기 (쓰는 것만) */
export const IMG_TEXT_FRAMES: Readonly<Record<number, FrameSize>> = {
  49: frame(20, 10),
  54: frame(21, 10),
  55: frame(21, 10),
  56: frame(21, 10),
  57: frame(21, 10),
  58: frame(21, 10),
  59: frame(28, 10),
  60: frame(28, 10),
  61: frame(20, 10),
  157: frame(39, 5),
  158: frame(20, 5),
  170: frame(21, 10),
  173: frame(15, 10, 2),
  174: frame(17, 10),
  175: frame(17, 10),
  176: frame(21, 10),
  177: frame(19, 10),
  178: frame(20, 10),
  179: frame(20, 10),
  180: frame(20, 10),
  181: frame(21, 10),
  182: frame(21, 10),
  183: frame(20, 10),
  184: frame(20, 11),
  316: frame(20, 10),
  317: frame(21, 10),
  318: frame(21, 10),
  319: frame(21, 10),
  361: frame(21, 10),
  362: frame(21, 10),
}

/** num 그림 크기 — 20~29 · 30~39 모두 6×10, "1"(21 · 31)만 4×10 */
export const numImageWidthOf = (image: number): number => (image % 10 === 1 ? 4 : 6)

export const NUM_IMAGE_HEIGHT = 10

/** img_text 글자 프레임 번호 */
export const LABEL = {
  player: 157,
  computer: 158,
  leftPitcher: 54,
  rightPitcher: 55,
  leftBatter: 56,
  rightBatter: 57,
  /** 316 "방어" (0x44d02 `0x9e << 3` = 0x4f0 / 4) */
  earnedRun: 316,
  /** 317 "삼진" (0x44e44 0x4f4 / 4) */
  strikeout: 317,
  /** 318 "타율" (0x45370 `0x9f << 3` = 0x4f8 / 4) */
  average: 318,
  /** 180 "홈런" (0x45542 `0xb4 << 2` = 0x2d0 / 4) */
  homeRun: 180,
  /** 319 "타점" (0x455aa 0x4fc / 4) */
  runsBattedIn: 319,
} as const

/** 0xba0bc 색 — 0x1400748(r, g, b) 차례 */
export const CARD_COLORS = {
  border: '#000000',
  /** (0x33, 0x5f, 0xcd) */
  fill: '#335FCD',
  /** 소수점 (0xff, 0xff, 0xff) — 0x6a9f0 */
  point: '#FFFFFF',
  name: '#FFFFFF',
} as const

/** 숫자 기준 그림 — 주황 20 (0x44d6c 등 `movs #0x14`) · 타순 30 (0x45600 `movs #0x1e`) */
export const NUMBER_BASE = { stat: 20, order: 30 } as const

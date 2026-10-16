import { withSemiPlayoffWinner } from '@/entities/league/model/league'
import type { PostseasonSeries } from '@/entities/league/model/league'
import { glyphsWidthOf } from '@/shared/lib/pixelNumber/pixelNumber'
import type { Glyph } from '@/shared/lib/pixelNumber/pixelNumber'

/**
 * 포스트시즌 대진표 배치 (그리기 `0x853ac` — P6 4a-1 **확정**).
 *
 * 부르는 곳은 두 군데다: **시즌모드 `0xb7b8`**(= 장면 0x105 상태 **0xef** 의 그리기, R13 1절)와
 * 나만의리그 `0x168e8`. 원본은 mode_ui **프레임 53**(195×210: 위 "CHAMPION" 리본 + 계단식 팀 칸 4개
 * + 순위 딱지 4개)을 앵커 (0,0) 으로 통째로 깔고, 그 프레임 박스로 로고·딱지 자리를 잡는다.
 * 대진 선은 그림이 없는 **프레임 54~57**(박스만 있는 2px 선분 목록)이다.
 *
 * 시즌 상태 0xef(`SeasonSummaryScreen`)와 나만의리그 상태 128(`pages/season-end` 의 `PostseasonScreen`)이
 * 이 위젯 하나(`PostseasonBracketWindow`)를 함께 쓴다 — 원본도 같은 함수 0x853ac 다.
 */

/** 박스 하나 — 원본 프레임 박스(x, y, w, h)는 화면 절대 좌표다 */
export interface BracketBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** 대진표 그림 = mode_ui 프레임 53 (195×210). 앵커 (0,0) 에 놓으면 원점 (24,48) 로 들어간다 */
export const BRACKET_BACKDROP = {
  folder: './sprites/mode_ui/frames',
  frame: 53,
  anchorX: 0,
  anchorY: 0,
} as const

/**
 * 프레임 53 박스 0~3 — 팀 칸 계단(칸 3 이 가장 높다).
 * 칸 k 로고는 `team_logo 0x66431(skin, [this+0x384], [this+0x388 + 4k], 박스x + 3, 박스y + 3)` — 앉는 팀은 `CELL_QUALIFIER_INDEX`.
 */
export const TEAM_CELLS: readonly BracketBox[] = [
  { x: 25, y: 195, width: 41, height: 40 }, // 칸 0 — 딱지 "4위", 정규 3위 팀
  { x: 75, y: 195, width: 41, height: 40 }, // 칸 1 — 딱지 "3위", 정규 4위 팀
  { x: 125, y: 171, width: 41, height: 40 }, // 칸 2 — 2위
  { x: 175, y: 147, width: 41, height: 40 }, // 칸 3 — 1위
]

/** 로고 안쪽 여백 (0x66431 인자 박스x + 3) */
export const LOGO_INSET = 3

/**
 * 프레임 53 박스 4~7 — 순위 딱지. 칸 k 의 딱지 = 박스 4 + k, 숫자 4 − k (아래 `rankGlyphsOf` 주석).
 */
export const RANK_TAGS: readonly BracketBox[] = [
  { x: 26, y: 243, width: 39, height: 15 }, // 칸 0 "4위"
  { x: 76, y: 243, width: 39, height: 15 }, // 칸 1 "3위"
  { x: 126, y: 219, width: 39, height: 15 }, // 칸 2 "2위"
  { x: 176, y: 195, width: 39, height: 15 }, // 칸 3 "1위"
]

/**
 * 대진 선 = mode_ui 프레임 **54~57** 의 박스 목록 그대로(그림 없는 2px 선분). `frame_boxes(mode_ui.pzx)` 로 다시 읽어 맞췄다.
 * 프레임 54 + k 는 팀 칸 k(프레임 53 박스 k) 에서 결승 꼭짓점 (120,87) 까지 가는 길이다 — 합류점 (69,162) → (95,138)
 * → (120,114) → (120,87).
 */
export const LINE_FRAMES: Readonly<Record<54 | 55 | 56 | 57, readonly BracketBox[]>> = {
  54: [
    { x: 44, y: 162, width: 2, height: 32 }, { x: 46, y: 162, width: 25, height: 2 },
    { x: 69, y: 138, width: 2, height: 24 }, { x: 71, y: 138, width: 26, height: 2 },
    { x: 95, y: 114, width: 2, height: 24 }, { x: 97, y: 114, width: 25, height: 2 },
    { x: 120, y: 87, width: 2, height: 29 },
  ],
  55: [
    { x: 95, y: 162, width: 2, height: 32 }, { x: 70, y: 162, width: 25, height: 2 },
    { x: 69, y: 138, width: 2, height: 24 }, { x: 71, y: 138, width: 26, height: 2 },
    { x: 95, y: 114, width: 2, height: 24 }, { x: 97, y: 114, width: 25, height: 2 },
    { x: 120, y: 87, width: 2, height: 29 },
  ],
  56: [
    { x: 145, y: 138, width: 2, height: 32 }, { x: 95, y: 138, width: 50, height: 2 },
    { x: 95, y: 114, width: 2, height: 24 }, { x: 97, y: 114, width: 25, height: 2 },
    { x: 120, y: 87, width: 2, height: 29 },
  ],
  57: [
    { x: 196, y: 114, width: 2, height: 31 }, { x: 120, y: 114, width: 76, height: 2 },
    { x: 120, y: 87, width: 2, height: 29 },
  ],
}

export type LineFrame = keyof typeof LINE_FRAMES

/** 팀 칸 k 의 선 프레임 = 54 + k (0x8540e~0x85474 `adds r1, #0x36`) */
export function lineFrameOfCell(cell: number): LineFrame {
  return (54 + cell) as LineFrame
}

/** 선분 바탕색 #08044A = RGB(8,4,74) (0x85450~0x85456) */
export const LINE_COLOR = '#08044A'
/** 이긴 길은 빨강 RGB(255,0,0) 으로 다시 채운다 (0x85586~0x857f6) */
export const WON_LINE_COLOR = '#FF0000'

/**
 * 팀 칸 k 에 앉는 팀 = 대진 칸 (직접 떴다 — 0x8533c, 부르는 곳 0x693e 시즌 · 0x12110 나리):
 * ```
 * [this+0x388] = 0xb7649(L, 2, 0) = L[0x3c] (정규 3위)   ← 칸 0
 * [this+0x38c] = 0xb7649(L, 2, 1) = L[0x3d] (정규 4위)   ← 칸 1
 * [this+0x390] = 0xb7649(L, 1, 0) = L[0x3a] (정규 2위)   ← 칸 2
 * [this+0x394] = 0xb7649(L, 0, 0) = L[0x38] (정규 1위)   ← 칸 3
 * ```
 * 0x853ac 는 칸 k 에 로고 `0x66431(…, [this+0x388 + 4k], …)` 와 딱지 숫자 **4 − k** 를 그린다(0x85512).
 * 그래서 **"4위" 딱지 칸에 정규 3위 팀, "3위" 딱지 칸에 정규 4위 팀**이 앉는다 — 원본 그대로.
 * 값은 `qualifiers`(1~4위) 의 색인이다.
 */
export const CELL_QUALIFIER_INDEX: readonly number[] = [2, 3, 1, 0]

/** 칸 k 의 딱지 숫자 (0x85512 `movs r3, #4; subs r3, r3, r7`) */
export function rankLabelOfCell(cell: number): number {
  return 4 - cell
}

/** 빨강으로 다시 채우는 박스 하나 — 프레임 54~57 의 박스 번호 */
export interface RedBox {
  readonly frame: LineFrame
  readonly box: number
}

/** 대진표에 그릴 상태 */
export interface BracketView {
  /** 팀 칸 0~3 에 앉은 팀 번호 (`CELL_QUALIFIER_INDEX`). 모르면 null */
  readonly cellTeams: readonly (number | null)[]
  /** 빨강으로 다시 채울 박스 — 원본이 칠하는 차례 그대로(겹쳐도 그대로 둔다) */
  readonly redBoxes: readonly RedBox[]
  /** 팀 칸 k 를 검정 단계 7 로 덮는가 (진 팀 표시 — 0x8580e~0x85858) */
  readonly darkCells: readonly boolean[]
  /** 한국시리즈 우승 팀 (L+0x37) */
  readonly champion: number | null
}

const EMPTY_VIEW: BracketView = {
  cellTeams: [null, null, null, null],
  redBoxes: [],
  darkCells: [false, false, false, false],
  champion: null,
}

/** 대진 칸 L[0x39] · L[0x3b] 의 '미정' 값 (0xb80a8 `movs r5, #0xa`) */
const UNDECIDED = 10

/** 진 팀 칸 덮기 — [0x15605d4] 검정 몸통 단계 7 (0x8584a `movs r3, #7`): 화면을 7/16 남긴다 */
export const DARK_CELL_STEP = 7

/** 덮는 칸 = 프레임 53 박스 k 를 (x, y, w, h + 1) 로 (0x85840 `adds r5, r3, #1`) */
export function darkCellBoxOf(cell: number): BracketBox {
  const box = TEAM_CELLS[cell]
  return { x: box.x, y: box.y, width: box.width, height: box.height + 1 }
}

const boxesOf = (frame: LineFrame, count: number): RedBox[] =>
  Array.from({ length: count }, (_, box) => ({ frame, box }))

/**
 * 진행 중인 시리즈에서 대진표 상태를 뽑는다 — 0x853ac 의 0x85536~0x8580e 를 직접 떴다.
 *
 * 원본은 대진 칸 여섯 개를 읽는다: a = L[0x3d](4위) · b = L[0x3c](3위) · s = L[0x3b](준PO 승자) · c = L[0x3a](2위)
 * · p = L[0x39](PO 승자) · d = L[0x38](1위). s · p 는 0xb80a8 이 10 으로 깔고 0xb7724 가 시리즈가 끝날 때 채운다(R13 8절).
 * ```
 * s != 10:  f = s == b ? 54 : 55 ; f 박스 0..2 빨강 ; 55 박스 0 · 56 박스 0 빨강 ; s == b ? 덮기[1] : 덮기[0]
 * p != 10:  (f, n) = p == b ? (54, 5) : p == a ? (55, 5) : (56, 3) ; f 박스 0..n−1 빨강 ; 56 박스 0 · 57 박스 0 빨강
 *           p == c ? 덮기[0] · 덮기[1] : 덮기[2]
 * L[0x36]:  e = L[0x37] ; f = e == a ? 55 : e == b ? 54 : e == c ? 56 : 57 ; f 박스 전부 빨강
 *           e == d ? 덮기[0..2] : 덮기[3]
 * ```
 * 준PO 뒤 "55 박스 0 · 56 박스 0", PO 뒤 "56 박스 0 · 57 박스 0" 은 **누가 이겼든** 칠한다 — 진 쪽 칸 세로선도
 * 빨개지는 것은 원본 그대로다.
 *
 * 웹 모델과 맞춤: s = `semiPlayoffWinner`(L+0x3b — `advancePostseason` 이 남긴다. 옛 저장은 `withSemiPlayoffWinner`
 * 로 되살리고, 그래도 모르면 10), p = 한국시리즈·종료의 아랫 시드 `teams[1]`(L+0x39), L[0x36] = `round === '종료'`.
 */
export function bracketViewOf(series: PostseasonSeries | null): BracketView {
  if (series === null) return EMPTY_VIEW

  const qualifiers = series.qualifiers
  const team = (index: number) => qualifiers[index] ?? null
  const [d, c, b, a] = [team(0), team(1), team(2), team(3)]
  const cellTeams = CELL_QUALIFIER_INDEX.map(team)

  const semiplayoffWinner =
    series.round === '준플레이오프' ? UNDECIDED : withSemiPlayoffWinner(series).semiPlayoffWinner ?? UNDECIDED
  const playoffWinner = series.round === '한국시리즈' || series.round === '종료' ? series.teams[1] : UNDECIDED

  const redBoxes: RedBox[] = []
  const darkCells = [false, false, false, false]

  if (semiplayoffWinner !== UNDECIDED) {
    redBoxes.push(...boxesOf(semiplayoffWinner === b ? 54 : 55, 3), { frame: 55, box: 0 }, { frame: 56, box: 0 })
    darkCells[semiplayoffWinner === b ? 1 : 0] = true
  }
  if (playoffWinner !== UNDECIDED) {
    const [frame, count]: [LineFrame, number] =
      playoffWinner === b ? [54, 5] : playoffWinner === a ? [55, 5] : [56, 3]
    redBoxes.push(...boxesOf(frame, count), { frame: 56, box: 0 }, { frame: 57, box: 0 })
    if (playoffWinner === c) {
      darkCells[0] = true
      darkCells[1] = true
    } else {
      darkCells[2] = true
    }
  }
  if (series.round === '종료') {
    const champion = series.champion
    const frame: LineFrame = champion === a ? 55 : champion === b ? 54 : champion === c ? 56 : 57
    redBoxes.push(...boxesOf(frame, LINE_FRAMES[frame].length))
    if (champion === d) {
      darkCells[0] = true
      darkCells[1] = true
      darkCells[2] = true
    } else {
      darkCells[3] = true
    }
  }

  return { cellTeams, redBoxes, darkCells, champion: series.champion }
}

/**
 * 순위 딱지 (직접 떴다, 0x854c8~0x85524 — k = 0..3 이 프레임 53 박스 4 + k):
 * ```
 * 854f4  0xb9e05(img_text 307 "위", 박스, 정렬 0x24, 0, 0, ox −6, 0, 0)
 *        → 0xb9d74: x = 박스x − 6 + (박스폭 − 9) (비트 0x4) · y = 박스y + ceil((15 − 10)/2) (비트 0x20, 0xb9db0~0xb9dc4)
 * 85522  0xba719(박스, 자간 0, 값 4 − k, 기준 0, [[this+0x13c]+8]+8 = num, 정렬 0x21, ox 8, oy 1, 0)
 *        → 0xba51c: x0 = 박스x + 8 · y0 = 박스y + 1 + ceil((15 − 10)/2) — 비트 0x1 은 아무도 안 봐 **왼쪽 붙임**이다
 * ```
 * 숫자 그림은 num **0~9**(기준 0 — 흰 테두리 8×10, '1' 만 4×10)다. [this+0x13c] 는 순위표 0x7f070 이 "%"(num 106)를 꺼내는
 * 같은 num 이다(0x7f35e). 예전 웹은 P6 의 "numBox(…, 33, 8)" 를 못 풀어 하늘색 숫자(90번대)로 두었다.
 */
export const RANK_UNIT = { folder: './sprites/img_text/frames', frame: 307, width: 9, height: 10 } as const
/** "위" 의 ox (0x854ec `movs r3, #6; rsbs`) */
const RANK_UNIT_DX = -6
/** 숫자의 ox · oy (0x85508 · 0x8550e) */
const RANK_DIGIT_DX = 8
const RANK_DIGIT_DY = 1
/** num 0~9 의 높이 */
export const RANK_GLYPH_HEIGHT = 10

/** 순위 숫자 — num 프레임 0 + 숫자, 자간 0 (한 자리뿐이다: 1~4) */
export function rankGlyphsOf(rank: number): Glyph[] {
  return [...String(rank)].map((digit) => ({ frame: Number(digit), width: digit === '1' ? 4 : 8, spacing: 0 }))
}

/** "위" 그림 왼쪽 위 — 오른쪽 맞춤 ox −6, 세로 가운데(올림) */
export function rankUnitPositionOf(tag: BracketBox): { x: number; y: number } {
  const dy = tag.height - RANK_UNIT.height
  return {
    x: tag.x + RANK_UNIT_DX + tag.width - RANK_UNIT.width,
    y: tag.y + (dy >> 1) + (dy & 1),
  }
}

/** 숫자는 박스 x + 8 에서 왼쪽 붙임 — `SpriteNumber` 에 넘길 오른쪽 끝 */
export function rankDigitRightOf(tag: BracketBox, rank: number): number {
  return tag.x + RANK_DIGIT_DX + glyphsWidthOf(rankGlyphsOf(rank))
}

/** 숫자 세로 칸 — oy 1 을 더한 박스(`SpriteNumber` 가 올림 가운데를 한다) */
export function rankDigitBoxTopOf(tag: BracketBox): number {
  return tag.y + RANK_DIGIT_DY
}

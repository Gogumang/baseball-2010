/**
 * 포스트시즌 대진표 배치 (그리기 0x853ac, 부르는 곳 0xb7b8 시즌 · 0x168e8 나리 — P6 4a-1 확정).
 *
 * 원본은 mode_ui(this+0x138) **프레임 53**(195×210: 위 "CHAMPION" 리본 + 계단식 팀 칸 4개 +
 * 순위 딱지 4개) 을 앵커 (0,0) 으로 통째로 그린 뒤, 그 프레임의 박스로 로고·딱지 자리를 잡는다.
 * 대진 선은 그림이 없는 **프레임 54~57**(박스만 있는 2px 선분 목록) 이다.
 *
 * 아래 값은 모두 `base/work/jar/ui/mode_ui.pzx` 를 `tools/decode_pzx.py` 와 같은 방식으로 읽어
 * 프레임 박스에서 그대로 옮겼다 (P6 4a-1 표와 한 칸도 다르지 않다).
 */

/** 박스 하나 — 원본 프레임 박스(x, y, w, h)는 화면 절대 좌표다 */
export interface BracketBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** 대진표 그림 = mode_ui 프레임 53 (195×210). 앵커 (0,0) 에 놓으면 원점 (24,48) 로 들어간다 */
export const BACKDROP = { folder: './sprites/mode_ui/frames', frame: 53, anchorX: 0, anchorY: 0 } as const

/**
 * 프레임 53 박스 0~3 — 팀 칸. **4위·3위·2위·1위 순 계단**(1위가 가장 높다).
 * 칸 안 로고는 `team_logo 0x66431(skin, 팀, ?, 박스x + 3, 박스y + 3)`.
 */
export const TEAM_CELLS: readonly BracketBox[] = [
  { x: 25, y: 195, width: 41, height: 40 }, // 4위
  { x: 75, y: 195, width: 41, height: 40 }, // 3위
  { x: 125, y: 171, width: 41, height: 40 }, // 2위
  { x: 175, y: 147, width: 41, height: 40 }, // 1위
]

/** 로고 안쪽 여백 (0x66431 인자 박스x + 3) */
export const LOGO_INSET = 3

/**
 * 프레임 53 박스 4~7 — 순위 딱지.
 * 원본은 `numBox(순위, 1, 4, 글꼴 33, 8)` + `img_text 307 "위"` 오른쪽 정렬(0x24) 이지만,
 * 웹에는 글꼴 33 비트맵 숫자를 아직 안 옮겨서 "N위" 글자 한 줄로 둔다 (근사).
 */
export const RANK_TAGS: readonly BracketBox[] = [
  { x: 26, y: 243, width: 39, height: 15 }, // 4위
  { x: 76, y: 243, width: 39, height: 15 }, // 3위
  { x: 126, y: 219, width: 39, height: 15 }, // 2위
  { x: 176, y: 195, width: 39, height: 15 }, // 1위
]

/**
 * 대진 선 묶음. 프레임 54~57 은 각 팀 칸에서 결승 꼭짓점 (120,87) 까지 가는 **한 길**인데,
 * 네 프레임이 위로 갈수록 박스를 나눠 쓴다. 겹치는 부분을 빼고 아래 일곱 묶음으로 쪼개면
 * 프레임 박스 목록이 정확히 복원된다 — 라운드별로 빨강을 칠하려면 이 쪼갬이 필요하다.
 *
 *   프레임 54 (4위 길)  = rank4 + semiAdvance + finalAdvance + champion  (박스 7개)
 *   프레임 55 (3위 길)  = rank3 + semiAdvance + finalAdvance + champion  (박스 7개)
 *   프레임 56 (2위 길)  = rank2 +               finalAdvance + champion  (박스 5개)
 *   프레임 57 (1위 길)  = rank1 +                              champion  (박스 3개)
 *
 * 합류점: 준플레이오프 (69,162) → 플레이오프 (95,138) → 한국시리즈 (120,114) → 꼭짓점 (120,87).
 */
export const LINE_SEGMENTS = {
  /** 4위 칸 → 준플레이오프 합류점 (프레임 54 박스 0·1) */
  rank4: [
    { x: 44, y: 162, width: 2, height: 32 },
    { x: 46, y: 162, width: 25, height: 2 },
  ],
  /** 3위 칸 → 준플레이오프 합류점 (프레임 55 박스 0·1) */
  rank3: [
    { x: 95, y: 162, width: 2, height: 32 },
    { x: 70, y: 162, width: 25, height: 2 },
  ],
  /** 준플레이오프 승자 → 플레이오프 합류점 (프레임 54·55 박스 2·3) */
  semiAdvance: [
    { x: 69, y: 138, width: 2, height: 24 },
    { x: 71, y: 138, width: 26, height: 2 },
  ],
  /** 2위 칸 → 플레이오프 합류점 (프레임 56 박스 0·1) */
  rank2: [
    { x: 145, y: 138, width: 2, height: 32 },
    { x: 95, y: 138, width: 50, height: 2 },
  ],
  /** 플레이오프 승자 → 한국시리즈 합류점 (프레임 54·55 박스 4·5 = 56 박스 2·3) */
  finalAdvance: [
    { x: 95, y: 114, width: 2, height: 24 },
    { x: 97, y: 114, width: 25, height: 2 },
  ],
  /** 1위 칸 → 한국시리즈 합류점 (프레임 57 박스 0·1) */
  rank1: [
    { x: 196, y: 114, width: 2, height: 31 },
    { x: 120, y: 114, width: 76, height: 2 },
  ],
  /** 한국시리즈 승자 → 결승 꼭짓점 (모든 프레임의 마지막 박스) */
  champion: [{ x: 120, y: 87, width: 2, height: 29 }],
} as const satisfies Readonly<Record<string, readonly BracketBox[]>>

export type BracketLeg = keyof typeof LINE_SEGMENTS

/** 그리는 순서 — 원본도 프레임 54 → 57 순으로 채운다 (0x853fa~0x85474) */
export const LEG_ORDER: readonly BracketLeg[] = [
  'rank4', 'rank3', 'semiAdvance', 'rank2', 'finalAdvance', 'rank1', 'champion',
]

/** 선분 바탕색 #08044A = RGB(8,4,74) (0x853fa~0x85474) */
export const LINE_COLOR = '#08044A'
/** 이긴 길 RGB(255,0,0) 로 다시 채운다 (0x855b4~0x857ec) */
export const WON_LINE_COLOR = '#FF0000'

/** 순위 1~4 → 계단 칸 색인. 칸은 4위부터이므로 뒤집는다 */
export function cellIndexOfRank(rank: number): number {
  return 4 - rank
}

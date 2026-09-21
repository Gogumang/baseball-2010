/**
 * 팀 고르기 배치 (나만의리그 상태 **0x65** — 진입 0x10790 · 그리기 0x14114 → 목록 0x63b15,
 * 본문 0x63dee. P6 2a-1·2a-2 확정).
 *
 * 원본은 경기 준비·스페셜 화면 열두 가지를 **한 함수**(0x63b15)로 그린다. 팀 고르기는 그중
 * `k = 0`(유저 팀)이다. 화면은 기준점 둘로 잡힌다:
 *
 * ```
 * A = 팀 로고·이름 자리   B = 능력치 도형 자리
 * 기본 A = (W/2 − 60, H/2 − 50) = (60, 110) · B = (W/2 + 60, H/2 − 68) = (180, 92)
 * k = 0 보정 (표 0xd1eac) → A = (58, 110) · B = (178, 96)
 * ```
 */
const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320

/** k = 0 (유저 팀 고르기) 의 두 기준점 — 표 0xd1eac 가 기본값에 준 보정이 이미 들어 있다 */
export const ANCHOR_A = { x: 58, y: 110 } as const
export const ANCHOR_B = { x: 178, y: 96 } as const

/**
 * A·B 딱지 (0x65744, 모든 k 공통 — P6 2a-4).
 *
 * ```
 * A 딱지 = slt_frame **이미지 116**(57×15 흰 막대)  을 (A.x − 28, A.y − 53), 글자는 A.y − 48
 * B 딱지 = slt_frame **이미지 117**(57×15 파란 막대) 을 (B.x − 28, B.y − 43), 글자는 그 +5
 * ```
 * k 3~5 만 B 도 116·53 을 쓴다 — 팀 고르기(k=0)는 **117·43** 이다.
 *
 * ⚠️ 막대는 `slt_frame/NNN.png`(**이미지** 128장)에 있다. `slt_frame/frames/`(프레임 62장)에는
 *    116·117 이 아예 없어서, 프레임 쪽으로 찾으면 아무것도 안 그려진다.
 */
export const TAG = {
  /** A 딱지 흰 막대 — slt_frame **이미지** 116 */
  aBarImage: 116,
  /** B 딱지 파란 막대 — slt_frame **이미지** 117 (k=0 기본값) */
  bBarImage: 117,
  barWidth: 57,
  barHeight: 15,
  dx: -28,
  /** A 막대 원점 y 보정 */
  aDy: -53,
  /** B 막대 원점 y 보정 — A 와 다르다 */
  bDy: -43,
  /** A 글자 y = A.y − 48 (막대 +5) */
  aTextDy: -48,
  /** B 글자 y = B 막대 +5 */
  bTextDy: -38,
  aTextFrame: 157,
  bTextFrame: 159,
} as const

/**
 * 팀 격자 — `0x79ed5([skin+0xe0], 9, 120, H/2 + 22 = 182, 표, 칸 40, 5열, 행 = 개수/5)`.
 * **15팀 · 5열 · 칸 40px · 중심 (120, 182)** 다 (에디트 화면 k=9 만 10팀이다).
 */
export const GRID = {
  columns: 5,
  cell: 40,
  centerX: SCREEN_WIDTH / 2,
  centerY: SCREEN_HEIGHT / 2 + 22,
} as const

export const TEAM_COUNT = 15
/** 히든이 아닌 기본 팀 — 0~9 는 늘 열려 있다 (0x63e30: `idx ≤ 9` 또는 전역 기록 +0x70+idx ≠ 0) */
export const OPEN_TEAM_COUNT = 10

export const gridRowCountOf = (count: number) => Math.ceil(count / GRID.columns)

/**
 * 격자 칸 i 의 왼쪽 위. 격자는 중심 기준이라 전체 폭·높이의 반을 뺀다
 * (칸 그리기 내부 0x7a571 은 미해독이라 **칸 배치는 근사**다 — 칸 40px·5열·중심만 확정이다).
 */
export function cellPositionOf(index: number, count = TEAM_COUNT) {
  const rows = gridRowCountOf(count)
  const left = GRID.centerX - (GRID.columns * GRID.cell) / 2
  const top = GRID.centerY - (rows * GRID.cell) / 2
  return {
    x: left + GRID.cell * (index % GRID.columns),
    y: top + GRID.cell * Math.floor(index / GRID.columns),
  }
}

/** 팀이 열려 있는가 — 0~9 는 늘 열려 있고, 10~14 히든은 해금 기록이 있어야 한다 */
export function isTeamOpen(teamId: number, openedHiddenIds: readonly number[]): boolean {
  return teamId < OPEN_TEAM_COUNT || openedHiddenIds.includes(teamId)
}

/**
 * 잠긴 히든 팀 자리에 그리는 원 두 개 (0x63ec4~0x63f10).
 * 지름 77 #5A86BD 위에 지름 63 #29348C — 둘 다 A 에서 반지름만큼 왼쪽·위로 물린다.
 */
export const LOCKED_CIRCLES = [
  { diameter: 77, color: '#5A86BD' },
  { diameter: 63, color: '#29348C' },
] as const
/** 잠긴 팀의 이름 자리 글 — `"!C!cFFFFFF???"` (0xd2478), (A.x − 41, A.y + 42) 폭 82 가운데 */
export const LOCKED_NAME = '???'

/**
 * 이름 막대 — slt_frame **이미지** 9 (82×15) 을 (A.x − 41, A.y + 40).
 * ⚠️ 같은 번호가 `slt_frame/frames/009.png` 에도 있지만 그건 72×17(탭 커서)이다 — 다른 그림이다.
 */
export const NAME_BAR = { image: 9, width: 82, height: 15, dx: -41, dy: 40 } as const
/** 팀 이름 글 — img_text 프레임 **65 + 팀**, y = A.y + 42, 막대 안 가운데 */
export const NAME_TEXT = { firstFrame: 65, dy: 42 } as const
export const teamNameFrameOf = (teamId: number) => NAME_TEXT.firstFrame + teamId

/** 능력치 도형 — `0x5aefd(…, B.x, B.y + 8, …, 잠김이면 −1, 반지름 30)` */
export const ABILITY_CHART = { dx: 0, dy: 8, radius: 30 } as const

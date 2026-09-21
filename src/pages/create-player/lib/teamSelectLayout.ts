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
import { cosineSixteen, sineSixteen } from '@/shared/lib/math/originalTrigonometry'

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
 * 팀 격자 — `0x79ed5([skin+0xe0], **종류 9**, 120, H/2 + 22 = 182, 표, 칸 40, 5열, 행 = 개수/5)`.
 * 15팀 · 5열 · 칸 40px (에디트 화면 k=9 만 10팀이다).
 *
 * ⚠️ **네 번째 인자는 중심이 아니라 "첫 줄 위쪽 y" 다** (S9 10절 정정 1 확정, 0x79f36·0x79f3c):
 * `+0x10 = cx − 폭/2` 로 **가로만** 가운데를 맞추고 `+0x14 = cy` 는 그대로 쓴다.
 * P6 의 "중심 (120,182)" 는 가로만 중심이라는 뜻이다.
 * 예전에는 세로도 중심으로 읽어 격자가 60px 올라가 **로고·이름 막대를 덮고 있었다**.
 */
export const GRID = {
  columns: 5,
  cell: 40,
  centerX: SCREEN_WIDTH / 2,
  /** 첫 줄 **위쪽** y (중심 아님) */
  top: SCREEN_HEIGHT / 2 + 22,
} as const

/**
 * 5열 화면 전용 **열별 y 보정** 표 `0xd40b8` = [3,3,3,13,13] (S9 4-3 확정).
 * 종류 3·4·6·7·8·9 에 걸리므로 팀 격자(종류 9)도 받는다 — 4·5번째 열이 10px 더 올라간다.
 */
export const COLUMN_Y_OFFSETS = [3, 3, 3, 13, 13] as const

export const TEAM_COUNT = 15
/** 히든이 아닌 기본 팀 — 0~9 는 늘 열려 있다 (0x63e30: `idx ≤ 9` 또는 전역 기록 +0x70+idx ≠ 0) */
export const OPEN_TEAM_COUNT = 10

export const gridRowCountOf = (count: number) => Math.ceil(count / GRID.columns)

/**
 * 격자 칸 i 의 왼쪽 위 (그리기 `0x7a571`, S9 3-2·4-3 확정).
 *
 * ```
 * 왼쪽 = cx − (칸너비 합 + (열−1)·가로틈) / 2      ; 가로만 가운데
 * 위쪽 = cy                                        ; 그대로 쓴다
 * y[i] -= 0xd40b8[i mod 열]                        ; 5열 화면의 열별 보정
 * ```
 * ⚠️ 칸 **너비 배열**과 가로·세로 틈은 문서에 값이 없어 40·0 으로 둔다 (**근사**).
 */
export function cellPositionOf(index: number, _count = TEAM_COUNT) {
  const left = GRID.centerX - (GRID.columns * GRID.cell) / 2
  const column = index % GRID.columns
  return {
    x: left + GRID.cell * column,
    y: GRID.top + GRID.cell * Math.floor(index / GRID.columns) - COLUMN_Y_OFFSETS[column],
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

/**
 * 능력치 마름모 — `0x5aefd(skin, [skin+0xd4], B.x, B.y + 8, 종류 0, …, 팀 idx(잠김이면 −1), 반지름 30, …)`.
 *
 * 호출 두 군데를 떠서 인자를 확인했다 (0x63dee 안):
 *   - 열린 팀 `0x63e5c~0x63e74` → 스택 [8] = 팀 idx, **[0xc] = `movs r3,#0x1e` = 30**
 *   - 잠긴 팀 `0x63f14~0x63f38` → 스택 [8] = −1,     **[0xc] = 0x1e = 30**
 * 그 30 이 `anim+0x1d8` 로 들어가 꼭짓점 길이의 기준이 된다 (0x5b396).
 */
export const ABILITY_CHART = { dx: 0, dy: 8, radius: 30 } as const

/**
 * 4축 각도 — 표 `0xd1b0c` (= 서술자 표 `0xd1b2c` 각 항목의 +4). **화면 좌표(y 가 아래)의 네 대각선**이라
 * 왼위 · 오른위 · 오른아래 · 왼아래 순이다. 꼭짓점 그림은 방향마다 8·9·10·11 로 다르다 (S9 5-1 확정).
 * 값은 팀 레코드 `+4 · +6 · +8 · +0xa` 를 이 차례로 짝지어 넣는다 (0x5b062~0x5b084).
 */
export const ABILITY_AXIS_ANGLES: readonly number[] = [225, 315, 45, 135]

/**
 * 축 하나의 최대치 — 서술자 표 `0xd1b2c` 항목의 첫 u16. 네 축 모두 **999** 다.
 * 나눗셈 상수(`0x760d0`)도 같은 999 다.
 */
export const ABILITY_AXIS_MAXIMUM = 999
const ABILITY_CHART_SCALE = 999

/**
 * **값 → 꼭짓점 길이** (`0x75ebc`, 이번에 디스어셈으로 풀었다 — S9 5절 "미해결" 이던 곳):
 *
 * ```
 * 75f1c: 반지름(anim+0x1d8) 이 0 이면 32 를 넣는다
 * 75f30: 최대길이(+0xa) = 반지름 × 서술자+0(축 최대치)  / 999      ; 0xca7b5 정수 나눗셈
 * 75f96: 현재길이(+0xb) = 최대길이 × 서술자+2(능력치 값) / 999
 * ```
 * 축 최대치가 999 라 **최대길이 = 반지름**, **현재길이 = 반지름 × 값 / 999** 로 줄어든다.
 * 정수 나눗셈이라 버림이다.
 */
export function abilityAxisMaximumLengthOf(radius: number = ABILITY_CHART.radius): number {
  return Math.trunc((radius * ABILITY_AXIS_MAXIMUM) / ABILITY_CHART_SCALE)
}
export function abilityAxisLengthOf(value: number, radius: number = ABILITY_CHART.radius): number {
  return Math.trunc((abilityAxisMaximumLengthOf(radius) * value) / ABILITY_CHART_SCALE)
}

export interface ChartPoint {
  readonly x: number
  readonly y: number
}

/**
 * 축 하나의 꼭짓점 (`0x75f4e~0x75f88` 최대점 · `0x76034~0x7606a` 현재점):
 *
 * ```
 * x = 중심x + (길이 × cos(각도)) >> 16
 * y = 중심y + (길이 × sin(각도)) >> 16
 * ```
 * sin·cos 는 `0x6c7c0`·`0x6c7f4` 의 ×65535 표(`0xd2eec` = `SINE_SIXTEEN_TABLE`)다.
 * `>>` 는 산술 시프트라 내림이다.
 */
export function abilityVertexOf(center: ChartPoint, length: number, angle: number): ChartPoint {
  return {
    x: center.x + ((length * cosineSixteen(angle)) >> 16),
    y: center.y + ((length * sineSixteen(angle)) >> 16),
  }
}

/** 값 네 개의 꼭짓점. 값이 없으면(잠긴 팀, idx = −1) 원본도 네 값을 0 으로 채운다 (0x5b008~0x5b026) */
export function abilityChartVerticesOf(
  center: ChartPoint,
  values: readonly number[],
  radius: number = ABILITY_CHART.radius,
): readonly ChartPoint[] {
  return ABILITY_AXIS_ANGLES.map((angle, axis) =>
    abilityVertexOf(center, abilityAxisLengthOf(values[axis] ?? 0, radius), angle))
}

/**
 * 바탕 테두리 — 그리기 `0x7633c` (확정).
 * 넘겨받은 반지름이 아니라 **고정 29**(`0x7639c movs r3,#0x1d`)로, 자기 각도표 `0xd36fc`
 * (= 역시 [225,315,45,135])를 따라 네 꼭짓점을 잡고 **선 네 줄**(0x763d6~0x7641e)을 긋는다.
 * 색은 `makeColor(0x6b, 0x92, 0xf4)` = **#6B92F4** (`radarAxis`) 다.
 */
export const ABILITY_FRAME_RADIUS = 29

export function abilityChartFrameOf(center: ChartPoint): readonly ChartPoint[] {
  return ABILITY_AXIS_ANGLES.map((angle) => abilityVertexOf(center, ABILITY_FRAME_RADIUS, angle))
}

/**
 * 축별 **최대 꼭짓점**(길이 = 최대길이)으로 그리는 빨간 테두리 — `0x76440~0x764a2`,
 * 색은 `anim+0x1dc = makeColor(255,0,0)`(0x5b36c). 다만 `anim+0x1e0` 이 0 이 아닐 때만 그리는데
 * (0x76424) 그 칸을 세우는 곳을 못 찾았다 — **그래서 웹에서는 그리지 않는다**.
 */
export function abilityChartMaximumOf(center: ChartPoint, radius: number = ABILITY_CHART.radius): readonly ChartPoint[] {
  return ABILITY_AXIS_ANGLES.map((angle) => abilityVertexOf(center, abilityAxisMaximumLengthOf(radius), angle))
}

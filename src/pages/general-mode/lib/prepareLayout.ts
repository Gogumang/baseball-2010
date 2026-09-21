/**
 * **일반모드 준비 화면 배치** — 공용 목록 페이지 `0x63b15(skin, 목록, k, …)` 의 k = 2·3·4
 * (P6 2a-1 · 2a-4 · 2a-5 · 2a-6. 좌표는 확정, 스프라이트 이름 일부는 유력).
 *
 * 원본은 준비·스페셜 화면 열두 가지를 한 함수로 그린다. 어느 k 든 기준점 두 개로 잡힌다:
 * ```
 * 기본 A = (W/2 − 60, H/2 − 50) = (60, 110)   ·  B = (W/2 + 60, H/2 − 68) = (180, 92)
 * k 별 보정 (표 0xd1eac):  k 2 → A (58,107) B (178,96)  ·  k 3·4·5 → A (52,110) B (188,92)
 * ```
 * A 는 왼쪽(유저) 자리, B 는 오른쪽(CPU 또는 능력치) 자리다.
 *
 * 그림 폴더 규칙 (웹판 스프라이트): **이미지**는 `sprites/<이름>/NNN.png`,
 * **프레임**은 `sprites/<이름>/frames/NNN.png` 다. 노트가 "이미지 9" 라 하면 앞쪽,
 * "프레임 0" 이라 하면 뒤쪽이다.
 */
export const SCREEN = { width: 240, height: 320 } as const

/**
 * 팀 엠블럼 `0x5a7b9(skin, 팀, 기준점)` 은 기준점 가운데에 놓인다.
 * 웹판 `ui/team_logo` 는 77×76 이라 반쪽을 빼서 맞춘다 (팀 고르기 화면과 같은 값).
 */
export const TEAM_LOGO_HALF = { width: 38, height: 38 } as const

/** 잠긴 칸(히든 팀·잠긴 마선수) 자리에 그리는 원 두 개 (0x63ec4~0x63f10) */
export const LOCKED_CIRCLES = [
  { diameter: 77, color: '#5A86BD' },
  { diameter: 63, color: '#29348C' },
] as const

/** 이름 막대 — slt_frame **이미지 9** (82×15) 을 (A.x − 41, A.y + 40), 글은 그 +2 */
export const NAME_BAR = { image: 9, width: 82, height: 15, dx: -41, dy: 40, textDy: 42 } as const

/**
 * A·B 딱지 (0x65744, 모든 k 공통).
 *   A = slt_frame 이미지 116(57×15 흰 막대)을 (A.x − 28, A.y − 53), img_text 프레임을 그 +5
 *   B = slt_frame 이미지 `[sp+0xbc]` 를 (B.x − 28, B.y − `[sp+0xb8]`), 글은 그 +5
 *       기본은 117(파란 막대)·43 이고, **k 3~5 는 116·53** 이다
 */
export const TAG = {
  width: 57,
  height: 15,
  dx: -28,
  textDdy: 5,
  whiteBar: 116,
  blueBar: 117,
  aDy: -53,
  bDyDefault: -43,
  bDyMatchScreens: -53,
} as const

/* ── k = 3 선공/구장 (0x640e2~0x647b2) ───────────────────────────────────────── */

export const FIRST_BAT_LAYOUT = {
  anchorA: { x: 52, y: 110 },
  anchorB: { x: 188, y: 92 },
  /** slt_frame 이미지 122 "VS"(37×26) 을 (W/2 − 18, H/2 − 15 − 63) */
  vs: { image: 122, x: SCREEN.width / 2 - 18, y: 82, width: 37, height: 26 },
  /** 선공 꼬리표 slt_frame 이미지 19 (28×18) — 선공을 잡은 쪽 옆에 붙는다 */
  firstBatTag: {
    image: 19,
    width: 28,
    height: 18,
    /** CPU 가 선공이면 (B.x − 56, B.y − 39) + img_text 52 "선공" 을 (B.x − 54, B.y − 37) */
    cpu: { dx: -56, dy: -39, textDx: -54, textDy: -37 },
    /**
     * 유저가 선공이면 꼬리표는 (A.x + 25, A.y − 47) 에 효과 17(좌우 뒤집기)로 붙는다.
     * ⚠️ 원본 배치 미해독 — 근사: 뒤집힌 꼬리표 **위의 "선공" 글자 좌표는 노트에 없다**.
     *    CPU 쪽 (−56,−39) → (−54,−37) 의 어긋남(+2,+2)을 그대로 옮겨 잡았다.
     */
    user: { dx: 25, dy: -47, textDx: 27, textDy: -45 },
    textFrame: 52,
  },
  /** 아래 판 0x5461d(skin, W/2 − 102, H/2 + 30, 204, 80) */
  panel: { x: 18, y: 190, width: 204, height: 80 },
  /** 구장 줄 — game_ui **프레임 22**(187×15) 을 (27, H/2 + 38), 이름은 막대 가운데 y = 200 */
  stadiumBar: { frame: 22, x: 27, y: 198, width: 187, height: 15 },
  /** 구장 이름 = img_text 프레임 **192 + 구장** */
  stadiumNameFrame: 192,
  stadiumNameY: 200,
  /**
   * 좌우 화살 slt_frame 이미지 20 (5×8), y = 201 (오른쪽은 효과 17 뒤집기).
   * ⚠️ 원본 배치 미해독 — 근사: 노트에 y 만 있고 x 가 없어 막대(27~213) 바깥에 붙였다.
   */
  arrow: { image: 20, width: 5, height: 8, y: 201, leftX: 20, rightX: 216 },
  /** stadium_symbol 이미지 구장번호(91×40) 을 (28, H/2 + 58) */
  stadiumSymbol: { x: 28, y: 218, width: 91, height: 40 },
  /** 오른쪽 정보 두 줄 — game_ui **프레임 21**(92×15) */
  infoBars: [
    { frame: 21, x: 121, y: 220, width: 92, height: 15 },
    { frame: 21, x: 121, y: 240, width: 92, height: 15 },
  ],
  /** 딱지 img_text 190 "연고지" (125, 223) · 191 "좌석" (130, 243) */
  infoLabels: [
    { frame: 190, x: 125, y: 223 },
    { frame: 191, x: 130, y: 243 },
  ],
  /** 값은 막대 안 흰 글 가운데 — 연고지 y = 222 · 좌석 y = 242 */
  infoValueY: [222, 242],
} as const

/* ── k = 2 마선수 고르기 (0x647b4~0x64d2e) ───────────────────────────────────── */

export const ACE_LAYOUT = {
  anchorA: { x: 58, y: 107 },
  anchorB: { x: 178, y: 96 },
  /** `0x79ed5(격자, 7, 120, H/2 + 30, 표, 40, 5열, 2행)` → 10칸 */
  /**
   * `0x79ed5(격자, k==2 ? 7 : 8, 120, H/2 + 30 = 190, 표, 40, 5열, 2행)`.
   * ⚠️ 네 번째 인자는 **첫 줄 위쪽 y** 다 (중심 아님 — S9 10절 정정 1).
   */
  grid: { columns: 5, rows: 2, cell: 40, centerX: 120, top: 190 },
  /** 줄 딱지 — 둥근 판 #3045CD (17,175,51×10) + slt_frame 이미지 8 "PITCHER"(46×7) 을 (20,176) */
  rowTags: [
    { panel: { x: 17, y: 175, width: 51, height: 10 }, image: 8, imageAt: { x: 20, y: 176 }, label: 'PITCHER' },
    { panel: { x: 17, y: 233, width: 51, height: 10 }, image: 7, imageAt: { x: 20, y: 234 }, label: 'BATTER' },
  ],
  panelColor: '#3045CD',
  /** 잠긴 마선수 — 원 두 개 + slt_frame 이미지 114 "LOCK"(23×7) + 자물쇠 이미지 31 */
  lock: { labelImage: 114, iconImage: 31 },
  /** A 딱지 = img_text 50 "마타자" / 51 "마투수" (`[skin+0xd0]` 이 고른다) · B 딱지 159 "ABILITY" */
  tagFrames: { 마타자: 50, 마투수: 51, ability: 159 },
  /** 능력치 도형 `0x5aefd(…, B.x, B.y + 8, …, idx − 5, 30)` */
  abilityChart: { dx: 0, dy: 8, radius: 30 },
} as const

/**
 * 마선수 격자 칸 i 의 왼쪽 위 (그리기 `0x7a571`, S9 3-2·4-3 확정).
 *
 * 가로만 가운데를 맞추고 **세로는 `top` 을 그대로** 쓴다. 5열 화면이라 열별 보정
 * `0xd40b8 = [3,3,3,13,13]` 도 받는다 (종류 7·8 이 대상이다).
 *
 * ⚠️ 예전에는 세로도 중심으로 읽어 두 줄이 150·190 에 놓였다 — 줄 딱지 PITCHER(175)가
 * 첫 줄 칸 한복판을 뚫고, BATTER(233)는 둘째 줄이 끝난 뒤 허공에 떴다.
 * ⚠️ 칸 너비 배열과 가로·세로 틈은 문서에 값이 없어 40·0 으로 둔다 (**근사**).
 */
export function aceCellPositionOf(index: number) {
  const { columns, cell, centerX, top } = ACE_LAYOUT.grid
  const column = index % columns
  return {
    x: centerX - (columns * cell) / 2 + cell * column,
    y: top + cell * Math.floor(index / columns) - ACE_COLUMN_Y_OFFSETS[column],
  }
}

/** 5열 화면 전용 열별 y 보정 `0xd40b8` (S9 4-3 확정) */
const ACE_COLUMN_Y_OFFSETS = [3, 3, 3, 13, 13] as const

/* ── k = 4 경기정보 (0x64d30~0x65108) ────────────────────────────────────────── */

/** 줄 딱지 img_text 프레임 — 표 0xd1e84 [47 순위, 48 승패, 49 선발, 51 마투수, 50 마타자] */
export const MATCH_INFO_LABEL_FRAMES = [47, 48, 49, 51, 50] as const

/**
 * 줄 i 의 y = `H/2 − 15 + s + 17·i + 38`, **둘째 무리(i ≥ 2)부터 +8** (0x64f2a~0x65074).
 * k = 4 는 s = 0 이라 183·200·225·242·259 가 된다.
 */
export function matchInfoRowY(index: number): number {
  return SCREEN.height / 2 - 15 + 17 * index + 38 + (index >= 2 ? 8 : 0)
}

export const MATCH_INFO_LAYOUT = {
  anchorA: { x: 52, y: 110 },
  anchorB: { x: 188, y: 92 },
  /** slt_frame **프레임 0** "PLAY BALL"(공 46×46) 을 (W/2 − w/2, y0 − 33) */
  playBall: { frame: 0, y: 112 },
  /** 노랑 반원 slt_frame 이미지 6(26×52) — 왼쪽 (W/2 − 26, 109) · 오른쪽 뒤집어 (119, 109) */
  halfCircle: { image: 6, width: 26, height: 52, leftX: SCREEN.width / 2 - 26, rightX: 119, y: 109 },
  /**
   * 화살 slt_frame 이미지 20 을 (W/2 − d − 7, 98) · (W/2 + d + 1, 98), d = 흔들림 값 `[sp+0xd4]`.
   * ⚠️ 흔들림 식이 미해독이라 **d = 0 으로 굳혀** 둔다 (근사).
   */
  arrow: { image: 20, width: 5, height: 8, y: 98, leftX: SCREEN.width / 2 - 7, rightX: SCREEN.width / 2 + 1 },
  /** 딱지 판 slt_frame 이미지 18(39×15 흰 막대)을 (W/2 − 19, y), 글씨는 그 +2 */
  labelBar: { image: 18, width: 39, height: 15, x: SCREEN.width / 2 - 19, textDy: 2 },
  /**
   * 값 칸 배경 slt_frame 이미지 10 — 짝수 = 유저(x 16) · 홀수 = CPU(x 144) (R4 2d).
   * ⚠️ 원본 배치 미해독 — 근사: 이미지 10 의 **크기가 노트에 없다**. 글자를 가운데로 놓으려고
   *    두 칸 사이 간격 128 에서 가운데 딱지(39)를 뺀 88 을 글 폭으로 쓴다.
   */
  valueCell: { image: 10, userX: 16, cpuX: 144, textWidth: 88 },
  /** 선공 꼬리표는 k = 3 과 같은 자리를 쓴다 */
  firstBatTag: FIRST_BAT_LAYOUT.firstBatTag,
} as const

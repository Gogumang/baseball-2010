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
import type { GridOpenShape } from '@/shared/lib/gridOpen/gridOpen'
import { measuredTitleCenterXOf } from '@/shared/lib/font'

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
  /**
   * 선공 꼬리표 slt_frame 이미지 19 (28×18) + img_text 52 "선공" — 커서 [skin+0x74] 쪽 엠블럼 옆 (k 3 0x641c4~0x642e0 · k 4 0x64d8a~0x64e5c, 직접 떴다).
   * 아래 값은 깜빡 [sp+0xd4] 가 **꺼진** 틀이고, 켜진 틀은 `FIRST_BAT_TAG_BOB` 만큼 바깥으로 2px 나간다 (`firstBatTagPlacementOf`).
   * ```
   * 유저  꼬리표 효과 0x11(좌우 뒤집기) (A.x + 0x1b − 2, A.y − 0x31 + 2) · 글 (A.x + 0x22 − 2, A.y − 0x2f + 2)   ; 켜지면 −2 · +2 를 빼지 않는다
   * CPU   꼬리표 (B.x − 0x3a + 2, B.y − 0x29 + 2) · 글 (B.x − 0x38 + 2, B.y − 0x27 + 2)
   * ```
   */
  firstBatTag: {
    image: 19,
    width: 28,
    height: 18,
    cpu: { dx: -56, dy: -39, textDx: -54, textDy: -37 },
    user: { dx: 25, dy: -47, textDx: 32, textDy: -45 },
    textFrame: 52,
  },
  /**
   * 고른 쪽 엠블럼 뒤 반투명 노랑 원 — 단계 0([skin+0xcc] == 0)이고 깜빡일 때만 0x6b7b9(gfx, 기준 − 41, 기준 − 41, 82, 82, 0x80FFFF00, 0, 360)
   * (0x6413c~0x64178). 엠블럼보다 먼저 그린다.
   */
  sideCircle: { radius: 41, color: 'rgba(255, 255, 0, 0.502)' },
  /** 아래 판 0x5461d(skin, W/2 − 102, H/2 + 30, 204, 80) */
  panel: { x: 18, y: 190, width: 204, height: 80 },
  /** 구장 줄 — game_ui **프레임 22**(187×15) 을 (27, H/2 + 38), 이름은 막대 가운데 y = 200 */
  stadiumBar: { frame: 22, x: 27, y: 198, width: 187, height: 15 },
  /** 구장 이름 = img_text 프레임 **192 + 구장** */
  stadiumNameFrame: 192,
  stadiumNameY: 200,
  /** 구장 이름 그림은 막대 가운데 — `W/2 − (w >> 1)` (0x64780~0x647a6) */
  stadiumNameCenterX: SCREEN.width / 2,
  /**
   * 좌우 화살 slt_frame 이미지 20 (5×8) — **단계와 상관없이 늘** 그린다 (0x644ac~0x64576, 직접 떴다).
   * 왼쪽 (W/2 − 막대폭/2 + 3 + dL, H/2 + 0x29) · 오른쪽 효과 0x11 (W/2 + 막대폭/2 − 8 + dR, H/2 + 0x29), 막대폭 = game_ui 프레임 22 의 187.
   * dL = −2 · dR = +2 는 단계 1([skin+0xcc] == 1) · 깜빡 [sp+0xd4] 이고 커서가 첫 칸 뒤 / 끝 칸 앞일 때만 (`stadiumArrowsOf`).
   */
  arrow: { image: 20, width: 5, height: 8, y: SCREEN.height / 2 + 0x29, leftX: SCREEN.width / 2 - (187 >> 1) + 3, rightX: SCREEN.width / 2 + (187 >> 1) - 8, bob: 2 },
  /**
   * 단계 1 이고 깜빡일 때 구장 막대 자리에 반투명 노랑 둥근 칠 0x6b7d5(gfx, 막대x − 1, 막대y − 1, 막대폭 + 1, 막대높이 + 1, 둥글기 1, 0x80FFFF00)
   * (0x6432e~0x6438e) → (26, 197, 188, 16).
   */
  stadiumHighlight: { x: 26, y: 197, width: 188, height: 16, color: 'rgba(255, 255, 0, 0.502)' },
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
  /**
   * 값 두 줄 — **0xba269 폭 −1** 이라 막대 가운데가 아니다 (0x64688~0x6472c 직접 뜸):
   * ```
   * 646ca  연고지 0xba269("!C!cffffff%s"(0xcf2e0) 도시, W/2 + 막대폭/2 + 8, H/2 + 0x3e, −1, −1)    ; 막대폭 = game_ui 프레임 21 의 92
   * 6472c  좌석   0xba269("!C!cffffff%d석"(0xd2488) 수, W/2 + 막대폭/2 − 1, H/2 + 0x52, −1, −1)   ; 같은 r6 = 0xba269 를 다시 부른다
   * ```
   * 폭 −1 = 날 글 폭(서식 글자까지 잰 0x9c52c)이고 `!C` 줄은 x + (폭 >> 1) 이 가운데다(`measuredTitleCenterXOf`).
   * 막대폭/2 는 C 나눗셈 `(v + 부호) >> 1` (0x646a2~0x646ae) — 92 → 46.
   */
  infoValues: [
    { x: SCREEN.width / 2 + (92 >> 1) + 8, y: SCREEN.height / 2 + 0x3e, format: '!C!cffffff%s' },
    { x: SCREEN.width / 2 + (92 >> 1) - 1, y: SCREEN.height / 2 + 0x52, format: '!C!cffffff%d석' },
  ],
} as const

/* ── k = 2 마선수 고르기 (0x647b4~0x64d2e) ───────────────────────────────────── */

export const ACE_LAYOUT = {
  anchorA: { x: 58, y: 107 },
  anchorB: { x: 178, y: 96 },
  /**
   * `0x79ed5(격자, k==2 ? 7 : 8, 120, H/2 + 30 = 190, 칸너비 0xd1df8 = [40 ×5], 줄높이 40, 5열, 2줄, 가로틈 0, 세로틈 0x12, 1)`
   * (0x647f4~0x6482e, 직접 떴다). 네 번째 인자는 **첫 줄 위쪽 y** 다 (중심 아님 — S9 10절 정정 1).
   */
  grid: { columns: 5, rows: 2, cell: 40, centerX: 120, top: 190, hGap: 0, vGap: 0x12 },
  /**
   * 칸 그리기 — 0x7a005(격자, 1, 1, 1) 로 열림 애니 · 튕김 · 칸 바탕을 켠다(0x64832). 매 틱 0x7a571 이 (직접 떴다):
   * ```
   * 7a844  보이는 칸마다 0x6b7d5(gfx, x − 3, y − 3, 43, 43, 둥글기 1, RGB(0x30, 0x45, 0xcd))     ; 남색 둥근 바탕
   * 7b14c  종류 7: slt_frame 이미지 0(39×38) 을 (x, y)
   * 7b222  열렸으면 [skin+0xac](ace_icon) 이미지 칸번호 를 (x + 3, y + 2) — 흐릴 칸이면 효과 0xa(회색)
   *        잠겼으면 ace_icon 이미지 10 "?" 를 (x + 10, y + 5)
   * 7b408  커서 — 깜빡 ([격자+0x18] % 8 ≤ 4) 이고 열림 애니가 끝났으면 slt_frame 이미지 1(42×42) 을 (x − 2, y − 2)
   * ```
   */
  cellBack: { dx: -3, dy: -3, size: 43, color: '#3045CD' },
  cellImage: 0,
  icon: { dx: 3, dy: 2 },
  lockedIcon: { image: 10, dx: 10, dy: 5 },
  cursor: { image: 1, dx: -2, dy: -2 },
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
 * 가로만 가운데를 맞추고 **세로는 `top` 을 그대로** 쓴다 — 줄 사이는 줄높이 40 + 세로틈 18 = 58.
 * 5열 화면이라 열별 보정 `0xd40b8 = [3,3,3,13,13]` 도 받는다 (종류 7·8 이 대상이다).
 * 열림 애니(위에서 한 줄씩 떨어짐 — `ACE_GRID_OPEN`)와 커서 튕김(2px 2틱)이 끝난 자리다 — ⚠️ 튕김은 아직 옮기지 않았다.
 */
export function aceCellPositionOf(index: number) {
  const { columns, cell, centerX, top, hGap, vGap } = ACE_LAYOUT.grid
  const column = index % columns
  return {
    x: centerX - ((columns * cell + (columns - 1) * hGap) >> 1) + (cell + hGap) * column,
    y: top + (cell + vGap) * Math.floor(index / columns) - ACE_COLUMN_Y_OFFSETS[column],
  }
}

/**
 * 격자 열림 애니의 꼴 (`shared/lib/gridOpen`) — 줄높이 40 · 세로틈 0x12 · 가속 시프트 1(0x6481e `str r6,[sp,#0x18]`).
 * 시작 `0x7a005(격자, 1, 1, 1)`(0x64832~0x6483c) — 넷째 인자와 상관없이 늘 돈다.
 */
export const ACE_GRID_OPEN: GridOpenShape = {
  rows: ACE_LAYOUT.grid.rows, columns: ACE_LAYOUT.grid.columns, rowHeight: ACE_LAYOUT.grid.cell, rowGap: ACE_LAYOUT.grid.vGap, shift: 1,
}

/**
 * 격자 커서 깜빡임 — 그릴 때마다 [격자+0x18] 을 1 올리고 `% 8 ≤ 4` (0x7a632~0x7a64a).
 * 시작 0x7a005 가 [격자+0x18] = 0 으로 둔다(0x7a01e) — 격자를 지은 그림이 0 이다.
 */
export const isAceGridCursorOn = (drawCount: number): boolean => ((drawCount % 8) + 8) % 8 <= 4

/**
 * 흐린 칸(효과 0xa) — 0x7b1d0~0x7b220. [skin+0x105](레벨업 화면)이면 흐리지 않는다.
 * 단계 [skin+0xd0] 가 1(마투수 고르기)이면 마타자 칸(5~9)을, 0(마타자 고르기)이면 **고른 마투수가 아닌** 마투수 칸(0~4)을 흐린다.
 * ⚠️ 0 갈래의 "고른 마투수" 바이트([sp+0x15a] = [skin+0xbc..]+0xe 를 옮긴 것)는 칸 번호와 같은 뜻으로 읽었다(유력).
 */
export function isAceCellDimmed(cell: number, isPitcherPhase: boolean, chosenPitcherCell: number | null): boolean {
  if (isPitcherPhase) return cell > 4
  return cell <= 4 && cell !== chosenPitcherCell
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
  /**
   * 노랑 반원 slt_frame 이미지 6(26×52) — 왼쪽 (W/2 − 26, 109) · 오른쪽 뒤집어 (119, 109).
   * 값 줄 0x5dcc0 이 다 펼쳐졌다고 돌려주고([skin+0xe4] ≠ 0) **깜빡 [sp+0xd4] 일 때만** 그린다 (0x65078~0x65108).
   */
  halfCircle: { image: 6, width: 26, height: 52, leftX: SCREEN.width / 2 - 26, rightX: 119, y: 109 },
  /**
   * 화살 slt_frame 이미지 20 을 (W/2 − d − 7, 98) · 효과 0x11 로 (W/2 + d + 1, 98) — d = 깜빡 [sp+0xd4] (0 · 1) (0x64eba~0x64f08).
   */
  arrow: { image: 20, width: 5, height: 8, y: 98, leftX: SCREEN.width / 2 - 7, rightX: SCREEN.width / 2 + 1 },
  /** 딱지 판 slt_frame 이미지 18(39×15 흰 막대)을 (W/2 − 19, y), 글씨는 그 +2 */
  labelBar: { image: 18, width: 39, height: 15, x: SCREEN.width / 2 - 19, textDy: 2 },
  /**
   * 값 칸 0x5dcc0(skin, W/2 − 104 = 16, H/2 − 15 + 0x2e, …) — 칸 i 를 번갈아 유저 · CPU 로 그린다 (0x5de44~0x5e248, 직접 떴다):
   * 유저 slt_frame 이미지 10(86×15) 을 (16, 줄y + 3) · CPU 는 효과 0x11(좌우 뒤집기)로 (16 + 128 − 6 = 138, 줄y − 3).
   * 글은 칸 가운데(x + 43)에 칸 y + 2 로 놓는다(0x9c068).
   */
  valueCell: { image: 10, width: 86, height: 15, userX: 16, cpuX: 138, userDy: 3, cpuDy: -3, textDy: 2 },
  /** 선공 꼬리표는 k = 3 과 같은 자리를 쓴다 */
  firstBatTag: FIRST_BAT_LAYOUT.firstBatTag,
} as const

/** 경기정보(k 4) 투명 누름 칸 — 가운데 PLAY BALL 공(slt_frame 0, 46×46) = OK */
export const MATCH_INFO_PLAY_BALL_PRESS_RECT = {
  x: SCREEN.width / 2 - 23, y: MATCH_INFO_LAYOUT.playBall.y - 33, width: 46, height: 46,
} as const

/** 경기정보 투명 누름 칸 — 엠블럼(76×76) 자리 = ←/→ 엔트리 */
export const matchInfoLogoPressRectOf = (anchor: { readonly x: number; readonly y: number }) => ({
  x: anchor.x - TEAM_LOGO_HALF.width, y: anchor.y - TEAM_LOGO_HALF.height,
  width: TEAM_LOGO_HALF.width * 2, height: TEAM_LOGO_HALF.height * 2,
})

/**
 * 공용 목록 깜빡 [sp+0xd4] — 다섯째 인자(메인 메뉴 [메뉴+0x2c], 상태에 들어온 뒤 센 틱)가 `% 6 ≤ 3` 이면 1 (0x63b4a~0x63b5c).
 * ⚠️ 웹은 화면을 띄운 뒤 갱신 수로 센다 — 시작 위상은 원본과 같다고 본다(진입 때 0 으로 지우는 곳은 미확인).
 */
export const isPrepareBobOn = (tick: number): boolean => ((tick % 6) + 6) % 6 <= 3

/** 깜빡이 켜지면 꼬리표가 바깥으로 2px — 유저 (+2, −2) · CPU (−2, −2) */
export const FIRST_BAT_TAG_BOB = { user: { x: 2, y: -2 }, cpu: { x: -2, y: -2 } } as const

/** 선공 꼬리표 · 글의 자리 (k 3 · 4 공용) */
export function firstBatTagPlacementOf(isUser: boolean, anchor: { readonly x: number; readonly y: number }, isBob: boolean) {
  const offset = isUser ? FIRST_BAT_LAYOUT.firstBatTag.user : FIRST_BAT_LAYOUT.firstBatTag.cpu
  const bob = isBob ? (isUser ? FIRST_BAT_TAG_BOB.user : FIRST_BAT_TAG_BOB.cpu) : { x: 0, y: 0 }
  return {
    tag: { x: anchor.x + offset.dx + bob.x, y: anchor.y + offset.dy + bob.y },
    text: { x: anchor.x + offset.textDx + bob.x, y: anchor.y + offset.textDy + bob.y },
  }
}

/** 구장 줄 좌우 화살 x — 단계 1 · 깜빡일 때 커서가 움직일 수 있는 쪽으로 2px (0x644ac~0x644ce) */
export function stadiumArrowsOf(isStadiumStage: boolean, isBob: boolean, cursor: number, count: number) {
  const { leftX, rightX, bob } = FIRST_BAT_LAYOUT.arrow
  const active = isStadiumStage && isBob
  return {
    leftX: leftX - (active && cursor > 0 ? bob : 0),
    rightX: rightX + (active && cursor < count - 1 ? bob : 0),
  }
}

/**
 * 구장 값 두 줄의 보이는 글과 가운데 x — `FIRST_BAT_LAYOUT.infoValues` 의 서식에 값을 넣은 **날 글**을 재서
 * x + (폭 >> 1) 를 가운데로 둔다 (0xba269 폭 −1, 0x646ca · 0x6472c). 값이 없으면(구장 표 미추출) 빈 글.
 */
export function stadiumInfoValuesOf(stadium: { readonly city: string; readonly capacity: number } | undefined) {
  const [cityLine, seatLine] = FIRST_BAT_LAYOUT.infoValues
  if (stadium === undefined) return [{ text: '', centerX: cityLine.x }, { text: '', centerX: seatLine.x }]
  const seats = `${stadium.capacity}석`
  return [
    { text: stadium.city, centerX: measuredTitleCenterXOf(cityLine.x, cityLine.format.replace('%s', stadium.city)) },
    { text: seats, centerX: measuredTitleCenterXOf(seatLine.x, seatLine.format.replace('%d석', seats)) },
  ]
}

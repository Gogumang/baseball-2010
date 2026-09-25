/**
 * 메인 메뉴 배치 — 원본 그림·좌표를 그대로 쓴다.
 *
 * 원작 메뉴는 **두 겹**이다. 어느 하위 상태든 먼저 반원 바퀴 판 0x24b1c 를 깔고,
 * 하위 목록이 있는 상태(5·6·9 …)는 그 위에 **세로 릴 0x2524c** 를 더 그린다
 * (부르는 곳 0x2857c·0x285ac·0x285dc·0x2860c·0x2863c 가 모두 `0x24b1c` → `0x2524c` 짝이다).
 *
 * ## 두 단이 **같은 모델**이다 — 각도가 아니라 **배열이 돈다**
 * 커서가 칸 사이를 옮겨 다니는 것이 아니라, 화면 자리는 고정이고 **항목 배열이 한 칸씩 회전**한다.
 * 회전 함수는 윗단·아랫단이 **같은 0x24780** 이다 (윗단 0x24c58, 아랫단 0x253a6).
 *   `0x24780(obj, arr, n, dir)` — arr 에서 −1 이 아닌 구간만 찾아
 *   dir −1 이면 오른쪽 1칸, dir −2 면 왼쪽 1칸 돌린다. **고른 칸은 언제나 그 구간의 첫 칸**이다.
 * 키도 같다 (상태 4 는 0x294e6, 상태 5 는 0x28e26): ↑·← = −1, ↓·→ = −2.
 *
 * ## 윗단 (하위 상태 4, 반원 바퀴) — 확정
 * - 중심 `(scrW>>1, scrH)` = **(120, 320)** — 0x237c4(폭 0x14008b8) · 0x237d6(높이 0x14008c8)
 * - 테두리 원 3겹: 반지름 **93 · 95 · 97**, 색 RGB(37,55,120) · RGB(138,185,235) · RGB(36,55,120) — 0x24cf6~0x24d70
 * - 가운데에 main_ball 애니 0 을 (120,320) 기준점으로 그린다 — 0x24cda
 * - 각도 표 0xcead4 = **[0,45,90,180,270,315]** (s16), 순서 표 0xceae0 = [0..5]
 * - 칸 그림 표 **0xcea6c = [0,1,2,3,4,26]** (u32, `ui/img_text` 프레임) — 상태 4 진입 0x258fc 가
 *   전역 `[0x1552d4c]` 로 통째로 복사하고, 그 배열이 0x24c58 에서 돈다. **확정**
 *   (예전 주석이 "눈으로 맞춘 유력" 이라 했는데 값은 그대로 맞았다.)
 * - 칸 위치: `x = 120 + (cos a·93 >> 16) + (a 가 [90,270] 밖이면 20)`, `y = 320 + (sin a·93 >> 16)` — 0x24e8a~0x24eba
 * - 도는 동안 각 = 표값 ± 카운터×9, **90° 벌어지는 칸만 ×18** — 0x24de6~0x24e2c
 * - 카운터 0→4, 5틱째에 배열을 돌린다 — 0x24c42~0x24c4c
 * - 칸 그림은 기준점 가운데 맞춤 `(x − w/2, y − h/2)`, 폭·높이는 그 img_text 프레임 것이다 — 0x24fc4~0x24fe2
 * - **각이 19 미만이거나 341 초과면 아예 안 그린다** — 0x24ef0. 고른 칸은 배열 0번 = 각도 0° 라
 *   **늘 이 구간에 들어간다 → 고른 칸은 바퀴에 안 그려지고 설명 판이 대신한다.**
 * - 커서 [obj+0xe8] 은 0~5 로 감싼다 — 0x24bfa~0x24c14. OK 를 누르면 표 0xcebdc = [5,6,7,8,9,10]
 *   으로 하위 상태를 고른다 (0x294a2) → 게임시작 5 · 스페셜 6 · 도움말 7 · 환경설정 8 · 랭킹 9 · 게임문의 10.
 *
 * ## 아랫단 (세로 릴 0x2524c) — 확정
 * 아래 `MENU_REEL_*` 주석 참고. 표 넷을 전부 binary.mod 에서 다시 떠 대조했다.
 *
 * ## 아랫단 바탕 띠 — 확정 (아래 `MENU_BAND_*` 참고)
 * **"윗단 잔상" 과 "아랫단 바탕 그라데이션" 은 서로 다른 연출이 아니라 같은 코드 한 덩이다.**
 * 0x253e8~0x2548e 밖에 `[메뉴+0xe4]` 를 읽는 곳이 없고(전체 .text 를 훑어 0xe2·0xe4 를 건드리는
 * 곳은 0x23840·0x254e6·0x25512 뿐이다), 그 덩이는 **아랫단 0x2524c 안에만** 있다. 윗단 판
 * 0x24b1c 에는 아예 없다. 그리고 멈추는 값은 **높이/2 = 160** 이다 — 폭/2 = 120 이 아니다.
 * 0x254e8 이 부르는 것이 폭(0x14008b8)이 아니라 **높이(0x14008c8)** 이기 때문이다.
 *
 * ## 아직 모르는 것
 * - 각도 구간별 main_ui 이미지 0·1·2 접힘 연출(R6 2절)은 안 옮겼다. **미구현**(지어낸 것 아님).
 * - main_ball 을 그리는 조건 `[+0xe6] ≥ 0` 의 뜻을 몰라 늘 그린다. **근사**.
 *   (진입 0x237b4 가 `[0xe6] = 0`, 0x23848 이 5·0x11 로 들어올 때만 `= 1` 을 넣는다. 0x24cde 가
 *    `[0xe6] ≤ 0` 이면 테두리 원·칸 글자를 통째로 건너뛰므로 뜻이 "바퀴를 편다" 쪽으로 보이는데,
 *    윗단 진입 0x25936 이 무엇을 넣는지까지는 안 봤다.)
 *
 * 그림 치수는 직접 읽어 확정이다:
 *   배너 `mode_back/000` 240×84 · `main_ui/frames/NNN` 높이 **27** · `img_text/frames/NNN` 높이 **10**
 *   설명 판 `main_ui/003` 149×63
 */

/**
 * 원작 화면 240×320.
 *
 * ⚠️ **바이너리에 박힌 값이 아니다.** 초기화 0x237c4·0x237d6 이 `[메뉴+0xd8] = 폭>>1`,
 * `[메뉴+0xdc] = 높이` 를 넣는데, 그 폭·높이는 .data 0x14008b8 · 0x14008c8 **을 부른** 값이다.
 * 이 둘은 전역 변수가 아니라 .data(0x1400000, 크기 0x998, **실행 가능**) 에 깔린 **WIPI 네이티브
 * 호출 토막**이다 — 16바이트마다 `[클래스 0x1fb][메서드 번호][str lr,[sp,#-4]!][bl 디스패처]` 꼴이고
 * 폭이 메서드 0x32, 높이가 0x33 이다. 곧 **기종이 알려 주는 값**이라 기종별로 다를 수 있다.
 *   (`ldr r3,[pc,…] ; bl 0xca9f8` 의 0xca9f8 은 `bx r3` 한 줄짜리 징검다리다 — 0xca9e8~0xcaa20 이
 *    레지스터마다 `bx rN` 을 늘어놓은 표다. 그래서 "전역을 읽는다" 가 아니라 "그 주소로 뛴다" 다.)
 *
 * 그래도 **320 으로 본다** — 근거:
 * - `mainui/main_title.pzx` 안에 **정확히 240×320 인 그림이 10장** 있다(전체 배경). 240×400 이상은 없다.
 * - 외출 지도 바닥선 `0x7fe0c` = `높이() − 0x44` → 320 이면 252 (A-8·R6 5절과 같은 값),
 *   지도 프레임은 높이 298 이라 `mapY = (높이 − 298)>>1 = 11` — 400 화면이면 51 이 되어 그림이 뜬다.
 * - 훈련 팝업 가운데 정렬 `0x84eda` 의 `높이()/2` = 160.
 * - 0x1637d4 바이트 바이너리 전체에 해상도 분기가 없다(한 벌로 모든 기종을 돈다).
 * **단, 아래 `menuReelTextTopLeftOf`·`MENU_DESCRIPTION_PANEL` 의 잘림은 높이와 무관하다** — 그 주석 참고.
 */
export const SCREEN_WIDTH = 240
export const SCREEN_HEIGHT = 320
/** 화면 가운데 */
export const SCREEN_CENTER_X = 120

export const MENU_BANNER = { x: 0, y: 0, width: 240, height: 84 } as const

/** `main_ui/frames` 글자 그림의 공통 높이 (원점표에서 읽었다) — 설명 판 안 큰 글자가 이 크기다 */
export const MENU_LABEL_HEIGHT = 27

// ──────────────────────────── 반원 바퀴 (윗단 = 처음 메뉴 6칸) ────────────────────────────

/** 바퀴 중심 (120,320) — 초기화 0x237c4 (확정) */
export const MENU_WHEEL_CENTER = { x: SCREEN_CENTER_X, y: SCREEN_HEIGHT } as const

/** 칸이 놓이는 반지름 — 0x24e92 의 0x5d (확정) */
export const MENU_WHEEL_RADIUS = 93

/** 테두리 원 3겹 — 0x24cf6~0x24d70 (확정) */
export const MENU_WHEEL_RINGS = [
  { radius: 93, color: 'rgb(37, 55, 120)' },
  { radius: 95, color: 'rgb(138, 185, 235)' },
  { radius: 97, color: 'rgb(36, 55, 120)' },
] as const

/** 각도 표 0xcead4 (s16, 도) — 확정 */
export const MENU_WHEEL_ANGLES = [0, 45, 90, 180, 270, 315] as const
/** 순서 표 0xceae0 — 확정. 표 자리와 칸 번호가 1:1 이다. */
export const MENU_WHEEL_ORDER = [0, 1, 2, 3, 4, 5] as const

/**
 * 칸 글자 표 0xcea6c (u32 6개, `ui/img_text` 프레임 번호) — 확정.
 * 상태 4 진입 0x258fc 가 `memcpy([0x1552d4c], 0xcea6c, 0x18)` 로 복사한다.
 * 0 게임시작 · 1 스페셜 · 2 도움말 · 3 환경설정 · 4 랭킹 · **26 게임문의** (5 는 "선물&추천" 이라 아니다).
 */
export const MENU_WHEEL_ITEM_FRAMES = [0, 1, 2, 3, 4, 26] as const

/**
 * 고른 칸이 오는 배열 자리 = **0번(각도 0°)** — 0x24780 이 구간 첫 칸을 기준으로 돌리고,
 * 설명 판도 이 자리(`[sp+0x38] == 0`)에서만 그린다 (0x24ff0). **확정**.
 * 각도 0° 는 아래 `isMenuWheelAngleDrawn` 에서 걸러지므로 **고른 칸은 바퀴에 안 그려진다.**
 */
export const MENU_WHEEL_SELECTED_SLOT = 0

/** 한 칸 이동에 걸리는 틱 — 카운터 0→4, 5틱째 회전 (확정) */
export const MENU_WHEEL_TURN_TICKS = 5

/** 기준점 가운데 맞춤이라 화면 밖으로 넘치는 칸도 그대로 그린다 (stage 가 잘라 준다) */
export interface MenuWheelPoint {
  readonly x: number
  readonly y: number
}

/** 원본 키 방향 값 `[obj+0x100]` — ↑·← 가 −1, ↓·→ 가 −2 다 (0x294e6 · 0x28e26) */
export type MenuTurnDirection = -1 | -2

/** 각도를 0 이상 360 미만으로 접는다 */
function wrapDegrees(angle: number): number {
  return ((angle % 360) + 360) % 360
}

/** 16.16 고정소수 `>> 16` 은 −∞ 쪽으로 자른다 — 그래서 Math.floor 다 */
function scaled(value: number): number {
  // cos 90° 같은 자리에서 떠다니는 1e-17 이 floor 때문에 −1 로 떨어지는 것만 막는다
  const clean = Math.abs(value) < 1e-9 ? 0 : value
  return Math.floor(clean * MENU_WHEEL_RADIUS)
}

/**
 * 각도 → 칸 기준점. `x = 120 + (cos a·93 >> 16) + (a 가 [90,270] 밖이면 20)`,
 * `y = 320 + (sin a·93 >> 16)` (0x24e8a~0x24eba, 확정).
 *
 * 20px 보정은 **각도로만** 갈리므로 도는 도중 270° 를 지날 때 x 가 20 만큼 툭 튄다.
 * 원본 식 그대로다 — 고치지 않는다.
 */
export function menuWheelPointOf(angle: number): MenuWheelPoint {
  const a = wrapDegrees(angle)
  const radians = (a * Math.PI) / 180
  const sideShift = a < 90 || a > 270 ? 20 : 0
  return {
    x: MENU_WHEEL_CENTER.x + scaled(Math.cos(radians)) + sideShift,
    y: MENU_WHEEL_CENTER.y + scaled(Math.sin(radians)),
  }
}

/**
 * 그 각에 칸을 그리는지 — 0x24ef0 `r2 = a − 0x13 ; cmp r2, #0x142 ; bhi 건너뜀` (부호 없음)
 * 곧 **19 ≤ a ≤ 341** 만 그린다. 표의 0° 자리(= 고른 칸)는 여기서 걸린다.
 */
export function isMenuWheelAngleDrawn(angle: number): boolean {
  const a = wrapDegrees(angle)
  return a >= 19 && a <= 341
}

/**
 * 도는 동안 한 틱에 움직이는 각 — 보통 9°, **90° 벌어지는 자리만 18°** (0x24de6~0x24e06, 확정).
 * dir −1(각이 커지는 쪽)은 90·180 에서, dir −2(작아지는 쪽)는 180·270 에서 18° 다.
 */
export function menuWheelStepOf(angle: number, direction: MenuTurnDirection): number {
  if (direction === -1 && (angle === 90 || angle === 180)) return 18
  if (direction === -2 && (angle === 180 || angle === 270)) return 18
  return 9
}

/**
 * 배열 자리 `slot` 이 카운터 `counter` 일 때 놓이는 각.
 * dir −1 이면 표값 + 걸음×카운터, −2 면 −. 360 을 넘으면 360 으로 잘리고(0x24e2e),
 * 음수면 +360 한다(0x24e74). `direction` 이 null 이면 멈춰 있는 표값 그대로다.
 */
export function menuWheelAngleAt(
  slot: number,
  direction: MenuTurnDirection | null,
  counter: number,
): number {
  const base = MENU_WHEEL_ANGLES[slot]
  if (direction === null || counter <= 0) return base
  const moved = menuWheelStepOf(base, direction) * Math.min(counter, MENU_WHEEL_TURN_TICKS)
  const angle = direction === -1 ? base + moved : base - moved
  if (angle > 360) return 360
  return angle < 0 ? angle + 360 : angle
}

/**
 * 커서가 `cursor` 일 때 각도 표 자리마다 놓이는 칸 번호.
 * 아랫단과 같은 0x24780 회전이라 "왼쪽으로 cursor 번 돌린 것" 과 같다 — 곧 `(cursor + 자리) % 6`.
 */
export function menuWheelOrderOf(cursor: number): number[] {
  let order: number[] = [...MENU_WHEEL_ORDER]
  for (let step = 0; step < cursor; step += 1) order = rotateMenuReel(order, -2)
  return order
}

/** 칸 그림의 좌상단 — 기준점 가운데 맞춤 (0x24fc4: x − w/2, y − h/2) */
export function menuWheelLabelTopLeftOf(
  point: MenuWheelPoint,
  width: number,
  height: number,
): MenuWheelPoint {
  return { x: point.x - Math.trunc(width / 2), y: point.y - Math.trunc(height / 2) }
}

// ──────────────────────── 세로 릴 (아랫단 = 하위 목록 0x2524c) ────────────────────────

/**
 * **슬롯 표 0xceaf2** = s8[6][9]. 색인은 커서가 아니라 **상태 − 5** 다
 * (0x25490 `r3 = 상태*9 + 표 − 0x2d`). 값은 항목 배열 `[0x1552d28]` 의 첨자이고,
 * **−1 이면 그 슬롯은 건너뛴다** (0x2552c). 확정 — 바이너리에서 54바이트 그대로 읽었다.
 */
export const MENU_REEL_SLOT_TABLE: readonly (readonly number[])[] = [
  [-1, 5, 6, 7, 1, 2, 3, 4, -1], // 상태 5 게임시작 (7칸)
  [-1, 6, 7, 8, 1, 2, 3, 4, 5], //  상태 6 스페셜 (8칸)
  [-1, 5, 6, 7, 1, 2, 3, 4, -1], // 상태 7 도움말
  [-1, -1, 5, 6, 1, 2, 3, 4, -1], // 상태 8 환경설정
  [-1, -1, 5, 6, 2, 3, 4, -1, -1], // 상태 9 랭킹 (5칸)
  [-1, -1, -1, 4, 3, -1, -1, -1, -1], // 상태 10 게임문의
] as const

/** 슬롯 표에서 상태 하나의 줄 */
export function menuReelSlotRowOf(state: number): readonly number[] {
  return MENU_REEL_SLOT_TABLE[state - 5] ?? MENU_REEL_SLOT_TABLE[0]
}

/**
 * **항목 글자 표** — 상태 진입 때 ROM 에서 전역 `[0x1552d28]` 로 통째로 복사한다
 * (상태 5 = 0x25b94 · 6 = 0x23d60 · 9 = 0x23d98, 각각 `memcpy(…, 0x24)` = u32 9개).
 * 값은 **`ui/img_text` 프레임 번호**다 — `main_ui` 가 아니다 (0x2553e 가 img_text 전역
 * `[0x1552aec]` 의 프레임 목록에서 뽑는다). 셋 다 바이너리에서 다시 읽어 확정했다.
 */
export const MENU_REEL_ITEM_FRAMES: Readonly<Record<number, readonly number[]>> = {
  5: [-1, 6, 9, 12, 15, 18, 20, 23, -1], // 0xcea48
  6: [-1, 7, 11, 189, 14, 17, 19, 21, 315], // 0xcea24
  9: [-1, -1, 9, 12, 15, 18, 20, -1, -1], // 0xcea00
}

/** 상태별 항목 수 — 진입 코드가 `[obj+0xe9]` 에 박는 값 (5→7 · 6→8 · 9→5) */
export const MENU_REEL_ITEM_COUNT: Readonly<Record<number, number>> = { 5: 7, 6: 8, 9: 5 }

/** 표에서 −1(빈 자리)을 뺀, **항목 차례대로의** img_text 프레임 목록 */
export function menuReelFrameListOf(frames: readonly number[]): number[] {
  return frames.filter((frame) => frame !== -1)
}

/**
 * **0x24780 그대로** — 배열에서 −1 이 아닌 구간만 찾아 한 칸 돌린다.
 * dir −1 이면 오른쪽(구간 마지막 값이 맨 앞으로), −2 면 왼쪽(맨 앞 값이 마지막으로).
 * 구간 밖(−1 자리)은 건드리지 않는다.
 */
export function rotateMenuReel(items: readonly number[], direction: MenuTurnDirection): number[] {
  const next = [...items]
  const first = next.findIndex((value) => value !== -1)
  if (first < 0) return next
  let last = next.length - 1
  while (last > first && next[last] === -1) last -= 1

  if (direction === -1) {
    const carried = next[last]
    for (let i = last; i > first; i -= 1) next[i] = next[i - 1]
    next[first] = carried
  } else {
    const carried = next[first]
    for (let i = first; i < last; i += 1) next[i] = next[i + 1]
    next[last] = carried
  }
  return next
}

/**
 * 항목 표와 같은 꼴(−1 자리까지)로 만든 "몇 번째 항목인가" 배열.
 * 원본은 프레임 배열을 돌리지만, 같은 배열을 항목 차례로 채워 돌리면 화면 어느 슬롯에 어느
 * 항목이 있는지 그대로 나온다 — 프레임 번호는 항목 차례로 따로 찾으면 된다.
 */
function menuReelIndexSource(frames: readonly number[]): number[] {
  let seen = 0
  return frames.map((frame) => {
    if (frame === -1) return -1
    const index = seen
    seen += 1
    return index
  })
}

/**
 * 커서가 `cursor` 일 때의 배열. 원본은 ↓ 를 누를 때마다 배열을 왼쪽으로 돌리고 커서를 +1 하므로
 * (0x25328 · 0x253a6), 커서 칸수만큼 왼쪽으로 돌린 것과 결과가 같다.
 */
export function menuReelOrderOf(frames: readonly number[], cursor: number): number[] {
  let order = menuReelIndexSource(frames)
  for (let step = 0; step < cursor; step += 1) order = rotateMenuReel(order, -2)
  return order
}

/**
 * 화면 슬롯(1..7) → 그 칸에 놓인 항목 차례. 놓을 것이 없으면 null.
 * 슬롯 표 값이 −1 이거나, 배열의 그 자리가 −1 이면 없다.
 */
export function menuReelEntryAtSlotOf(
  frames: readonly number[],
  slotRow: readonly number[],
  cursor: number,
  slot: number,
): number | null {
  const arrayIndex = slotRow[slot]
  if (arrayIndex === undefined || arrayIndex === -1) return null
  const entry = menuReelOrderOf(frames, cursor)[arrayIndex]
  return entry === undefined || entry === -1 ? null : entry
}

/** 화면에 그리는 슬롯 번호 — 1..7 이고 **4 는 뺀다** (0x2562c `cmp #4 ; ble`) */
export const MENU_REEL_SLOTS: readonly number[] = [1, 2, 3, 5, 6, 7]

/**
 * 릴 글자의 가운데 x = `scrW − 0x28` = **200** (0x255c4 · 0x255de).
 * ⚠️ 화면 가운데(120)가 아니다 — 원본이 목록을 오른쪽으로 몰아 그린다.
 * 바퀴 315° 칸이 (205,254) 인 것과 같은 자리다.
 */
export const MENU_REEL_TEXT_CENTER_X = SCREEN_WIDTH - 0x28

/** 줄 간격 — 슬롯마다 20px (0x256c0 `adds r1,#0x14`) */
export const MENU_REEL_ROW_STEP = 20

/** 그림자 색 #212B70 — 0x255c8 `setColor(0x21, 0x2b, 0x70)` (확정) */
export const MENU_REEL_SHADOW_COLOR = '#212b70'

/** 그림자는 진짜 글자에서 (+1,+1) 자리에 **먼저** 찍는다 (x 는 0x27 vs 0x28, y 는 −6 vs −7) */
export const MENU_REEL_SHADOW_OFFSET = { x: 1, y: 1 } as const

/**
 * 한 칸 옮길 때의 스크롤 값 `[0x1552d68]` — 키를 누른 프레임에 ±1 로 시작해서
 * 매 갱신 ×4 하고(0x25386 `lsls #2`), 절댓값이 0x1f 를 넘으면 배열을 돌리고 0 으로 되돌린다.
 * 그래서 실제로 그려지는 값은 **±1 → ±4 → ±16 → 0** 넉 장이다.
 * 부호: ↑(dir −1) 이 **+**, ↓(dir −2) 가 **−** 다 (0x2534c~0x2535a).
 */
export const MENU_REEL_SCROLL_STEPS: readonly number[] = [1, 4, 16]

/**
 * 슬롯 글자의 좌상단 (0x255aa~0x2562a · 0x2562c~0x256b0, 확정). `base = scrH = 320`.
 *   i ≤ 3 : (240 − w/2 − 0x28, base + (20i − 100) + 스크롤 − 7)
 *   i ≥ 5 : (240 − w/2 − 0x28, base + 20i + 스크롤 − 0x3c)
 * i == 4 는 아예 그리지 않는다 — 고른 칸은 설명 판이 대신 보여 준다.
 *
 * ⚠️ **아래 세 줄(360·380·400)이 화면 밖인 것은 원본이 그렇다 — 확정.**
 * 두 식의 상수는 0x25518 에서 그대로 읽었다: `[sp+0x18] = −0x50`, `[sp+0x1c] = 0x14`,
 * 줄마다 둘 다 `+0x14`(0x256c0·0x256c2). 그래서 i ≥ 5 자리는 **`높이 + 20i − 60`**,
 * 곧 **언제나 `높이 + 40·60·80`** 이다. **화면이 몇이든 아래 세 줄은 바닥 밖**이라
 * "실기가 240×400 이었다" 같은 해상도 가설로는 설명되지 않는다(가설 기각).
 *
 * 뜻: 아랫단은 (폭/2, 높이) = **화면 아래 한가운데를 축으로 삼은 릴**이다. 같은 함수가
 * 바탕 그라데이션도 `y = 높이 − i` 와 `y = 높이 + i` 로 **위아래 대칭**으로 긋고(0x2543c·0x25472),
 * 그 높이는 `높이/2` 에서 멈춘다(0x254f8). 곧 위쪽 절반만 화면에 들어오도록 만든 모양이고,
 * 슬롯 1·2·3 = 보이는 윗줄, 4 = 고른 칸(설명 판이 대신), **5·6·7 = 축 아래로 넘어간 숨은 줄**이다.
 * 걸러내는 코드는 따로 없다 — 0x2524c 안의 거르개는 `슬롯 ≠ 4`(0x2562c `cmp #4 ; ble`) 와
 * 슬롯 표 −1(0x2552c) 둘뿐이고, y 상한도 스크롤 상한도 없다. 화면 밖은 그리기 쪽에서 버린다
 * (블릿 0x98974 가 `[그래픽+0x44]` 잘라내기 사각형과 대상 폭·높이를 견줘 **그냥 되돌아간다**).
 * 웹판은 240×320 뷰포트가 같은 일을 하므로 **옮길 거르개가 없다**.
 */
export function menuReelTextTopLeftOf(
  slot: number,
  width: number,
  scroll: number,
): MenuWheelPoint | null {
  if (slot < 1 || slot > 7 || slot === 4) return null
  const x = SCREEN_WIDTH - Math.trunc(width / 2) - 0x28
  const y = slot <= 3
    ? SCREEN_HEIGHT + (MENU_REEL_ROW_STEP * slot - 100) + scroll - 7
    : SCREEN_HEIGHT + MENU_REEL_ROW_STEP * slot + scroll - 0x3c
  return { x, y }
}

// ─────────────────── 아랫단 바탕 띠 (0x253e8~0x2548e · 0x254d4~0x25516) ───────────────────

/**
 * 릴 뒤에 깔리는 **바탕 띠**. 릴과 같은 축 `(폭/2, 높이)` 를 쓰고 `y = 높이 ± i` 로 위아래
 * 대칭으로 가로선을 긋는다. 아래쪽 절반은 화면 밖이라 **오른쪽 80px 띠가 바닥에서 올라오는**
 * 것으로 보인다.
 *
 * 원본 그리기 (0x253e8~0x2548e, 전부 다시 떠서 확인):
 * ```
 *   알파 = 256
 *   for (i = 0; i <= (s16)[메뉴+0xe4]; i++) {           ; [0xe4] < 0 이면 아예 안 돈다
 *     알파 -= 2; if (알파 <= 3) 알파 = 4                 ; 0x25400~0x2540c
 *     색 = (알파 << 24) | 0x192e74                       ; 0x2543e (상수 0x25580)
 *     선(g, 폭()−0x50, [+0xdc]−i, 폭(), 같은 y, 색)      ; 0x2541e·0x25426·0x2543c
 *     선(g, 폭()−0x50, [+0xdc]+i, 폭(), 같은 y, 색)      ; 0x25472
 *   }
 * ```
 * 그리기는 0x6a905 `선(ctx, x1, y1, x2, y2=[sp0], color=[sp4])` 이고, 그 안에서 색의 위 바이트를
 * 알파로 본다(0x6a918: `0` 이거나 `0xff` 면 섞지 않는다). 그래서 알파는 **255 로 나눈다**.
 *
 * ⚠️ **x 는 `폭−0x50 → 폭` 이지 `0 → 폭` 이 아니다.** 두 좌표 다 폭(0x14008b8)을 부른 값이고
 * 첫 번째만 0x50 을 뺀다. 240 화면에서 **160 → 240**.
 */
export const MENU_BAND_COLOR = { r: 0x19, g: 0x2e, b: 0x74 } as const
export const MENU_BAND_LEFT = SCREEN_WIDTH - 0x50
export const MENU_BAND_RIGHT = SCREEN_WIDTH
/** 띠 축 y = `[메뉴+0xdc]` = 높이 (0x237dc) — 릴 축과 같은 자리다 */
export const MENU_BAND_PIVOT_Y = SCREEN_HEIGHT

/**
 * 첫 값 1 — 0x23846 `strh 1, [메뉴+0xe4]`.
 * ⚠️ 원본은 **장면을 만들 때 전역 `[0x140006c]` 가 5 나 0x11 일 때만** 이 값을 넣는다
 * (0x2381c~0x23848, 생성자 0x234d4). 곧 "메인 메뉴를 게임시작 목록으로 바로 열어라" 로
 * 들어올 때만 연출이 돌고, 윗단에서 OK 로 내려온 경우에는 `[0xe4]` 가 0 이라 띠가 안 보인다.
 */
export const MENU_BAND_FIRST_SPREAD = 1

/**
 * 멈추는 값 = **높이/2 = 160**. 0x254e4~0x25512 (다시 떠서 확인):
 * ```
 *   n = (s16)[메뉴+0xe4]; [메뉴+0xe4] = n*4                ; 0x254e4·0x254e6
 *   if ((s16)(n*4) >= 높이()>>1) {                          ; 0x254f0(0x14008c8 호출)·0x254f8
 *     [메뉴+0xe4] = 높이()>>1 ; [메뉴+0xe2] = 0             ; 0x2550e~0x25514
 *   }
 * ```
 * 0x254f0 이 부르는 것은 **높이(0x14008c8)** 다 — 그리기 쪽 0x2541a·0x25464 가 부르는 폭
 * (0x14008b8) 과 다른 토막이다. 그래서 상한은 120(폭/2)이 아니라 **160(높이/2)** 이다.
 */
export const MENU_BAND_MAX_SPREAD = SCREEN_HEIGHT >> 1

/** 선 하나의 알파 — 256 에서 2씩 줄이고 4 에서 멈춘다 (0x25400~0x2540c). i = 0 이 254 다. */
export function menuBandAlphaAt(offset: number): number {
  const alpha = 256 - 2 * (offset + 1)
  return alpha <= 3 ? 4 : alpha
}

export interface MenuBandState {
  /** 이번 틱에 그리는 `[메뉴+0xe4]` */
  readonly spread: number
  /** `[메뉴+0xe2]` ≠ 0 — 아직 자라는 중. 이 동안 **릴 줄을 안 그린다** (0x254d8). */
  readonly isGrowing: boolean
}

/**
 * `tick` 번째 갱신에 그리는 띠 상태.
 *
 * 0x2524c 는 **띠를 먼저 그리고 그 다음에 자란다** — 그래서 화면에 나오는 값은
 * `1 → 4 → 16 → 64 → 160` 이다. 넷째 틱에서 64×4 = 256 이 160 을 넘어 160 으로 잘리고
 * `[0xe2] = 0` 이 되므로, 줄이 안 그려지는 틱은 **넷**(0~3)이다.
 */
export function menuBandStateAt(tick: number): MenuBandState {
  let spread = MENU_BAND_FIRST_SPREAD
  for (let step = 0; step < tick; step += 1) {
    const grown = spread * 4
    if (grown >= MENU_BAND_MAX_SPREAD) return { spread: MENU_BAND_MAX_SPREAD, isGrowing: false }
    spread = grown
  }
  return { spread, isGrowing: true }
}

/** 다 자랄 때까지 걸리는 틱 수 (줄이 안 그려지는 틱 수와 같다) — 원본 값으로 세어 둔다 */
export const MENU_BAND_GROW_TICKS = ((): number => {
  let ticks = 0
  while (menuBandStateAt(ticks).isGrowing) ticks += 1
  return ticks
})()

export interface MenuBandLine {
  readonly y: number
  /** 0~255 (원본 알파 바이트 그대로) */
  readonly alpha: number
}

/**
 * `spread` 만큼 펼쳐졌을 때 긋는 가로선 목록. 축 위 `높이 − i` 와 축 아래 `높이 + i` 가
 * **같은 알파**를 쓴다 (둘 다 `[sp+0x14]` 에 넣어 둔 색을 읽는다 — 0x25446·0x25470).
 * 아래쪽은 화면 밖이지만 원본이 긋는 대로 그대로 낸다.
 */
export function menuBandLinesOf(spread: number): readonly MenuBandLine[] {
  if (spread < 0) return []
  const lines: MenuBandLine[] = []
  for (let offset = 0; offset <= spread; offset += 1) {
    const alpha = menuBandAlphaAt(offset)
    lines.push({ y: MENU_BAND_PIVOT_Y - offset, alpha })
    lines.push({ y: MENU_BAND_PIVOT_Y + offset, alpha })
  }
  return lines
}

// ──────────────────────────────── 설명 판 ────────────────────────────────

export interface MenuPanelBox {
  readonly frame: number
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * 설명 판 = `main_ui` **이미지** 3 (149×63). 자리는 두 함수가 따로 같은 식으로 구한다:
 *   `x = scrW − 폭 + 5` = **96** (0x24db0 · 0x256fc)
 *   `y = 320 − 높이/2`  = **289** (0x24dc0 · 0x25714)
 *
 * ⚠️ **판 아래 절반(289+63 = 352)이 화면 밖인 것도 원본이 그렇다 — 확정.**
 * 식이 `높이 − 높이/2` 라 **어느 해상도에서나 아래 h/2 = 32px 가 바닥 밖**이다(해상도 무관).
 * 0x25714(아랫단)와 0x24dc0(윗단 바퀴) **두 곳이 따로 같은 식을 쓴다**. 오른쪽으로도 5px
 * 삐져나간다(96+149 = 245). R6-sprite-leftovers 2절이 같은 좌표를 따로 확인해 뒀다.
 * 그림은 좌상단 기준이다 — 0xba759 는 (자원, 번호, 종류, x, y, …) 를 받아 종류 0 이면
 * 이미지 vtable 로 그대로 넘기고, 가운데 맞춤이 필요한 곳(바퀴 칸 0x24fc4, 판 안 큰 글자 0x25794)은
 * **부르는 쪽이 직접 w/2·h/2 를 뺀다**. 곧 (96,289) 는 가운데가 아니라 좌상단이다.
 */
export const MENU_DESCRIPTION_PANEL: MenuPanelBox = {
  frame: 3,
  width: 149,
  height: 63,
  x: SCREEN_WIDTH - 149 + 5,
  y: SCREEN_HEIGHT - (63 >> 1),
}

/** 설명 글을 쓰는 안쪽 칸 `(x+5, y+5, w−10, h−10)` — R6 2절 (0x25036 이후) */
export const MENU_DESCRIPTION_TEXT_BOX = {
  x: MENU_DESCRIPTION_PANEL.x + 5,
  y: MENU_DESCRIPTION_PANEL.y + 5,
  width: MENU_DESCRIPTION_PANEL.width - 10,
  height: MENU_DESCRIPTION_PANEL.height - 10,
} as const

/**
 * 판 안 큰 글자(`main_ui` **프레임**)의 좌상단 — 0x25794~0x257c4 (확정).
 * `(판x + (149 − w)/2 + 2, 판y + (63 − h)/2 + 5)`.
 * 판이 이미 반쯤 화면 밖이라 27px 글자는 **윗 8px 만 보인다**(`높이 − 8` 자리라 해상도 무관).
 * ⚠️ 여기만은 **왜 이래도 되는지 설명을 못 찾았다**. 회색 상태 제목(img_text 10px)은 `높이 − 23`
 * 이라 온전히 보이는데 큰 글자만 잘린다. 그리기 쪽에 세로 보정이 있기는 하다 —
 * 0xba759 는 인자 [sp+0xc] ≠ 0 일 때 전역 `[0x15606f4]` 를, 낮은 단계는 `[그래픽+0x40]` 을
 * y 에 더한다(0xbaedc) — 그러나 **메뉴는 그 인자를 0 으로 넘긴다**(0x25768). 원본 식 그대로 둔다.
 */
export function menuPanelLabelTopLeftOf(width: number, height: number): MenuWheelPoint {
  return {
    x: MENU_DESCRIPTION_PANEL.x + ((MENU_DESCRIPTION_PANEL.width - width) >> 1) + 2,
    y: MENU_DESCRIPTION_PANEL.y + ((MENU_DESCRIPTION_PANEL.height - height) >> 1) + 5,
  }
}

/**
 * 판 왼쪽 위에 회색으로 찍는 상태 제목(img_text 프레임) — 0x257cc~0x257ee.
 * 색은 `setColor(0x80,0x80,0x80)`, 자리는 `(판x + 8, 판y + 8)`, 효과 0xb(단색 찍기)다.
 * 번호는 **0xcea6c[상태 − 5]** 라 윗단 칸 글자 표와 같은 표를 쓴다 (0x254aa).
 */
export const MENU_PANEL_HEADING_COLOR = '#808080'
export function menuPanelHeadingTopLeftOf(): MenuWheelPoint {
  return { x: MENU_DESCRIPTION_PANEL.x + 8, y: MENU_DESCRIPTION_PANEL.y + 8 }
}

/** 상태 제목 img_text 프레임 — 0xcea6c[상태 − 5] (윗단 칸 글자 표와 같은 표) */
export function menuPanelHeadingFrameOf(state: number): number | null {
  return MENU_WHEEL_ITEM_FRAMES[state - 5] ?? null
}

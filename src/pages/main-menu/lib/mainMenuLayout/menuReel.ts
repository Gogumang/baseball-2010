/** 아랫단 세로 릴 (하위 목록 0x2524c) — 슬롯 표 · 항목 회전 · 글 자리 */
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '@/pages/main-menu/lib/mainMenuLayout/menuScreen'
import type { MenuTurnDirection, MenuWheelPoint } from '@/pages/main-menu/lib/mainMenuLayout/menuWheel'

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
export function menuReelEntryAtSlotOf(frames: readonly number[], slotRow: readonly number[], cursor: number, slot: number): number | null {
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
export function menuReelTextTopLeftOf(slot: number, width: number, scroll: number): MenuWheelPoint | null {
  if (slot < 1 || slot > 7 || slot === 4) return null
  const x = SCREEN_WIDTH - Math.trunc(width / 2) - 0x28
  const y = slot <= 3 ? SCREEN_HEIGHT + (MENU_REEL_ROW_STEP * slot - 100) + scroll - 7 : SCREEN_HEIGHT + MENU_REEL_ROW_STEP * slot + scroll - 0x3c
  return { x, y }
}

// ─────────────────── 아랫단 바탕 띠 (0x253e8~0x2548e · 0x254d4~0x25516) ───────────────────

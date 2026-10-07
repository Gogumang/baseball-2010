/**
 * **공수 교대 판의 두 팀 판** — 그리기 0x4fe9c 의 교대 가지(경기 끝 아님, 틱 > 0x45)가 점수판 틀 0x41440 뒤에 그린다.
 * 직접 떴다(0x4ff16~0x5001a · 0x420dc~0x4232c · 0x42364~0x42548).
 *
 * ## 자리 (0x4fe9c)
 * ```
 * 4febc  상자 = 0x94a65(out, game_ui 프레임 19, 0, 4)          ; boxes.json "019" 상자 4 = (14, 213, 212, 57) → 폭 212
 * 4ff1c  st[9] == 0(초) → 왼쪽 0x42364 · 오른쪽 0x420dc,  st[9] ≠ 0(말) → 왼쪽 0x420dc · 오른쪽 0x42364
 *        왼쪽 (W/2 − 폭/2,      H/2 − 0 − 2)                 ; 0 = [sp+0x4c] (경기 끝일 때만 3 — 그때는 이 가지에 안 온다)
 *        오른쪽 (W/2 + 폭/2 − 0x4c, H/2 − 0 − 2)
 * ```
 *
 * ## 0x420dc(경기, x, y) — "PITCHER" 판 (수비 팀 지금 투수)
 * ```
 * 420f4  0xba0bd((x, y, 0x35, 0xc), 둥글기 1, RGB(0x5b, 0x81, 0xba))        ; 머리 칸
 * 42124  0xba0bd((x, y + 10, 0x4d, 0x36), 둥글기 1, 같은 색)                 ; 몸통
 * 42154  0x913e5(img_text 애니, 0) · img_text 프레임 0xba(186 "PITCHER") 를 (x + 5, y + 4)
 * 4218e  game_ui 프레임 31(0x7c/4) 을 (x + 3, y + 0xd)                       ; 칸 둘(작은 칸 · 넓은 칸)과 아래 큰 칸
 * 421bc  game_ui 프레임 17(0x44/4) 을 (x − 0xd, y − 0x8c)                    ; "S B O" 와 빈 점 — 원점 (26, 172)
 * 421e6  game_ui 이미지 0("P") 을 (x + 9, y + 0x10)
 * 42206  이름 = 0xb62c0(0xae83c(팀[st[0xa]])) → sprintf("!R!cffffff%s")      ; 0xd0714
 *        0xba269(글, x + 0x15, y + 0xf, 0x34, −1, 0)                         ; 흰 글 오른쪽 맞춤
 * 42252  0xb68fc(st)(경기 끝) 이면 여기서 끝
 * 4225c  s = min(st[4], 2) · b = min(st[5], 3) · o = min(st[6], 2)
 *        k < s: game_ui 이미지 13(노랑) 을 (x + 0x16 + 9k, y + 0x20)
 *        k < b: 이미지 14(초록) 을 (…, y + 0x2a) · k < o: 이미지 15(빨강) 을 (…, y + 0x34)
 * ```
 *
 * ## 0x42364(경기, x, y) — "DUE UP" 판 (공격 팀 지금 타자부터 셋)
 * ```
 * 42382  0xba0bd((x + 0x13, y, 0x33, 0xc), 둥글기 1, RGB(0x5b, 0x81, 0xba))  ; 머리 칸
 * 423ba  0xba0bd((x, y + 10, 0x4d, 0x36), …)                                ; 몸통
 * 423f4  0x913e5(…, 0) · img_text 프레임 0xbb(187 "DUE UP") 를 (x + 0x1c, y + 4)
 * 42426  game_ui 프레임 32(0x80/4) 를 (x + 3, y + 0xd)                       ; 줄 셋(작은 칸 · 넓은 칸)
 * 42450  경기 끝이면 여기서 끝
 * 4245e  i = 0..2, yᵢ = y + 0x11·i, 팀 = 팀[st[9]]:
 *          n = 팀[+0x32] + i + 1;  n > 9 이면 n = n mod 9 (0xca911)          ; 타순 번호 1~9
 *          0xba719((x + 4, yᵢ + 0xd, 0x13, 0xf), 자간 0, n, 0x1e, num 이미지, 정렬 0x22)
 *          이름 = 0xb62c0(0xae914(팀, i))  — 0xae914 = 타순 칸 (팀[+0x32] + i) mod 9 의 선수
 *          0xba269("!R!cffffff%s", x + 0x15, yᵢ + 0xf, 0x34, −1, 0)
 * ```
 * - 둥근 칠 0xba0bd 는 점수판 틀 이름 칸과 같은 함수다 — (w+1)×(h+1) 에서 네 모서리 점이 빠진다(`roundPlateRectsOf`).
 * - 숫자 0xba719 → 0xba51c(정렬 0x22): 폭 합 T = Σ(글자 폭 + 자간), 큰 높이 M —
 *   x += (칸폭 − T) >> 1 (비트 1), y += floor(d/2) + d % 2 (d = 칸높이 − M, 비트 5), 글자는 아래 맞춤으로 왼쪽부터.
 *   num 이미지 0x1e+자리 (30~39) 는 파란 숫자, "1" 만 폭 4 이고 나머지 6, 높이 모두 10.
 * - 교대 판에 들어올 때 0x3ac90 → 0xb6b6c 가 3아웃이면 0xb6784 로 st[4]·st[5]·st[6] 을 0 으로 지우고 st[9]·st[0xa] 를
 *   맞바꾼다 — 그래서 보통의 교대 판에선 st[9] 가 **새로 공격하는 쪽**이고 점은 다 비어 있다(1회초 판도 0).
 *   자동진행 0x21 이 반 이닝 중간에 사람에게 넘길 때만 그때의 카운트가 남는다.
 */

/** 화면 240×320 — W · H */
const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320

/** game_ui 프레임 19 상자 4 의 폭 (boxes.json "019") — 두 판 자리를 정한다 */
export const HALF_INNING_CARDS_SPAN = 212

/** 0x4fe9c 의 두 판 y — H/2 − 0 − 2 */
export const HALF_INNING_CARDS_Y = SCREEN_HEIGHT / 2 - 2

/** 왼쪽 판 x (W/2 − 폭/2) · 오른쪽 판 x (W/2 + 폭/2 − 0x4c) */
export const HALF_INNING_CARD_X = {
  left: SCREEN_WIDTH / 2 - Math.trunc(HALF_INNING_CARDS_SPAN / 2),
  right: SCREEN_WIDTH / 2 + Math.trunc(HALF_INNING_CARDS_SPAN / 2) - 0x4c,
} as const

/** 두 판의 칠 RGB(0x5b, 0x81, 0xba) */
export const CARD_PLATE_COLOR = '#5B81BA'

export interface CardBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface CardSprite {
  readonly x: number
  readonly y: number
}

export interface CardFrame extends CardSprite {
  readonly frame: number
}

export interface CardImage extends CardSprite {
  readonly image: number
}

/** 두 판이 서는 자리 — st[9] == 0(초)이면 왼쪽이 DUE UP(0x42364), 말이면 왼쪽이 PITCHER(0x420dc) */
export function halfInningCardsAt(battingSide: number): { readonly dueUpX: number; readonly pitcherX: number } {
  return battingSide === 0
    ? { dueUpX: HALF_INNING_CARD_X.left, pitcherX: HALF_INNING_CARD_X.right }
    : { dueUpX: HALF_INNING_CARD_X.right, pitcherX: HALF_INNING_CARD_X.left }
}

export interface PitcherCount {
  /** st[4] — 스트라이크 */
  readonly strikes: number
  /** st[5] — 볼 */
  readonly balls: number
  /** st[6] — 아웃 */
  readonly outs: number
}

export interface PitcherCardPlacement {
  readonly plates: readonly CardBox[]
  /** img_text 프레임 (팔레트 0) */
  readonly title: CardFrame
  /** game_ui 프레임 */
  readonly frames: readonly CardFrame[]
  /** game_ui 이미지 — "P" 다음 S·B·O 점 */
  readonly images: readonly CardImage[]
  /** 이름 칸 — 흰 글 오른쪽 맞춤 */
  readonly name: CardBox
}

/** game_ui 이미지 13 · 14 · 15 — S(노랑) · B(초록) · O(빨강) 점 */
export const COUNT_DOT_IMAGE = { strike: 13, ball: 14, out: 15 } as const

/** 0x420dc 의 그림 자리. 점은 경기 끝이 아닐 때만 (교대 가지는 늘 경기 끝이 아니다) */
export function pitcherCardPlacementOf(x: number, y: number, count: PitcherCount): PitcherCardPlacement {
  const rows: readonly (readonly [number, number, number])[] = [
    [COUNT_DOT_IMAGE.strike, Math.min(count.strikes, 2), 0x20],
    [COUNT_DOT_IMAGE.ball, Math.min(count.balls, 3), 0x2a],
    [COUNT_DOT_IMAGE.out, Math.min(count.outs, 2), 0x34],
  ]
  const dots = rows.flatMap(([image, n, dy]) =>
    Array.from({ length: Math.max(0, n) }, (_, k) => ({ image, x: x + 0x16 + 9 * k, y: y + dy })),
  )
  return {
    plates: [
      { x, y, width: 0x35, height: 0xc },
      { x, y: y + 10, width: 0x4d, height: 0x36 },
    ],
    title: { frame: 0xba, x: x + 5, y: y + 4 },
    frames: [
      { frame: 31, x: x + 3, y: y + 0xd },
      { frame: 17, x: x - 0xd, y: y - 0x8c },
    ],
    images: [{ image: 0, x: x + 9, y: y + 0x10 }, ...dots],
    name: { x: x + 0x15, y: y + 0xf, width: 0x34, height: 0 },
  }
}

/** num 이미지 0x1e + 자리 의 폭 (높이는 모두 10) — public/sprites/num 030~039 */
const DUE_UP_DIGIT_WIDTHS = [6, 4, 6, 6, 6, 6, 6, 6, 6, 6] as const
const DUE_UP_DIGIT_HEIGHT = 10
/** 0xba719 의 이미지 기준 0x1e (파란 숫자) */
export const DUE_UP_DIGIT_BASE = 0x1e

export interface DueUpRow {
  /** 타순 번호 1~9 */
  readonly order: number
  /** num 이미지 번호들과 자리 */
  readonly digits: readonly CardImage[]
  /** 이름 칸 — 흰 글 오른쪽 맞춤 */
  readonly name: CardBox
}

export interface DueUpCardPlacement {
  readonly plates: readonly CardBox[]
  readonly title: CardFrame
  readonly frame: CardFrame
  readonly rows: readonly DueUpRow[]
}

/** 타순 번호 n = 팀[+0x32] + i + 1, 9 를 넘으면 n mod 9 (0x42486~0x42494) */
export function dueUpOrderOf(currentOrder: number, row: number): number {
  const n = currentOrder + row + 1
  return n > 9 ? n % 9 : n
}

/** 0xba51c 정렬 0x22 — 칸 안 가운데, 글자는 아래 맞춤 */
function centeredDigitsOf(value: number, target: CardBox): CardImage[] {
  const digits = String(value).split('').map(Number)
  const total = digits.reduce((sum, digit) => sum + DUE_UP_DIGIT_WIDTHS[digit]!, 0)
  const tallest = DUE_UP_DIGIT_HEIGHT
  const dy = target.height - tallest
  let left = target.x + ((target.width - total) >> 1)
  const top = target.y + Math.floor(dy / 2) + (dy % 2)
  return digits.map((digit) => {
    const placed = { image: DUE_UP_DIGIT_BASE + digit, x: left, y: top + tallest - DUE_UP_DIGIT_HEIGHT }
    left += DUE_UP_DIGIT_WIDTHS[digit]!
    return placed
  })
}

/** 0x42364 의 그림 자리 — currentOrder = 공격 팀 팀[+0x32] (0~8) */
export function dueUpCardPlacementOf(x: number, y: number, currentOrder: number): DueUpCardPlacement {
  const rows = [0, 1, 2].map((row) => {
    const rowY = y + 0x11 * row
    const order = dueUpOrderOf(currentOrder, row)
    return {
      order,
      digits: centeredDigitsOf(order, { x: x + 4, y: rowY + 0xd, width: 0x13, height: 0xf }),
      name: { x: x + 0x15, y: rowY + 0xf, width: 0x34, height: 0 },
    }
  })
  return {
    plates: [
      { x: x + 0x13, y, width: 0x33, height: 0xc },
      { x, y: y + 10, width: 0x4d, height: 0x36 },
    ],
    title: { frame: 0xbb, x: x + 0x1c, y: y + 4 },
    frame: { frame: 32, x: x + 3, y: y + 0xd },
    rows,
  }
}

/** 0xae914(팀, i) — 타순 칸 (팀[+0x32] + i) mod 9 */
export const dueUpLineupSlotOf = (currentOrder: number, row: number) => (currentOrder + row) % 9

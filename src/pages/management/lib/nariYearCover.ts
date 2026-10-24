/**
 * **나리 137 새 시즌 "N년차" 표지** (장면 0x106 — 진입 0x1055c · 키 0x106a4 · 틀 0x12190 · 그리기 0x1cc4c, r148 직접 뜸).
 *
 * 들어오는 길은 모두 새 시즌 처리 0x1b768 뒤다. 0x1b768 꼬리(1b8a8~1b8c6)가 **효과기 종류 1(어두워짐)** 을 걸고 장면+0x289 = 1,
 * 부른 상태의 틀(114 0x1c014 · 134 0x1b92c · 141 0x1bbc4 — 1bb30~1bb64 · 1bec0~1beea · 1c0e0~1c114)이 효과기 끝(+4 ≠ 0 ·
 * +0x10 == 2)을 보면 +0x289 = 0 · `0xbcb49(0x89)` · **효과기 종류 2(밝아짐)** 를 건다. 곧 앞 화면이 아홉 틀 어두워진 뒤
 * 137 이 검정에서 밝아진다.
 *
 * ```
 * 진입 0x1055c   [장면+0x18](단계) = 0                       ; +0x28c 는 안 건드린다 — new 의 0 채움 그대로(아래 ⚠️)
 * 키   0x106a4   단계 == 0 이면 [장면+0x28c] = 0x51            ; 아무 키나 — 기다림을 건너뛴다
 * 틀   0x12190   단계 == 0 && [+0x28c] > 0x50 → 0xbdae9(…, 1, 0, 5, 1500) 효과기 종류 1 · 단계 = 1
 *                단계 == 1 && 효과기 끝(+4 ≠ 0 && +0x10 == 2) → 0xbcb49(0x69 = 105) · 0xbdae9(…, 2, 0, 5, 1500)
 * 그리기 0x1cc4c
 *   1cc5a  0x6a735(gfx, 0)                                  ; 검정
 *   1cc72  0x913e5(img_text 애니 [0x1552ae8], 1)            ; img_text 팔레트 1(노랑)
 *   1cc76  F = img_text 프레임 0xc7 << 3 / 4 = 398 ([[0x1552aec]+0xc]+8 칸 398)
 *   1cca2  x0 = W >> 1 = 120 · y0 = (H >> 1) − (F.h >> 1) = 160 − 5 = 155
 *   1ccd2  0xbae25(0, y0 − 1, W, F.h·2 + 2)                ; 자르기 (0, 154, 240, 22)
 *   1cce8  0xba19d(F, x0, y0, 효과 0x10, 2, 0)              ; 두 배 확대(R6 3b) — "년차" 를 (120, 155) 에 40×20
 *   1ccee  x = x0 − 0x12 = 102 · i = S+0xb3(새 연차 idx) · n = i + 1
 *   1ccfc  i > 9 면 num 이미지 21("1") 을 (x − 11, y0) 에 · n −= 10 · i −= 10   ; 열 자리 (그대로 선다)
 *   1cd22  c = [장면+0x28c] → 밀림 d = c ≤ 0x14 ? 0 : c ≤ 0x32 ? c − 0x15 : 0x1e
 *   1cd5c  num 이미지 20 + i 를 (x, y0 − d)                 ; 지난 연차 숫자가 위로 빠진다
 *   1cd84  num 이미지 20 + n mod 10 을 (x, y0 − d + 30)     ; 새 연차 숫자가 아래에서 올라온다 (0xca911 = mod)
 *   1cd88  n == 10 이면 num 이미지 21 을 (x − 11, y0 − d + 30)   ; 9 → 10 년차는 열 자리도 함께 올라온다
 *   1cda8  [장면+0x28c] += 1 · 0xbaf8d 자르기 풂
 * ```
 * 숫자 그림은 [[[장면+0xf0](ui/num)+8]+8] 의 +0x50 + 4i = num 이미지 0x14 + i, 그리기는 이미지 vt+0x14(x, y, 효과 0x10, 2, 0)
 * — 0x6aff8 의 이미지 그리기와 같은 꼴(왼쪽 위 기준)에 두 배 확대다.
 *
 * 장면 틀 0x1cdec 의 차례는 상태 적용 → 진입 → 키 → 갱신(틀) → 그리기 → 효과기 그리기라 그리기 t 는 c = t 를 쓰고(키가 없으면),
 * 틀은 c > 0x50 을 t = 81 에 처음 본다 — 표지는 81 틀(원본 틱 기준) 뒤 어두워지고, 끝을 본 틀(+9)에 105 를 예약한다.
 * 키 문 0x10758 은 효과기가 돌 때(+4 ≠ 0 && +0x10 ≠ 0) 키를 적지 않는다 — 들어올 때 밝아짐(종류 2)이 비워지는 틀 뒤부터 키를 받는다.
 * ⚠️ +0x28c 를 0 으로 두는 곳은 없다(work/R9/imm.py 0xa3 즉치 전수 — 이 셋만 읽고 쓴다). 장면 0x106 은 경기마다 새로 서고
 * (new 가 0 으로 채운다) 해마다 경기를 거쳐 137 에 오므로 늘 0 에서 시작한다고 본다.
 */

/** 표지가 기다리는 문턱 — 틀 0x12190 `cmp [+0x28c], #0x50 ; ble` */
export const YEAR_COVER_WAIT = 0x50
/** 키가 넣는 값 — 0x106b2 `movs r3, #0x51` */
export const YEAR_COVER_SKIP = 0x51
/** 효과기 종류 1 · 2 가 끝을 세우고 비우는 데 드는 틀 (0~8 칠하고 8 에 끝, 9 에 비움 — `entities/story/model/screenEffect`) */
export const EFFECTOR_FRAMES = 9

/** 표지 그림 — img_text 프레임 398 "년차", 팔레트 1 */
export const YEAR_COVER_LABEL = { frame: 398, palette: 1 } as const
/** 확대 배율 — 효과 0x10 · 인자 2 */
export const YEAR_COVER_SCALE = 2
/** 숫자 그림 — num 이미지 0x14 + 숫자, 열 자리 "1" 은 0x15 */
export const YEAR_COVER_DIGIT_BASE = 0x14

const SCREEN = { width: 240, height: 320 } as const
/** 프레임 398 의 높이(박스 +0x14) — origins.json 의 10 */
const LABEL_HEIGHT = 10

/** "년차" 그림 자리 (120, 155) — x0 = W/2 · y0 = H/2 − h/2 */
export const YEAR_COVER_ORIGIN = {
  x: SCREEN.width >> 1,
  y: (SCREEN.height >> 1) - (LABEL_HEIGHT >> 1),
} as const
/** 자르기 0xbae25(0, y0 − 1, W, h·2 + 2) */
export const YEAR_COVER_CLIP = {
  x: 0,
  y: YEAR_COVER_ORIGIN.y - 1,
  width: SCREEN.width,
  height: LABEL_HEIGHT * 2 + 2,
} as const
/** 일의 자리 x = x0 − 0x12 · 열 자리 x − 11 */
const ONES_X = YEAR_COVER_ORIGIN.x - 0x12
const TENS_X = ONES_X - 11
/** 새 숫자가 올라오는 거리 — 0x1cd76 `adds r5, #0x1e` · 밀림 끝 0x1e */
const ROLL_DISTANCE = 0x1e

/** 밀림 d — 1cd30~1cd3e */
export function yearCoverRollOf(counter: number): number {
  if (counter <= 0x14) return 0
  if (counter <= 0x32) return counter - 0x15
  return ROLL_DISTANCE
}

export interface YearCoverDigit {
  /** num 이미지 번호 */
  readonly image: number
  readonly x: number
  readonly y: number
}

/** 그리기 0x1cc4c 의 숫자들 (그리는 차례) — `yearIndex` = S+0xb3(새 시즌이 올린 뒤), `counter` = [장면+0x28c] */
export function yearCoverDigitsOf(yearIndex: number, counter: number): readonly YearCoverDigit[] {
  const digits: YearCoverDigit[] = []
  const y0 = YEAR_COVER_ORIGIN.y
  let previous = yearIndex
  let next = yearIndex + 1
  if (previous > 9) {
    digits.push({ image: YEAR_COVER_DIGIT_BASE + 1, x: TENS_X, y: y0 })
    next -= 10
    previous -= 10
  }
  const y = y0 - yearCoverRollOf(counter)
  digits.push({ image: YEAR_COVER_DIGIT_BASE + previous, x: ONES_X, y })
  digits.push({ image: YEAR_COVER_DIGIT_BASE + (next % 10), x: ONES_X, y: y + ROLL_DISTANCE })
  if (next === 10) digits.push({ image: YEAR_COVER_DIGIT_BASE + 1, x: TENS_X, y: y + ROLL_DISTANCE })
  return digits
}

/**
 * 표지의 틀 차례 — `frame` 은 새 시즌 처리 0x1b768 이 효과기를 건 틀부터 센 그리기 수, `skipAt` 은 키를 받은 137 틀(없으면 null).
 * ```
 * 0 ~ 8    앞 화면 + 효과기 종류 1 칠하기 0 ~ 8 (`fadeOutFrame`)
 * 9        앞 상태 틀이 끝을 보고 137 예약 · 종류 2 를 새로 건다 — 앞 화면 + 종류 2 칠하기 0(검정)
 * 10 ~     137 틀 t = frame − 10 · 종류 2 칠하기 t + 1 (t ≤ 7), t = 8 그리기가 비운다
 *          틀 T(기다림 81 또는 키) 에 종류 1 을 걸고 t = T ~ T+8 칠하기 0 ~ 8, T+9 틀이 105 를 예약하고 종류 2 칠하기 0(검정)
 *          T+10 부터 105 (밝아짐 칠하기 1 부터)
 * ```
 */
export type YearCoverStep =
  | { readonly kind: '앞화면'; readonly fadeOutFrame: number | null; readonly fadeInFrame: number | null }
  | {
      readonly kind: '표지'
      readonly tick: number
      /** 이 틀 그리기의 [장면+0x28c] */
      readonly counter: number
      /** 들어올 때 밝아짐(종류 2)의 칠하기 차례 — 비었으면 null */
      readonly fadeInFrame: number | null
      /** 나갈 때 어두워짐(종류 1)의 칠하기 차례 — 아직 안 걸었으면 null */
      readonly fadeOutFrame: number | null
      /** 105 를 예약한 틀 — 종류 2 를 새로 건 칠하기 0 */
      readonly isLeaving: boolean
      /** 키 문 0x10758 이 열렸나 — 이 틀을 그린 뒤 든 키를 다음 틀이 받는다 */
      readonly acceptsKey: boolean
    }
  | { readonly kind: '관리' }

/** 앞 화면이 어두워지는 틀 수 + 137 예약 틀 */
export const YEAR_COVER_ENTRY_FRAMES = EFFECTOR_FRAMES + 1
/** 표지를 기다림만으로 넘기는 틀 — 틀이 c > 0x50 을 처음 보는 t */
const WAIT_TRIGGER_TICK = YEAR_COVER_WAIT + 1

export function yearCoverStepAt(frame: number, skipAt: number | null): YearCoverStep {
  if (frame < EFFECTOR_FRAMES) return { kind: '앞화면', fadeOutFrame: frame, fadeInFrame: null }
  if (frame < YEAR_COVER_ENTRY_FRAMES) return { kind: '앞화면', fadeOutFrame: null, fadeInFrame: 0 }
  const tick = frame - YEAR_COVER_ENTRY_FRAMES
  const trigger = skipAt === null ? WAIT_TRIGGER_TICK : Math.min(skipAt, WAIT_TRIGGER_TICK)
  if (tick >= trigger + EFFECTOR_FRAMES + 1) return { kind: '관리' }
  const counter = skipAt !== null && skipAt <= tick && skipAt < WAIT_TRIGGER_TICK ? YEAR_COVER_SKIP + (tick - skipAt) : tick
  const isLeaving = tick === trigger + EFFECTOR_FRAMES
  const entryFade = tick + 1 < EFFECTOR_FRAMES ? tick + 1 : null
  return {
    kind: '표지',
    tick,
    counter,
    fadeInFrame: isLeaving ? 0 : entryFade,
    fadeOutFrame: tick >= trigger && !isLeaving ? tick - trigger : null,
    isLeaving,
    // 들어올 때 효과기를 비우는 그리기는 t = 8 — 그 뒤 키부터 적힌다. 나갈 효과기를 건 뒤로는 단계 1 이라 키가 아무 일도 안 한다
    acceptsKey: tick >= EFFECTOR_FRAMES - 1 && tick < trigger,
  }
}

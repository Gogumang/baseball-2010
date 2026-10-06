import { sineHundred } from '@/shared/lib/math/originalTrigonometry'

/**
 * 나만의리그 엔딩 화면 (장면 0x106 상태 141 — 적재 `0x87c7c`, 그리기 `0x168fc`).
 *
 * 장면 그리기 `0x168fc` 가 단계 `[장면+0xd4]` 로 두 함수를 가른다:
 * ```
 * 단계 ≤ 2 → 0x882b4(엔딩판, 단계, n)      ; 단계 0 은 아무것도 안 그린다(0x882c4)
 * 단계 > 2 → 0x88bb4(엔딩판, 단계, n)      ; 제작진
 * ```
 * n = `[장면+0x2c]`(이 상태에 들어와 돈 틀 수). 단계는 배경음 페이드(0xbdae9(…, 1500))가 끝날 때 0→1, 키로 1→2(0x12246),
 * 다시 페이드가 끝나면 2→3 이고 이때 n 을 0 으로 되돌린다(0x1bf54~0x1bfa0).
 *
 * `0x882b4` 는 본 엔딩 e(`[this+0x2e4]`)로 **두 갈래**다 (표 0xd4b28):
 *   - **e 0·1 (부상·방출)** — 0x883b6: 띠 창 + mode_back + 걸어 들어오는 선수(+ e 0 이면 부상 아이콘) + 글.
 *     엔딩 그림·원형 전환은 없다(적재가 ending.pzx 를 안 올리고 `[this+0x2ec]` 를 안 켠다).
 *   - **e 2~9** — 0x886ca: ending.pzx 그림이 미끄러져 서고, 그 뒤 원형 전환이 e 마다 다른 자리로 닫히며,
 *     글 StrENDING[20] + 본 엔딩이 아래에서 올라온다. 띠 창·걸어 들어오는 선수는 없다.
 * 제작진 `0x88bb4` 는 e 2~9 에만 온다(부상·방출은 키가 곧장 이어하기 팝업이다, 0x1220c).
 */

export const SCREEN = { width: 240, height: 320 } as const

/** mode_ui 프레임 10 박스 0 = (0, 65, 240, 72) — F-6 외출 연출 창과 같은 틀 */
const BAND_BOX = { x: 0, y: 65, width: SCREEN.width, height: 72 } as const

/**
 * 띠 창 — 박스를 **화면 세로 가운데로 옮겨** 쓴다 (0x883ea~0x8840a · 제작진 0x88c02~0x88c16):
 * `y' = H/2 − (y + h/2) + y = 160 − 101 + 65 = 124`.
 * 박스 안은 검정(0xb9f75), **위·아래 11px 띠는 박스 바깥**에 칠한다 (0x88420~0x88556):
 * ```
 * 위  (0, y'−11, W, 11) #395DCE · 선 y'−11 #294DAD · 선 y'−10 #4A7DFF
 * 아래 (0, y'+h, W, 11) #395DCE · 선 y'+h+9 #4A7DFF · 선 y'+h+10 #294DAD
 * ```
 */
export const BAND_WINDOW = {
  x: BAND_BOX.x,
  y: SCREEN.height / 2 - BAND_BOX.height / 2,
  width: BAND_BOX.width,
  height: BAND_BOX.height,
  fill: '#000000',
  edgeHeight: 11,
  edgeColor: '#395DCE',
  outerLine: '#294DAD',
  innerLine: '#4A7DFF',
} as const

/** 띠 창 아래 = 196 — 걸어 들어오는 선수·제작진 인물의 발 자리 */
export const BAND_WINDOW_BOTTOM = BAND_WINDOW.y + BAND_WINDOW.height

/**
 * 띠 안 배경 `0x7b9ac(this, 박스x + 1, y' + 1, −14)` (0x88572 · 0x88d76) — mode_back 을 (1, 125) 에 70 높이로 자른다.
 * ⚠️ 원본이 **어느 프레임**(0 낮 · 1 저녁 · 2 밤)을 고르는지는 못 읽었다 — 낮(0)을 쓴다.
 */
export const BAND_BACKGROUND = { frame: 0, left: 1, top: BAND_WINDOW.y + 1, height: BAND_WINDOW.height - 2 } as const

/**
 * 걸어 들어오는 그림 두 개 (e 0·1 만) — S12 7절 · 0x885b0~0x88698.
 *
 * - `[this+0x344]` = `event_char_0.pzx` 애니 — 적재 `0x87cd6` 이 **e ≤ 1 일 때만** `0x63a05(ui, 1, 2)` 로 만든다.
 * - mode_ui **프레임 87**(부상 아이콘) — `[this+0x2e4] == 0`(부상 엔딩)일 때만 (0x885fc).
 *
 * 자리 (`n` = 틀 수, 박스는 가운데로 옮긴 y' = 124 · 아래 196):
 * ```
 * 애니        x = 240 − n/3 − 20   y = (n & 7) ? 196 : 195
 * 프레임 87   x = 240 − n/3 − 62   y = (n & 7) ? 120 : 119      ; y' − 4 / y' − 5
 * ```
 * (S12 의 137·61 은 박스를 옮기기 전 값이다.)
 */
export const WALK_IN = {
  characterFolder: './sprites/event_char_0/frames',
  characterAnimation: 2,
  characterAnimationWithLook: 10,
  characterDx: -20,
  iconFolder: './sprites/mode_ui/frames',
  iconFrame: 87,
  iconDx: -62,
  /** x = W − n/3 + dx — 3틱에 1px */
  xOf: (tick: number, dx: number) => SCREEN.width - Math.trunc(tick / 3) + dx,
  /** y — 8틱에 한 번 1px 위로 튄다 */
  characterYOf: (tick: number) => ((tick & 7) !== 0 ? BAND_WINDOW_BOTTOM : BAND_WINDOW_BOTTOM - 1),
  iconYOf: (tick: number) => ((tick & 7) !== 0 ? BAND_WINDOW.y - 4 : BAND_WINDOW.y - 5),
} as const

/** 부상 아이콘을 그리는 엔딩 — 0 부상 (0x885fc `cmp [this+0x2e4], #0`) */
export const INJURY_ENDING = 0
/** 걸어 들어오는 갈래(0x883b6)를 타는 마지막 엔딩 — 0 부상 · 1 방출 */
export const LAST_WALK_IN_ENDING = 1

/**
 * 걸어 들어오는 선수의 생김새 — 레코드 `+0xb` 한 바이트에서 뽑는다 (C-4 등록 화면과 같은 칸).
 * 엔딩(`0x63a04` 의 idx == 1)만 표 `0xd0ae6` 대신 이 바이트를 본다 (S12 7-1 확정).
 */
export interface EndingWalkInLook {
  /** 전역 모드 `[0x1552d10]` — **4 나리 타자편** · 3 투수편 */
  readonly mode: number
  /** `+0xb` bit5~7 = 등록 타입 (타자 0 타격형 · 1 장타형) */
  readonly typeIndex: number
  /** `+0xb` bit4 = 손 (0 우 · 1 좌) */
  readonly handIndex: number
  /** `+0xb` bit2~3 = 피부 (0 황인 · 1 백인 · 2 흑인) */
  readonly skinIndex: number
}

/** 타자편 모드 번호 — 엔딩 애니 8 가지는 이 모드에서만 탄다 */
export const BATTER_EDITION_MODE = 4

/** `0x63a04` idx == 1(육성 선수) 의 애니 바탕 — 모드 4 이고 `p[0xb] >> 4 > 1` 이면 8, 아니면 0 (0x63a5c~0x63a92) */
function playerAnimationBaseOf(look: EndingWalkInLook): number {
  const typeAndHand = (look.typeIndex << 1) | (look.handIndex & 1)
  return look.mode === BATTER_EDITION_MODE && typeAndHand > 1 ? 8 : 0
}

/**
 * 엔딩 애니 번호 = 바탕 + 2 (0x87cd6 의 n = 2).
 * `p[0xb] >> 4` 는 `타입<<1 | 손` 이라 **타입 ≥ 1**(= 타자 장타형)이면 8 이다. 투수편(모드 3)은 늘 2 다.
 */
export function endingWalkInAnimationOf(look: EndingWalkInLook): number {
  return playerAnimationBaseOf(look) + WALK_IN.characterAnimation
}

/**
 * `event_char_0.mpl` 팔레트 번호 = `(p[0xb] >> 2) & 3` 이 **1 → 0 · 2 → 1 · 그 밖 → 2** (0x63a92).
 *
 * ⚠️ **원본 그대로**: 피부 0(황인)이 팔레트 **2**(C-1 이 "인물 8·9 용" 이라 적은 칸)로 간다.
 * 이벤트 초상화 쪽(0x63a50)은 피부 0 이면 mpl 을 아예 안 쓰는데 엔딩만 다르다 — 고치지 않는다.
 */
export function endingWalkInPaletteOf(look: EndingWalkInLook): number {
  const skin = look.skinIndex & 3
  if (skin === 1) return 0
  return skin === 2 ? 1 : 2
}

/**
 * e 0·1 의 글 (0x88974~0x88a94) — StrENDING[e] 를 띠 아래 칸 `(0, y'+h+11, W, H − (y'+h+11))` = (0, 207, 240, 113)
 * 의 **세로 가운데 줄 y = 207 + 113/2 = 263** 에 `0xba269(글, 0, y, W, −1, 0)` 로 그린다.
 * ⚠️ 0xba269 의 y 가 글 위끝인지 가운데인지는 안 읽었다 — 다른 호출(올라오는 글)과 같이 위끝으로 둔다.
 */
export const SHORT_ENDING_TEXT_TOP = (() => {
  const top = BAND_WINDOW_BOTTOM + BAND_WINDOW.edgeHeight
  return top + Math.trunc((SCREEN.height - top) / 2)
})()

/**
 * 엔딩 그림 — `ending.pzx` 이미지 0 (146×96). e 2~9 에만 올린다 (적재 0x87cf2~0x87d10).
 *
 * 움직임 (0x886ca~0x887bc):
 * ```
 * 처음 [this+0x2f0] = W − 2·폭 = −52 · [this+0x2f4] = 0   (0x87dc8~0x87dd4)
 * 가 단계: [this+0x2f0] 자리에 그리고 +1 (0 에서 멈춤)
 * 나 단계(표의 칸 > 0 인 e 4~9): [this+0x2f0] 가 0 이 된 뒤 [this+0x2f4] 자리에 그리고 −1, 목표 칸에 닿으면 원형 전환을 켠다
 * e 2·3: 가 단계가 0 에 닿으면 곧바로 원형 전환을 켠다 ([this+0x2ec] = 1)
 * ```
 * 나 단계 목표 = e 4·5·6·9 → −37 · e 7·8 → −52 (표 0xd4b28 의 갈래가 r5 에 넣는 값).
 *
 * ⚠️ 그림의 바탕 자리(x 47 · y 64)는 S9 8-1 의 가운데 맞춤 그대로다 — 그리기 0xcaa1d 의 기준점 플래그(0x10, 2) 뜻은 안 읽었다.
 */
export const ENDING_IMAGE = {
  image: 0,
  width: 146,
  height: 96,
  x: (SCREEN.width - 146) / 2,
  y: SCREEN.height / 2 - 96,
  /** 가 단계 시작 자리 `W − 2·폭` */
  startOffset: SCREEN.width - 2 * 146,
} as const

/** 나 단계 목표 — e 별 (0x88374~0x883b4). 없는 e(2·3)는 나 단계가 없다 */
const PAN_TARGET: Readonly<Record<number, number>> = { 4: -37, 5: -37, 6: -37, 7: -52, 8: -52, 9: -37 }

/** 그림 자리 (바탕 x 에 더할 값) — 틱 n 에서 */
export function endingImageOffsetOf(tick: number, endingIndex: number): number {
  const slide = Math.min(ENDING_IMAGE.startOffset + tick, 0)
  const panTarget = PAN_TARGET[endingIndex]
  if (slide < 0 || panTarget === undefined) return slide
  const panTicks = tick + ENDING_IMAGE.startOffset
  return Math.max(0 - panTicks, panTarget)
}

/**
 * 원형 전환이 켜지는 틱 — 그린 뒤 옮긴 값이 목표(가 단계 0 · 나 단계 목표)에 닿은 **그 틀**에 `[this+0x2ec]` 를 켜고
 * 같은 틀에서 원을 t = 0 으로 그린다 (0x88794 · 0x887a0 → 0x887be).
 */
export function irisStartTickOf(endingIndex: number): number {
  const panTarget = PAN_TARGET[endingIndex] ?? 0
  return -ENDING_IMAGE.startOffset - 1 - panTarget
}

/**
 * 원형 전환 — e 별 닫히는 크기 `s = [this+0x2fc]` 와 자리 `[this+0x300]`·`[this+0x304]` (적재 0x87e4c~0x87f10,
 * 보정 표 s8 0xd41c7 = [45, −28, −69, −42, −108, 6, −56, −80, 13, −29]).
 *
 * | e | s | dx, dy |
 * |---|---|---|
 * | 2 | 34 | −69, −42 |
 * | 3 | 90 | −108, 6 |
 * | 4·8 | 57 | 13, −29 |
 * | 5·6·9 | 85 | −56, −80 |
 * | 7 | 70 | 45, −28 |
 *
 * (P6·S12 가 적은 D 140 · (−58, −55) 는 **시즌모드 엔딩** 적재 0x879b6 의 값이다.)
 */
export const IRIS_BY_ENDING: Readonly<Record<number, { readonly size: number; readonly dx: number; readonly dy: number }>> = {
  2: { size: 34, dx: -69, dy: -42 },
  3: { size: 90, dx: -108, dy: 6 },
  4: { size: 57, dx: 13, dy: -29 },
  5: { size: 85, dx: -56, dy: -80 },
  6: { size: 85, dx: -56, dy: -80 },
  7: { size: 70, dx: 45, dy: -28 },
  8: { size: 57, dx: 13, dy: -29 },
  9: { size: 85, dx: -56, dy: -80 },
}

/** 덮는 판 색 — 오프스크린을 검정으로 칠하고 RGB(255,0,255) 원을 뚫는다 */
export const IRIS_COVER = '#000000'

/**
 * 원형 전환의 원 (0x887ce~0x8896c) — t = 켜진 뒤 틱 `[this+0x308]`:
 * ```
 * D = W − s
 * r = D − D·sin(t == 0 ? 90 : 110)/100 + D·sin(min(16t, 110))/100     ; sin = 0x6c6a9 (사인표 0xd310c, ×100)
 * 지름 = W − r · 왼쪽 위 = (W/2 + dx − (D − r)/2, H/2 + dy − (D − r)/2)  ; 0x1400708 fillArc(…, 0, 360)
 * ```
 * t = 0 → 지름 240(화면 전체) 에서 줄어 t ≥ 7 이면 지름 s 로 선다(t = 6 에 조금 더 작아졌다 돌아온다 — 원본 그대로).
 * 가운데는 늘 (W/2 + dx + s/2, H/2 + dy + s/2) 다.
 */
export function irisCircleOf(tick: number, endingIndex: number): { readonly x: number; readonly y: number; readonly diameter: number } | null {
  const iris = IRIS_BY_ENDING[endingIndex]
  if (iris === undefined) return null
  const span = SCREEN.width - iris.size
  const k = sineHundred(tick === 0 ? 90 : 110)
  const p = sineHundred(Math.min(tick << 4, 110))
  const r = Math.trunc((span * p) / 100) + (span - Math.trunc((span * k) / 100))
  const shift = Math.trunc((span - r) / 2)
  return {
    x: SCREEN.width / 2 + iris.dx - shift,
    y: SCREEN.height / 2 + iris.dy - shift,
    diameter: SCREEN.width - r,
  }
}

/**
 * e 2~9 의 글 (0x88a96~0x88b56) — `"!C" + StrENDING[20] + "!N"×4 + sprintf(StrENDING[e], 이름)` 을
 * `(0, H − n, W)` 에 그린다 → **한 틱에 1px 씩 아래에서 올라온다**. [20] 은 모든 은퇴 엔딩 앞에 붙는 머리말이다.
 */
export const RISING_TEXT = { prologueIndex: 20, gapLines: 4, x: 0, width: SCREEN.width } as const
export const risingTextTopOf = (tick: number) => SCREEN.height - tick

/**
 * 제작진 `0x88bb4` (단계 3 — 틱은 0 부터 다시 센다):
 * ```
 * 띠 창(가운데 124) + mode_back + 연애 인물들 (발 y = 196)
 * 글 "!C" + StrENDING[연애 엔딩 9 + c] + "!N"×8 + StrENDING[21] 을 (0, H − n/2, W) 에,
 *    잘라내기 (0, 196 + 20, W, …) 아래로만 보인다
 * ```
 */
export const CREDITS = { index: 21, gapLines: 8, x: 0, width: SCREEN.width, clipTop: BAND_WINDOW_BOTTOM + 20 } as const

export const creditsTopOf = (tick: number) => SCREEN.height - Math.trunc(tick / 2)

/** 제작진 화면에 서는 인물 하나 */
export interface CreditsWalker {
  readonly folder: string
  readonly animation: number
  readonly x: number
  /** 그리기 깃발 0x11 — 좌우를 뒤집어 그린다 (⚠️ 0x93c45 의 깃발 비트 0 = 뒤집기로 본 것은 **유력**) */
  readonly isFlipped: boolean
  /** 20틱마다 돌아선다 (선수, c == 3) — 짝수 구간이 뒤집힌 쪽 */
  readonly turnsEvery20: boolean
  /** 선수면 생김새 팔레트를 쓴다 */
  readonly isPlayer: boolean
}

/** 0xd4aec — 선수 애니 = 바탕 + 표[c − 1] */
const PLAYER_CREDITS_ANIMATION = [6, 5, 4, 7, 1] as const
/** 0xd4b00 — 연애 상대 애니 = 0xd0ae6[10 + k] + 표[c − 2] */
const PARTNER_CREDITS_ANIMATION = [5, 3, 0, 1, 0] as const
/** 0xd0ae6[10..13] — event_char_1.pzx 안 인물 넷(300 메디카 · 301 레오니 · 302 로제 · 303 발렌타인)의 애니 바탕 */
const PARTNER_ANIMATION_BASE = [0, 7, 15, 23] as const
const FIRST_ROMANCE_EVENT = 300
/** 처음 자리 W/2 (0x88010~0x88024) 와 c 별 옮김 (0x8819c~0x88264) */
const WALKER_SHIFT: Readonly<Record<number, readonly number[]>> = {
  1: [0],
  2: [40, -40],
  3: [0, -80, 80],
  4: [85, -100, -50, 0],
  5: [0, -100, -50, 50, 100],
}

/**
 * 제작진 인물 (적재 0x87fda~0x88266): 선수 하나 + 본 연애 상대(이벤트 번호 순). c = 1 + 상대 수.
 * c == 2 면 상대(1번)를 뒤집고, c == 3 이면 1번을 뒤집고 선수가 20틱마다 돌아선다.
 */
export function creditsWalkersOf(look: EndingWalkInLook, romanceEvents: readonly number[]): readonly CreditsWalker[] {
  const count = 1 + romanceEvents.length
  const shifts = WALKER_SHIFT[count] ?? WALKER_SHIFT[1]
  const player: CreditsWalker = {
    folder: WALK_IN.characterFolder,
    animation: playerAnimationBaseOf(look) + PLAYER_CREDITS_ANIMATION[count - 1],
    x: SCREEN.width / 2 + shifts[0],
    isFlipped: false,
    turnsEvery20: count === 3,
    isPlayer: true,
  }
  const partners = romanceEvents.map((eventId, index): CreditsWalker => ({
    folder: './sprites/event_char_1/frames',
    animation: PARTNER_ANIMATION_BASE[eventId - FIRST_ROMANCE_EVENT] + PARTNER_CREDITS_ANIMATION[count - 2],
    x: SCREEN.width / 2 + (shifts[index + 1] ?? 0),
    isFlipped: index === 0 && (count === 2 || count === 3),
    turnsEvery20: false,
    isPlayer: false,
  }))
  return [player, ...partners]
}

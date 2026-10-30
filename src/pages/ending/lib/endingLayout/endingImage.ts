/** e 2~9 갈래 — 엔딩 그림 · 원형 전환 · 올라오는 글 · 제작진 걷는 이 (0x886ca · 0x88bb4) */
import { sineHundred } from '@/shared/lib/math/originalTrigonometry'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import { BAND_WINDOW_BOTTOM, SCREEN, WALK_IN, playerAnimationBaseOf } from '@/pages/ending/lib/endingLayout/endingBand'
import type { EndingWalkInLook } from '@/pages/ending/lib/endingLayout/endingBand'

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
    folder: assetUrl('./sprites/event_char_1/frames'),
    animation: PARTNER_ANIMATION_BASE[eventId - FIRST_ROMANCE_EVENT] + PARTNER_CREDITS_ANIMATION[count - 2],
    x: SCREEN.width / 2 + (shifts[index + 1] ?? 0),
    isFlipped: index === 0 && (count === 2 || count === 3),
    turnsEvery20: false,
    isPlayer: false,
  }))
  return [player, ...partners]
}

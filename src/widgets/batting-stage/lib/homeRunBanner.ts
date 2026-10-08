/**
 * 홈런 글자 연출 (HOMERUN) — 원본 R2-game-effects 3-2.
 *
 * 켜는 곳은 판정 스위치 v = 8·12(홈런, 0x51cd8): 단계 +0x1961 = 0, 켜짐 +0x1960 = 1,
 * 글자별 칸 +0x1964+i = 5+i (i = 0..6). 그리기는 0x40b18 이 경기 틱마다 부른다.
 * 글자는 game_effect **이미지 54~60 = H O M E R U N** (폭 27,27,30,24,27,27,27 · 높이 25).
 *
 * 합성 인자 0xbb91d(그림, x, y, 종류, a, b) 의 뜻은 R6-sprite-leftovers 3c 에서 풀렸다(확정):
 *   종류 1 = 보통 복사 · 종류 2 = 크기 a/10 배 · 종류 8 = 각 채널에 +b 밝게.
 * 그래서 칸 5·4·3 은 2배(a=20), 칸 1 은 +200 흰 번쩍, 유지 단계 반짝임은 +140 이다.
 *
 * 같은 가지에서 **사운드 11(홈런 함성)** 이 울리지만 웹엔 소리 장치가 없어 번호만 남긴다.
 *
 * 여기는 좌표·단계 계산만 한다 — 그리기는 renderHomeRunBanner.ts.
 */
import { STAGE_HEIGHT, STAGE_WIDTH } from '@/widgets/batting-stage/lib/stageLayout'

/** H O M E R U N — game_effect 이미지 번호 */
export const HOME_RUN_LETTER_IMAGES: readonly number[] = [54, 55, 56, 57, 58, 59, 60]

/** 이미지 054~060.png 실측 폭 (높이는 모두 25) */
export const HOME_RUN_LETTER_WIDTHS: readonly number[] = [27, 27, 30, 24, 27, 27, 27]

export const HOME_RUN_LETTER_HEIGHT = 25

/** 글자 맨 처음 칸 = 5 + i */
const FIRST_SLOT = 5
/** 2틱마다 모든 글자 칸 −1 */
const TICKS_PER_SLOT_STEP = 2
/** 글자 y0 = scrH/2 − 25 */
const BASE_Y = Math.floor(STAGE_HEIGHT / 2) - HOME_RUN_LETTER_HEIGHT

/** 날아 들어오기(단계 0)가 끝나는 틱 — 마지막 N 의 칸 11 이 2틱마다 1씩 줄어 22틱 */
export const HOME_RUN_FLY_IN_END_TICK =
  (FIRST_SLOT + HOME_RUN_LETTER_IMAGES.length - 1) * TICKS_PER_SLOT_STEP

/** 흔들기 단계 1·2·3 은 2틱씩 */
const SHAKE_PHASE_TICKS = 2
const SHAKE_PHASE_COUNT = 3

/** 유지(단계 4)가 시작하는 틱 */
export const HOME_RUN_HOLD_START_TICK =
  HOME_RUN_FLY_IN_END_TICK + SHAKE_PHASE_COUNT * SHAKE_PHASE_TICKS

/** 반짝임 주기 — (카운터 mod 14)/2 번째 글자가 번쩍인다 */
export const HOME_RUN_FLASH_CYCLE_TICKS = 14

/** 한 글자를 어디에 어떻게 그릴지 */
export interface HomeRunLetter {
  /** 글자 차례 0(H)~6(N) */
  readonly index: number
  /** game_effect 이미지 번호 */
  readonly image: number
  readonly x: number
  readonly y: number
  /** 0xbb91d 종류 2 의 크기 배율 a/10 — 1 이면 원래 크기 */
  readonly scale: number
  /** 0xbb91d 종류 8 의 b — 채널마다 더해 밝힌다. 0 이면 보통 그리기 */
  readonly brighten: number
}

/**
 * 칸별 y 와 합성 (R2 3-2 의 표 그대로, 점프표 0xd0010).
 * 칸 5 는 화면 아래(scrH), 4 는 scrH·3/4 − 25, 3 아래로는 제자리 y0 이다.
 */
const SLOT_SHAPES: readonly { readonly y: number; readonly scale: number; readonly brighten: number }[] = [
  { y: BASE_Y, scale: 1, brighten: 0 }, // 칸 0 — 종류 1 · a 10
  { y: BASE_Y, scale: 1, brighten: 200 }, // 칸 1 — 종류 8 · a 10 · b 200 (흰 번쩍)
  { y: BASE_Y, scale: 1, brighten: 0 }, // 칸 2 — 종류 1 · a 10
  { y: BASE_Y, scale: 2, brighten: 0 }, // 칸 3 — 종류 2 · a 20 (2배)
  { y: Math.floor((STAGE_HEIGHT * 3) / 4) - HOME_RUN_LETTER_HEIGHT, scale: 2, brighten: 0 }, // 칸 4
  { y: STAGE_HEIGHT, scale: 2, brighten: 0 }, // 칸 5 — 화면 아래
]

/**
 * 글자 x 자리. 시작 x = scrW/2 − Σ(w−간격)/2 이고 글자 사이가 w−간격 이다.
 * 원본이 7글자 모두의 (w−간격) 을 더해 반으로 나누므로(0x40b18) 마지막 글자 폭만큼 오른쪽으로 치우친다 — 그대로 둔다.
 */
function letterXs(gap: number): readonly number[] {
  const span = HOME_RUN_LETTER_WIDTHS.reduce((sum, width) => sum + (width - gap), 0)
  let x = Math.floor(STAGE_WIDTH / 2 - span / 2)
  return HOME_RUN_LETTER_WIDTHS.map((width) => {
    const left = x
    x += width - gap
    return left
  })
}

/** 글자 i 의 칸 — 2틱마다 1씩 줄어 0 에서 멈춘다 */
export function homeRunSlotAt(index: number, tick: number): number {
  const steps = Math.floor(tick / TICKS_PER_SLOT_STEP)
  return Math.max(0, FIRST_SLOT + index - steps)
}

/**
 * 지금 단계. 0 = 날아 들어오기 · 1·2·3 = 흔들기(2틱씩) · 4 = 유지(꺼질 때까지).
 * 단계 0 은 모든 글자 칸이 0 이 될 때 끝난다 (= 22틱).
 */
export function homeRunPhaseAt(tick: number): number {
  if (tick < HOME_RUN_FLY_IN_END_TICK) return 0
  const step = Math.floor((tick - HOME_RUN_FLY_IN_END_TICK) / SHAKE_PHASE_TICKS)
  return step >= SHAKE_PHASE_COUNT ? 4 : step + 1
}

/** 단계 1·2·3 에 화면 가운데 겹치는 game_effect 프레임 17+단계 = 18·19·20. 그 밖엔 null */
export function homeRunBurstFrameAt(tick: number): number | null {
  const phase = homeRunPhaseAt(tick)
  return phase >= 1 && phase <= SHAKE_PHASE_COUNT ? 17 + phase : null
}

/** 단계 0 — 칸이 5 보다 크면 아직 안 그린다 → 글자가 2틱 간격으로 하나씩 나온다 */
function flyInLetters(tick: number): readonly HomeRunLetter[] {
  const xs = letterXs(3)
  const letters: HomeRunLetter[] = []
  HOME_RUN_LETTER_IMAGES.forEach((image, index) => {
    const slot = homeRunSlotAt(index, tick)
    if (slot > FIRST_SLOT) return
    const shape = SLOT_SHAPES[slot]
    letters.push({ index, image, x: xs[index], y: shape.y, scale: shape.scale, brighten: shape.brighten })
  })
  return letters
}

/**
 * 단계 1·2·3 — 가운데로 모였다 튕기는 흔들림.
 * 앞 셋 = H·O·M, 뒤 셋 = R·U·N, 가운데 E 는 문서에 보정이 없어 제자리에 둔다 (추정).
 * 글자 자체의 합성 인자도 문서에 없어 보통 그리기로 둔다 (추정).
 */
function shakeLetters(phase: number): readonly HomeRunLetter[] {
  const xs = letterXs(3)
  return HOME_RUN_LETTER_IMAGES.map((image, index) => {
    const isFront = index < 3
    const isBack = index > 3
    let x = xs[index]
    let y = BASE_Y
    if (phase === 1) {
      if (isFront) x += 3
      if (isBack) x -= 3
    } else if (phase === 2) {
      if (isFront) {
        x -= 5
        y = BASE_Y - index + 3
      }
      if (isBack) {
        x += 5
        y = BASE_Y + index - 3
      }
    } else {
      if (isFront) {
        x -= 5
        y = BASE_Y + index - 3
      }
      if (isBack) {
        x += 5
        y = BASE_Y - index + 3
      }
    }
    return { index, image, x, y, scale: 1, brighten: 0 }
  })
}

/**
 * 단계 4 이상 — 글자 사이를 w−1 로 좁혀 다시 가운데 정렬하고,
 * (카운터 mod 14)/2 번째 글자만 5px 올려 +140 밝게 → 14틱 주기로 왼쪽→오른쪽 반짝임.
 *
 * 원본 카운터는 +0x1962 인데 언제 0 이 되는지는 문서에 없다. 다만 유지 시작 틱 28 이 14 의 배수라
 * "연출 시작부터" 세든 "유지 진입부터" 세든 고르는 글자가 같아 그냥 연출 틱을 쓴다.
 */
function holdLetters(tick: number): readonly HomeRunLetter[] {
  const xs = letterXs(1)
  const flashing = Math.floor((tick % HOME_RUN_FLASH_CYCLE_TICKS) / 2)
  return HOME_RUN_LETTER_IMAGES.map((image, index) =>
    index === flashing
      ? { index, image, x: xs[index], y: BASE_Y - 5, scale: 1, brighten: 140 }
      : { index, image, x: xs[index], y: BASE_Y, scale: 1, brighten: 0 },
  )
}

/** 이 틱에 그릴 글자들 */
export function homeRunLettersAt(tick: number): readonly HomeRunLetter[] {
  const phase = homeRunPhaseAt(tick)
  if (phase === 0) return flyInLetters(tick)
  if (phase >= 4) return holdLetters(tick)
  return shakeLetters(phase)
}

/**
 * ============================================================================
 * 그리기 한 번씩 도는 **원본 칸 그대로의 글자 연출** — 0x40b18 (2026-10-07 직접 뜸)
 * ============================================================================
 * ```
 * 40b22  +0x1960(켜짐) == 0 이면 아무것도 안 한다
 * 40b40  +0x1961(단계) ≤ 3:
 *          글자 i 마다 칸 +0x1964+i 로 그린다(칸 > 5 면 안 그림 · 점프표 0xd0010) — 단계 1·2·3 은 흔들기 자리
 * 40d7c    단계 ∈ 1..3 이면 **글자 다음에** game_effect 프레임 0x11+단계(18·19·20)를 화면 가운데 (W/2, H/2)에
 * 40dec    +0x1963 += 1 ; ≤ 1 이면 끝
 *          +0x1963 = 0 ; 단계 0: 칸마다 −1(0 에서 멈춤) → 모두 ≤ 0 이면 단계 1 / 단계 1·2·3: 단계 += 1
 * 40e98  단계 ≥ 4 (유지): 글자 사이 w−1 · (+0x1962 mod 14)/2 번째 글자만 5px 올려 +140 밝게
 * 40f98    +0x1962 += 1 ; > 13 이면 0
 * 40faa    0x901a0([0x1400064], 0, 0) — 홈런 효과 객체 틱 (유지 단계를 그린 그림에서만)
 * ```
 * 칸을 세우는 곳: 일반 홈런 0x51cd8~0x51d0a(+0x1963 = 0 · +0x1961 = 0 · +0x1960 = 1 · 칸 5+i — `generalHomeRunTextOn`) ·
 * 홈런더비 0x5279a~0x527ac(+0x1961 = 0 · +0x1960 = 1 만 — `derbyHomeRunTextOn`). +0x1962 는 아무도 0 으로 되돌리지 않고(장면 new 의 0),
 * 더비는 +0x1963 · 칸도 안 건드려 **앞 연출이 남긴 값**에서 이어 센다. 끄는 곳: 0x17 끝 0x35108(0x351d0) · 키 건너뛰기 0x519cc.
 * 그리기 0x40b18 을 부르는 곳은 0x17 그리기 0x46c88 의 0x46e5c 하나 — `0x33c98 && 관문 0xb0d28 열림 && (state[0x1d] || +0x129)`.
 */
export interface HomeRunTextState {
  /** +0x1961 — 0 날아 들어오기 · 1·2·3 흔들기 · 4 유지 */
  readonly stage: number
  /** +0x1963 — 날아 들어오기 · 흔들기의 두 그림 셈 */
  readonly stepCounter: number
  /** +0x1962 — 유지 단계 반짝임 셈 (0..13) */
  readonly flashCounter: number
  /** +0x1964+i — 글자 칸 */
  readonly slots: readonly number[]
}

/** 장면을 새로 만든 때의 칸 — new 의 0 채움 */
export const HOME_RUN_TEXT_SCENE_START: HomeRunTextState = {
  stage: 0,
  stepCounter: 0,
  flashCounter: 0,
  slots: HOME_RUN_LETTER_IMAGES.map(() => 0),
}

/** 일반 홈런 0x51cd8 — 단계 0 · +0x1963 = 0 · 칸 5+i. +0x1962 는 그대로 */
export function generalHomeRunTextOn(scene: HomeRunTextState): HomeRunTextState {
  return { ...scene, stage: 0, stepCounter: 0, slots: HOME_RUN_LETTER_IMAGES.map((_image, index) => FIRST_SLOT + index) }
}

/**
 * 홈런더비 0x5279a~0x527ac — 단계 +0x1961 = [sp+0x10](= 0xb68dc 결과, 홈런 갈래에선 0) 만 쓴다.
 * +0x1963 · 칸 · +0x1962 는 앞 연출이 남긴 값 그대로라 날아 들어오기 없이 제자리(칸 0)에서 시작한다.
 */
export function derbyHomeRunTextOn(scene: HomeRunTextState): HomeRunTextState {
  return { ...scene, stage: 0 }
}

/** 그림 한 번에 그리는 것 */
export interface HomeRunTextFrame {
  readonly letters: readonly HomeRunLetter[]
  /** 단계 1·2·3 에 글자 **위에** 얹는 game_effect 프레임 18·19·20. 그 밖엔 null */
  readonly burstFrame: number | null
}

/** 0x40b18 한 번 — 이 칸으로 그릴 것과 그린 뒤의 칸 */
export function drawHomeRunTextOnce(state: HomeRunTextState): { readonly frame: HomeRunTextFrame; readonly next: HomeRunTextState } {
  if (state.stage >= 4) {
    const flashing = Math.trunc((state.flashCounter % HOME_RUN_FLASH_CYCLE_TICKS) / 2)
    const xs = letterXs(1)
    const letters = HOME_RUN_LETTER_IMAGES.map((image, index) =>
      index === flashing
        ? { index, image, x: xs[index], y: BASE_Y - 5, scale: 1, brighten: 140 }
        : { index, image, x: xs[index], y: BASE_Y, scale: 1, brighten: 0 },
    )
    const raised = state.flashCounter + 1
    return {
      frame: { letters, burstFrame: null },
      next: { ...state, flashCounter: raised > HOME_RUN_FLASH_CYCLE_TICKS - 1 ? 0 : raised },
    }
  }

  const letters =
    state.stage === 0
      ? lettersFromSlots(state.slots)
      : shakeLetters(state.stage)
  const frame = { letters, burstFrame: state.stage >= 1 ? 17 + state.stage : null }
  const counted = state.stepCounter + 1
  if (counted <= 1) return { frame, next: { ...state, stepCounter: counted } }
  if (state.stage !== 0) return { frame, next: { ...state, stepCounter: 0, stage: state.stage + 1 } }
  const slots = state.slots.map((slot) => Math.max(0, slot - 1))
  return {
    frame,
    next: { ...state, stepCounter: 0, slots, stage: slots.every((slot) => slot <= 0) ? 1 : 0 },
  }
}

/** 단계 0 — 칸 > 5 면 안 그린다 */
function lettersFromSlots(slots: readonly number[]): readonly HomeRunLetter[] {
  const xs = letterXs(3)
  const letters: HomeRunLetter[] = []
  HOME_RUN_LETTER_IMAGES.forEach((image, index) => {
    const slot = slots[index] ?? 0
    if (slot > FIRST_SLOT || slot < 0) return
    const shape = SLOT_SHAPES[slot]
    letters.push({ index, image, x: xs[index], y: shape.y, scale: shape.scale, brighten: shape.brighten })
  })
  return letters
}

/**
 * 켠 칸(`…HomeRunTextOn`)에서 그림을 `draws` 번 그린 결과 — 마지막 그림(`draws ≥ 1`)과 그린 뒤의 칸.
 * `draws` 가 0 이면 그림 없이 켠 칸 그대로다. `restartDraws` 의 그림(1 부터 센 차례) 앞에서는 단계를 0 으로 되돌린다 —
 * 같은 판에서 홈런 갈래를 한 번 더 지난 틱(더비의 폴 뒤 담장선, 0x5279a 가 +0x1961 = 0 을 다시 쓴다)이다.
 */
export function homeRunTextAfterDraws(
  on: HomeRunTextState,
  draws: number,
  restartDraws: readonly number[] = [],
): { readonly frame: HomeRunTextFrame | null; readonly state: HomeRunTextState } {
  let state = on
  let frame: HomeRunTextFrame | null = null
  for (let draw = 0; draw < draws; draw += 1) {
    if (restartDraws.includes(draw + 1)) state = derbyHomeRunTextOn(state)
    const drawn = drawHomeRunTextOnce(state)
    frame = drawn.frame
    state = drawn.next
  }
  return { frame, state }
}

/**
 * 부르는 쪽이 모는 HOMERUN 글자 창 — 홈런더비처럼 글자를 켜는 때(홈런 틱)와 그리기가 멈추는 때(관문이 닫힌 틱 · 키 건너뛰기)를
 * 진행기가 아는 화면이 넘긴다. 시각은 `performance.now()` 기준 ms.
 */
export interface HomeRunTextWindow {
  /** 첫 그림 시각 */
  readonly startedAt: number
  /** 이 시각부터는 안 그린다(관문이 닫혀 0x40b18 이 안 불린다 · 키 건너뛰기가 +0x1960 을 끈다). null 이면 끝 없음 */
  readonly endsAt: number | null
  /** 켠 칸 (`derbyHomeRunTextOn` · `generalHomeRunTextOn`) */
  readonly on: HomeRunTextState
  /** 단계를 0 으로 되돌리는 그림 차례(1 부터) — `homeRunTextAfterDraws` */
  readonly restartDraws?: readonly number[]
}

/** 시각 `now` 의 그림 — 창 밖이면 null. 그림 수 = 첫 그림부터 흐른 틱 + 1 */
export function homeRunTextFrameAt(window: HomeRunTextWindow, now: number, millisecondsPerTick: number): HomeRunTextFrame | null {
  if (now < window.startedAt) return null
  if (window.endsAt !== null && now >= window.endsAt) return null
  const draws = Math.floor((now - window.startedAt) / millisecondsPerTick) + 1
  return homeRunTextAfterDraws(window.on, draws, window.restartDraws).frame
}

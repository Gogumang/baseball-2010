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

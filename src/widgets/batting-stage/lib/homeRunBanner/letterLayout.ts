import { isBugFixed } from '@/shared/config/bugfixes'
import { STAGE_HEIGHT, STAGE_WIDTH } from '@/widgets/batting-stage/lib/stageLayout'

/** H O M E R U N — game_effect 이미지 번호 */
export const HOME_RUN_LETTER_IMAGES: readonly number[] = [54, 55, 56, 57, 58, 59, 60]

/** 이미지 054~060.png 실측 폭 (높이는 모두 25) */
export const HOME_RUN_LETTER_WIDTHS: readonly number[] = [27, 27, 30, 24, 27, 27, 27]

export const HOME_RUN_LETTER_HEIGHT = 25

/** 글자 맨 처음 칸 = 5 + i */
export const FIRST_SLOT = 5

/** 2틱마다 모든 글자 칸 −1 */
export const TICKS_PER_SLOT_STEP = 2

/** 글자 y0 = scrH/2 − 25 */
const BASE_Y = Math.floor(STAGE_HEIGHT / 2) - HOME_RUN_LETTER_HEIGHT

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
export const SLOT_SHAPES: readonly { readonly y: number; readonly scale: number; readonly brighten: number }[] = [
  { y: BASE_Y, scale: 1, brighten: 0 }, // 칸 0 — 종류 1 · a 10
  { y: BASE_Y, scale: 1, brighten: 200 }, // 칸 1 — 종류 8 · a 10 · b 200 (흰 번쩍)
  { y: BASE_Y, scale: 1, brighten: 0 }, // 칸 2 — 종류 1 · a 10
  { y: BASE_Y, scale: 2, brighten: 0 }, // 칸 3 — 종류 2 · a 20 (2배)
  { y: Math.floor((STAGE_HEIGHT * 3) / 4) - HOME_RUN_LETTER_HEIGHT, scale: 2, brighten: 0 }, // 칸 4
  { y: STAGE_HEIGHT, scale: 2, brighten: 0 }, // 칸 5 — 화면 아래
]

/**
 * 글자 x 자리. 시작 x = scrW/2 − Σ(w−간격)/2 이고 글자 사이가 w−간격 이다.
 * 원본이 7글자 모두의 (w−간격) 을 더해 반으로 나누므로(0x40b18 40b46~40b88 — 프레임 0x36~0x3c 의 w − 3 합 >> 1) 그린 폭보다
 * 간격만큼 좁게 재어 간격의 반(간격 3 이면 1.5px)만큼 오른쪽으로 치우친다(B-88). 고친 길은 그린 폭(마지막 글자는 w 그대로)으로 가운데를 잡는다. 굴림 없음
 */
export function letterXs(gap: number): readonly number[] {
  const span = HOME_RUN_LETTER_WIDTHS.reduce((sum, width) => sum + (width - gap), 0)
  const drawnSpan = isBugFixed('B-88') ? span + gap : span
  let x = Math.floor(STAGE_WIDTH / 2 - drawnSpan / 2)
  return HOME_RUN_LETTER_WIDTHS.map((width) => {
    const left = x
    x += width - gap
    return left
  })
}

/**
 * 단계 1·2·3 — 가운데로 모였다 튕기는 흔들림.
 * 앞 셋 = H·O·M, 뒤 셋 = R·U·N, 가운데 E 는 문서에 보정이 없어 제자리에 둔다 (추정).
 * 글자 자체의 합성 인자도 문서에 없어 보통 그리기로 둔다 (추정).
 */
export function shakeLetters(phase: number): readonly HomeRunLetter[] {
  const xs = letterXs(3)
  return HOME_RUN_LETTER_IMAGES.map((image, index) => {
    const offset = shakeOffsetOf(phase, index)
    return { index, image, x: xs[index] + offset.dx, y: BASE_Y + offset.dy, scale: 1, brighten: 0 }
  })
}

/** 가운데 글자 E 의 차례 — 앞 셋(H·O·M)은 +1 쪽, 뒤 셋(R·U·N)은 −1 쪽 */
const MIDDLE_LETTER_INDEX = 3

/**
 * 흔들기 자리 — 단계 1: 앞 셋 x + 3 · 뒤 셋 x − 3 (가운데로 모임).
 * 단계 2: 앞 셋 x − 5 · y − (i − 3) / 뒤 셋 x + 5 · y + (i − 3). 그 밖(3): x 는 2 와 같고 y 는 거꾸로. E 는 제자리.
 */
function shakeOffsetOf(phase: number, index: number): { readonly dx: number; readonly dy: number } {
  if (index === MIDDLE_LETTER_INDEX) return { dx: 0, dy: 0 }
  const side = index < MIDDLE_LETTER_INDEX ? 1 : -1
  if (phase === 1) return { dx: 3 * side, dy: 0 }
  const tilt = (index - MIDDLE_LETTER_INDEX) * side
  return { dx: -5 * side, dy: phase === 2 ? -tilt : tilt }
}

/** 유지 단계 글자 — 사이 w−1 로 다시 가운데, `flashing` 번째 글자만 5px 올려 +140 밝게 (40e98) */
export function flashLettersOf(flashing: number): readonly HomeRunLetter[] {
  const xs = letterXs(1)
  return HOME_RUN_LETTER_IMAGES.map((image, index) =>
    index === flashing
      ? { index, image, x: xs[index], y: BASE_Y - 5, scale: 1, brighten: 140 }
      : { index, image, x: xs[index], y: BASE_Y, scale: 1, brighten: 0 },
  )
}

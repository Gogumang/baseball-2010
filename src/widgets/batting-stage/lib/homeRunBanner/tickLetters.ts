import {
  FIRST_SLOT,
  HOME_RUN_FLASH_CYCLE_TICKS,
  HOME_RUN_LETTER_IMAGES,
  type HomeRunLetter,
  SLOT_SHAPES,
  TICKS_PER_SLOT_STEP,
  flashLettersOf,
  letterXs,
  shakeLetters,
} from '@/widgets/batting-stage/lib/homeRunBanner/letterLayout'

/** 날아 들어오기(단계 0)가 끝나는 틱 — 마지막 N 의 칸 11 이 2틱마다 1씩 줄어 22틱 */
export const HOME_RUN_FLY_IN_END_TICK = (FIRST_SLOT + HOME_RUN_LETTER_IMAGES.length - 1) * TICKS_PER_SLOT_STEP

/** 흔들기 단계 1·2·3 은 2틱씩 */
const SHAKE_PHASE_TICKS = 2

const SHAKE_PHASE_COUNT = 3

/** 유지(단계 4)가 시작하는 틱 */
export const HOME_RUN_HOLD_START_TICK = HOME_RUN_FLY_IN_END_TICK + SHAKE_PHASE_COUNT * SHAKE_PHASE_TICKS

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
 * 단계 4 이상 — 글자 사이를 w−1 로 좁혀 다시 가운데 정렬하고,
 * (카운터 mod 14)/2 번째 글자만 5px 올려 +140 밝게 → 14틱 주기로 왼쪽→오른쪽 반짝임.
 *
 * 원본 카운터는 +0x1962 인데 언제 0 이 되는지는 문서에 없다. 다만 유지 시작 틱 28 이 14 의 배수라
 * "연출 시작부터" 세든 "유지 진입부터" 세든 고르는 글자가 같아 그냥 연출 틱을 쓴다.
 */
function holdLetters(tick: number): readonly HomeRunLetter[] {
  return flashLettersOf(Math.floor((tick % HOME_RUN_FLASH_CYCLE_TICKS) / 2))
}

/** 이 틱에 그릴 글자들 */
export function homeRunLettersAt(tick: number): readonly HomeRunLetter[] {
  const phase = homeRunPhaseAt(tick)
  if (phase === 0) return flyInLetters(tick)
  if (phase >= 4) return holdLetters(tick)
  return shakeLetters(phase)
}

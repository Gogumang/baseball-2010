import {
  FIRST_SLOT,
  HOME_RUN_FLASH_CYCLE_TICKS,
  HOME_RUN_LETTER_IMAGES,
  type HomeRunLetter,
  SLOT_SHAPES,
  flashLettersOf,
  letterXs,
  shakeLetters,
} from '@/widgets/batting-stage/lib/homeRunBanner/letterLayout'

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
    const letters = flashLettersOf(Math.trunc((state.flashCounter % HOME_RUN_FLASH_CYCLE_TICKS) / 2))
    const raised = state.flashCounter + 1
    return {
      frame: { letters, burstFrame: null },
      next: { ...state, flashCounter: raised > HOME_RUN_FLASH_CYCLE_TICKS - 1 ? 0 : raised },
    }
  }

  const letters = state.stage === 0 ? lettersFromSlots(state.slots) : shakeLetters(state.stage)
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

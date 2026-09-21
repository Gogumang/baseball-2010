import { millisecondsPerFrame } from '@/shared/config/frameRate'

/**
 * 원작 타이틀 인트로. ui/main_title.pzx 프레임 테이블의 파트 좌표를 그대로 옮겼다.
 *
 *   f00 선수 y=159 · 공 (211,0)        — 배경 없음
 *   f01 선수 y=77  · 공 (180,14)
 *   f02 흙먼지 (131,226) 등장 · 공 (162,31)
 *   f04 공 (158,34)
 *   f13~f16 배경이 깔리고 로고가 x = -86 → -47 → -9 → 4 로 밀려 들어온다 (y=144)
 *
 * 인트로가 끝나면 원본은 **애니 1**(8틱 주기)을 돌린다 — PROMPT_CYCLE (F-4·4-1 확정).
 * 전체이용가·저작권·판 번호는 **인트로가 끝난 뒤에만** 그린다(그리기 0x2cbac 가 애니 0 이
 * 끝난 뒤에만 지나가는 자리) — 그래서 이 표에는 이용등급 칸이 없다.
 *
 * 추정인 것: 선수가 배경 구멍(126,34)에 안착하는 시점.
 * 이 프레임들은 파트 길이가 가변이라 파서가 일부를 잘못 읽는다.
 */
export interface Point {
  readonly x: number
  readonly y: number
}

/**
 * 애니 1 의 "PRESS ANY KEY" 단계 (F-4·4-1 확정).
 * 프레임 13(문구 없음) → 16(흐림) → 17(밝음) → 16(흐림).
 */
export type PromptPhase = 'hidden' | 'dim' | 'bright'

export interface TitlePose {
  readonly playerY: number
  readonly ball: Point
  readonly isDustVisible: boolean
  readonly isBackgroundVisible: boolean
  /** null 이면 로고를 그리지 않는다 */
  readonly logoX: number | null
  readonly promptPhase: PromptPhase
  readonly isSettled: boolean
}

type IntroPose = Omit<TitlePose, 'promptPhase' | 'isSettled'>

interface Keyframe {
  readonly frames: number
  readonly pose: IntroPose
}

const SETTLED_PLAYER_Y = 34
const SETTLED_BALL: Point = { x: 158, y: 34 }
const SETTLED_LOGO_X = 4

/**
 * 애니 1 (반복, 8틱 주기) — 프레임 13(2틱) → 16(1틱 흐림) → 17(4틱 밝음) → 16(1틱 흐림).
 * 이 빌드는 TOUCH SCREEN(애니 2)을 아예 쓰지 않는다 (0x2cbfe `movs r1,#1`, F-4·4-1 확정).
 */
const PROMPT_CYCLE: readonly PromptPhase[] = [
  'hidden', 'hidden', 'dim', 'bright', 'bright', 'bright', 'bright', 'dim',
]

const BEFORE_BACKGROUND: IntroPose = {
  playerY: SETTLED_PLAYER_Y,
  ball: SETTLED_BALL,
  isDustVisible: true,
  isBackgroundVisible: false,
  logoX: null,
}

/** 프레임 수의 합이 원본 번호와 맞는다 — 로고가 x=4 에 닿는 것이 정확히 f16 이다. */
const KEYFRAMES: readonly Keyframe[] = [
  { frames: 1, pose: { ...BEFORE_BACKGROUND, playerY: 159, ball: { x: 211, y: 0 }, isDustVisible: false } },
  { frames: 1, pose: { ...BEFORE_BACKGROUND, playerY: 77, ball: { x: 180, y: 14 }, isDustVisible: false } },
  { frames: 2, pose: { ...BEFORE_BACKGROUND, ball: { x: 162, y: 31 } } },
  { frames: 9, pose: BEFORE_BACKGROUND },
  { frames: 1, pose: { ...BEFORE_BACKGROUND, isBackgroundVisible: true, logoX: -86 } },
  { frames: 1, pose: { ...BEFORE_BACKGROUND, isBackgroundVisible: true, logoX: -47 } },
  { frames: 1, pose: { ...BEFORE_BACKGROUND, isBackgroundVisible: true, logoX: -9 } },
]

export const INTRO_FRAME_COUNT = KEYFRAMES.reduce((total, keyframe) => total + keyframe.frames, 0)

export const SETTLED_POSE: TitlePose = {
  ...BEFORE_BACKGROUND,
  isBackgroundVisible: true,
  logoX: SETTLED_LOGO_X,
  promptPhase: 'bright',
  isSettled: true,
}

export function titlePoseAt(elapsedMilliseconds: number): TitlePose {
  const frame = Math.max(0, Math.floor(elapsedMilliseconds / millisecondsPerFrame()))

  let cursor = 0
  for (const keyframe of KEYFRAMES) {
    cursor += keyframe.frames
    if (frame < cursor) return { ...keyframe.pose, promptPhase: 'hidden', isSettled: false }
  }

  return { ...SETTLED_POSE, promptPhase: PROMPT_CYCLE[(frame - cursor) % PROMPT_CYCLE.length] }
}

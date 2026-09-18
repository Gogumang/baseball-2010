import { millisecondsPerFrame } from '@/shared/config/frameRate'

/**
 * 원작 타이틀 인트로. ui/main_title.pzx 프레임 테이블의 파트 좌표를 그대로 옮겼다.
 *
 *   f00 선수 y=159 · 공 (211,0)        — 배경 없음
 *   f01 선수 y=77  · 공 (180,14)
 *   f02 흙먼지 (131,226) 등장 · 공 (162,31) · 이용등급 (0,5)
 *   f04 공 (158,34)
 *   f13~f16 배경이 깔리고 로고가 x = -86 → -47 → -9 → 4 로 밀려 들어온다 (y=144)
 *   f29/f30/f31 TOUCH SCREEN (88,254) 이 켜졌다 꺼졌다 한다
 *
 * 추정인 것: 선수가 배경 구멍(126,34)에 안착하는 시점, 깜빡임 주기, 저작권 문구 위치.
 * 이 프레임들은 파트 길이가 가변이라 파서가 일부를 잘못 읽는다.
 */
export interface Point {
  readonly x: number
  readonly y: number
}

export interface TitlePose {
  readonly playerY: number
  readonly ball: Point
  readonly isDustVisible: boolean
  readonly isBackgroundVisible: boolean
  readonly isRatingVisible: boolean
  /** null 이면 로고를 그리지 않는다 */
  readonly logoX: number | null
  readonly isPromptVisible: boolean
  readonly isSettled: boolean
}

type IntroPose = Omit<TitlePose, 'isPromptVisible' | 'isSettled'>

interface Keyframe {
  readonly frames: number
  readonly pose: IntroPose
}

const SETTLED_PLAYER_Y = 34
const SETTLED_BALL: Point = { x: 158, y: 34 }
const SETTLED_LOGO_X = 4
const PROMPT_BLINK_FRAMES = 8

const BEFORE_BACKGROUND: IntroPose = {
  playerY: SETTLED_PLAYER_Y,
  ball: SETTLED_BALL,
  isDustVisible: true,
  isBackgroundVisible: false,
  isRatingVisible: false,
  logoX: null,
}

/** 프레임 수의 합이 원본 번호와 맞는다 — 로고가 x=4 에 닿는 것이 정확히 f16 이다. */
const KEYFRAMES: readonly Keyframe[] = [
  { frames: 1, pose: { ...BEFORE_BACKGROUND, playerY: 159, ball: { x: 211, y: 0 }, isDustVisible: false } },
  { frames: 1, pose: { ...BEFORE_BACKGROUND, playerY: 77, ball: { x: 180, y: 14 }, isDustVisible: false } },
  { frames: 2, pose: { ...BEFORE_BACKGROUND, ball: { x: 162, y: 31 }, isRatingVisible: true } },
  { frames: 9, pose: BEFORE_BACKGROUND },
  { frames: 1, pose: { ...BEFORE_BACKGROUND, isBackgroundVisible: true, isRatingVisible: true, logoX: -86 } },
  { frames: 1, pose: { ...BEFORE_BACKGROUND, isBackgroundVisible: true, isRatingVisible: true, logoX: -47 } },
  { frames: 1, pose: { ...BEFORE_BACKGROUND, isBackgroundVisible: true, isRatingVisible: true, logoX: -9 } },
]

export const INTRO_FRAME_COUNT = KEYFRAMES.reduce((total, keyframe) => total + keyframe.frames, 0)

export const SETTLED_POSE: TitlePose = {
  ...BEFORE_BACKGROUND,
  isBackgroundVisible: true,
  logoX: SETTLED_LOGO_X,
  isPromptVisible: true,
  isSettled: true,
}

export function titlePoseAt(elapsedMilliseconds: number): TitlePose {
  const frame = Math.max(0, Math.floor(elapsedMilliseconds / millisecondsPerFrame()))

  let cursor = 0
  for (const keyframe of KEYFRAMES) {
    cursor += keyframe.frames
    if (frame < cursor) return { ...keyframe.pose, isPromptVisible: false, isSettled: false }
  }

  const blinkPhase = Math.floor((frame - cursor) / PROMPT_BLINK_FRAMES) % 2
  return { ...SETTLED_POSE, isPromptVisible: blinkPhase === 0 }
}

import { placedFrame } from '@/widgets/batting-stage/lib/spriteLoader'
import { stageLayoutOf } from '@/widgets/batting-stage/lib/stageLayout'

/**
 * **홈런더비 투구 기계 `0x42f2c`** — 타석 화면 공용 그리기가 그리기 목록을 비운 뒤(0xbe6a1) · HUD 0x4c4bc 앞에 부른다
 * (0x4cb6c · 0x4d098 · 0x4d94a · 0x4d9d8 · 0x4da14 · 0x4da5a · 0x4db54 · 0x4db90, 모두 둘째 인자 0). 2026-10-08 직접 뜸:
 * ```
 * 42f3c  모드 [+0x1104] ≠ 7 → 끝
 * 42f40  (x, y) = 투수 그림 객체 [+0xf1c] 의 +4 · +8      ; 0x38d1c 가 0x38e6c 에서 적는 투수 자리(좌투면 x + 1)
 * 42f52  투수 = 0xae83c(수비 팀 [+0x224]) ; 손 = 0xb63c0(투수)
 * 42f5a  둘째 인자 == 0 → 0xba759(trainning [+0x19e8], 0, 종류 1, x, y, 효과 손 ≠ 0 ? 0x11 : 0, 0, 0, 1)
 *        (둘째 인자 ≠ 0 이면 같은 그림을 그리기 목록 0xbe8d5 에 깊이 [0xcfa8c+8] + 1 로 넣는다 — 부르는 곳이 없다)
 * ```
 * trainning.pzx 프레임 0 (43 × 37, 원점 (−17, −28)) — 투수 발밑 자리에 서는 기계 그림이다. 투수 그림(0x38d1c)은 모드 7 에서도
 * 그대로 그려지고(0x38ed2 가 모드 검사 0x38eda 보다 앞), 기계가 그 **위**에 얹힌다.
 * 효과 0x11(좌우 뒤집기)은 투수 그림과 같은 축 잡기(`renderBattingStage.pitcherMirrorOf` — 근사, `drawBatter` 주석)로 옮긴다.
 */

const TRAINING_FRAMES = './sprites/trainning/frames'
export const DERBY_MACHINE_FRAME = 0
/** 원본 전역 모드 7 = 홈런더비 */
export const HOME_RUN_DERBY_MODE = 7

/** 좌투(손 1) — 투수 그림 객체 x 가 앵커 + 1 (0x38db8) */
const LEFT_HANDED_PITCHER = 1

/** 기계 자리 — 투수 그림 객체 (+4, +8) = 투수 앵커(좌투면 x + 1) · 뒤집기 */
export function derbyMachinePlacementOf(side: number, pitcherHand: number): {
  readonly x: number
  readonly y: number
  readonly isMirrored: boolean
} {
  const anchor = stageLayoutOf(side).pitcherAnchor
  const isMirrored = pitcherHand === LEFT_HANDED_PITCHER
  return { x: anchor.x + (isMirrored ? 1 : 0), y: anchor.y, isMirrored }
}

/** 기계를 그리는가 — 모드 7 일 때만 */
export function drawsDerbyPitchingMachine(gameMode: number | undefined): boolean {
  return gameMode === HOME_RUN_DERBY_MODE
}

export function drawDerbyPitchingMachine(
  context: CanvasRenderingContext2D,
  gameMode: number | undefined,
  side: number,
  pitcherHand: number,
): void {
  if (!drawsDerbyPitchingMachine(gameMode)) return
  const frame = placedFrame(TRAINING_FRAMES, DERBY_MACHINE_FRAME)
  if (frame === null) return
  const { x, y, isMirrored } = derbyMachinePlacementOf(side, pitcherHand)
  context.save()
  if (isMirrored) {
    context.translate(x * 2, 0)
    context.scale(-1, 1)
  }
  context.drawImage(frame.image, x + frame.offsetX, y + frame.offsetY)
  context.restore()
}

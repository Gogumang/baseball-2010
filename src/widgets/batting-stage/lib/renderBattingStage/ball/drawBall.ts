/** 타석 공 그리기 0x3b2f4 의 그림 하나하나 — 그림자 · 꼬리선 · 공 · 마구 이펙트 · 강속구 불꽃 */
import type { Pitch } from '@/entities/pitching/model/pitch'
import { BALL_FRAMES_PER_KIND } from '@/entities/pitching/model/pitchCurve'
import { ballFrameIndexAt, ballPixelAt, ballShadowAt } from '@/widgets/batting-stage/lib/trajectory'
import type { BallTrailLine } from '@/widgets/batting-stage/lib/ballTrail'
import { ballShadowPiecesAt } from '@/shared/lib/ballShadow/ballShadowPieces'
import { drawFrameAt, frameAnimations, GAME_EFFECT_FRAMES, placedFrame } from '@/widgets/batting-stage/lib/spriteLoader'
import { magicBallEffectFolderOf, magicBallEffectFrameAt } from '@/widgets/batting-stage/lib/magicBallEffect'
import { FASTBALL_FLAME_ANIMATION, fastballFlameBallTickOf, fastballFlameFrameAt, hasFastballFlame } from '@/widgets/batting-stage/lib/fastballFlame'
import type { StagePhaseSnapshot } from '@/widgets/batting-stage/lib/softKeyLabels'
import { UI_COLORS } from '@/shared/config/design'
import { linePixels } from '@/features/play-game/model/aceCutIn'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

/** 그림자 조각(`ballShadowPiecesAt`)을 (x, y) 에 크기 s 로 — 조각마다 제 색 채우기 */
export function drawShadowPieces(context: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  for (const piece of ballShadowPiecesAt(x, y, size)) {
    context.fillStyle = `rgb(${piece.color.r}, ${piece.color.g}, ${piece.color.b})`
    context.fillRect(piece.x, piece.y, piece.width, piece.height)
  }
}

/** 꼬리선 마디 — 0x6a905 선(양 끝 포함), 회색 a 를 알파 a/255 로 */
export function drawBallTrail(context: CanvasRenderingContext2D, lines: readonly BallTrailLine[]): void {
  if (lines.length === 0) return
  context.save()
  for (const line of lines) {
    context.fillStyle = `rgba(${line.shade}, ${line.shade}, ${line.shade}, ${line.shade / 255})`
    for (const pixel of linePixels(line.from, line.to)) context.fillRect(pixel.x, pixel.y, 1, 1)
  }
  context.restore()
}

/** 공 그림자 0x356f8 — 자리 · 크기는 `ballShadowAt`, 조각은 `ballShadowPiecesAt` */
export function drawBallShadow(context: CanvasRenderingContext2D, pitch: Pitch, ballTick: number): void {
  const placement = ballShadowAt(pitch, ballTick)
  if (placement === null) return
  drawShadowPieces(context, placement.x, placement.y, placement.size)
}

/** ball.pzx 합성 프레임 — 원점이 공 가운데라 투영 좌표에 원점대로 놓는다 */
const BALL_FRAMES = assetUrl('./sprites/ball/frames')

/** 공 그림 (3b6ac 0xbe8d5) — 그림자는 `drawBallShadow`(3b388~3b422) */
export function drawBall(context: CanvasRenderingContext2D, pitch: Pitch, frame: number): void {
  drawBallSprite(context, ballPixelAt(pitch, frame), ballFrameIndexAt(pitch, frame))
}

/** ball.pzx 프레임 한 장을 화면 자리에 (원점 = 공 가운데) */
export function drawBallSprite(context: CanvasRenderingContext2D, position: { readonly x: number; readonly y: number }, ballFrame: number): void {
  const placed = placedFrame(BALL_FRAMES, ballFrame)

  if (placed === null) {
    context.fillStyle = UI_COLORS.ball
    context.beginPath()
    // 그림이 없을 때의 대체 동그라미 — 프레임 번호에서 종류(11칸 묶음)를 덜고 크기만 쓴다
    context.arc(position.x, position.y, 1 + (ballFrame % BALL_FRAMES_PER_KIND) / 2, 0, Math.PI * 2)
    context.fill()
    return
  }
  context.drawImage(placed.image, Math.round(position.x) + placed.offsetX, Math.round(position.y) + placed.offsetY)
}

/**
 * 마구 공 이펙트 (경기+0x1040, 0x3b546) — **공과 같은 화면 좌표**에 겹친다.
 * 무엇을 언제 그리는지는 전부 `magicBallEffect.ts` 가 들고 있다.
 */
export function drawMagicBallEffect(context: CanvasRenderingContext2D, pitch: Pitch, frame: number): void {
  const folder = magicBallEffectFolderOf(pitch)
  if (folder === null) return
  // 원본이 쓰는 애니는 0 번 한 벌뿐이다 (effect_fire·effect_shinning 둘 다 [0,1,2,3])
  const entries = frameAnimations(folder)?.[0]
  if (entries === undefined) return
  const frameIndex = magicBallEffectFrameAt(entries, frame)
  if (frameIndex === null) return
  const placed = placedFrame(folder, frameIndex)
  if (placed === null) return

  const position = ballPixelAt(pitch, frame)
  context.drawImage(placed.image, Math.round(position.x) + placed.offsetX, Math.round(position.y) + placed.offsetY)
}

/** 강속구 불꽃 (R2 3-1) — game_effect 애니 1 을 공 화면 자리(마지막 점으로 잘린 0x35820)에 */
export function drawFastballFlame(context: CanvasRenderingContext2D, pitch: Pitch, frame: number, phase: StagePhaseSnapshot | undefined): void {
  const ballTick = fastballFlameBallTickOf(phase, frame, pitch.frameCount)
  if (ballTick === null || !hasFastballFlame(pitch)) return
  const entries = frameAnimations(GAME_EFFECT_FRAMES)?.[FASTBALL_FLAME_ANIMATION]
  if (entries === undefined) return
  const frameIndex = fastballFlameFrameAt(entries, ballTick, pitch.frameCount)
  if (frameIndex === null) return
  const position = ballPixelAt(pitch, ballTick)
  // 3b7ce 0xbe8a5(…, 애니 1, 효과 0, …) — 칸 12~17 은 모두 0x67 파트라 화면에 더한다(0xc9f98 ca198 · 효과 2)
  drawFrameAt(context, GAME_EFFECT_FRAMES, frameIndex, Math.round(position.x), Math.round(position.y))
}

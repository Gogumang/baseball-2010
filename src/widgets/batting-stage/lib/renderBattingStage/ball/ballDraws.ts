/**
 * 타석 공 그리기 0x3b2f4 의 몫 — 그림자 · 꼬리선은 곧바로 화면에(목록 밖이라 선수 · 공 아래), 공 · 마구 이펙트 · 강속구 불꽃은 그리기 목록에 넣는다.
 * 0x13 은 같은 공 그리기가 0x33e34 로 다시 채운 타구 경로를 그린다 — 투구 경로 · 마구 이펙트 · 강속구 불꽃은 없다.
 */
import type { Pitch } from '@/entities/pitching/model/pitch'
import { projectToScreen } from '@/entities/pitching/model/pitchCurve'
import { ballDepthAt, ballShadowOfPoint } from '@/widgets/batting-stage/lib/trajectory'
import { hitBallPointAt, hitBallSizeOf } from '@/widgets/batting-stage/lib/hitBallPath'
import { HIT_BALL_TRAIL, PITCH_BALL_TRAIL, ballTrailLinesOf, trailsAt } from '@/widgets/batting-stage/lib/ballTrail'
import { heldBallTickOf } from '@/widgets/batting-stage/lib/heldBall'
import { DRAW_DEPTH, MAGIC_EFFECT_DEPTH_STEP, type StageDrawList } from '@/widgets/batting-stage/lib/renderBattingStage/drawList'
import {
  drawBall,
  drawBallShadow,
  drawBallSprite,
  drawBallTrail,
  drawFastballFlame,
  drawMagicBallEffect,
  drawShadowPieces,
} from '@/widgets/batting-stage/lib/renderBattingStage/ball/drawBall'
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage/stageScene'

/** 이 그림의 공 — 0x13('타격')은 타구 공, 아니면 투구 공 */
export function addStageBallDraws(context: CanvasRenderingContext2D, drawList: StageDrawList, scene: StageScene, side: number): void {
  if (scene.stagePhase?.kind === '타격') {
    if (scene.hitBall != null) addHitBallDraws(context, drawList, scene.hitBall, side)
    return
  }
  if (scene.pitch !== null) addBallDraws(context, drawList, scene, scene.pitch)
}

/**
 * 공 틱 — 나는 동안은 공 프레임 그대로, 아니면 0x12 의 굳은 공(`heldBall`).
 * 0x12 그리기 0x4ce9c 도 0x3b2f4 를 불러 공을 마지막 점에 그대로 둔다 — 0x11 이 아니라 마구 이펙트는 없다 (`heldBall`).
 * 0x11 의 공 틱 N · N + 1(0x12 를 예약한 틀) 도 공은 같다: 0x11 그리기 0x4d64c 는 4d72c 에서 보임 칸(0x9e039 — 0x11 진입이 세우고
 * 0xf · 0xd 진입 · 0x18 진입만 지운다)이 서 있으면 4d73a 에서 0x3b2f4 를 부르고, 0x3b2f4 는 3b310 의 0x35820 으로 공 틱을 N − 1 에
 * 자른다(35828~3582e). 그 두 틀은 아직 0x11 이라 마구 이펙트도 돈다(2026-10-24 직접 떴다): 3b496 상태 == 0x11 이면 3b546 갈래가
 * 자르지 않은 공 틱 [sp+0x38] > 7 · 애니가 마지막 칸 전이면 그리고, 자리는 잘린 점 [sp+0x4c](0x35854)다 — 공과 같은 자리 · 같은 셈
 */
function ballTickOf(scene: StageScene, pitch: Pitch, isFlying: boolean): number | null {
  if (isFlying) return scene.frame
  const heldTick = heldBallTickOf(scene.stagePhase, pitch.frameCount)
  if (heldTick !== null) return heldTick
  return scene.stagePhase?.kind === '투구중' && scene.frame >= pitch.frameCount ? scene.frame : null
}

/** 3b434~3b46e 꼬리선 0x3b188(장면, 5, 0xdf, 0) — 공 틱 ≤ N 이면 0x11 · 0x12 늘. 그림자 다음 · 그리기 목록 밖(곧바로)이다 */
function drawPitchTrail(context: CanvasRenderingContext2D, pitch: Pitch, ballTick: number): void {
  const path = pitch.worldPath
  if (path === null || path.length === 0 || !trailsAt(ballTick, path.length)) return
  drawBallTrail(
    context,
    ballTrailLinesOf(PITCH_BALL_TRAIL, ballTick, path.length, (index) => projectToScreen(path[index], pitch.stageSide)),
  )
}

/**
 * 넣는 차례는 마구 이펙트(3b59e, 깊이 z + 1) → 공(3b6de, z) → 강속구 불꽃(3b7cc, z) 이라 비울 때 공 · 불꽃 · 이펙트 차례다.
 * z 는 공 틱의 경로 점 월드 z(`ballDepthAt`) — 공이 타자 깊이 29705 에 못 미치면 타자 · 투구 UI 밑, 닿으면 그 위다.
 */
function addBallDraws(context: CanvasRenderingContext2D, drawList: StageDrawList, scene: StageScene, pitch: Pitch): void {
  const isFlying = scene.frame >= 0 && scene.frame < pitch.frameCount
  const ballTick = ballTickOf(scene, pitch, isFlying)
  const depth = ballDepthAt(pitch, ballTick ?? scene.frame) ?? DRAW_DEPTH.타자
  if (ballTick !== null) addPitchBallDraws(context, drawList, scene, { pitch, ballTick, depth, isFlying })
  // 강속구 불꽃 0x3b6e4 — 같은 공 그리기 0x3b2f4 의 꼬리라 공 다음에 같은 깊이로 넣는다. 공이 다 온 틱(N)부터라
  // 0x12 에서도 마지막 점의 공 위에 돈다 (`fastballFlame`)
  drawList.add(depth, () => drawFastballFlame(context, pitch, scene.frame, scene.stagePhase))
}

/** 공 틱이 있는 그림 — 그림자 · 꼬리선은 곧바로, 마구 이펙트 · 공은 목록에 */
function addPitchBallDraws(
  context: CanvasRenderingContext2D,
  drawList: StageDrawList,
  scene: StageScene,
  ball: { readonly pitch: Pitch; readonly ballTick: number; readonly depth: number; readonly isFlying: boolean },
): void {
  const { pitch, ballTick, depth } = ball
  const isPitchState = scene.stagePhase === undefined || scene.stagePhase.kind === '투구중'
  // 3b388~3b422 공 그림자 — 상태 0x11 에서만(0x12 는 3b406 에서 빠진다). 0x13 의 타구 공은 `addHitBallDraws`
  if (isPitchState) drawBallShadow(context, pitch, ballTick)
  drawPitchTrail(context, pitch, ballTick)
  // 마구 이펙트는 원본에서도 공 **다음**에 그려 공 위에 얹힌다 (0x3b422 공 → 0x3b546 이펙트 · 깊이 z + 1)
  if (ball.isFlying || scene.stagePhase?.kind === '투구중') {
    drawList.add(depth + MAGIC_EFFECT_DEPTH_STEP, () => drawMagicBallEffect(context, pitch, ballTick))
  }
  drawList.add(depth, () => drawBall(context, pitch, ballTick))
}

/**
 * 0x13 의 타구 공 — 0x3b2f4 를 0x33e34 가 다시 채운 경로(`hitBallPath`)로 돈다 (r274 직접 떴다):
 * ```
 * 3b310  P = 0x35820(공 틱)                 ; 경로 점 [clamp(틱, 0, N − 1)]
 * 3b35c  크기 = 0x358fc(P)                  ; 0x13 갈래 — trunc((P.z − 24500) · 10 / 5205) 를 [2, 9] 로 (`hitBallSizeOf`)
 * 3b388  공 틱 ≠ 0 이면 그림자 — 0x13 은 화면 아래 끝을 안 본다(3b406 → 3b40a)
 * 3b434  공 틱 ≤ N 이고 0x35988 · 0x357e0 이면 꼬리선 0x3b188(장면, 3, 0x8f, 0)
 * 3b472  0x13 이고 P.y == 0 이면 0xbbc85(공 화면 점, 0, 8) — 땅 파티클(웹은 타석 갱신이 쏜다 — `useStageAnimation`)
 * 3b6ac  공 그림 크기 + 11 × [+0x1080](0x13 진입 3d78e 가 0) 을 깊이 P.z 로 그리기 목록에 (0x11 만 보는 마구 이펙트 · 강속구 불꽃은 없다)
 * ```
 */
function addHitBallDraws(
  context: CanvasRenderingContext2D,
  drawList: StageDrawList,
  hitBall: NonNullable<StageScene['hitBall']>,
  side: number,
): void {
  const { path, ballTick, showsTrail } = hitBall
  const point = hitBallPointAt(path, ballTick)
  if (point === null) return
  const size = hitBallSizeOf(point)
  const shadow = ballShadowOfPoint(point, size, side, true, ballTick)
  if (shadow !== null) drawShadowPieces(context, shadow.x, shadow.y, shadow.size)
  const count = path.points.length
  if (showsTrail && trailsAt(ballTick, count)) {
    drawBallTrail(
      context,
      ballTrailLinesOf(HIT_BALL_TRAIL, ballTick, count, (index) => projectToScreen(path.points[index], side)),
    )
  }
  const position = projectToScreen(point, side)
  drawList.add(point.z, () => drawBallSprite(context, position, size))
}

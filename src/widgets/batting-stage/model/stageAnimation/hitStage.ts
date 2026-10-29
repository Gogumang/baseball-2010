/** 상태 0x13('타격')의 그림 몫 — 큰 타구 멈춤 016 · 땅에 닿은 타구 공 파티클 · 타구 공 · 타석 카메라 */
import { projectToScreen } from '@/entities/pitching/model/pitchCurve'
import { emitParticles } from '@/entities/particle/model/particleScene'
import { hitBallPointAt, hitBallTickOf } from '@/widgets/batting-stage/lib/hitBallPath'
import { BIG_HIT_PARTICLE, HIT_GROUND_PARTICLE } from '@/widgets/batting-stage/lib/hitParticles'
import { bigHitReleaseTickOf } from '@/widgets/batting-stage/lib/bigHitScreen'
import { hitCameraAt, stageCameraShiftOf, type StageCamera } from '@/widgets/batting-stage/lib/hitCamera'
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage'
import type { PendingHit } from '@/widgets/batting-stage/model/stageRefs'
import type { HitInStage, StageLoop } from '@/widgets/batting-stage/model/stageAnimation/stageLoop'
import { batterSideNow } from '@/widgets/batting-stage/model/stageAnimation/batterSide'

/** 큰 타구면 막음이 풀린 그림(`bigHitReleaseTickOf`, 상태 틱 앞 창 첫 그림까지 센다) — 아니면 null */
function releaseTickBefore(hit: HitInStage, stateTick: number): number | null {
  return hit.pending.watchesBigHit ? bigHitReleaseTickOf(hit.frozenDraws.filter((at) => at < stateTick)) : null
}

export function emitHitStopParticle(loop: StageLoop, pending: PendingHit): void {
  if (pending.bigHitAt === null) return
  emitParticles(
    loop.refs.particlesRef.current,
    loop.particleKit.configOf(BIG_HIT_PARTICLE.id),
    pending.bigHitAt.x,
    pending.bigHitAt.y,
    BIG_HIT_PARTICLE.img,
  )
}

/**
 * 0x13 그리기 0x4cb1c 4ccba~4cd14 — 큰 타구(+0x199a)면 공 틱이 0 인 그림마다 멈춤 셈 [+0x10a8](맞을 때 6)을 1 주고, 옛값이 −1 인
 * 여덟째 그림(상태 틱 7)이 막음을 풀며 공 자리에 016(id 15, 프레임 10)을 쏜다(`hitPause.HIT_STOP_TICKS`) — 이 틀의 파티클
 * 틱(53048) 앞이다. 0x13 이 틱 7 전에 끝나면(문턱 ≤ 0 · OK 건너뛰기) 안 쏜다
 */
export function drawHitStop(loop: StageLoop, pending: PendingHit, held: number, frozenDraws: readonly number[]): void {
  // 창이 선 첫 그림이 멈춤 셈을 더 줄였으면 막음이 그만큼 일찍 풀린다(`bigHitReleaseTickOf`)
  if (!pending.watchesBigHit || held < bigHitReleaseTickOf(frozenDraws) || loop.hitStopReleased === pending) return
  loop.hitStopReleased = pending
  emitHitStopParticle(loop, pending)
}

/** 장면 틱이 이번 0x13 안(선 틱 ~ 다음 상태 전)인가 */
function isInHitStage(hit: HitInStage, tick: number): boolean {
  return tick >= hit.startTick && (hit.endTick === null || tick < hit.endTick)
}

/**
 * 0x13 공 그리기 0x3b2f4 의 3b472~3b492 — 상태 0x13 이고 지금 경로 점(0x35820, `hitBallPath`)의 높이가 0 이면 공 화면 점 [sp+0x4c]
 * 에 0xbbc85(x, y, 0, 8) — 튐 파티클(001.ptc · ptcimg 8)과 같은 것이다. 장면 틱 `tick` 의 그림 몫(그 틀 끝 관리자 틱 앞).
 * 같은 그림 꼬리 4cd14 의 016(`drawHitStop`)과 한 그림에 겹치지 않는다 — 016 은 공 틱 0(타격점, 높이 > 0)의 그림이다
 */
export function emitHitGroundParticleAt(loop: StageLoop, tick: number): void {
  const hit = loop.hitInStage
  if (hit === null || !isInHitStage(hit, tick)) return
  const path = hit.pending.hitPath ?? null
  if (path === null) return
  const held = tick - hit.startTick
  const point = hitBallPointAt(path, hitBallTickOf(held, releaseTickBefore(hit, held)))
  if (point === null || point.y !== 0) return
  // [sp+0x4c] = 0x35854 — 투영 + (+0xff4, +0xff8): 이 그림의 0x13 카메라만큼 옮긴다
  const at = projectToScreen(point, batterSideNow(loop))
  const shift = stageCameraShiftOf(hitCameraNow(loop, hit, held))
  emitParticles(
    loop.refs.particlesRef.current,
    loop.particleKit.configOf(HIT_GROUND_PARTICLE.id),
    at.x + shift.dx,
    at.y + shift.dy,
    HIT_GROUND_PARTICLE.img,
  )
}

/** 0x13 그림의 타구 공 — 공 틱은 큰 타구면 막음이 풀린 그림(`bigHitReleaseTickOf`, 그 앞 창 첫 그림까지 센다)부터 오른다 */
export function hitBallNow(hit: HitInStage, sceneTick: number): StageScene['hitBall'] {
  const path = hit.pending.hitPath ?? null
  if (path === null) return null
  const stateTick = sceneTick - hit.startTick
  return { path, ballTick: hitBallTickOf(stateTick, releaseTickBefore(hit, stateTick)), showsTrail: hit.pending.showsHitTrail === true }
}

/**
 * 0x13 그림의 타석 카메라(0x3f060 3f1dc~3f2d8, `hitCamera`) — 막음이 풀린 다음 틀 머리부터 공을 따라간다. 창이 선 첫 그림은 틀 머리를
 * 안 돌아 마지막 갱신 틱의 자리다
 */
export function hitCameraNow(loop: StageLoop, hit: HitInStage, stateTick: number): StageCamera | null {
  const path = hit.pending.hitPath ?? null
  const angle = hit.pending.hitAngle ?? null
  if (path === null || angle === null) return null
  const releaseTick = releaseTickBefore(hit, stateTick)
  return hitCameraAt({ path, side: batterSideNow(loop), angle, releaseTick }, stateTick)
}

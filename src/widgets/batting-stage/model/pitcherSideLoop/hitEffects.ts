/** 맞은 공의 판정 틀 · 0x13 — 판정 굴림 · 타격 불꽃 · 016 · 땅 파티클 · 0x17 알림 */
import type { Pitch } from '@/entities/pitching/model/pitch'
import { projectToScreen } from '@/entities/pitching/model/pitchCurve'
import { HUMAN_PITCH_RELEASE_STATE_TICK, hitEndTickOf, pitcherHitContactOf } from '@/widgets/batting-stage/lib/pitcherSideStage'
import type { PitcherHitScene } from '@/widgets/batting-stage/lib/pitcherSideStage'
import { pitcherReleaseTicksOf } from '@/widgets/batting-stage/lib/stageScenery'
import { BIG_HIT_PARTICLE, HIT_GROUND_PARTICLE } from '@/widgets/batting-stage/lib/hitParticles'
import { hitBallPointAt, hitBallTickOf, type HitBallPath } from '@/widgets/batting-stage/lib/hitBallPath'
import { bigHitReleaseTickOf } from '@/widgets/batting-stage/lib/bigHitScreen'
import { hitCameraAt, stageCameraShiftOf } from '@/widgets/batting-stage/lib/hitCamera'
import { platePixelOf } from '@/widgets/batting-stage/lib/trajectory'
import type { PitcherSideLoop } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideLoop'
import type { PitcherSideFrame } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideFrame'

/** 0x13 의 이 틀 셈 — 0x13 틱(판정 틀 다음이 0) · 0x17 을 예약하는 0x13 틱 */
interface HitTicks {
  readonly hitTickRaw: number
  readonly endTick: number
}

export function applyHitEffects(loop: PitcherSideLoop, frame: PitcherSideFrame): void {
  const { hit, pitch, hitBase } = frame
  const releaseTick = loop.releaseTick
  if (hit === null || hitBase === null || pitch === null || releaseTick === null) return
  const stateTickNow = frame.nowTick - releaseTick + HUMAN_PITCH_RELEASE_STATE_TICK
  /** 판정 틀 J 의 0x11 상태 틱 — 그 틀의 갱신이 0x6aa 로 0x13 을 예약한다 */
  const judgeStateTick = pitcherReleaseTicksOf(frame.aceOrder) + hitBase.judgeBallTick
  if (stateTickNow >= judgeStateTick && !loop.marks.sparkShot) judgeHitAt(loop, frame, pitch, hitBase)
  const ticks: HitTicks = { hitTickRaw: stateTickNow - judgeStateTick - 1, endTick: hitEndTickOf(hit) }
  const judged = frame.hitBase ?? hitBase
  emitHitStopParticle(loop, judged, pitch, ticks)
  emitHitGroundParticles(loop, frame, judged, ticks)
  notifyHitSceneEnd(loop, frame, ticks)
}

/** 0x13 틱 endTick 의 갱신 0x406e8 이 0x17 을 예약 — 다음 틀(0x17 틱 0)에 부르는 화면이 수비 판으로 넘긴다 */
function notifyHitSceneEnd(loop: PitcherSideLoop, frame: PitcherSideFrame, ticks: HitTicks): void {
  if (ticks.hitTickRaw <= ticks.endTick || loop.marks.endNotified) return
  loop.marks.endNotified = true
  frame.current.onHitSceneEnd?.()
}

/**
 * 판정 틀의 갱신 — 0x51408 515c0 메시지 0x11(0x50faa: 필살수비 · 표시 패턴 · 판 공 51188 · [경기+0xf2c] 공 5174c 의 폴 굴림) ·
 * 필살타법 517e6 을 굴린 뒤 0x13 을 예약한다. 0x13 의 경로 · 이른 넘김 · 각 · 카메라 · 이 틀의 불꽃은 표시 패턴(+0xfcc)을 본다.
 * 그리기 0x49e64 가 타격점에 불꽃을 쏜다 (타자편 `BattingStage` 와 같은 근사 — 판정 순간에 쏜다). CPU 필살 스윙이 0x49aec 의 그림
 * 갈래를 타면 보통 불꽃 대신 필살 파티클이다(49fa2 → 4a0ce · 49dbc · 49de0 — `pitcherHitContactOf`)
 */
function judgeHitAt(loop: PitcherSideLoop, frame: PitcherSideFrame, pitch: Pitch, hitBase: PitcherHitScene): void {
  loop.marks.sparkShot = true
  const judged = frame.current.onHitJudged?.() ?? null
  if (judged !== null) {
    loop.marks.hit = judged
    frame.hitBase = judged
  }
  const contact = platePixelOf(pitch)
  const { current } = frame
  const chosen = pitcherHitContactOf(judged ?? hitBase, current.batterForm, current.aceBatterOrder ?? null, frame.side)
  for (const particle of chosen.particles) {
    loop.emitParticle(particle.id, contact.x, contact.y + particle.offsetY, particle.img)
  }
  loop.marks.specialEffect = chosen.effect === null ? null : { ...chosen.effect, x: contact.x, y: contact.y }
}

/**
 * 0x4cb1c 4ccba~4cd14 — 큰 타구 멈춤이 풀리는 0x13 그림(틱 7 — 창 첫 그림이 당긴다, `bigHitReleaseTickOf`)이 공 자리에 016 을
 * 쏜다. 그 전에 0x13 이 끝나면 안 쏜다. 창 첫 그림이 이미 풀었어도 다음 갱신 틀의 그림이 다시 공 틱 0 을 보고 한 번 더 쏜다
 */
function emitHitStopParticle(loop: PitcherSideLoop, hitBase: PitcherHitScene, pitch: Pitch, ticks: HitTicks): void {
  const hitStopTick = bigHitReleaseTickOf(loop.marks.frozenDraws)
  if (!hitBase.watchesBigHit || loop.marks.stopShot) return
  if (ticks.hitTickRaw < hitStopTick || ticks.endTick < hitStopTick) return
  loop.marks.stopShot = true
  const contact = platePixelOf(pitch)
  loop.emitParticle(BIG_HIT_PARTICLE.id, contact.x, contact.y, BIG_HIT_PARTICLE.img)
}

/**
 * 0x13 공 그리기 0x3b2f4 3b472 — 지금 경로 점(0x33e34 가 채운 `hitPath`)의 높이가 0 인 그림마다 공 자리에 0xbbc85(…, 0, 8)
 * (타자편 `useStageAnimation` 의 `emitHitGroundParticleAt` 과 같다). 016 은 공 틱 0(타격점, 높이 > 0)의 그림이라 겹치지 않는다
 */
function emitHitGroundParticles(loop: PitcherSideLoop, frame: PitcherSideFrame, hitBase: PitcherHitScene, ticks: HitTicks): void {
  const hitPath = hitBase.hitPath ?? null
  if (hitPath === null) return
  const last = Math.min(ticks.hitTickRaw, ticks.endTick)
  for (let tick = (loop.marks.groundEmittedTick ?? -1) + 1; tick <= last; tick += 1) {
    emitHitGroundAt(loop, hitBase, hitPath, frame.side, tick)
  }
  loop.marks.groundEmittedTick = Math.max(loop.marks.groundEmittedTick ?? -1, last)
}

function emitHitGroundAt(loop: PitcherSideLoop, hitBase: PitcherHitScene, path: HitBallPath, side: number, tick: number): void {
  const releaseTick = hitBase.watchesBigHit ? bigHitReleaseTickOf(loop.marks.frozenDraws.filter((at) => at < tick)) : null
  const point = hitBallPointAt(path, hitBallTickOf(tick, releaseTick))
  if (point === null || point.y !== 0) return
  // [sp+0x4c] = 0x35854 — 투영 + (+0xff4, +0xff8): 그 그림의 0x13 카메라만큼 옮긴다(`hitCamera`)
  const at = projectToScreen(point, side)
  const camera = hitBase.hitAngle === undefined ? null : hitCameraAt({ path, side, angle: hitBase.hitAngle, releaseTick }, tick)
  const shift = stageCameraShiftOf(camera)
  loop.emitParticle(HIT_GROUND_PARTICLE.id, at.x + shift.dx, at.y + shift.dy, HIT_GROUND_PARTICLE.img)
}

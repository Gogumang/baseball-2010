/**
 * 0x11 그림의 마구 공 파티클 — 공 그리기 0x3b2f4 3b496~3b62c(구질 22 · 투수 레코드 +0x18, `magicBallParticlesOf`). 0x11 그림마다
 * 공 틱 [+0x1098](0 ~ N − 1 로 자른 점 0x35854)에 쏜다 — 타자편 `useStageAnimation` 과 같은 셈. 그림 한 번 = 장면 틱 하나.
 * 놓기 전 0x11 그림(틱 0~9)은 게이지가 실은 구질 · 상태 틱으로 `windUpMagic` 이 앞 공 경로 자리에 쏜다(Q-09).
 * 갈래의 폼은 지금 투수 레코드 0xb6e25(3b528) — 사람 공에는 `pitcherForm` 칸이 없어 마운드 폼을 본다
 */
import type { Pitch } from '@/entities/pitching/model/pitch'
import { pitcherSideStageFrameOf } from '@/widgets/batting-stage/lib/pitcherSideStage'
import { magicBallParticlesOf } from '@/widgets/batting-stage/lib/magicBallEffect'
import { ballPixelAt } from '@/widgets/batting-stage/lib/trajectory'
import type { PitcherSideLoop } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideLoop'
import type { PitcherSideFrame } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideFrame'

export function emitFlightMagicParticles(loop: PitcherSideLoop, frame: PitcherSideFrame): void {
  const { pitch } = frame
  const releaseTick = loop.releaseTick
  if (pitch === null || releaseTick === null || pitch.isMagicPitch !== true) return
  const emitted = loop.marks.magicEmittedTick
  const from = emitted === null ? releaseTick : emitted + 1
  for (let tick = from; tick <= frame.nowTick; tick += 1) emitFlightMagicAt(loop, frame, pitch, releaseTick, tick)
  loop.marks.magicEmittedTick = Math.max(emitted ?? releaseTick - 1, frame.nowTick)
}

/** 장면 틱 하나의 그림 — 0x11 이면 그 공 틱 자리에 쏜다 */
function emitFlightMagicAt(loop: PitcherSideLoop, frame: PitcherSideFrame, pitch: Pitch, releaseTick: number, tick: number): void {
  const at = pitcherSideStageFrameOf({
    nowTick: tick,
    releaseTick,
    frameCount: pitch.frameCount,
    resultTicks: frame.heldResultTicks,
    isPaused: false,
    pausedSinceTick: 0,
    aceOrder: frame.aceOrder,
    hit: frame.hit,
  })
  if (at.phase.kind !== '투구중') return
  const ballTick = Math.max(0, at.ballFrame)
  const pitcherForm = pitch.pitcherForm ?? frame.current.pitcherForm
  const particles = magicBallParticlesOf({ ...pitch, pitcherForm }, ballTick, pitch.frameCount)
  if (particles.length === 0) return
  const point = ballPixelAt(pitch, ballTick)
  for (const particle of particles) loop.emitParticle(particle.id, point.x, point.y, particle.img)
}

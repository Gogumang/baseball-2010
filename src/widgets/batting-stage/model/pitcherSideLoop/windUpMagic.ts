/**
 * 놓기 전 0x11 그림의 마구 공 파티클 — 공 그림 0x3b2f4 의 3b496 갈래는 상태 0x11 이고 [경기+0xfc8] == 22 면 쏜다(3b4dc~3b4e4).
 * 구질은 0xf 가 적고 0x10 OK(0x50e9c)가 그 값으로 0x11 을 예약하므로 와인드업 그림(틱 0~9)에도 선다. 공 틱 [+0x1098] 은 0x11 진입이
 * 0 으로 두고 투수가 놓는 단계(≥ 11)에 닿아야 오르니 0 이고, 경로 칸 [+0x1140] 은 아직 앞 공의 것(장면 첫 공이면 0 채움 N = 0 —
 * `sceneBallPathPixelAt`, 타자편 A-26 과 같은 길). 갈래는 지금 투수 레코드 +0x18 · 폼 0xb6e25(3b4dc · 3b528). 0x11 틱 `upTo`(≤ 9)까지
 * 아직 안 쏜 그림 몫을 쏜다 — 그 틀 끝 관리자 틱(0x6de84) 앞이라 파티클이 늘면 관리자 틱의 굴림(경기 난수)도 그만큼 는다
 */
import type { Pitch } from '@/entities/pitching/model/pitch'
import { HUMAN_PITCH_RELEASE_STATE_TICK } from '@/widgets/batting-stage/lib/pitcherSideStage'
import { magicBallParticlesOf } from '@/widgets/batting-stage/lib/magicBallEffect'
import { sceneBallPathPixelAt } from '@/widgets/batting-stage/lib/trajectory'
import { sceneBallPathPitch } from '@/widgets/batting-stage/model/sceneBallPath'
import type { PitcherSideLoop, WindUpMagic } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideLoop'
import type { PitcherSideStageProps } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideProps'

/** 놓기 전 0x11 그림(틱 0~9)의 마구 공 파티클 — 게이지가 센 상태 틱까지(Q-09) */
export function emitWindUpMagicOfGauge(loop: PitcherSideLoop, current: PitcherSideStageProps): void {
  const gauge = magicGaugeOf(current)
  if (gauge === null) return
  const { overlay, stateTickRef } = gauge
  if (loop.windUpMagic?.stateTickRef !== stateTickRef) loop.windUpMagic = { stateTickRef, overlay, emittedStateTick: -1 }
  emitWindUpMagicUpTo(loop, stateTickRef.current)
}

/** 마구를 고른 게이지(0x11)가 서 있으면 그 게이지와 상태 틱 칸 — 칸을 든 것만 */
function magicGaugeOf(current: PitcherSideStageProps): Pick<WindUpMagic, 'overlay' | 'stateTickRef'> | null {
  const overlay = current.inputOverlayRef?.current ?? null
  if (overlay?.kind !== '게이지' || overlay.isMagicPitch !== true) return null
  const { stateTickRef } = overlay
  return stateTickRef === undefined ? null : { overlay, stateTickRef }
}

export function emitWindUpMagicUpTo(loop: PitcherSideLoop, upTo: number): void {
  const windUp = loop.windUpMagic
  if (windUp === null) return
  const last = Math.min(upTo, HUMAN_PITCH_RELEASE_STATE_TICK - 1)
  const path = sceneBallPathPitch()
  const current = loop.latestRef.current
  for (let stateTick = windUp.emittedStateTick + 1; stateTick <= last; stateTick += 1) emitWindUpMagicOnce(loop, windUp, current, path)
  windUp.emittedStateTick = Math.max(windUp.emittedStateTick, last)
}

/** 와인드업 그림 하나 — 공 틱 0 · 앞 공 경로 자리 */
function emitWindUpMagicOnce(loop: PitcherSideLoop, windUp: WindUpMagic, current: PitcherSideStageProps, path: Pitch | null): void {
  const particles = magicBallParticlesOf(
    { isMagicPitch: true, pitcherMagicNumber: current.pitcherMagicNumber ?? 0, pitcherForm: current.pitcherForm },
    0,
    path?.frameCount ?? 0,
  )
  const at = sceneBallPathPixelAt(path?.worldPath ?? null, 0, windUp.overlay.aimSide)
  for (const particle of particles) loop.emitParticle(particle.id, at.x, at.y, particle.img)
}

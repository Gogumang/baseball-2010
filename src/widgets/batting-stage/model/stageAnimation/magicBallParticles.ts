import { emitParticles } from '@/entities/particle/model/particleScene'
import { magicBallParticlesOf } from '@/widgets/batting-stage/lib/magicBallEffect'
import { sceneBallPathPixelAt } from '@/widgets/batting-stage/lib/trajectory'
import { ballFrameOf } from '@/widgets/batting-stage/model/stageRefs'
import { rememberSceneBallPath, sceneBallPathPitch } from '@/widgets/batting-stage/model/sceneBallPath'
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { StageLoop } from '@/widgets/batting-stage/model/stageAnimation/stageLoop'

/**
 * 0x11 그림의 마구 공 파티클(0x3b2f4 3b496~3b62c — `magicBallParticlesOf`) — 장면 틱 `tick` 의 그림 몫. 그 틀 끝 관리자 틱(0x6de84)
 * 앞이다. 파티클이 늘면 관리자 틱의 굴림(경기 난수)도 그만큼 는다 — 원본과 같은 차례.
 *
 * 공 경로 [경기+0x1140](점 N 개, N = [+0x109c])를 마지막으로 채운 공 — 놓기 0x4dc78 만 쓰므로 0x11 의 놓기 전 그림은 앞 공의 경로를
 * 본다(`magicBallParticlesOf` 의 자리 · N). 경로 칸은 경기 장면에 붙어 부품이 새로 서도 이어진다(`sceneBallPath`, r184).
 * 장면의 첫 공은 놓기 전 경로가 0 채움(N = 0)이라 0x35820 이 점 0 = (0, 0, 0) 을 내고 그 자리에 쏜다(`sceneBallPathPixelAt`, A-26)
 */
export function emitMagicBallParticlesAt(loop: StageLoop, tick: number): void {
  const pitch = flyingPitchAt(loop, tick)
  if (pitch === null) return
  const { phaseStartTickRef, latestRef, particlesRef } = loop.refs
  rememberSceneBallPath(pitch)
  // 아직 놓은 공이 없는 장면이면 0 채움 칸(N = 0) — 첫 공이 마구여도 그 칸 자리에 쏜다
  const path = sceneBallPathPitch()
  // 공 틱 [+0x1098] — 0x11 진입이 0 으로 두고 투수가 놓는 단계에 닿은 틀 끝부터 오른다(`ballFrameOf` 가 음수인 동안 0)
  const ballTick = Math.max(0, ballFrameOf(tick - phaseStartTickRef.current, latestRef.current.acePitcher?.order))
  const particles = magicBallParticlesOf(pitch, ballTick, path === null ? 0 : path.frameCount)
  if (particles.length === 0) return
  // [sp+0x4c] — 0x35854(공 틱) 은 경로를 0 ~ N − 1 로 잘라(위 먼저, N = 0 이면 점 0) 지금 타자 좌우 [+0x17e1] 로 투영한다
  const at = sceneBallPathPixelAt(path === null ? null : path.worldPath, ballTick, pitch.stageSide)
  for (const particle of particles) {
    emitParticles(particlesRef.current, loop.particleKit.configOf(particle.id), at.x, at.y, particle.img)
  }
}

/** 이 틱의 0x11 그림 공 — 0x11 이 아니거나 그 틱이 0x11 이 서기 전이면 null */
function flyingPitchAt(loop: StageLoop, tick: number): Pitch | null {
  const { pitchRef, phaseRef, phaseStartTickRef } = loop.refs
  const pitch = pitchRef.current
  if (phaseRef.current !== '투구중' || pitch === null || tick < phaseStartTickRef.current) return null
  return pitch
}

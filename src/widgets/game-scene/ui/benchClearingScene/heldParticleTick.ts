import type { RandomPort } from '@/shared/api/random/randomPort'
import { claimSceneParticleTick, sceneParticleScene } from '@/entities/particle/model/sceneParticleManager'
import { tickParticles } from '@/entities/particle/model/particleScene'
import { appTickOfGameSceneTick, gameSceneTickNow } from '@/shared/lib/commonWindow/commonWindow'

/**
 * 같은 틀의 프레임 끝 관리자 틱 0x6de85(53048) — 갱신 표(52e14) 뒤다. 앞 상태가 쏜 이미터가 남았으면 이 틀에 굴린다
 * (틱 10 이면 목표 굴림 8 번 뒤). 앱 층의 그림 시계(requestAnimationFrame)에 맡기면 같은 틀의 두 굴림 차례가 어느 시계가 먼저
 * 울리느냐에 달려 장면 갱신 바로 뒤에서 돌린다(`holdSceneParticleTicks`, r284). 공용 창이 서 있는 틀은 갱신과 함께 건너뛴다(52cc6 · 53048)
 */
export function rollHeldSceneParticleTick(random: RandomPort | undefined): void {
  const scene = sceneParticleScene()
  if (random === undefined || scene.emitters.length === 0) return
  if (!claimSceneParticleTick(scene, appTickOfGameSceneTick(gameSceneTickNow()))) return
  tickParticles(scene, random)
}

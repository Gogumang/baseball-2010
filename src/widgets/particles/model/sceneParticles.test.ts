import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

const catalog = JSON.parse(readFileSync('public/sprites/ptcimg/particles.json', 'utf8')) as {
  emitters: { callId: number; callable: boolean }[]
}

vi.mock('@/widgets/particles/lib/particleCatalog', () => ({
  particleConfigOf: (callId: number) => catalog.emitters.find((entry) => entry.callId === callId && entry.callable) ?? null,
}))
vi.mock('@/widgets/particles/lib/renderParticles', () => ({ preloadPtcParts: () => {} }))

const { emitMenuSparkle, resetSceneParticlesForTest, sceneParticleScene, tickSceneParticles } = await import(
  '@/widgets/particles/model/sceneParticles'
)

describe('장면 파티클 관리자 [0x1400068] — 마선수 오픈 · 레벨업 반짝이', () => {
  afterEach(() => resetSceneParticlesForTest())

  it('0xbbc85((W >> 1) − 0x3c, H >> 1, 2, 4) — (60, 160) 에 ptc/003 · 그림 4', () => {
    emitMenuSparkle()
    const [emitter] = sceneParticleScene().emitters
    expect(emitter).toMatchObject({ x: 60, y: 160, img: 4, total: 256 })
  })

  it('장면 틱마다 굴려 다 뿌리고 알이 다 지면 관리자가 지운다 (0x6de84)', () => {
    emitMenuSparkle()
    const random = createSeededRandom(7)
    let ticks = 0
    while (sceneParticleScene().emitters.length > 0 && ticks < 200) {
      tickSceneParticles(random)
      ticks += 1
    }
    expect(sceneParticleScene().emitters).toHaveLength(0)
    // 한 틱 25 ± 7 알 · 총 256 · 수명 9 ± 2 — 스무 틱 남짓
    expect(ticks).toBeGreaterThan(10)
    expect(ticks).toBeLessThan(40)
  })
})

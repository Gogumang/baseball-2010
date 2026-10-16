// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { markCommonWindowShown, resetCommonWindowShownForTest } from '@/shared/lib/commonWindow/commonWindow'

const catalog = JSON.parse(readFileSync('public/sprites/ptcimg/particles.json', 'utf8')) as {
  emitters: { callId: number; callable: boolean }[]
}

vi.mock('@/widgets/particles/lib/particleCatalog', () => ({
  particleConfigOf: (callId: number) => catalog.emitters.find((entry) => entry.callId === callId && entry.callable) ?? null,
}))
vi.mock('@/widgets/particles/lib/renderParticles', () => ({ preloadPtcParts: () => {}, drawParticles: () => {} }))

const { emitMenuSparkle, resetSceneParticlesForTest, sceneParticleScene } = await import('@/widgets/particles/model/sceneParticles')
const { SceneParticleLayer } = await import('@/widgets/particles/ui/SceneParticleLayer')

/** 굴린 수를 세는 난수 */
function countingRandom(): { readonly random: RandomPort; readonly count: () => number } {
  const inner = createSeededRandom(7)
  let rolls = 0
  return {
    random: {
      rand: (lo, hi) => {
        rolls += 1
        return inner.rand(lo, hi)
      },
      rand9d: (n) => {
        if (n > 0) rolls += 1
        return inner.rand9d(n)
      },
    },
    count: () => rolls,
  }
}

describe('SceneParticleLayer — 경기 장면 0x52c50 의 공용 창 게이트(53048)', () => {
  let frames: FrameRequestCallback[] = []
  beforeEach(() => {
    frames = []
    vi.spyOn(performance, 'now').mockReturnValue(0)
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback)
      return frames.length
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    // jsdom 에는 캔버스가 없다 — 그리기는 `drawParticles` 를 막아 두었으니 칠하기만 받는다
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    resetSceneParticlesForTest()
    resetCommonWindowShownForTest()
  })
  /** 쌓인 그림 콜백을 시각 `at` 으로 한 번 돌린다 */
  const 그림 = (at: number) => act(() => {
    const pending = frames
    frames = []
    for (const callback of pending) callback(at)
  })

  it('경기 장면에 공용 창이 떠 있으면 틱도 그림도 없다 — 창이 내려가면 다시 굴린다(따라잡지 않는다)', () => {
    emitMenuSparkle()
    const { random, count } = countingRandom()
    const release = markCommonWindowShown()
    const { container } = render(<SceneParticleLayer random={random} isGameScene />)
    그림(millisecondsPerFrame() * 3)
    expect(count()).toBe(0)
    expect((container.firstChild as HTMLElement).style.display).toBe('none')
    expect(sceneParticleScene().emitters).toHaveLength(1)

    release()
    그림(millisecondsPerFrame() * 4)
    // 창이 서 있던 세 틱은 버리고 한 틱만 돈다
    expect(count()).toBeGreaterThan(0)
    expect((container.firstChild as HTMLElement).style.display).toBe('')
  })

  it('경기 장면이 아니면(메뉴 0x32dd8 · 시즌 0xe9ac · 나리 0x1cdec · 미션 0x1eb0c) 창이 떠 있어도 굴린다', () => {
    emitMenuSparkle()
    const { random, count } = countingRandom()
    markCommonWindowShown()
    const { container } = render(<SceneParticleLayer random={random} />)
    그림(millisecondsPerFrame())
    expect(count()).toBeGreaterThan(0)
    expect((container.firstChild as HTMLElement).style.display).toBe('')
  })
})

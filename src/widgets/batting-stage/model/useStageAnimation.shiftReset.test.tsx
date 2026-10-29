// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { resetCommonWindowShownForTest } from '@/shared/lib/commonWindow/commonWindow'
import { DEFAULT_PITCHER_ABILITY } from '@/entities/pitching/model/pitch'
import { ROOKIE_BATTER_ABILITY } from '@/entities/batting/model/batter'
import { resetSceneParticlesForTest } from '@/widgets/particles/model/sceneParticles'
import { resetSceneResultCode } from '@/widgets/batting-stage/model/sceneResultCodeStore'
import { resetSceneCloudClock } from '@/widgets/batting-stage/model/sceneCloudClock'

/**
 * **좌우 이동 +0xfe4 는 0xd 진입(0x48d50 48f88)에서만 0 이 된다** — 리터럴 0xfe4 를 읽는 다섯 곳(3d504 · 48f7a · 49ef0 · 50f86 · 51250)
 * 가운데 쓰는 곳은 48f88(지움)과 키 50f86(±3) 둘뿐이다. 같은 타석의 다음 공은 0xae3e8 → 0xf 로 가 0xd 를 안 지나므로
 * 결과 연출로 쉬는 동안(`isPaused`)에도 이동이 남아야 한다.
 */
const 그린장면: StageScene[] = []
vi.mock('@/widgets/batting-stage/lib/renderBattingStage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/widgets/batting-stage/lib/renderBattingStage')>()
  return {
    ...actual,
    renderBattingStage: (_context: CanvasRenderingContext2D, scene: StageScene) => {
      그린장면.push(scene)
    },
    renderSettlementLayer: () => {},
  }
})

const { BattingStage } = await import('@/widgets/batting-stage/ui/BattingStage')

let frames = new Map<number, FrameRequestCallback>()
let nextHandle = 1
let clock = 0
beforeEach(() => {
  frames = new Map()
  clock = 0
  그린장면.length = 0
  vi.spyOn(performance, 'now').mockImplementation(() => clock)
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    const handle = nextHandle
    nextHandle += 1
    frames.set(handle, callback)
    return handle
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((handle) => void frames.delete(handle))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    return new Proxy({ canvas: this } as object, {
      get: (target, key) => (key in target ? (target as Record<string | symbol, unknown>)[key] : () => undefined),
      set: () => true,
    }) as never
  })
  resetSceneParticlesForTest()
  resetSceneResultCode()
  resetCommonWindowShownForTest()
  resetSceneCloudClock()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

let at = 0
/** 그림 n 장 — 한 장마다 경기 틱 하나 남짓 */
const 그림들 = (count: number) => {
  for (let index = 0; index < count; index += 1) {
    at += millisecondsPerFrame() + 0.37
    act(() => {
      clock = at
      const pending = [...frames.values()]
      frames = new Map()
      for (const callback of pending) callback(at)
    })
  }
}

const 이동 = () => 그린장면.at(-1)?.shift

describe('좌우 이동 +0xfe4 — 0xd 진입 48f88 에서만 지운다 (A-02)', () => {
  it('결과 연출로 쉬었다가(isPaused) 다시 던져도 이동이 남고, 0xd 번호가 바뀌면 그때 0 이 된다', () => {
    at = 0
    const props = {
      batterAbility: ROOKIE_BATTER_ABILITY,
      pitcherAbility: DEFAULT_PITCHER_ABILITY,
      isEagleEyeEnabled: false,
      hud: null,
      acePitcher: null,
      skyRow: 2,
      random: createSeededRandom(20101016),
      onPitchResolved: vi.fn(),
    } as const
    const { rerender } = render(<BattingStage {...props} isPaused={false} />)
    그림들(3)
    // 0xf · 0x10 에서 '6' — 0x50f86 이 +3
    act(() => void fireEvent.keyDown(window, { key: '6' }))
    그림들(1)
    act(() => void fireEvent.keyUp(window, { key: '6' }))
    그림들(2)
    expect(이동()).toBe(3)

    // 결과 연출 동안 쉰다 — 같은 타석이면 다음 공은 0xf 로 곧장 간다(0xd 없음)
    rerender(<BattingStage {...props} isPaused />)
    그림들(20)
    rerender(<BattingStage {...props} isPaused={false} />)
    그림들(5)
    expect(이동()).toBe(3)

    // 새 타석 — 0xd 진입 번호가 오르면 48f88 이 지운다
    rerender(<BattingStage {...props} isPaused={false} shiftResetSerial={1} />)
    그림들(2)
    expect(이동()).toBe(0)
  })
})

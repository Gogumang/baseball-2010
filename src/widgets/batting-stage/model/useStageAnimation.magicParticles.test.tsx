// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { resetCommonWindowShownForTest } from '@/shared/lib/commonWindow/commonWindow'
import { ROOKIE_BATTER_ABILITY } from '@/entities/batting/model/batter'
import { resetSceneParticlesForTest } from '@/widgets/particles/model/sceneParticles'
import { resetSceneResultCode } from '@/widgets/batting-stage/model/sceneResultCodeStore'
import { resetSceneCloudClock } from '@/widgets/batting-stage/model/sceneCloudClock'
import { resetSceneBallPath } from '@/widgets/batting-stage/model/sceneBallPath'

/**
 * **0x11 마구 공 파티클이 그림마다 한 번씩 나가는가** — 홈런더비(모드 7)에 마구 22 를 넘기면 0x344ea 가 구질을 안 굴리고 늘 22 다.
 * 마구 번호 2 투수면 0x3b4fa 가 0x11 그림마다 id 0x15 · img 15 를 공 자리에 쏜다 — 틱마다 꼭 한 번(rAF 가 틱 하나에 네 번 돌아도).
 */
const 그린장면: StageScene[] = []
vi.mock('@/widgets/batting-stage/lib/renderBattingStage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/widgets/batting-stage/lib/renderBattingStage')>()
  return {
    ...actual,
    renderBattingStage: (_context: CanvasRenderingContext2D, scene: StageScene) => void 그린장면.push(scene),
    renderSettlementLayer: () => {},
  }
})
const catalog = JSON.parse(readFileSync('public/sprites/ptcimg/particles.json', 'utf8')) as {
  emitters: { callId: number; callable: boolean }[]
}
vi.mock('@/widgets/particles/lib/particleCatalog', () => ({
  particleConfigOf: (callId: number) => catalog.emitters.find((entry) => entry.callId === callId && entry.callable) ?? null,
}))
const 쏜것: { callId: number; img: number }[] = []
vi.mock('@/entities/particle/model/particleScene', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/entities/particle/model/particleScene')>()
  return {
    ...actual,
    emitParticles: (...args: Parameters<typeof actual.emitParticles>) => {
      const config = args[1] as { callId?: number } | null
      쏜것.push({ callId: config?.callId ?? -1, img: args[4] })
      return actual.emitParticles(...args)
    },
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
  쏜것.length = 0
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
  resetSceneBallPath()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const 그림 = (at: number) =>
  act(() => {
    clock = at
    const pending = [...frames.values()]
    frames = new Map()
    for (const callback of pending) callback(at)
  })

const 타석 = () => (
  <BattingStage
    batterAbility={ROOKIE_BATTER_ABILITY}
    pitcherAbility={{ control: 60, velocity: 60, repertoire: { form: 0, pitchMask: 1, magicId: 2 } }}
    isEagleEyeEnabled={false}
    hud={null}
    acePitcher={null}
    isPaused={false}
    skyRow={2}
    gameMode={7}
    derbyPitchType={22}
    random={createSeededRandom(7)}
    onPitchResolved={vi.fn()}
  />
)

describe('0x11 마구 공 파티클 (0x3b2f4 3b4fa)', () => {
  it('경로 칸 [경기+0x1140] 은 장면에 붙는다 — 부품이 다시 서도 첫 공의 놓기 전 틱이 앞 공 경로 자리에 쏜다 (r184)', () => {
    const 간격 = millisecondsPerFrame() / 4 + 0.37
    const first = render(타석())
    for (let index = 1; index <= 600; index += 1) 그림(index * 간격)
    first.unmount()
    쏜것.length = 0
    그린장면.length = 0
    render(타석())
    for (let index = 601; index <= 1200; index += 1) 그림(index * 간격)
    const 마구 = 쏜것.filter((call) => call.callId === 0x15)
    const 투구틱 = new Set(그린장면.filter((scene) => scene.stagePhase?.kind === '투구중').map((scene) => scene.tick))
    expect(투구틱.size).toBeGreaterThan(10)
    expect(마구.length).toBe(투구틱.size)
  })

  it('마구 번호 2 — 0x11 틱마다 id 0x15 · img 15 를 한 번씩, 0x11 밖에서는 안 쏜다', () => {
    render(
      <BattingStage
        batterAbility={ROOKIE_BATTER_ABILITY}
        pitcherAbility={{ control: 60, velocity: 60, repertoire: { form: 0, pitchMask: 1, magicId: 2 } }}
        isEagleEyeEnabled={false}
        hud={null}
        acePitcher={null}
        isPaused={false}
        skyRow={2}
        gameMode={7}
        derbyPitchType={22}
        random={createSeededRandom(7)}
        onPitchResolved={vi.fn()}
      />,
    )
    const 간격 = millisecondsPerFrame() / 4 + 0.37
    for (let index = 1; index <= 600; index += 1) 그림(index * 간격)
    const 마구 = 쏜것.filter((call) => call.callId === 0x15)
    expect(마구.length).toBeGreaterThan(0)
    expect(마구.every((call) => call.img === 15)).toBe(true)
    // 0x11 에 머문 틱 수와 같다 — 틱마다 꼭 한 번. 첫 공의 놓기(0x11 틱 10) 전 열 틱도 0 채움 경로 칸(N = 0 → 점 0)에 쏜다 (A-26)
    const 투구틱 = new Set(그린장면.filter((scene) => scene.stagePhase?.kind === '투구중').map((scene) => scene.tick))
    expect(마구.length).toBe(투구틱.size)
  })
})

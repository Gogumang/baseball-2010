// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { setDrawMemoBypassForTest } from '@/shared/lib/canvas/drawMemo'
import { markCommonWindowShown, markGameSceneUp, resetCommonWindowShownForTest } from '@/shared/lib/commonWindow/commonWindow'
import { DEFAULT_PITCHER_ABILITY } from '@/entities/pitching/model/pitch'
import { ROOKIE_BATTER_ABILITY } from '@/entities/batting/model/batter'
import { particleSignatureOf } from '@/widgets/particles/lib/particleSignature'
import { resetSceneParticlesForTest } from '@/widgets/particles/model/sceneParticles'
import { resetSceneResultCode } from '@/widgets/batting-stage/model/sceneResultCodeStore'
import { resetSceneCloudClock } from '@/widgets/batting-stage/model/sceneCloudClock'

/**
 * **창이 선 첫 그림([창+0x250])** — 52efe 가 갱신 없이 그리기 표를 한 번 더 돌아 그리기 쪽 애니(0x93d91)가 한 칸 더 간다(r178,
 * `stageRedraws`). 타자편 타석이 그 그림을 한 번 그리고 그 틱을 그림 입력에 남기는지 본다.
 */
const 그린입력: string[] = []
const 그린장면: StageScene[] = []
vi.mock('@/widgets/batting-stage/lib/renderBattingStage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/widgets/batting-stage/lib/renderBattingStage')>()
  return {
    ...actual,
    renderBattingStage: (_context: CanvasRenderingContext2D, scene: StageScene) => {
      그린입력.push(JSON.stringify({ ...scene, particles: particleSignatureOf(scene.particles) }))
      그린장면.push(scene)
    },
    renderSettlementLayer: () => {},
  }
})

// 파티클 설정은 늦게 받는다 — 시험은 파일을 바로 읽어 연출(타구 · 홈런 파티클)이 실제로 돌게 한다
const catalog = JSON.parse(readFileSync('public/sprites/ptcimg/particles.json', 'utf8')) as {
  emitters: { callId: number; callable: boolean }[]
}
vi.mock('@/widgets/particles/lib/particleCatalog', () => ({
  particleConfigOf: (callId: number) => catalog.emitters.find((entry) => entry.callId === callId && entry.callable) ?? null,
}))

const { BattingStage } = await import('@/widgets/batting-stage/ui/BattingStage')

/** 걸린 그림 콜백 — 내린 화면의 루프가 남지 않게 cancelAnimationFrame 도 받는다 */
let frames = new Map<number, FrameRequestCallback>()
let nextHandle = 1
let clock = 0
beforeEach(() => {
  frames = new Map()
  clock = 0
  그린입력.length = 0
  그린장면.length = 0
  vi.spyOn(performance, 'now').mockImplementation(() => clock)
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    const handle = nextHandle
    nextHandle += 1
    frames.set(handle, callback)
    return handle
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((handle) => void frames.delete(handle))
  // jsdom 에는 캔버스가 없다 — 그리기 함수는 막아 두었으니 아무 일도 안 하는 붓을 준다
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
  setDrawMemoBypassForTest(false)
})

/** 쌓인 그림 콜백을 시각 `at` 으로 한 번 돌린다 */
const 그림 = (at: number) =>
  act(() => {
    clock = at
    const pending = [...frames.values()]
    frames = new Map()
    for (const callback of pending) callback(at)
  })

const 틀간격 = () => millisecondsPerFrame() / 4 + 0.37

describe('타자편 타석 — 창이 선 첫 그림 (r178)', () => {
  it('창이 서면 마지막 틱 자리를 그림 입력(redrawTicks)에 남겨 한 번 다시 그리고, 닫힌 앱 틱 동안은 그 그림을 그대로 둔다', () => {
    const 장면내림 = markGameSceneUp()
    render(
      <BattingStage
        batterAbility={ROOKIE_BATTER_ABILITY}
        pitcherAbility={DEFAULT_PITCHER_ABILITY}
        isEagleEyeEnabled={false}
        hud={null}
        acePitcher={null}
        isPaused={false}
        skyRow={2}
        random={createSeededRandom(20101016)}
        onPitchResolved={vi.fn()}
      />,
    )
    let index = 1
    for (; index <= 40; index += 1) 그림(index * 틀간격())
    const 앞마지막 = 그린장면.at(-1)
    expect(앞마지막?.redrawTicks).toEqual([])
    const 창내림 = markCommonWindowShown()
    const 앞수 = 그린장면.length
    for (; index <= 80; index += 1) 그림(index * 틀간격())
    const 창그림 = 그린장면.slice(앞수)
    expect(창그림).toHaveLength(1)
    expect(창그림[0]?.tick).toBe(앞마지막?.tick)
    expect(창그림[0]?.redrawTicks).toEqual([앞마지막?.tick])
    act(() => 창내림())
    for (; index <= 120; index += 1) 그림(index * 틀간격())
    const 뒤 = 그린장면.slice(앞수 + 1)
    expect(뒤.length).toBeGreaterThan(0)
    // 창 첫 그림의 틱은 다시 안 그리고, 뒤 그림은 그 자리를 이어 싣는다
    expect(뒤.every((scene) => scene.tick !== 앞마지막?.tick)).toBe(true)
    expect(뒤.every((scene) => scene.redrawTicks?.length === 1)).toBe(true)
    장면내림()
  })
})

// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { markGameSceneUp, resetCommonWindowShownForTest } from '@/shared/lib/commonWindow/commonWindow'
import { DEFAULT_PITCHER_ABILITY } from '@/entities/pitching/model/pitch'
import type { Pitch } from '@/entities/pitching/model/pitch'
import { ROOKIE_BATTER_ABILITY } from '@/entities/batting/model/batter'
import { resetSceneParticlesForTest } from '@/widgets/particles/model/sceneParticles'
import { resetSceneResultCode } from '@/widgets/batting-stage/model/sceneResultCodeStore'
import { resetSceneCloudClock } from '@/widgets/batting-stage/model/sceneCloudClock'

/**
 * **보이던 공 틱 v 에서 누른 스윙 키의 판정 틱 F = v + 1** (r209 회귀 시험).
 *
 * 원본 경기 장면 0x52c50 은 한 틀에 키(0x498d4) → 갱신(0x4e060) → 메시지(0x51db6 이 +0xfd8 = 공 틱 +0x1098) → 그리기 → 0x3f378(공 틱 +1)
 * 차례라, 틱 v 로 그린 그림을 보고 누른 키는 다음 틀에서 F = v + 1 로 적힌다(`swingWindow.keyTickOf`). 타이밍 0x34be0 은 |F − (N − 2)| 로
 * 깎으므로 F 가 한 틱 밀리면 맞힐 확률(0xab214 의 contact ∝ 타이밍)이 크게 준다. 키 칸(`sceneKeyLatch`) · 틱 시계 · 미리 칠하기가
 * 바뀌어도 이 관계가 그대로인지 화면 부품 전체(키 → 루프 → 판정)를 돌려 본다.
 */
const drawn: { frame: number; pitch: Pitch | null }[] = []
vi.mock('@/widgets/batting-stage/lib/renderBattingStage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/widgets/batting-stage/lib/renderBattingStage')>()
  return {
    ...actual,
    renderBattingStage: (_context: CanvasRenderingContext2D, scene: { frame: number; pitch: Pitch | null }) =>
      void drawn.push({ frame: scene.frame, pitch: scene.pitch }),
    renderSettlementLayer: () => {},
  }
})
const catalog = JSON.parse(readFileSync('public/sprites/ptcimg/particles.json', 'utf8')) as {
  emitters: { callId: number; callable: boolean }[]
}
vi.mock('@/widgets/particles/lib/particleCatalog', () => ({
  particleConfigOf: (callId: number) => catalog.emitters.find((entry) => entry.callId === callId && entry.callable) ?? null,
}))
/** 판정에 들어간 스윙 — 키 틱 F 와 공의 N */
const judged: { frame: number; frameCount: number }[] = []
vi.mock('@/features/play-at-bat/model/resolvePitch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/play-at-bat/model/resolvePitch')>()
  return {
    ...actual,
    resolvePitch: (...args: Parameters<typeof actual.resolvePitch>) => {
      const [pitch, swing] = args
      if (swing !== null) judged.push({ frame: swing.frame, frameCount: pitch.frameCount })
      return actual.resolvePitch(...args)
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
  drawn.length = 0
  judged.length = 0
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

const 그림 = (at: number) =>
  act(() => {
    clock = at
    const pending = [...frames.values()]
    frames = new Map()
    for (const callback of pending) callback(at)
  })

describe('타자편 스윙 키 틱 — F = 보이던 공 틱 + 1 (0x52c50 차례 · 0x51db6)', () => {
  it.each([3, 2, 4])('공 끝에서 %i 틱 앞 그림을 보고 누르면 판정 F 는 그 틱 + 1', (back) => {
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
        random={createSeededRandom(20101025 + back)}
        onPitchResolved={vi.fn()}
      />,
    )
    const 틀간격 = millisecondsPerFrame() / 4 + 0.37
    let 본틱: number | null = null
    for (let index = 1; index < 2000 && judged.length === 0; index += 1) {
      그림(index * 틀간격)
      const last = drawn.at(-1)
      if (본틱 === null && last?.pitch && last.frame >= 0 && last.frame === last.pitch.frameCount - back) {
        본틱 = last.frame
        act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' })))
      }
    }
    expect(본틱).not.toBeNull()
    expect(judged).toHaveLength(1)
    expect(judged[0].frame).toBe((본틱 ?? 0) + 1)
    장면내림()
  })
})

// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { PRESENT_DELAY_MS } from '@/shared/lib/sceneKeyLatch/shownSceneTicks'
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
        // 그 그림이 화면에 나온(다음 화면 갱신, r406) 뒤에 누른다
        clock += PRESENT_DELAY_MS
        act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' })))
      }
    }
    expect(본틱).not.toBeNull()
    expect(judged).toHaveLength(1)
    expect(judged[0].frame).toBe((본틱 ?? 0) + 1)
    장면내림()
  })
})

/**
 * **그리기 · 키 손잡이가 밀려도 F = 누를 때 보이던 공 틱 + 1** (r211 — 웹판 전용 지연).
 *
 * 원본은 키를 받은 틀이 마지막으로 그린 틀이다. 웹의 장면 틱은 실제 시각에서 세므로, 그리기가 밀리면(느린 기기 · 30Hz 절전) 시각으로는
 * 다음 틱인데 화면은 앞 그림이고, 주 스레드가 바쁘면 키 손잡이가 새 그림 뒤에 돈다. 손잡이 때의 시각 틱으로 세면 한두 틱 늦게 누른 것이
 * 된다(headless 측정: 그리기 50ms 막힘에서 60% 가 두 틱 늦음). 키는 사건 시각 앞에 마지막으로 그린 그림의 틱으로 센다(`shownSceneTicks`).
 */
describe('타자편 스윙 키 틱 — 그리기가 밀려도 사람이 본 그림으로 센다 (r211)', () => {
  const 띄우기 = (seed: number) =>
    render(
      <BattingStage
        batterAbility={ROOKIE_BATTER_ABILITY}
        pitcherAbility={DEFAULT_PITCHER_ABILITY}
        isEagleEyeEnabled={false}
        hud={null}
        acePitcher={null}
        isPaused={false}
        skyRow={2}
        random={createSeededRandom(seed)}
        onPitchResolved={vi.fn()}
      />,
    )
  /** 키 사건 — 사건 시각(`timeStamp`)을 `pressedAt` 으로 */
  const 키 = (pressedAt: number) => {
    const event = new KeyboardEvent('keydown', { key: ' ' })
    Object.defineProperty(event, 'timeStamp', { value: pressedAt })
    act(() => void window.dispatchEvent(event))
  }
  /** 공 끝 `back` 틱 앞 그림이 설 때까지 틀을 그린다 — 그 그림을 그린 시각을 돌려준다 */
  const 그때까지 = (back: number, 틀간격: number) => {
    for (let index = 1; index < 2000; index += 1) {
      const at = index * 틀간격
      그림(at)
      const last = drawn.at(-1)
      if (last?.pitch && last.frame >= 0 && last.frame === last.pitch.frameCount - back) return { at, frame: last.frame }
    }
    throw new Error('공이 안 섰다')
  }
  const 틱 = millisecondsPerFrame()

  it('그림이 밀려 시각으로는 한두 틱 뒤에 눌러도 — F 는 화면에 있던 공 틱 + 1', () => {
    const 장면내림 = markGameSceneUp()
    띄우기(20101025 + 3)
    const 틀간격 = 틱 / 4 + 0.37
    const 본 = 그때까지(3, 틀간격)
    // 다음 그림이 1.6 틱 동안 안 온다(그리기 밀림) — 그 사이 누른다. 손잡이 때의 시각 틱은 본 틱보다 1 뒤다
    clock = 본.at + 틱 * 1.6
    키(clock)
    for (let index = 1; index < 200 && judged.length === 0; index += 1) 그림(clock + index * 틀간격)
    expect(judged).toHaveLength(1)
    expect(judged[0].frame).toBe(본.frame + 1)
    장면내림()
  })

  it('누른 뒤 손잡이가 새 그림보다 늦게 돌아도(주 스레드 막힘) — 누를 때 보이던 그림의 틱으로 센다', () => {
    const 장면내림 = markGameSceneUp()
    띄우기(20101025 + 2)
    // 30Hz 쯤 — 한 틀이 틱 반
    const 틀간격 = 틱 / 2 + 0.37
    const 본 = 그때까지(3, 틀간격)
    const 누른때 = 본.at + PRESENT_DELAY_MS + 1
    // 키 사건이 줄에 선 사이 다음 그림(본 틱 + 1)이 먼저 섰다
    그림(본.at + 틱 + 0.5)
    expect(drawn.at(-1)?.frame).toBe(본.frame + 1)
    clock = 본.at + 틱 + 3
    키(누른때)
    for (let index = 1; index < 200 && judged.length === 0; index += 1) 그림(clock + index * 틀간격)
    expect(judged).toHaveLength(1)
    expect(judged[0].frame).toBe(본.frame + 1)
    장면내림()
  })

  it('그린 직후 다음 화면 갱신 전에 누른 키는 앞 그림 틱으로 센다 — 새 그림은 아직 화면에 안 나왔다 (r406)', () => {
    const 장면내림 = markGameSceneUp()
    띄우기(20101025 + 2)
    const 틀간격 = 틱 / 2 + 0.37
    const 본 = 그때까지(3, 틀간격)
    clock = 본.at + 1
    키(clock)
    for (let index = 1; index < 200 && judged.length === 0; index += 1) 그림(clock + index * 틀간격)
    expect(judged).toHaveLength(1)
    expect(judged[0].frame).toBe(본.frame)
    장면내림()
  })
})

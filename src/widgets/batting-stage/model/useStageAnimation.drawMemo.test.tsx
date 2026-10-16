// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { setDrawMemoBypassForTest } from '@/shared/lib/canvas/drawMemo'
import { noteAssetLoaded } from '@/shared/lib/sprite/assetLoadVersion'
import { resetCommonWindowShownForTest } from '@/shared/lib/commonWindow/commonWindow'
import { DEFAULT_PITCHER_ABILITY } from '@/entities/pitching/model/pitch'
import type { Pitch } from '@/entities/pitching/model/pitch'
import { ROOKIE_BATTER_ABILITY } from '@/entities/batting/model/batter'
import { particleSignatureOf } from '@/widgets/particles/lib/particleSignature'
import { emitMenuSparkle, resetSceneParticlesForTest } from '@/widgets/particles/model/sceneParticles'
import { resetSceneResultCode } from '@/widgets/batting-stage/model/sceneResultCodeStore'
import { resetSceneCloudClock } from '@/widgets/batting-stage/model/sceneCloudClock'

/**
 * **그림 건너뛰기(`createDrawMemo`)가 화면을 안 바꾸는가** — 같은 씨앗 · 같은 키 · 같은 rAF 시각(틱 하나에 네 번)으로 두 번 돌린다.
 * 한 번은 건너뛰기를 끄고(틀마다 그림 = 예전 동작), 한 번은 켠다. 그리기 함수는 넘긴 입력만으로 그림이 정해지므로(재료 로딩 제외)
 * 틀마다 "캔버스에 남은 마지막 그림의 입력"이 두 번 사이에 같으면 화면이 같다. 그리기를 부른 입력을 값으로 떠서 견준다.
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
const { PitcherSideStage } = await import('@/widgets/batting-stage/ui/PitcherSideStage')

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

/** 틀마다 그 틀 뒤 캔버스에 남은 그림의 입력 */
interface 돌림 {
  readonly 틀마다: readonly string[]
  readonly 그린수: number
  readonly 장면: readonly StageScene[]
}

const 틀수 = 1200
/** 틱 하나에 rAF 네 번(60Hz 화면 · 16/s 원본 틱) — 틱 경계와 어긋나게 조금 비튼다 */
const 틀간격 = () => millisecondsPerFrame() / 4 + 0.37

function 타석돌리기(bypass: boolean): 돌림 {
  setDrawMemoBypassForTest(bypass)
  // 구름 셈은 경기 장면 하나 동안 남는다 — 두 번 돌리는 사이 장면을 새로 세운 것으로 본다
  resetSceneCloudClock()
  clock = 0
  그린입력.length = 0
  그린장면.length = 0
  const onPitchResolved = vi.fn()
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
      onPitchResolved={onPitchResolved}
    />,
  )
  const 틀마다: string[] = []
  let swings = 0
  let lastSwingPitch: Pitch | null = null
  for (let index = 1; index <= 틀수; index += 1) {
    // 스윙 키 — 공마다 다른 틱에 누른다(맞은 공 · 헛스윙 · 그냥 보낸 공이 섞인다)
    // 캔버스에 남은 그림(두 번 사이에 같아야 하는 값)으로 공이 타자 앞에 온 틱을 보고 누른다 — 공마다 한 틱씩 비켜 맞은 공도 나온다
    const shown = 그린장면.at(-1)
    if (shown?.pitch != null && shown.frame === shown.pitch.frameCount - 2 - (swings % 4) && lastSwingPitch !== shown.pitch) {
      lastSwingPitch = shown.pitch
      swings += 1
      act(() => void fireEvent.keyDown(window, { key: '5' }))
    }
    if (index % 211 === 0) act(() => void fireEvent.keyDown(window, { key: '6' }))
    // 틀 사이(React · 키 자리)에 파티클 관리자를 고쳐 쓴다 — 제자리에서 고치는 객체도 모습으로 견주는지
    if (index % 180 === 30) emitMenuSparkle()
    그림(index * 틀간격())
    틀마다.push(그린입력.at(-1) ?? '')
  }
  cleanup()
  resetSceneParticlesForTest()
  resetSceneResultCode()
  resetCommonWindowShownForTest()
  return { 틀마다, 그린수: 그린입력.length, 장면: [...그린장면] }
}

describe('그림 건너뛰기 — 타석(useStageAnimation)', () => {
  it('틀마다 캔버스에 남은 그림이 건너뛰기 전과 같고, 그리기는 틱 수 언저리로 준다', () => {
    const 전 = 타석돌리기(true)
    const 후 = 타석돌리기(false)
    expect(전.그린수).toBe(틀수)
    // 공이 실제로 날았는지(시험이 빈 장면만 견주지 않게)
    expect(전.장면.some((scene) => scene.pitch !== null && scene.frame >= 0)).toBe(true)
    expect(new Set(전.틀마다).size).toBeGreaterThan(50)
    // 맞은 공 · 파티클도 지나갔는지
    expect(전.장면.some((scene) => scene.stagePhase?.kind === '타격')).toBe(true)
    expect(전.틀마다.some((drawn) => /"particles":\[\d/.test(drawn))).toBe(true)
    for (let index = 0; index < 틀수; index += 1) {
      if (후.틀마다[index] !== 전.틀마다[index]) throw new Error(`틀 ${index} 의 그림이 다르다`)
    }
    // 틀 넷에 틱 하나 — 단계 시작 시각이 틀 시각이라 시계가 여럿이어도 틱 수의 두 배를 넘지 않는다
    expect(후.그린수).toBeLessThan(틀수 / 2)
    expect(후.그린수).toBeGreaterThanOrEqual(new Set(전.틀마다).size)
  })

  it('그림 재료가 실리면 입력이 같아도 다시 그린다', () => {
    render(
      <BattingStage
        batterAbility={ROOKIE_BATTER_ABILITY}
        pitcherAbility={DEFAULT_PITCHER_ABILITY}
        isEagleEyeEnabled={false}
        hud={null}
        acePitcher={null}
        isPaused
        skyRow={2}
        random={createSeededRandom(1)}
        onPitchResolved={vi.fn()}
      />,
    )
    // 쉬는 동안 같은 틱 안의 틀은 입력이 같다
    그림(1)
    const 처음 = 그린입력.length
    expect(처음).toBe(1)
    그림(2)
    expect(그린입력.length).toBe(처음)
    noteAssetLoaded()
    그림(3)
    expect(그린입력.length).toBe(처음 + 1)
    expect(그린입력.at(-1)).toBe(그린입력.at(-2))
  })

  it('캔버스 크기를 다시 매기면(캔버스가 지워진다) 다시 그린다', () => {
    const { container } = render(
      <BattingStage
        batterAbility={ROOKIE_BATTER_ABILITY}
        pitcherAbility={DEFAULT_PITCHER_ABILITY}
        isEagleEyeEnabled={false}
        hud={null}
        acePitcher={null}
        isPaused
        skyRow={2}
        random={createSeededRandom(1)}
        onPitchResolved={vi.fn()}
      />,
    )
    그림(1)
    그림(2)
    const 앞 = 그린입력.length
    const canvas = container.querySelector('canvas')!
    canvas.width = canvas.width + 1
    그림(3)
    expect(그린입력.length).toBe(앞 + 1)
  })
})

describe('그림 건너뛰기 — 투수편(PitcherSideStage)', () => {
  function 투수편돌리기(bypass: boolean, pitch: Pitch): readonly string[] {
    setDrawMemoBypassForTest(bypass)
    resetSceneCloudClock()
    clock = 0
    그린입력.length = 0
    const props = {
      resolution: null,
      resultTicks: 16,
      hud: null,
      batterForm: 0,
      batterSkinIndex: 0,
      batterTeamIndex: 0,
      pitcherForm: 0,
      pitcherHand: 0,
      stadium: 0,
      fieldPalette: null,
      skyRow: 1,
      gameMode: 5,
      isPaused: false,
    } as const
    const { rerender } = render(<PitcherSideStage {...props} pitch={null} />)
    const 틀마다: string[] = []
    for (let index = 1; index <= 600; index += 1) {
      // 공을 던졌다 거뒀다 한다 — 새 공이 들면 놓은 틱이 그 틀의 장면 틱이다
      if (index % 150 === 40) rerender(<PitcherSideStage {...props} pitch={pitch} />)
      if (index % 150 === 0) rerender(<PitcherSideStage {...props} pitch={null} />)
      // 부르는 쪽이 매 렌더 새로 만든 같은 값의 객체를 넘겨도 다시 안 그린다
      if (index % 7 === 0) rerender(<PitcherSideStage {...props} pitch={index % 150 >= 40 ? pitch : null} hud={null} />)
      그림(index * 틀간격())
      틀마다.push(그린입력.at(-1) ?? '')
    }
    cleanup()
    resetCommonWindowShownForTest()
    return 틀마다
  }

  it('틀마다 캔버스에 남은 그림이 건너뛰기 전과 같다', () => {
    const 공 = 타석돌리기(true).장면.find((scene) => scene.pitch !== null)?.pitch
    expect(공).toBeTruthy()
    const 전 = 투수편돌리기(true, 공!)
    const 그린전 = 그린입력.length
    const 후 = 투수편돌리기(false, 공!)
    const 그린후 = 그린입력.length
    expect(그린전).toBe(600)
    expect(후).toEqual(전)
    expect(new Set(전).size).toBeGreaterThan(20)
    expect(그린후).toBeLessThan(600 / 2)
  })
})

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSubstitutionScene } from '@/features/play-game/model/useSubstitutionScene'
import { SCENE_CONFIRM_READY_FRAMES, SCENE_PREPARE_FRAMES, useSceneConfirm } from '@/features/play-game/model/useSceneConfirm'
import { chainSceneConfirm, enterSceneConfirm, type SceneConfirmWait } from '@/features/play-game/model/sceneConfirm'
import type { SubstitutionScene } from '@/features/play-game/model/substitutionScene'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { setActiveSound, type SoundPort } from '@/shared/api/audio/soundPort'

let played: number[] = []
const port: SoundPort = {
  play: (id) => {
    played.push(id)
  },
  playBgm: () => {},
  stopBgm: () => {},
  resumeBgm: () => {},
  stop: () => {},
  currentBgm: () => null,
  setVolume: () => {},
  getVolume: () => 100,
}

beforeEach(() => {
  vi.useFakeTimers()
  played = []
  setActiveSound(port)
})
afterEach(() => {
  setActiveSound(null)
  vi.useRealTimers()
})

function 프레임(n: number) {
  act(() => {
    vi.advanceTimersByTime(n * millisecondsPerFrame())
  })
}

/** 화면 한 벌 — 교체 연출이 서 있으면 0xe 대기를 세지 않는다 */
function 화면(scene: SubstitutionScene | null, wait: SceneConfirmWait, onEntryDraw?: (scene: SubstitutionScene) => void) {
  return renderHook(() => {
    const substitution = useSubstitutionScene(scene, wait, true, onEntryDraw)
    const confirm = useSceneConfirm(wait, !substitution.isShown)
    return { substitution, confirm }
  })
}

describe('교체 연출 0x16 을 경기 화면에 세운다 (3da88 · 0x4da30 · 0x38b64)', () => {
  it('대기를 세우는 걸음이 연출을 실으면 곧장 선다 — 그동안 0xe 대기는 안 세고, 다 그리면 0xd 두 그림 뒤 등판음', () => {
    const scene: SubstitutionScene = { serial: 1, entryKind: '투수', incomingIsAce: false, entrySoundId: 15 }
    const { result } = 화면(scene, enterSceneConfirm())
    expect(result.current.substitution.isShown).toBe(true)
    expect(result.current.confirm.acceptsConfirm).toBe(false)
    // 22 는 실려 오지 않았다(진행기 걸음 끝 소리가 냈다)
    expect(played).toEqual([])
    act(() => result.current.substitution.finish())
    expect(result.current.substitution.isShown).toBe(false)
    expect(result.current.confirm.acceptsConfirm).toBe(true)
    프레임(SCENE_PREPARE_FRAMES - 1)
    expect(played).toEqual([])
    프레임(1)
    expect(played).toEqual([15])
    // 같은 연출은 두 번 안 선다
    act(() => result.current.substitution.finish())
    프레임(SCENE_PREPARE_FRAMES)
    expect(played).toEqual([15])
  })

  it('나리 타자편처럼 0xe 의 OK 뒤에 서는 연출은 그 OK 를 받은 뒤 서고, 첫 그림에 "Time!" 22 를 낸다', () => {
    const wait = chainSceneConfirm(enterSceneConfirm())
    const scene: SubstitutionScene = { serial: 1, entryKind: '타자', incomingIsAce: true, entrySoundId: 26, timeSoundId: 22, confirmsBefore: 1 }
    const { result } = 화면(scene, wait)
    expect(result.current.substitution.isShown).toBe(false)
    프레임(SCENE_CONFIRM_READY_FRAMES)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '5' }))
    })
    expect(result.current.substitution.isShown).toBe(true)
    expect(played).toEqual([22])
    // 둘째 0xe 는 연출이 끝난 뒤부터 센다
    expect(result.current.confirm.isAwaiting).toBe(true)
    expect(result.current.confirm.acceptsConfirm).toBe(false)
    act(() => result.current.substitution.finish())
    프레임(SCENE_PREPARE_FRAMES)
    expect(played).toEqual([22, 26])
  })

  it('0xe 첫 그림의 0x38b64 — 등판음과 같은 그림에, 소리보다 먼저 들어온 선수 파티클을 쏜다 (38bd0 · 38c6e → 38c36 · 38cd4)', () => {
    const scene: SubstitutionScene = { serial: 1, entryKind: '투수', incomingIsAce: false, entrySoundId: 14 }
    const order: string[] = []
    const { result } = 화면(scene, enterSceneConfirm(), (drawn) => {
      order.push(`파티클 ${drawn.entryKind}`)
      expect(played).toEqual([])
    })
    act(() => result.current.substitution.finish())
    프레임(SCENE_PREPARE_FRAMES - 1)
    expect(order).toEqual([])
    프레임(1)
    expect(order).toEqual(['파티클 투수'])
    expect(played).toEqual([14])
    // 한 번만 (38cd8 +0x1959 = 0 · +0x195c = 0)
    act(() => result.current.substitution.finish())
    프레임(SCENE_PREPARE_FRAMES)
    expect(order).toEqual(['파티클 투수'])
  })
})

describe('0x16 끝의 0xd 진입 틱 (끝 비트 메시지 0xd → 다음 틀 0xd 틱 0)', () => {
  it('다 그린 틀을 대기의 0xd 틱 0 으로 적는다 — 화면이 한 틱 늦게 받기 시작해도 등판음과 OK 잠금이 같은 0xd 에서 센다', () => {
    const scene: SubstitutionScene = { serial: 1, entryKind: '투수', incomingIsAce: false, entrySoundId: 15 }
    const wait = enterSceneConfirm()
    const { result, rerender } = renderHook(
      ({ cover }: { cover: boolean }) => {
        const substitution = useSubstitutionScene(scene, wait, true)
        const confirm = useSceneConfirm(wait, !substitution.isShown && !cover)
        return { substitution, confirm }
      },
      { initialProps: { cover: true } },
    )
    act(() => result.current.substitution.finish())
    프레임(1)
    rerender({ cover: false })
    프레임(SCENE_PREPARE_FRAMES - 1)
    expect(played).toEqual([15])
    프레임(SCENE_CONFIRM_READY_FRAMES - SCENE_PREPARE_FRAMES)
    act(() => result.current.confirm.confirm())
    expect(result.current.confirm.isAwaiting).toBe(false)
  })
})

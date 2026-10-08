// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { SCENE_CONFIRM_READY_FRAMES, SCENE_PREPARE_FRAMES, useSceneConfirm } from '@/features/play-game/model/useSceneConfirm'
import { chainSceneConfirm, enterSceneConfirm } from '@/features/play-game/model/sceneConfirm'
import type { SceneConfirmWait } from '@/features/play-game/model/sceneConfirm'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { createSilentSound, setActiveSound } from '@/shared/api/audio/soundPort'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function 잠금풀기() {
  act(() => {
    vi.advanceTimersByTime(SCENE_CONFIRM_READY_FRAMES * millisecondsPerFrame())
  })
}

function 키(key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }))
  })
}

describe('상태 0xe 의 OK 대기 (0x532b0 · 0x49a26)', () => {
  it('대기 객체가 없으면 기다리지 않는다', () => {
    const { result } = renderHook(() => useSceneConfirm(null, true))
    expect(result.current.isAwaiting).toBe(false)
  })

  it('들어선 뒤 세 갱신 안의 OK 는 먹지 않고, 그 뒤 OK·5·Enter·스페이스 하나로 끝난다', () => {
    const wait = enterSceneConfirm()
    const { result } = renderHook(() => useSceneConfirm(wait, true))
    expect(result.current.isAwaiting).toBe(true)
    키('5')
    expect(result.current.isAwaiting).toBe(true)
    잠금풀기()
    // 0x532b0 은 OK·'5' 말고는 아무 일도 안 한다
    키('4')
    expect(result.current.isAwaiting).toBe(true)
    키('5')
    expect(result.current.isAwaiting).toBe(false)
  })

  it('시간이 아무리 흘러도 스스로 넘어가지 않는다 (0x39bd4)', () => {
    const wait = enterSceneConfirm()
    const { result } = renderHook(() => useSceneConfirm(wait, true))
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(result.current.isAwaiting).toBe(true)
  })

  it('메뉴가 떠 있으면(canAccept 거짓) OK 를 안 받는다', () => {
    const wait = enterSceneConfirm()
    const { result, rerender } = renderHook(({ canAccept }) => useSceneConfirm(wait, canAccept), {
      initialProps: { canAccept: false },
    })
    잠금풀기()
    키('Enter')
    expect(result.current.isAwaiting).toBe(true)
    expect(result.current.acceptsConfirm).toBe(false)
    rerender({ canAccept: true })
    // 덮개가 걷힌 뒤로 다시 세 갱신을 잠근다
    키('Enter')
    expect(result.current.isAwaiting).toBe(true)
    잠금풀기()
    키('Enter')
    expect(result.current.isAwaiting).toBe(false)
  })

  it('같은 걸음에 0xe 를 두 번 지났으면 OK 를 두 번 받아야 하고, 두 번째도 잠금이 다시 걸린다', () => {
    const wait = chainSceneConfirm(enterSceneConfirm())
    const { result } = renderHook(() => useSceneConfirm(wait, true))
    잠금풀기()
    act(() => result.current.confirm())
    expect(result.current.isAwaiting).toBe(true)
    act(() => result.current.confirm())
    expect(result.current.isAwaiting).toBe(true)
    잠금풀기()
    act(() => result.current.confirm())
    expect(result.current.isAwaiting).toBe(false)
  })

  it('받은 OK 는 대기 객체에 남는다 — 화면이 다시 서도 다시 기다리지 않고, 새 객체면 다시 기다린다', () => {
    const wait: SceneConfirmWait = enterSceneConfirm()
    const first = renderHook(() => useSceneConfirm(wait, true))
    잠금풀기()
    act(() => first.result.current.confirm())
    first.unmount()
    const again = renderHook(() => useSceneConfirm(wait, true))
    expect(again.result.current.isAwaiting).toBe(false)
    const next = renderHook(() => useSceneConfirm(enterSceneConfirm(), true))
    expect(next.result.current.isAwaiting).toBe(true)
  })

  it('0xd 두 그림 뒤에야 0xe(소개 판)이고, 그 뒤 세 그림까지 OK 를 안 받는다 (0x39e14 · 0x49a26)', () => {
    const wait = enterSceneConfirm()
    const { result } = renderHook(() => useSceneConfirm(wait, true))
    expect(result.current.isInConfirmState).toBe(false)
    act(() => {
      vi.advanceTimersByTime(SCENE_PREPARE_FRAMES * millisecondsPerFrame())
    })
    expect(result.current.isInConfirmState).toBe(true)
    act(() => {
      vi.advanceTimersByTime(2 * millisecondsPerFrame())
    })
    act(() => result.current.confirm())
    expect(result.current.isAwaiting).toBe(true)
    act(() => {
      vi.advanceTimersByTime(millisecondsPerFrame())
    })
    act(() => result.current.confirm())
    expect(result.current.isAwaiting).toBe(false)
    expect(result.current.isInConfirmState).toBe(false)
  })
})

describe('타석 등장음 — 0xd 진입 메시지 0xbc1 → 0x522d2 (마타자 26 · 2·3루 주자 15 · 그 밖 14)', () => {
  const 통로 = () => {
    const played: number[] = []
    setActiveSound({ ...createSilentSound(), play: (id: number) => { played.push(id) } })
    return played
  }
  afterEach(() => setActiveSound(null))

  it('대기를 받기 시작한 그림(0xd 첫 그림)에 한 번 — 덮개가 걷힐 때까지 기다리고, 다시 덮였다 걷혀도 또 안 낸다', () => {
    const played = 통로()
    const wait = enterSceneConfirm(15)
    const { rerender } = renderHook(({ canAccept }: { canAccept: boolean }) => useSceneConfirm(wait, canAccept), {
      initialProps: { canAccept: false },
    })
    expect(played).toEqual([])
    rerender({ canAccept: true })
    expect(played).toEqual([15])
    rerender({ canAccept: false })
    rerender({ canAccept: true })
    expect(played).toEqual([15])
  })

  it('등장음이 없는 대기(교체 연출 0x16 뒤 · 교체 창 취소)는 소리가 없다', () => {
    const played = 통로()
    renderHook(() => useSceneConfirm(enterSceneConfirm(), true))
    expect(played).toEqual([])
  })

  it('같은 걸음의 둘째 0xe(0x16 뒤)는 첫 0xe 몫의 소리를 다시 안 낸다', () => {
    const played = 통로()
    const wait = chainSceneConfirm(enterSceneConfirm(26))
    expect(wait).toEqual({ entries: 2, atBatEntrySoundId: 26 })
    const { result } = renderHook(() => useSceneConfirm(wait, true))
    expect(played).toEqual([26])
    잠금풀기()
    키('5')
    expect(result.current.isAwaiting).toBe(true)
    expect(played).toEqual([26])
  })
})

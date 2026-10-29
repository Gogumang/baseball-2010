// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { createScreenWakeLock } from '@/shared/lib/wakeLock/screenWakeLock'
import { useScreenWakeLock } from '@/shared/lib/wakeLock/useScreenWakeLock'

/** 가짜 `navigator.wakeLock` — 잡은 수 · 놓은 수를 센다 */
function fakeWakeLock({ rejects = false } = {}) {
  const counts = { requested: 0, released: 0 }
  const wakeLock = {
    request: vi.fn(async () => {
      counts.requested += 1
      if (rejects) throw new DOMException('denied', 'NotAllowedError')
      return { release: vi.fn(async () => void (counts.released += 1)) } as unknown as WakeLockSentinel
    }),
  } as unknown as WakeLock
  return { wakeLock, counts }
}

let visibility: DocumentVisibilityState = 'visible'
const setVisibility = (next: DocumentVisibilityState) => {
  visibility = next
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  visibility = 'visible'
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const flush = () => act(async () => {})

describe('createScreenWakeLock', () => {
  it('원하면 잡고, 원하지 않게 되면 놓는다', async () => {
    const { wakeLock, counts } = fakeWakeLock()
    const lock = createScreenWakeLock({ wakeLock, document })
    lock.setWanted(true)
    await flush()
    expect(counts).toEqual({ requested: 1, released: 0 })
    lock.setWanted(false)
    await flush()
    expect(counts).toEqual({ requested: 1, released: 1 })
    lock.dispose()
  })

  it('탭이 숨으면 놓고 돌아오면 다시 잡는다', async () => {
    const { wakeLock, counts } = fakeWakeLock()
    const lock = createScreenWakeLock({ wakeLock, document })
    lock.setWanted(true)
    await flush()
    setVisibility('hidden')
    await flush()
    expect(counts).toEqual({ requested: 1, released: 1 })
    setVisibility('visible')
    await flush()
    expect(counts).toEqual({ requested: 2, released: 1 })
    lock.dispose()
  })

  it('잡는 사이에 원하지 않게 되면 받자마자 놓는다', async () => {
    const { wakeLock, counts } = fakeWakeLock()
    const lock = createScreenWakeLock({ wakeLock, document })
    lock.setWanted(true)
    lock.setWanted(false)
    await flush()
    expect(counts).toEqual({ requested: 1, released: 1 })
    lock.dispose()
  })

  it('지원하지 않거나 거절되면 조용히 넘어간다', async () => {
    const unsupported = createScreenWakeLock({ wakeLock: undefined, document })
    expect(() => unsupported.setWanted(true)).not.toThrow()
    const { wakeLock, counts } = fakeWakeLock({ rejects: true })
    const rejected = createScreenWakeLock({ wakeLock, document })
    rejected.setWanted(true)
    await flush()
    expect(counts.requested).toBe(1)
    unsupported.dispose()
    rejected.dispose()
  })
})

describe('useScreenWakeLock', () => {
  it('경기 중일 때만 잡고, 내려가면 놓는다', async () => {
    const { wakeLock, counts } = fakeWakeLock()
    // happy-dom 에는 `navigator.wakeLock` 이 없다 — 이 시험 동안만 단다
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: wakeLock })
    const { rerender, unmount } = renderHook(({ isActive }) => useScreenWakeLock(isActive), { initialProps: { isActive: false } })
    await flush()
    expect(counts.requested).toBe(0)
    rerender({ isActive: true })
    await flush()
    expect(counts).toEqual({ requested: 1, released: 0 })
    unmount()
    await flush()
    expect(counts).toEqual({ requested: 1, released: 1 })
    Reflect.deleteProperty(navigator, 'wakeLock')
  })
})

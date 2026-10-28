// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { safeJsonParse } from '@/shared/lib/safe/safeJson'
import { safeLocalStorage } from '@/shared/lib/safe/safeStorage'

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
})

describe('safeJsonParse', () => {
  it('맞는 글은 읽고 깨진 글은 대신 값', () => {
    expect(safeJsonParse('{"a":1}', null)).toEqual({ a: 1 })
    expect(safeJsonParse('{', null)).toBeNull()
  })
})

describe('safeStorage', () => {
  it('읽기 · 쓰기 · 지우기', () => {
    safeLocalStorage.set('k', 'v')
    expect(safeLocalStorage.get('k')).toBe('v')
    safeLocalStorage.remove('k')
    expect(safeLocalStorage.get('k')).toBeNull()
  })

  it('저장소가 던지면 읽기는 null, 쓰기 · 지우기는 삼킨다', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(safeLocalStorage.get('k')).toBeNull()
    expect(() => safeLocalStorage.set('k', 'v')).not.toThrow()
    expect(() => safeLocalStorage.remove('k')).not.toThrow()
  })
})

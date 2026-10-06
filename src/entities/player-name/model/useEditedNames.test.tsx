// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'
import { PITCHERS } from '@/shared/config/original/roster'
import { EMPTY_EDITED_NAMES, normalizeEditedNames, withEditedName } from '@/entities/player-name/model/editedNames'
import { originalNameOf, setActiveEditedNames } from '@/entities/player-name/model/playerName'
import { useEditedNames } from '@/entities/player-name/model/useEditedNames'

afterEach(() => setActiveEditedNames(EMPTY_EDITED_NAMES))

const memoryStore = (initial: unknown = null) => {
  let value = initial
  const store: JsonStorePort = { load: () => value, save: (next) => { value = next } }
  return { store, read: () => value }
}

describe('에디트 이름표 저장 고리', () => {
  it('저장을 읽자마자 공용 이름 함수가 그 표를 본다', () => {
    const { store } = memoryStore(withEditedName(EMPTY_EDITED_NAMES, 0, true, '저장됨'))
    renderHook(() => useEditedNames(store))
    expect(PITCHERS[0].name).toBe('저장됨')
  })

  it('고치면 곧바로 저장하고(0x1f1b9) 화면 이름도 바뀐다', () => {
    const { store, read } = memoryStore()
    const { result } = renderHook(() => useEditedNames(store))
    act(() => result.current.rename(1, true, '바뀜'))
    expect(PITCHERS[1].name).toBe('바뀜')
    expect(normalizeEditedNames(read()).pitchers[1]).toBe('바뀜')
    act(() => result.current.clear())
    expect(PITCHERS[1].name).toBe(originalNameOf(PITCHERS[1]))
    expect(normalizeEditedNames(read())).toEqual(EMPTY_EDITED_NAMES)
  })
})

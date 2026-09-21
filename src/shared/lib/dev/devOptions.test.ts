// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isInfiniteGamePointOn } from '@/shared/lib/dev/devOptions'

/** 웹판 테스트용 스위치 — 원본에는 없다 */

const 주소바꾸기 = (search: string) => {
  window.history.replaceState({}, '', `/${search}`)
}

beforeEach(() => {
  window.localStorage.clear()
  주소바꾸기('')
})
afterEach(() => {
  window.localStorage.clear()
  주소바꾸기('')
})

describe('무한 G 스위치', () => {
  it('기본은 꺼져 있다 — 원본 규칙이 그대로 돈다', () => {
    expect(isInfiniteGamePointOn()).toBe(false)
  })

  it('주소에 `?무한G` 를 붙이면 켜진다', () => {
    주소바꾸기('?무한G')
    expect(isInfiniteGamePointOn()).toBe(true)
  })

  it('영문 이름 `?infinite-gp` 도 받는다', () => {
    주소바꾸기('?infinite-gp')
    expect(isInfiniteGamePointOn()).toBe(true)
  })

  it('저장에 적어 두어도 켜진다 — 새로고침해도 남는다', () => {
    window.localStorage.setItem('compus-baseball/dev', '무한G')
    expect(isInfiniteGamePointOn()).toBe(true)
  })

  it('다른 이름은 켜지지 않는다', () => {
    주소바꾸기('?무한')
    expect(isInfiniteGamePointOn()).toBe(false)
  })
})

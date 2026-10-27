// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { TeamSelectScreen } from '@/pages/create-player/ui/TeamSelectScreen'

afterEach(cleanup)

/**
 * 공용 목록 0x63b15 의 넷째 인자 — 1 이면 머리띠 미끄러짐 · 격자 열림 애니 동안 키 함수가 [skin+0xe4] == 0 을 보고 키를 버리고,
 * 0 이면(일반모드 18 ↔ 19, 0x2de7e · 0x2ddf2) 0x63bd8~0x63be0 이 둘 다 꺼 곧바로 키를 받는다 (r333)
 */
describe('팀 고르기 들어옴 연출 (0x63b15 넷째 인자)', () => {
  it('연출을 돌면 첫 그림의 OK 는 버린다', () => {
    const onSelect = vi.fn()
    render(<TeamSelectScreen onSelect={onSelect} onCancel={vi.fn()} />)
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('연출을 끄면 첫 그림부터 OK 를 받는다', () => {
    const onSelect = vi.fn()
    render(<TeamSelectScreen onSelect={onSelect} onCancel={vi.fn()} isEntryAnimated={false} initialCursor={5} />)
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith(5)
  })
})

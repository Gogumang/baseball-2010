// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NextGameStandingsScreen } from '@/pages/management/ui/NextGameStandingsScreen'
import { EMPTY_LEAGUE } from '@/entities/league/model/league'

/** 나리 109 다음경기 앞 순위표 — 진입 0x10d8c · 키 0x105f0 · 그림 0x168a4 (직접 떴다) */

afterEach(cleanup)

const 띄우기 = (isFromManagement: boolean, handlers = { onConfirm: vi.fn(), onCancel: vi.fn() }) => ({
  ...render(
    <NextGameStandingsScreen league={EMPTY_LEAGUE} edition="타자편" gamePoint={0}
      isFromManagement={isFromManagement} {...handlers} />,
  ),
  ...handlers,
})

const 되돌아가기그림 = (container: HTMLElement) =>
  [...container.querySelectorAll('img')].some((node) => node.getAttribute('src')?.endsWith('game_frame/021.png'))

describe('109 순위표', () => {
  it('순위표 0x7f070 한 장이다', () => {
    띄우기(true)
    expect(screen.getByRole('dialog', { name: '기록실' })).toBeTruthy()
  })

  it('확인(Enter · 5) → 142', () => {
    const { onConfirm } = 띄우기(false)
    fireEvent.keyDown(window, { key: '5' })
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('관리(105)에서 왔으면 바닥 5 — 되돌아가기가 취소다', () => {
    const { container, onCancel } = 띄우기(true)
    expect(되돌아가기그림(container)).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '되돌아가기' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('경기 뒤(100)에서 왔으면 바닥 1 — 되돌아가기가 없다', () => {
    const { container } = 띄우기(false)
    expect(되돌아가기그림(container)).toBe(false)
  })
})

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NextGameScreen } from '@/pages/season/ui/NextGameScreen'
import { EMPTY_LEAGUE, recordLeagueResult } from '@/entities/league/model/league'

/** 다음경기 0xd8 — 순위표 한 장, 키 0x48d0 (−5·'5' 확인 · −16 취소) */

afterEach(cleanup)

describe('다음경기 화면 0xd8', () => {
  it('리그 순위표를 그린다 (0xae24 → 0x7f070)', () => {
    render(<NextGameScreen league={recordLeagueResult(EMPTY_LEAGUE, 3, 9)} onConfirm={vi.fn()} onCancel={vi.fn()} isFromManagement gamePoint={0} />)
    expect(screen.getByRole('dialog', { name: '기록실' })).toBeDefined()
  })

  it("확인 키(Enter · '5')는 onConfirm, 취소 키는 onCancel 이다", () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<NextGameScreen league={EMPTY_LEAGUE} onConfirm={onConfirm} onCancel={onCancel} isFromManagement gamePoint={0} />)

    fireEvent.keyDown(window, { key: '5' })
    fireEvent.keyDown(window, { key: 'Enter' })
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onConfirm).toHaveBeenCalledTimes(2)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('확인·취소 단추도 같은 일을 한다', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<NextGameScreen league={EMPTY_LEAGUE} onConfirm={onConfirm} onCancel={onCancel} isFromManagement gamePoint={0} />)

    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    fireEvent.click(screen.getByRole('button', { name: '취소' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('머리띠 시즌모드 · 바닥은 관리 메뉴에서 왔으면 5(되돌아가기), 아니면 1 (0xb8aa~0xb8c4)', () => {
    const onCancel = vi.fn()
    const { rerender } = render(<NextGameScreen league={EMPTY_LEAGUE} onConfirm={vi.fn()} onCancel={onCancel} isFromManagement gamePoint={0} />)
    fireEvent.click(screen.getByRole('button', { name: '되돌아가기' }))
    expect(onCancel).toHaveBeenCalledTimes(1)

    rerender(<NextGameScreen league={EMPTY_LEAGUE} onConfirm={vi.fn()} onCancel={onCancel} isFromManagement={false} gamePoint={0} />)
    expect(screen.queryByRole('button', { name: '되돌아가기' })).toBeNull()
  })
})

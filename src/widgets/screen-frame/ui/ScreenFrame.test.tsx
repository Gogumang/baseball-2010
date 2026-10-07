// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import {
  FOOTER_CENTER_X, FOOTER_LEFT_X, footerMarkTopOf, isGameSettingsMarkShown,
} from '@/widgets/screen-frame/lib/screenFrameLayout'

/** 바닥비트 (0x54d95 셋째 인자, 0x55220~0x554f4) */

afterEach(cleanup)

const marksOf = (container: HTMLElement) =>
  [...container.querySelectorAll('img[data-footer-mark]')].map((node) => Number((node as HTMLElement).dataset.footerMark))

describe('ScreenFrame 바닥비트', () => {
  it('바닥을 안 주면 예전대로 — onBack 이 있으면 되돌아가기만(5), null 이면 표시 없음(1)', () => {
    const { container, rerender } = render(<ScreenFrame title="2010프로야구" gamePoint={0} onBack={vi.fn()} />)
    expect(screen.getByRole('button', { name: '되돌아가기' })).toBeTruthy()
    expect(marksOf(container)).toEqual([])

    rerender(<ScreenFrame title="2010프로야구" gamePoint={0} onBack={null} />)
    expect(screen.queryByRole('button', { name: '되돌아가기' })).toBeNull()
  })

  it('517(0x205) = 가운데 "0레벨업"(프레임 9) + 되돌아가기 — 비트 0 은 안 본다', () => {
    const { container } = render(<ScreenFrame title="마선수선택" gamePoint={0} onBack={vi.fn()} footer={0x205} />)

    expect(marksOf(container)).toEqual([9])
    const mark = container.querySelector('img[data-footer-mark="9"]') as HTMLElement
    expect(mark.style.left).toBe(`${FOOTER_CENTER_X}px`)
    expect(FOOTER_CENTER_X).toBe(97)
    expect(screen.getByRole('button', { name: '되돌아가기' })).toBeTruthy()
  })

  it('23(0x17) = 상세정보(1) 가운데 + "#투수"(2) 왼쪽 · 15(0xf) = 상세정보 + "#타자"(3) · 36(0x24) = "#재선택"(5)', () => {
    const { container, rerender } = render(<ScreenFrame title="타자엔트리" gamePoint={0} onBack={vi.fn()} footer={0x17} />)
    expect(marksOf(container)).toEqual([2, 1])
    expect((container.querySelector('img[data-footer-mark="2"]') as HTMLElement).style.left).toBe(`${FOOTER_LEFT_X}px`)

    rerender(<ScreenFrame title="투수엔트리" gamePoint={0} onBack={vi.fn()} footer={0xf} />)
    expect(marksOf(container)).toEqual([3, 1])

    rerender(<ScreenFrame title="경기정보" gamePoint={0} onBack={vi.fn()} footer={0x24} />)
    expect(marksOf(container)).toEqual([5])
  })

  it('0x87 = "#닉네임"(8) + 상세정보(1) + 되돌아가기 · 0x100 = "#목표"(7)', () => {
    const { container, rerender } = render(<ScreenFrame title="나만의리그타자편" gamePoint={0} onBack={vi.fn()} footer={0x87} />)
    expect(marksOf(container)).toEqual([8, 1])

    rerender(<ScreenFrame title="나만의리그타자편" gamePoint={0} onBack={vi.fn()} footer={0x100} />)
    expect(marksOf(container)).toEqual([7])
    expect(screen.queryByRole('button', { name: '되돌아가기' })).toBeNull()
  })

  it('표시 윗변은 B − 18 (다 올라오면 302) · "0경기설정" 은 18틱 중 앞 9틱', () => {
    expect(footerMarkTopOf(320)).toBe(302)
    expect([0, 8, 9, 17, 18].map(isGameSettingsMarkShown)).toEqual([true, true, false, false, true])
  })
})

describe('ScreenFrame 머리띠 G (0x54a60)', () => {
  it('둥근 판 · 동전 (168, 머리띠y + 17) · 숫자 오른끝 168 + 0x41 + 2', () => {
    const { container } = render(<ScreenFrame title="2010프로야구" gamePoint={30} onBack={null} slides={false} />)
    const badge = screen.getByTestId('머리띠-G')
    expect(badge.querySelector('[data-badge-plate]')?.children).toHaveLength(5)
    const coin = badge.querySelector('[data-badge-coin]') as HTMLElement
    expect(coin.style.left).toBe('168px')
    const digits = [...badge.querySelectorAll('[data-badge-digit]')] as HTMLElement[]
    expect(digits.map((node) => node.style.left)).toEqual(['217px', '226px'])
    expect(container.querySelector('[data-badge-plus]')).toBeNull()
  })
})


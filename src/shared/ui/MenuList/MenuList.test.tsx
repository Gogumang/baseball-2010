// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MenuList } from '@/shared/ui/MenuList/MenuList'
import { IconMenu } from '@/shared/ui/IconMenu/IconMenu'

afterEach(cleanup)

const 항목 = [
  { id: 'a', label: '가' },
  { id: 'b', label: '나' },
  { id: 'c', label: '다' },
]

describe('마우스 길 — 원본 목록은 키패드뿐이라 포인터를 올려 두기만 해서는 커서가 안 옮겨진다', () => {
  it('MenuList', () => {
    render(<MenuList items={항목} onSelect={vi.fn()} />)
    const [첫, , 셋] = screen.getAllByRole('option')
    fireEvent.pointerEnter(셋)
    fireEvent.mouseEnter(셋)
    fireEvent.mouseOver(셋)
    expect(첫.getAttribute('aria-selected')).toBe('true')
    expect(셋.getAttribute('aria-selected')).toBe('false')
  })

  it('MenuList — 누르면 그 칸을 고른다(클릭은 남긴다)', () => {
    const onSelect = vi.fn()
    render(<MenuList items={항목} onSelect={onSelect} />)
    fireEvent.click(screen.getAllByRole('option')[2])
    expect(onSelect).toHaveBeenCalledWith('c')
  })

  it('IconMenu', () => {
    render(<IconMenu items={항목.map((item) => ({ ...item, iconUrl: '' }))} onSelect={vi.fn()} />)
    fireEvent.pointerEnter(screen.getByRole('button', { name: '다' }))
    fireEvent.mouseEnter(screen.getByRole('button', { name: '다' }))
    expect(screen.getByRole('button', { name: '가' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('button', { name: '다' }).getAttribute('aria-selected')).toBe('false')
  })
})

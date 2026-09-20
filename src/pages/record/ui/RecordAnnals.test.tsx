// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { RecordAnnals } from '@/pages/record/ui/RecordAnnals'
import { EMPTY_COLLECTION } from '@/entities/collection/model/collection'
import { ORIGINAL_SKILLS } from '@/shared/config/original/skills'
import { TITLE_NAMES } from '@/entities/career/model/titles'
import { CELL_GRID, PANEL, cellPositionOf } from '@/pages/record/lib/recordAnnalsLayout'

/**
 * 기록연감 (0x2e29c — P6 2c). 탭 다섯이 192 판 위에 놓이고
 * 진행·스킬은 41×25 칸 격자, 닉네임은 164×18 줄이다.
 */

afterEach(cleanup)

const 띄우기 = (overrides: Partial<Parameters<typeof RecordAnnals>[0]> = {}) =>
  render(<RecordAnnals collection={EMPTY_COLLECTION} onBack={vi.fn()} {...overrides} />)

describe('기록연감 뼈대', () => {
  it('판은 가운데 192×212 다', () => {
    const { container } = 띄우기()
    const panel = container.querySelector(`div[style*="${PANEL.width}px"]`) as HTMLElement

    expect(panel.style.left).toBe(`${PANEL.x}px`)
    expect(panel.style.top).toBe(`${PANEL.y}px`)
  })

  it('탭 다섯을 보여 준다 — 기록·진행·스킬·닉네임·통계', () => {
    띄우기()

    for (const name of ['기록', '진행', '스킬', '닉네임', '통계']) {
      expect(screen.getByRole('button', { name })).toBeTruthy()
    }
  })

  it('쪽이 있는 탭만 쪽 번호를 보여 준다 — 기록 6쪽 · 진행 없음', () => {
    띄우기()
    expect(screen.getByText('1/6')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '진행' }))
    expect(screen.queryByText(/\/\d/)).toBeNull()
  })

  it('좌우 키로 쪽을 넘긴다', () => {
    띄우기()

    fireEvent.keyDown(window, { key: 'ArrowRight' })

    expect(screen.getByText('2/6')).toBeTruthy()
  })
})

describe('기록연감 칸 격자', () => {
  it('못 얻은 칸은 ??? 로 보인다', () => {
    띄우기()
    fireEvent.click(screen.getByRole('button', { name: '스킬' }))

    expect(screen.getAllByRole('button', { name: '???' }).length).toBeGreaterThan(0)
  })

  it('얻은 칸은 이름이 나오고, 칸은 41×25 에 4열로 놓인다', () => {
    띄우기({ collection: { ...EMPTY_COLLECTION, skills: [0, 1] } })
    fireEvent.click(screen.getByRole('button', { name: '스킬' }))

    const first = screen.getByRole('button', { name: ORIGINAL_SKILLS[0].name })
    const second = screen.getByRole('button', { name: ORIGINAL_SKILLS[1].name })

    expect(first.style.width).toBe(`${CELL_GRID.width}px`)
    expect(first.style.height).toBe(`${CELL_GRID.height}px`)
    expect(first.style.left).toBe(`${cellPositionOf(0).x}px`)
    expect(second.style.left).toBe(`${cellPositionOf(1).x}px`)
  })

  it('스킬 탭은 고른 칸의 설명을 보여 준다 — 못 얻었으면 ???', () => {
    띄우기({ collection: { ...EMPTY_COLLECTION, skills: [0] } })
    fireEvent.click(screen.getByRole('button', { name: '스킬' }))

    expect(screen.getByText(/효과 :/)).toBeTruthy()
  })

  it('스킬·닉네임 탭은 아래에 전체합계를 보여 준다', () => {
    띄우기({ collection: { ...EMPTY_COLLECTION, titles: [TITLE_NAMES[0]] } })
    fireEvent.click(screen.getByRole('button', { name: '닉네임' }))

    expect(screen.getByText(`1/${TITLE_NAMES.length}`)).toBeTruthy()
  })
})

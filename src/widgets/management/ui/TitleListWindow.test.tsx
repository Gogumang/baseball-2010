// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { TitleListWindow } from '@/widgets/management/ui/TitleListWindow'
import { createCareer } from '@/entities/career/model/playerCareer'
import { TITLE_NAMES } from '@/entities/career/model/titles'
import {
  TITLE_CURSOR_BOX, TITLE_LIST_BOXES, TITLE_ROW_STEP, titleNumberLeftOf, titleScrollBarRectsOf,
} from '@/widgets/management/lib/titleListLayout'

/** 칭호 목록 창 0x198fc — mode_ui 프레임 63 박스 · 줄 막대 64/65 */

afterEach(cleanup)

describe('칭호 목록 창 0x198fc', () => {
  it('판은 프레임 63 박스 0 (24,56) 192×196 공용 판 0x55e60 이다 (19974 — 제목 탭 1)', () => {
    const career = { ...createCareer('타자'), titleIds: [TITLE_NAMES[0], TITLE_NAMES[3]], equippedTitle: 3 }
    render(<TitleListWindow career={career} onEquip={vi.fn()} onClose={vi.fn()} />)
    const panel = screen.getByTestId('칭호-판')
    expect(panel.style.left).toBe('24px')
    expect(panel.style.top).toBe('56px')
    expect(panel.style.height).toBe('196px')
  })

  it('줄 막대 64 는 빈 줄까지 아홉, 단 칭호 줄만 65 를 덧깔고 글이 검정', () => {
    const career = { ...createCareer('타자'), titleIds: [TITLE_NAMES[0], TITLE_NAMES[3]], equippedTitle: 3 }
    render(<TitleListWindow career={career} onEquip={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByTestId('칭호-막대-8-64').style.top).toBe(`${79 + TITLE_ROW_STEP * 8}px`)
    expect(screen.getByTestId('칭호-막대-1-65')).toBeTruthy()
    expect(screen.queryByTestId('칭호-막대-0-65')).toBeNull()
    expect(screen.getByText(TITLE_NAMES[3]).style.color).toBe('rgb(0, 0, 0)')
    expect(screen.getByText(TITLE_NAMES[0]).style.left).toBe(`${TITLE_LIST_BOXES.name.x}px`)
  })

  it('번호는 박스 3 가운데(자간 0) · 테두리는 박스 3 ∪ 4 를 (−1, −1)', () => {
    expect(titleNumberLeftOf(1)).toBe(34 + ((26 - 4) >> 1))
    expect(titleNumberLeftOf(12)).toBe(34 + ((26 - 12) >> 1))
    expect(TITLE_CURSOR_BOX).toEqual({ x: 33, y: 78, width: 162, height: 15 })
  })

  it('스크롤 막대 — 9줄 이하면 가득, 넘치면 L = (9h + n − 1)/n', () => {
    expect(titleScrollBarRectsOf(3, 0, 9)[0]).toMatchObject({ x: 200, y: 85, width: 5, height: 155 })
    const [edge] = titleScrollBarRectsOf(20, 9, 9)
    expect(edge).toMatchObject({ y: 85 + Math.trunc((9 * 155) / 20), height: Math.trunc((155 * 9 + 19) / 20) - 1 })
  })
})

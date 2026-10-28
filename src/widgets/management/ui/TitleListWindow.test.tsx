// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TitleListWindow } from '@/widgets/management/ui/TitleListWindow'
import { createCareer } from '@/entities/career/model/playerCareer'
import { TITLE_NAMES } from '@/entities/career/model/titles'
import * as windowStyles from '@/shared/ui/GameWindow/GameWindow.css'
import {
  TITLE_CURSOR_BOX,
  TITLE_LIST_BOXES,
  TITLE_ROW_STEP,
  titleListTopAfter,
  titleNumberLeftOf,
  titleScrollBarRectsOf,
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

describe('칭호 목록 윗줄 — 스크롤 격자 0x6c2bd (한 줄씩)', () => {
  it('커서가 보이는 칸 안이면 그대로 · 아래로 넘으면 커서가 맨 아랫줄 · 위로 넘으면 맨 윗줄', () => {
    expect(titleListTopAfter(0, 8, 9)).toBe(0)
    expect(titleListTopAfter(0, 9, 9)).toBe(1)
    expect(titleListTopAfter(3, 2, 9)).toBe(2)
    // 감기 — 끝에서 0 으로 · 0 에서 끝(20 개)으로
    expect(titleListTopAfter(11, 0, 9)).toBe(0)
    expect(titleListTopAfter(0, 19, 9)).toBe(11)
  })

  const twelve = TITLE_NAMES.slice(0, 12)
  const careerOf = () => ({ ...createCareer('타자'), titleIds: twelve, equippedTitle: 11 })

  it('진입 0x104cc 는 커서를 첫 줄에 둔다 — 장착한 칭호(12번째)로 가지 않는다', () => {
    render(<TitleListWindow career={careerOf()} onEquip={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText(twelve[0]!)).toBeTruthy()
    expect(screen.queryByText(twelve[11]!)).toBeNull()
  })

  it('↓ 아홉 번이면 한 줄만 굴러 둘째 칭호부터 보이고, 바뀐 윗줄을 알린다', () => {
    const onTopChange = vi.fn()
    render(<TitleListWindow career={careerOf()} onEquip={vi.fn()} onClose={vi.fn()} onTopChange={onTopChange} />)
    for (let i = 0; i < 9; i += 1) fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(screen.queryByText(twelve[0]!)).toBeNull()
    expect(screen.getByText(twelve[1]!)).toBeTruthy()
    expect(screen.getByText(twelve[9]!)).toBeTruthy()
    expect(onTopChange).toHaveBeenLastCalledWith(1)
  })

  it('다시 열면 지난 윗줄이 남는다 (장면 생성자만 0 으로 둔다)', () => {
    render(<TitleListWindow career={careerOf()} onEquip={vi.fn()} onClose={vi.fn()} initialTop={3} />)
    expect(screen.queryByText(twelve[0]!)).toBeNull()
    expect(screen.getByText(twelve[3]!)).toBeTruthy()
  })
})

describe('칭호 창 안 알림 상자의 겹 (r207)', () => {
  it('알림이 떠 있는 동안만 덮개가 상자 겹(POPUP_WINDOW)으로 올라 바닥 누름 칸(7)이 상자 위로 새지 않는다', () => {
    const career = { ...createCareer('타자'), titleIds: [TITLE_NAMES[0], TITLE_NAMES[3]], equippedTitle: 3 }
    render(<TitleListWindow career={career} onEquip={vi.fn()} onClose={vi.fn()} />)
    const overlay = screen.getByRole('dialog', { name: '칭호' })
    expect(overlay.className).not.toContain(windowStyles.overlayWithPopup)
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByRole('dialog', { name: '알림' })).toBeTruthy()
    expect(overlay.className).toContain(windowStyles.overlayWithPopup)
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(overlay.className).not.toContain(windowStyles.overlayWithPopup)
  })
})

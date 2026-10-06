// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { RecordAnnals } from '@/pages/record/ui/RecordAnnals'
import { EMPTY_COLLECTION } from '@/entities/collection/model/collection'
import { ORIGINAL_SKILLS } from '@/shared/config/original/skills'
import { TITLE_NAMES } from '@/entities/career/model/titles'
import {
  CELL_GRID, PANEL, TAB_CURSOR, TAB_NAME_Y, TAB_SELECTED_WIDTH, TAB_SLOT_WIDTH,
  cellPositionOf, tabIconXOf, tabNameXOf, tabSlotXOf,
} from '@/pages/record/lib/recordAnnalsLayout'
import { STAT_NAMES } from '@/pages/record/lib/statNames'
import { applyAnnalsStat } from '@/entities/collection/model/annalsStats'

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

  it('탭 칸은 slt_frame 프레임 4~8 의 박스다 — 26/55/84/113/142, 폭 72, 간격 29 (S12 1절)', () => {
    expect([0, 1, 2, 3, 4].map(tabSlotXOf)).toEqual([26, 55, 84, 113, 142])
    expect(TAB_SLOT_WIDTH).toBe(72)
    // 커서 y = 54 · 이름 y = 58 · 이름은 박스 안 가운데 (72 − 이름폭)/2
    expect(TAB_CURSOR.y).toBe(54)
    expect(TAB_NAME_Y).toBe(58)
    expect(tabNameXOf(2, 40)).toBe(84 + 16)
  })

  it('안 고른 탭은 29px 아이콘 칸이고 고른 탭만 75px 로 넓다', () => {
    띄우기() // 고른 탭 = 0

    expect(screen.getByRole('button', { name: '기록' }).style.width).toBe(`${TAB_SELECTED_WIDTH}px`)
    expect(screen.getByRole('button', { name: '진행' }).style.left).toBe(`${tabIconXOf(1, 0)}px`)
    // 고른 탭보다 뒤 칸은 넓어진 칸만큼(46) 밀린다 — 24 + 29 + 46 = 99
    expect(tabIconXOf(1, 0)).toBe(99)
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

  it('통계 탭 줄 이름은 StrMAINMENU[129~182] 그대로다 (P6 2c)', () => {
    띄우기()
    fireEvent.click(screen.getByRole('button', { name: '통계' }))

    expect(STAT_NAMES).toHaveLength(182 - 129 + 1)
    expect(STAT_NAMES[0]).toBe('일반 모드')
    expect(STAT_NAMES[STAT_NAMES.length - 1]).toBe('선물 받은 GP')
    // 쪽 0 = 칸 0~6 플레이 시간 [129]~[135] — 칸 7 은 비어 있다 (0x7a08c)
    for (const name of STAT_NAMES.slice(0, 7)) expect(screen.getByText(name)).toBeTruthy()
    expect(screen.queryByText(STAT_NAMES[7])).toBeNull()
  })

  it('통계 탭은 비밀 번호 없이 2쪽만 돈다 — 쪽 1 은 [136]~[140] 다섯 줄', () => {
    띄우기()
    fireEvent.click(screen.getByRole('button', { name: '통계' }))

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText('2/2')).toBeTruthy()
    expect(screen.getByText('나리 타자편 우승')).toBeTruthy()
    expect(screen.getByText('이벤트 미션 다운')).toBeTruthy()

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText('1/2')).toBeTruthy()
  })

  it('"1212123" 을 치면 아이템·GP 쪽이 열린다 — 쪽 번호 전체는 표 값 2 그대로 (0x2e6c8)', () => {
    const stats = applyAnnalsStat(EMPTY_COLLECTION.stats, { kind: 'GP아이템구매', mode: 4, index: 1, price: 300 })
    띄우기({ collection: { ...EMPTY_COLLECTION, stats } })
    fireEvent.click(screen.getByRole('button', { name: '통계' }))
    for (const key of '1212123') fireEvent.keyDown(window, { key })

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'ArrowRight' })

    expect(screen.getByText('3/2')).toBeTruthy()
    expect(screen.getByText('타자 붕붕드링크')).toBeTruthy()
    expect(screen.getByText('1개')).toBeTruthy()
  })

  it('비밀 번호가 틀리면 열리지 않는다 — 다시 쳐도 센 수가 7 에 멈춰 있다', () => {
    띄우기()
    fireEvent.click(screen.getByRole('button', { name: '통계' }))
    for (const key of '12121241212123') fireEvent.keyDown(window, { key })

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByText('2/2')).toBeTruthy()
  })

  it('마지막 쪽(소모 GP)은 사용처별 값을 보이고 합계는 원본 버그대로 0G 다', () => {
    const stats = applyAnnalsStat(EMPTY_COLLECTION.stats, { kind: 'G사용', usage: 0, amount: 3000 })
    띄우기({ collection: { ...EMPTY_COLLECTION, stats } })
    fireEvent.click(screen.getByRole('button', { name: '통계' }))
    for (const key of '1212123') fireEvent.keyDown(window, { key })

    fireEvent.keyDown(window, { key: 'ArrowLeft' })

    expect(screen.getByText('마선수 소모 GP')).toBeTruthy()
    expect(screen.getByText('3000G')).toBeTruthy()
    // 나머지 일곱 줄 0G + 합계 0G
    expect(screen.getAllByText('0G')).toHaveLength(8)
  })

  it('스킬·닉네임 탭은 아래에 전체합계를 보여 준다', () => {
    띄우기({ collection: { ...EMPTY_COLLECTION, titles: [TITLE_NAMES[0]] } })
    fireEvent.click(screen.getByRole('button', { name: '닉네임' }))

    expect(screen.getByText(`1/${TITLE_NAMES.length}`)).toBeTruthy()
  })
})

describe('탭 0 스페셜기록 쪽 — 셀 40~47 이름 StrGAME[48~55] · 달성 표시 0x22db4 (0x7a102~0x7a156)', () => {
  it('쪽 6(ArrowLeft 로 마지막 쪽)에 여덟 이름이 서고, 표시 k 가 선 칸에만 slt_frame 71 을 칸 오른쪽 끝에 그린다', () => {
    const stats = applyAnnalsStat(applyAnnalsStat(EMPTY_COLLECTION.stats, { kind: '달성표시', index: 0 }), { kind: '달성표시', index: 2 })
    const { container } = 띄우기({ collection: { ...EMPTY_COLLECTION, stats } })

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByText('6/6')).toBeTruthy()
    expect(screen.getByText('시즌모드 리그 1위 1회')).toBeTruthy()
    expect(screen.getByText('엔딩 모두 수집')).toBeTruthy()

    const marks = [...container.querySelectorAll('img[alt="달성"]')] as HTMLElement[]
    expect(marks.map((mark) => mark.dataset.cell)).toEqual(['40', '42'])
    // x = 32 + 176 − 28 − 1 = 179, y = 90 + 18·줄 − 1
    expect(marks[0]?.style.left).toBe('179px')
    expect(marks[0]?.style.top).toBe('89px')
    expect(marks[1]?.style.top).toBe('125px')
  })

  it('다른 쪽에는 표시가 없다', () => {
    const stats = applyAnnalsStat(EMPTY_COLLECTION.stats, { kind: '달성표시', index: 0 })
    const { container } = 띄우기({ collection: { ...EMPTY_COLLECTION, stats } })

    expect(container.querySelectorAll('img[alt="달성"]')).toHaveLength(0)
  })
})

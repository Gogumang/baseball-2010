// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { RecordAnnals } from '@/pages/record/ui/RecordAnnals'
import { EMPTY_COLLECTION } from '@/entities/collection/model/collection'
import { ORIGINAL_SKILLS } from '@/shared/config/original/skills'
import { TITLE_NAMES } from '@/entities/career/model/titles'
import {
  CELL_GRID, ENDING_CELL_NAMES, PANEL, PROGRESS_ROW, TAB_CURSOR, TAB_NAME_Y, TAB_SELECTED_WIDTH, TAB_SLOT_WIDTH,
  cellPositionOf, endingCellFrameOf, endingProgressOf, tabIconXOf, tabNameXOf, tabSlotXOf,
} from '@/pages/record/lib/recordAnnalsLayout'
import { STAT_NAMES } from '@/pages/record/lib/statNames'
import { RECORD_DESCRIPTIONS } from '@/pages/record/lib/recordDescriptions'
import { applyAnnalsStat } from '@/entities/collection/model/annalsStats'

/**
 * 기록연감 (0x2e29c — P6 2c). 탭 다섯이 192 판 위에 놓이고
 * 진행·스킬은 41×25 칸 격자, 닉네임은 164×18 줄이다.
 */

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** 갱신 n 번 — 기록연감은 판이 다 열린 뒤(그림 4번)에야 키를 받는다 (0x2b87c) */
const 틱 = (count: number) => act(() => void vi.advanceTimersByTime(millisecondsPerFrame() * count))
/** 가짜 requestAnimationFrame 은 16ms 마다 돈다 — 띄운 직후 한 번 밀어 두면 틱 경계가 rAF 뒤로 온다 */
const 시계맞추기 = () => act(() => void vi.advanceTimersByTime(16))

/** 띄우고 판이 다 열릴 때까지 기다린다 */
const 띄우기 = (overrides: Partial<Parameters<typeof RecordAnnals>[0]> = {}) => {
  vi.useFakeTimers()
  const result = render(<RecordAnnals collection={EMPTY_COLLECTION} onBack={vi.fn()} {...overrides} />)
  시계맞추기()
  틱(4)
  return result
}

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

  it('들어오면 탭 막대에 초점 — 좌우 키는 탭을 바꾼다 (0x2407c [skin+0xf6] = 1 · 0x2ba10 · 0x2ba5a)', () => {
    띄우기()

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByRole('button', { name: '진행' }).style.width).toBe(`${TAB_SELECTED_WIDTH}px`)

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByRole('button', { name: '통계' }).style.width).toBe(`${TAB_SELECTED_WIDTH}px`)
  })

  it('OK·↓ 로 본문에 들어가면 좌우 키로 쪽을 넘긴다', () => {
    띄우기()

    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'ArrowRight' })

    expect(screen.getByText('2/6')).toBeTruthy()
  })

  it('취소는 본문 → 탭 막대 → 닫기 (0x2b93a)', () => {
    const onBack = vi.fn()
    띄우기({ onBack })

    fireEvent.keyDown(window, { key: 'Enter' })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onBack).not.toHaveBeenCalled()

    fireEvent.keyDown(window, { key: 'Escape' })
    // 판이 212 → 208 → 192 → 128 → 10 으로 닫힌 다음 갱신에 나간다 (0x2fb94 · 0x2bb0a)
    틱(3)
    expect(onBack).not.toHaveBeenCalled()
    틱(1)
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('판이 다 열리기 전에는 키를 안 받는다 — 32 → 36 → 52 → 116 → 212 (0x2407c · 0x2fb94 · 0x2b87c)', () => {
    vi.useFakeTimers()
    const { container } = render(<RecordAnnals collection={EMPTY_COLLECTION} onBack={vi.fn()} />)
    시계맞추기()
    const panel = () => container.querySelector(`div[style*="${PANEL.width}px"]`) as HTMLElement
    expect(panel().style.height).toBe('32px')
    expect(panel().style.top).toBe('144px')

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByRole('button', { name: '기록' }).style.width).toBe(`${TAB_SELECTED_WIDTH}px`)

    틱(3)
    expect(panel().style.height).toBe('116px')
    틱(1)
    expect(panel().style.height).toBe('212px')
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByRole('button', { name: '진행' }).style.width).toBe(`${TAB_SELECTED_WIDTH}px`)
  })

  it('머리띠는 "2010프로야구" · 바닥 5 — 되돌아가기가 CLR 이다 (0x2fc1e)', () => {
    const onBack = vi.fn()
    const { container } = 띄우기({ onBack })
    expect(container.querySelector('img[src*="game_frame/003"]')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '되돌아가기' }))
    틱(4)
    expect(onBack).toHaveBeenCalledTimes(1)
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
    fireEvent.keyDown(window, { key: 'ArrowDown' })

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
    fireEvent.keyDown(window, { key: 'ArrowDown' })

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'ArrowRight' })

    expect(screen.getByText('3/2')).toBeTruthy()
    expect(screen.getByText('타자 붕붕드링크')).toBeTruthy()
    expect(screen.getByText('1개')).toBeTruthy()
  })

  it('비밀 번호가 틀리면 열리지 않는다 — 다시 쳐도 센 수가 7 에 멈춰 있다', () => {
    띄우기()
    fireEvent.click(screen.getByRole('button', { name: '통계' }))
    // 탭 막대에서 치므로 '4'·'6' 은 탭을 바꾼다 — 그 둘이 없는 틀린 번호
    for (const key of '12121221212123') fireEvent.keyDown(window, { key })
    fireEvent.keyDown(window, { key: 'ArrowDown' })

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByText('2/2')).toBeTruthy()
  })

  it('마지막 쪽(소모 GP)은 사용처별 값을 보이고 합계는 원본 버그대로 0G 다', () => {
    const stats = applyAnnalsStat(EMPTY_COLLECTION.stats, { kind: 'G사용', usage: 0, amount: 3000 })
    띄우기({ collection: { ...EMPTY_COLLECTION, stats } })
    fireEvent.click(screen.getByRole('button', { name: '통계' }))
    for (const key of '1212123') fireEvent.keyDown(window, { key })
    fireEvent.keyDown(window, { key: 'ArrowDown' })

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

describe('진행·스킬 격자 — 보이는 3줄 창이 커서를 따라간다 (0x2b968 · 0x2b9aa · 0x2ebcc)', () => {
  const 본문 = (tabName: string, collection = EMPTY_COLLECTION) => {
    const utils = 띄우기({ collection })
    fireEvent.click(screen.getByRole('button', { name: tabName }))
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    return utils
  }
  const 내리기 = (times: number) => {
    for (let i = 0; i < times; i += 1) fireEvent.keyDown(window, { key: 'ArrowDown' })
  }

  it('진행 탭 — 커서가 넷째 줄로 가면 창이 한 줄 내려가 칸 12~15 가 보이고, 끝 줄에서 시즌 엔딩 칸 16~19 가 보인다', () => {
    본문('진행', { ...EMPTY_COLLECTION, endings: [0, 13], seasonEndings: [4] })
    expect(screen.getByRole('button', { name: '부상' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '승리자' })).toBeNull()

    내리기(2)
    expect(screen.queryByRole('button', { name: '승리자' })).toBeNull()
    내리기(1)
    expect(screen.getByRole('button', { name: '승리자' }).style.top).toBe(`${cellPositionOf(8 + 1).y}px`)
    expect(screen.queryByRole('button', { name: '부상' })).toBeNull()

    내리기(5) // 줄 4 에서 멈춘다 (세로는 감지 않는다)
    expect(screen.getByRole('button', { name: '최강' }).style.top).toBe(`${cellPositionOf(8 + 3).y}px`)

    // 올리면 커서가 창 윗줄보다 위로 갈 때만 창이 따라 올라간다
    for (let i = 0; i < 2; i += 1) fireEvent.keyDown(window, { key: 'ArrowUp' })
    expect(screen.getByRole('button', { name: '최강' })).toBeTruthy()
    fireEvent.keyDown(window, { key: 'ArrowUp' })
    expect(screen.queryByRole('button', { name: '최강' })).toBeNull()
  })

  it('스킬 탭 — 숫자 8 도 ↓ 다. 끝 줄(칸 36~39)까지 내려간다', () => {
    본문('스킬', { ...EMPTY_COLLECTION, skills: [39] })
    for (let i = 0; i < 9; i += 1) fireEvent.keyDown(window, { key: '8' })

    expect(screen.getByRole('button', { name: ORIGINAL_SKILLS[39].name }).style.left).toBe(`${cellPositionOf(3).x}px`)
  })

  it('← 는 같은 줄 끝으로 감긴다 — 고른 칸이 바뀌어 설명이 따라간다', () => {
    본문('스킬', { ...EMPTY_COLLECTION, skills: [3] })
    expect(screen.queryByText(/효과 :/)).toBeNull()

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByText(/효과 :/)).toBeTruthy()
  })
})

describe('탭 0 스페셜기록 쪽 — 셀 40~47 이름 StrGAME[48~55] · 달성 표시 0x22db4 (0x7a102~0x7a156)', () => {
  it('쪽 6(ArrowLeft 로 마지막 쪽)에 여덟 이름이 서고, 표시 k 가 선 칸에만 slt_frame 71 을 칸 오른쪽 끝에 그린다', () => {
    const stats = applyAnnalsStat(applyAnnalsStat(EMPTY_COLLECTION.stats, { kind: '달성표시', index: 0 }), { kind: '달성표시', index: 2 })
    const { container } = 띄우기({ collection: { ...EMPTY_COLLECTION, stats } })

    fireEvent.keyDown(window, { key: 'ArrowDown' })
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

describe('탭 0 달성 횟수 — 셀 0~39 "!R!cffff00%d" (0x7a0d0~0x7a0fc)', () => {
  it('쪽 0 의 여덟 칸에 누계를 찍는다 — 0 도 찍고, 자리는 (x + 3, 줄 위 + 3, 폭 − 10) 오른쪽 맞춤', () => {
    const stats = applyAnnalsStat(EMPTY_COLLECTION.stats, { kind: '기록달성', recordIds: [1, 1, 7] })
    const { container } = 띄우기({ collection: { ...EMPTY_COLLECTION, stats } })

    const counts = [...container.querySelectorAll('[data-cell]')].filter((node) => node.tagName === 'DIV') as HTMLElement[]
    expect(counts.map((node) => node.dataset.cell)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7'])
    expect(counts.map((node) => node.textContent)).toEqual(['0', '2', '0', '0', '0', '0', '0', '1'])
    expect(counts[1]?.style.left).toBe('35px')
    expect(counts[1]?.style.top).toBe('111px')
    expect(counts[1]?.style.width).toBe('166px')
  })

  it('마지막 쪽(셀 40~47)에는 횟수가 없다', () => {
    const { container } = 띄우기({ collection: EMPTY_COLLECTION })
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect([...container.querySelectorAll('div[data-cell]')]).toHaveLength(0)
  })
})

describe('진행 탭 = 엔딩 칸 20 (0x2ead8 · 0x58b5c)', () => {
  const 진행 = (endings: readonly number[], seasonEndings: readonly number[]) => {
    const utils = 띄우기({ collection: { ...EMPTY_COLLECTION, endings, seasonEndings } })
    fireEvent.click(screen.getByRole('button', { name: '진행' }))
    return utils
  }

  it('칸 이름은 StrMAINMENU[189 + i] — 0~14 나리 엔딩, 15~19 시즌 엔딩', () => {
    expect(ENDING_CELL_NAMES).toHaveLength(20)
    expect(ENDING_CELL_NAMES[0]).toBe('부상')
    expect(ENDING_CELL_NAMES[14]).toBe('정복자')
    expect(ENDING_CELL_NAMES[15]).toBe('비인기')
    expect(ENDING_CELL_NAMES[19]).toBe('최강')
  })

  it('얻은 칸은 이름 · 프레임은 칸마다 (8·9·14·18·19 → 20 · 0·1·10·15 → 19 · 그 밖 17)', () => {
    진행([0, 2], [])

    expect(screen.getByRole('button', { name: '부상' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '관중' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '방출' })).toBeNull()
    expect([8, 9, 14, 18, 19].map(endingCellFrameOf)).toEqual([20, 20, 20, 20, 20])
    expect([0, 1, 10, 15].map(endingCellFrameOf)).toEqual([19, 19, 19, 19])
    expect(endingCellFrameOf(2)).toBe(17)
  })

  it('진행도는 두 줄 — 나리 n·100/15(버림) · 시즌 s·20', () => {
    진행([0, 1, 2, 3], [0, 2])

    expect(screen.getByText('26%')).toBeTruthy()
    expect(screen.getByText('40%')).toBeTruthy()
    expect(endingProgressOf(0, 15)).toBe(100)
    expect(endingProgressOf(1, 5)).toBe(100)
  })

  it('진행도 줄 y — 글 209 · 229, 노란 네모 +1, 프레임 14 는 −4', () => {
    expect(PROGRESS_ROW.firstY).toBe(209)
    expect(PROGRESS_ROW.firstY + PROGRESS_ROW.step).toBe(229)
  })
})

describe('탭 0 설명 막대 (0x2e9b0~0x2ea86)', () => {
  it('막대는 늘, 글은 본문에 초점이 있을 때만 — 쪽 × 8 + 줄 커서의 StrGAME[0x38 + n]', () => {
    띄우기()
    expect(screen.queryByTestId('기록-설명')).toBeNull()

    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByTestId('기록-설명').textContent).toBe('타자가 자신의 안타로 3루까지 진출')

    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    // 쪽 1 · 줄 1 → 칸 9 = StrGAME[65]
    expect(screen.getByTestId('기록-설명').textContent).toBe(RECORD_DESCRIPTIONS[9])
  })
})

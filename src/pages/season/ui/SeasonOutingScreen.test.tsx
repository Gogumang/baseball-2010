// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SeasonOutingScreen } from '@/pages/season/ui/SeasonOutingScreen'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord, SeasonState } from '@/entities/season-mode/model/seasonRecord'

/**
 * 시즌 외출 화면(0xd1) — 장소 5곳·가드 0xbd38·확인 팝업 0x16 을 못박는다 (P4 3절).
 * ⚠️ 나만의리그 외출과 값·가드가 다르다 — 여기 숫자를 나리 표와 맞추면 안 된다.
 */

afterEach(cleanup)

const 시즌 = (덮어쓰기: Partial<SeasonRecord> = {}, 사기 = 50): SeasonState => {
  const state = startNewSeason(0, '테스터')
  return { ...state, record: { ...state.record, ...덮어쓰기 }, teamMorale: 사기 }
}

const 줄 = (이름: string) =>
  screen.getAllByRole('button').find((button) => (button.textContent ?? '').includes(이름)) as HTMLElement

const 알림글 = () => screen.getByRole('dialog', { name: '알림' }).textContent ?? ''

describe('시즌 외출 (상태 0xd1)', () => {
  it('장소 5곳이 StrMODE[54+p] 기능 이름과 함께 차례대로 나온다', () => {
    render(<SeasonOutingScreen state={시즌({ popularity: 999, money: 50 })} onRun={vi.fn()} onBack={vi.fn()} />)

    const 글들 = screen.getAllByRole('button').map((button) => (button.textContent ?? '').replace('▶', '').trim())
    expect(글들.slice(0, 5)).toEqual([
      '경기장 [친선경기]',
      '번화가 [회식]400',
      '병원 [입원]500',
      '학교 [야구교실]',
      '방송국 [구단CF]1000',
    ])
  })

  it('고르면 팝업 [161]·[162] 를 거쳐 장소를 넘긴다', () => {
    const onRun = vi.fn()
    render(<SeasonOutingScreen state={시즌({ popularity: 999, money: 50 })} onRun={onRun} onBack={vi.fn()} />)

    fireEvent.click(줄('번화가'))
    expect(알림글()).toContain('[회식] 이벤트를 진행하시겠습니까?')
    expect(알림글()).toContain('소지금 400이 소모됩니다')

    fireEvent.click(screen.getByRole('button', { name: '예' }))
    expect(onRun).toHaveBeenCalledWith('번화가', 1)
  })

  it('비용이 없는 장소는 소지금 줄이 붙지 않는다', () => {
    render(<SeasonOutingScreen state={시즌({ popularity: 999, money: 50 })} onRun={vi.fn()} onBack={vi.fn()} />)

    fireEvent.click(줄('학교'))
    expect(알림글()).toContain('[야구교실] 이벤트')
    expect(알림글()).not.toContain('소모')
  })

  it('친선경기는 인기도 200, 구단CF 는 400 이 필요하다 (StrMODE[62])', () => {
    const onRun = vi.fn()
    render(<SeasonOutingScreen state={시즌({ popularity: 199, money: 50 })} onRun={onRun} onBack={vi.fn()} />)

    fireEvent.click(줄('경기장'))
    expect(알림글()).toContain('필요한 인기도 : 200')
    fireEvent.click(screen.getByRole('button', { name: '확인' }))

    fireEvent.click(줄('방송국'))
    expect(알림글()).toContain('필요한 인기도 : 400')
    expect(onRun).not.toHaveBeenCalled()
  })

  it('건강하면 입원이 StrMODE[196] 로 막힌다', () => {
    render(<SeasonOutingScreen state={시즌({ money: 50, illness: 0 })} onRun={vi.fn()} onBack={vi.fn()} />)

    fireEvent.click(줄('병원'))

    expect(알림글()).toContain('건강한 상태입니다')
  })

  it('사기가 100 이면 회식이 StrMODE[91] 로 막힌다', () => {
    render(<SeasonOutingScreen state={시즌({ money: 50 }, 100)} onRun={vi.fn()} onBack={vi.fn()} />)

    fireEvent.click(줄('번화가'))

    expect(알림글()).toContain('사기 최고 상태')
  })

  it('⚠️ 원본 버그 — 서브 아이템이 있어도 소지금 500만이 없으면 입원이 막힌다', () => {
    const onRun = vi.fn()
    render(
      <SeasonOutingScreen
        state={시즌({ money: 4, illness: 1 })}
        // StrITEM[222] "병원 [입원] 시 소지금 감소없음" 을 가진 상태
        outingSubItems={[false, false, true, false, false]}
        onRun={onRun}
        onBack={vi.fn()}
      />,
    )

    fireEvent.click(줄('병원'))

    expect(알림글()).toContain('소지금이 부족')
    expect(onRun).not.toHaveBeenCalled()
  })

  it('서브 아이템을 가진 장소는 설명 줄에 효과가 붙는다 (StrMODE[195])', () => {
    render(
      <SeasonOutingScreen
        state={시즌({ popularity: 999, money: 50 })}
        outingSubItems={[true, false, false, false, false]}
        onRun={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    expect(screen.getByRole('group', { name: '외출' }).textContent).toContain('소지금 +500만')
  })

  it('취소(−16) 는 관리 메뉴로 돌아간다', () => {
    const onBack = vi.fn()
    render(<SeasonOutingScreen state={시즌({ money: 50 })} onRun={vi.fn()} onBack={onBack} />)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onBack).toHaveBeenCalled()
  })
})

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SeasonTrainingScreen } from '@/pages/season/ui/SeasonTrainingScreen'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonState } from '@/entities/season-mode/model/seasonRecord'

/**
 * 시즌 팀 트레이닝 화면(0xcf) — 칸 차례·가드 문구·확인 팝업을 못박는다 (J 4-6 · R13 5절).
 * 굴림·적용은 이 화면이 하지 않는다 — 고른 칸만 콜백으로 넘긴다.
 */

afterEach(cleanup)

const 시즌 = (능력치: readonly number[] = [100, 100, 100, 100], 사기 = 50): SeasonState => {
  const state = startNewSeason(0, '테스터')
  return {
    ...state,
    teamMorale: 사기,
    teamAbilities: state.teamAbilities.map((팀, index) => (index === 0 ? [...능력치] : 팀)),
  }
}

/** 줄 단추 — 이름에 값이 붙어 있어 글을 품고 있는지로 찾는다 */
const 줄 = (이름: string) =>
  screen.getAllByRole('button').find((button) => (button.textContent ?? '').includes(이름)) as HTMLElement

const 알림글 = () => screen.getByRole('dialog', { name: '알림' }).textContent ?? ''

describe('시즌 팀 트레이닝 (상태 0xcf)', () => {
  it('칸 0~3 능력치와 칸 4 지옥훈련이 차례대로 나온다', () => {
    render(<SeasonTrainingScreen state={시즌([111, 222, 333, 444])} gamePoints={1000} onTrain={vi.fn()} onBack={vi.fn()} />)

    const 글들 = screen.getAllByRole('button').map((button) => (button.textContent ?? '').replace('▶', '').trim())
    expect(글들.slice(0, 5)).toEqual(['투구111', '타격222', '집중333', '근성444', '지옥훈련500G'])
  })

  it('능력치 칸을 고르면 확인 팝업을 거쳐 그 칸을 넘긴다', () => {
    const onTrain = vi.fn()
    render(<SeasonTrainingScreen state={시즌()} gamePoints={1000} onTrain={onTrain} onBack={vi.fn()} />)

    fireEvent.click(줄('타격'))
    expect(알림글()).toContain('[타격] 트레이닝')

    fireEvent.click(screen.getByRole('button', { name: '예' }))
    expect(onTrain).toHaveBeenCalledWith('타격', 1)
  })

  it('지옥훈련 확인 팝업은 StrMODE[141] "지옥훈련 500G" 를 보여 준다', () => {
    const onTrain = vi.fn()
    render(<SeasonTrainingScreen state={시즌()} gamePoints={500} onTrain={onTrain} onBack={vi.fn()} />)

    fireEvent.click(줄('지옥훈련'))
    expect(알림글()).toContain('지옥훈련 500G')

    fireEvent.click(screen.getByRole('button', { name: '예' }))
    expect(onTrain).toHaveBeenCalledWith('지옥훈련', 4)
  })

  it('아니오를 누르면 아무 일도 일어나지 않는다', () => {
    const onTrain = vi.fn()
    render(<SeasonTrainingScreen state={시즌()} gamePoints={1000} onTrain={onTrain} onBack={vi.fn()} />)

    fireEvent.click(줄('투구'))
    fireEvent.click(screen.getByRole('button', { name: '아니오' }))

    expect(onTrain).not.toHaveBeenCalled()
  })

  it('사기가 0 이면 StrMODE[193] 로 막는다', () => {
    const onTrain = vi.fn()
    render(<SeasonTrainingScreen state={시즌([100, 100, 100, 100], 0)} gamePoints={1000} onTrain={onTrain} onBack={vi.fn()} />)

    fireEvent.click(줄('투구'))

    expect(알림글()).toContain('사기가 0')
    expect(onTrain).not.toHaveBeenCalled()
  })

  it('G 가 모자라면 지옥훈련이 StrMODE[65] 로 막힌다', () => {
    const onTrain = vi.fn()
    render(<SeasonTrainingScreen state={시즌()} gamePoints={499} onTrain={onTrain} onBack={vi.fn()} />)

    fireEvent.click(줄('지옥훈련'))

    expect(알림글()).toContain('G포인트가 부족')
    expect(onTrain).not.toHaveBeenCalled()
  })

  it('⚠️ 원본 그대로 — 능력치가 999 인 칸만 막히고 998 은 훈련된다', () => {
    const onTrain = vi.fn()
    render(<SeasonTrainingScreen state={시즌([999, 998, 100, 100])} gamePoints={1000} onTrain={onTrain} onBack={vi.fn()} />)

    fireEvent.click(줄('투구'))
    expect(알림글()).toContain('능력치가 최대')
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(onTrain).not.toHaveBeenCalled()

    fireEvent.click(줄('타격'))
    fireEvent.click(screen.getByRole('button', { name: '예' }))
    expect(onTrain).toHaveBeenCalledWith('타격', 1)
  })

  it('⚠️ 지옥훈련은 일부만 최대면 알린 뒤 그대로 진행한다', () => {
    const onTrain = vi.fn()
    render(<SeasonTrainingScreen state={시즌([999, 999, 100, 100])} gamePoints={1000} onTrain={onTrain} onBack={vi.fn()} />)

    fireEvent.click(줄('지옥훈련'))
    expect(알림글()).toContain('[투구, 타격] 능력치가 최대')

    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    fireEvent.click(screen.getByRole('button', { name: '예' }))
    expect(onTrain).toHaveBeenCalledWith('지옥훈련', 4)
  })

  it('네 능력치가 다 최대면 지옥훈련이 거절된다', () => {
    const onTrain = vi.fn()
    render(<SeasonTrainingScreen state={시즌([999, 999, 999, 999])} gamePoints={1000} onTrain={onTrain} onBack={vi.fn()} />)

    fireEvent.click(줄('지옥훈련'))
    expect(알림글()).toContain('능력치가 최대')
    fireEvent.click(screen.getByRole('button', { name: '확인' }))

    expect(onTrain).not.toHaveBeenCalled()
  })

  it('취소(−16) 는 관리 메뉴로 돌아간다', () => {
    const onBack = vi.fn()
    render(<SeasonTrainingScreen state={시즌()} gamePoints={1000} onTrain={vi.fn()} onBack={onBack} />)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onBack).toHaveBeenCalled()
  })
})

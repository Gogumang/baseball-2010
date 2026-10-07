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

/** 커맨드 줄 칸 — 단추 이름이 칸 id 다 */
const 줄 = (이름: string) => screen.getByRole('button', { name: 이름 })

const 알림글 = () => screen.getByRole('dialog', { name: '알림' }).textContent ?? ''

describe('시즌 팀 트레이닝 (상태 0xcf)', () => {
  it('칸 0~3 능력치와 칸 4 지옥훈련이 차례대로 나온다 — 커맨드 줄 표 0xd47c0 · 0xd47ca (값은 그리지 않는다)', () => {
    const { container } = render(
      <SeasonTrainingScreen state={시즌([111, 222, 333, 444])} gamePoints={1000} onTrain={vi.fn()} onBack={vi.fn()} />,
    )

    const 칸들 = screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))
    expect(칸들.slice(0, 5)).toEqual(['투구', '타격', '집중', '근성', '지옥훈련'])
    const 아이콘 = [...container.querySelectorAll('[data-testid="command-bar"] button img')].map((img) => img.getAttribute('src'))
    expect(아이콘).toEqual([
      './sprites/management/icon_selected_17.png', './sprites/mode_icon/011.png', './sprites/mode_icon/013.png',
      './sprites/mode_icon/014.png', './sprites/mode_icon/019.png',
    ])
    expect(container.textContent).not.toContain('500G')
  })

  it('능력치 칸을 고르면 확인 팝업을 거쳐 그 칸을 넘긴다', () => {
    const onTrain = vi.fn()
    render(<SeasonTrainingScreen state={시즌()} gamePoints={1000} onTrain={onTrain} onBack={vi.fn()} />)

    fireEvent.click(줄('타격'))
    // sprintf(StrMODE[85], StrMODE[45]) — "[타격훈련]을 하시겠습니까?"
    expect(알림글()).toContain('[타격훈련]을 하시겠습니까?')

    fireEvent.click(screen.getByRole('button', { name: '예' }))
    // 예 → 상태 0xde 훈련 팝업 0x848d0 — 굴림(onTrain)은 연출이 끝난 뒤다
    expect(onTrain).not.toHaveBeenCalled()
    expect(screen.getByTestId('시즌-훈련팝업').getAttribute('data-slot')).toBe('1')
    // 확인 키(0x4968)는 게이지 끝으로 건너뛴다
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onTrain).toHaveBeenCalledWith('타격', 1)
  })

  it('지옥훈련 확인 팝업은 StrMODE[141] "지옥훈련 500G" 를 보여 준다', () => {
    const onTrain = vi.fn()
    render(<SeasonTrainingScreen state={시즌()} gamePoints={500} onTrain={onTrain} onBack={vi.fn()} />)

    fireEvent.click(줄('지옥훈련'))
    expect(알림글()).toContain('[지옥훈련]을 하시겠습니까?')
    expect(알림글()).toContain('500 G포인트가 소모됩니다')

    fireEvent.click(screen.getByRole('button', { name: '예' }))
    fireEvent.keyDown(window, { key: '5' })
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
    // 예 → 상태 0xde 훈련 팝업 0x848d0 — 굴림(onTrain)은 연출이 끝난 뒤다
    expect(onTrain).not.toHaveBeenCalled()
    expect(screen.getByTestId('시즌-훈련팝업').getAttribute('data-slot')).toBe('1')
    // 확인 키(0x4968)는 게이지 끝으로 건너뛴다
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onTrain).toHaveBeenCalledWith('타격', 1)
  })

  it('⚠️ 지옥훈련은 일부만 최대면 그 칸들을 [192] 줄로 앞에 붙인 [141] 확인 팝업 하나로 묻는다 (0x9224~0x9262)', () => {
    const onTrain = vi.fn()
    render(<SeasonTrainingScreen state={시즌([999, 999, 100, 100])} gamePoints={1000} onTrain={onTrain} onBack={vi.fn()} />)

    fireEvent.click(줄('지옥훈련'))
    expect(알림글()).toContain('[투구] 능력치가 최대입니다')
    expect(알림글()).toContain('[타격] 능력치가 최대입니다')
    expect(알림글()).toContain('[지옥훈련]을 하시겠습니까?')

    fireEvent.click(screen.getByRole('button', { name: '예' }))
    fireEvent.keyDown(window, { key: '5' })
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
  it('결과 팝업 0xf25c — 시즌 팀 이름표 · dy 0 표, 확인으로 닫고 위·아래는 글 줄을 돈다 (키 0xf2c8)', () => {
    const onCloseResult = vi.fn()
    const result = {
      current: { ability: [106, 100, 100, 100], morale: 43 },
      change: { ability: [6, 0, 0, 0], morale: -8 },
      bonus: { ability: [0, 0, 0, 0], morale: -1 },
      messages: ['가', '나', '다', '라', '마'],
    }
    const { container } = render(
      <SeasonTrainingScreen state={시즌()} gamePoints={1000} onTrain={vi.fn()} onBack={vi.fn()}
        result={result} onCloseResult={onCloseResult} />,
    )
    const 창 = screen.getByRole('dialog', { name: '상세정보' })
    const 이름표 = [...창.querySelectorAll('img')].map((img) => img.getAttribute('src'))
      .filter((src) => /img_text\/frames\/(046|347|204|205|084)\.png$/.test(src ?? ''))
    expect(이름표).toHaveLength(5)
    // 0x872d4(창, 0) — 글 상자는 박스 5 y 180 그대로 (나리 0x8a0a4 는 −4)
    expect(container.querySelector('[data-part="track"]')?.getAttribute('y')).toBe('180')

    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(창.textContent).not.toContain('가')
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(창.textContent).toContain('가')
    fireEvent.keyDown(window, { key: '5' })
    expect(onCloseResult).toHaveBeenCalledTimes(1)
  })

  it('보정 글이 없으면 글 상자 · 스크롤 막대를 안 그린다 (0x87700 빈 글)', () => {
    const result = {
      current: { ability: [106, 100, 100, 100], morale: 43 },
      change: { ability: [6, 0, 0, 0], morale: -8 },
      bonus: { ability: [0, 0, 0, 0], morale: 0 },
      messages: [],
    }
    render(<SeasonTrainingScreen state={시즌()} gamePoints={1000} onTrain={vi.fn()} onBack={vi.fn()} result={result} />)
    expect(screen.queryByTestId('상세스크롤막대')).toBeNull()
  })
})

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ManagementScreen } from '@/pages/management/ui/ManagementScreen'
import type { ManagementScreenProps } from '@/pages/management/ui/ManagementScreen'
import { createCareer } from '@/entities/career/model/playerCareer'

/** 알림 상자는 "확인"을 누르면 닫히고, 같은 문구라도 다시 띄우면 다시 보여야 한다. */

afterEach(cleanup)

const BLOCKED_NOTICE = '트레이닝·휴식·외출은 한 번에 한 가지만 할 수 있습니다'

function propsWith(overrides: Partial<ManagementScreenProps>): ManagementScreenProps {
  return {
    career: createCareer('테스터'),
    noticeText: '',
    onSelect: vi.fn(),
    onTraining: vi.fn(),
    onTrainingBlocked: vi.fn(),
    isTrainingBlocked: () => false,
    isRestBlocked: () => false,
    detail: null,
    onCloseDetail: vi.fn(),
    onDismissNotice: vi.fn(),
    onOpenShop: vi.fn(),
    onOpenPlayerInfo: vi.fn(),
    onExit: vi.fn(),
    ...overrides,
  }
}

const noticeBox = () => screen.queryByRole('dialog', { name: '알림' })
const clickCommand = (name: string) => fireEvent.click(screen.getByRole('button', { name }))

describe('관리 화면 알림 상자', () => {
  it('[확인] 을 누르면 알림을 지워 달라고 세션에 알린다', () => {
    const onDismissNotice = vi.fn()
    render(<ManagementScreen {...propsWith({ noticeText: BLOCKED_NOTICE, onDismissNotice })} />)

    screen.getByRole('button', { name: '확인' }).click()

    expect(onDismissNotice).toHaveBeenCalledTimes(1)
  })

  it('같은 문구를 다시 띄우면 상자가 다시 보인다 (막힌 칸을 두 번 고르는 경우)', () => {
    // 첫 알림 — 확인해서 닫는다
    const first = render(<ManagementScreen {...propsWith({ noticeText: BLOCKED_NOTICE })} />)
    screen.getByRole('button', { name: '확인' }).click()
    first.rerender(<ManagementScreen {...propsWith({ noticeText: '' })} />)
    expect(noticeBox(), '확인을 눌렀는데 상자가 남아 있다').toBeNull()

    // 같은 칸을 또 골라 같은 문구가 다시 온다
    first.rerender(<ManagementScreen {...propsWith({ noticeText: BLOCKED_NOTICE })} />)

    expect(noticeBox(), '같은 문구라 상자가 다시 뜨지 않았다').not.toBeNull()
  })

  it('상점 등을 다녀와 화면이 다시 마운트돼도, 알림이 없으면 예전 알림이 되살아나지 않는다', () => {
    const first = render(<ManagementScreen {...propsWith({ noticeText: BLOCKED_NOTICE })} />)
    screen.getByRole('button', { name: '확인' }).click()
    cleanup()

    render(<ManagementScreen {...propsWith({ noticeText: '' })} />)

    expect(noticeBox(), `다시 마운트한 뒤 상자가 떴다: ${first !== null}`).toBeNull()
  })

  it('알림이 떠 있는 동안 Escape 는 알림만 닫는다 — 관리 화면을 빠져나가지 않는다', () => {
    const onExit = vi.fn()
    const onDismissNotice = vi.fn()
    render(<ManagementScreen {...propsWith({ noticeText: BLOCKED_NOTICE, onExit, onDismissNotice })} />)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onDismissNotice).toHaveBeenCalledTimes(1)
    expect(onExit, '알림을 닫는 Escape 가 화면까지 빠져나갔다').not.toHaveBeenCalled()
  })

  /**
   * 원본은 훈련 칸 0~3 에만 StrMODE[85] "…훈련을 하시겠습니까?" 를 붙인다.
   * 칸 4(필살타법)는 전용 화면(상태 0x6c)으로 가서 StrMODE[69]~[71] 을 쓴다 — 그 화면은 아직 없다.
   */
  it('능력 훈련 칸은 [%s훈련]을 하시겠습니까? 로 묻는다', () => {
    render(<ManagementScreen {...propsWith({})} />)

    clickCommand('트레이닝')
    clickCommand('히트')

    expect(screen.queryByRole('dialog', { name: '알림' })?.textContent).toContain('하시겠습니까')
  })

  it('필살타법 칸은 묻지 않는다 — 원본은 칸 4 에 그 질문이 없다', () => {
    const onTraining = vi.fn()
    render(<ManagementScreen {...propsWith({ onTraining })} />)

    clickCommand('트레이닝')
    clickCommand('필살타법')

    expect(
      screen.queryByRole('dialog', { name: '알림' })?.textContent ?? '(창 없음)',
      '필살타법에 StrMODE[85] 질문이 붙었다',
    ).not.toContain('하시겠습니까')
  })

  it('알림이 떠 있는 동안 Enter 는 뒤쪽 커맨드를 고르지 않는다', () => {
    const onSelect = vi.fn()
    render(<ManagementScreen {...propsWith({ noticeText: BLOCKED_NOTICE, onSelect })} />)

    fireEvent.keyDown(window, { key: 'Enter' })

    expect(onSelect, '알림 뒤의 [선수정보] 까지 눌렸다').not.toHaveBeenCalled()
  })
})

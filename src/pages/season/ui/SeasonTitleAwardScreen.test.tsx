// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SeasonTitleAwardScreen } from '@/pages/season/ui/SeasonTitleAwardScreen'
import { LEADER_KIND } from '@/entities/awards/model/leaderboard'
import { NO_TEAM, TITLE_USER_EVENT_INDEX } from '@/entities/awards/model/seasonAwards'
import type { TitleSlot } from '@/entities/awards/model/seasonAwards'
import { TEAMS } from '@/shared/config/original/teams'

/**
 * 타자시상(0xeb) · 투수시상(0xec) — P4 1a·2a·2b 절.
 * 결과 이벤트가 **시즌모드 번호**(372/373 · 374/375)로 갈리는지, 보상이 평판 +10 · 소지금 500만인지 본다.
 */

afterEach(cleanup)

const 타이틀 = (name: keyof typeof TITLE_USER_EVENT_INDEX, teamId: number, winner: string, isMine: boolean): TitleSlot => ({
  name,
  kind: LEADER_KIND.홈런,
  userEventIndex: TITLE_USER_EVENT_INDEX[name],
  teamId,
  winnerName: winner,
  isMine,
})

const 창글 = () => screen.getByRole('group', { name: /시상/ }).textContent ?? ''

describe('타자시상 0xeb', () => {
  it('우리 팀 수상자가 없으면 이벤트 370 → 372 이고 보상이 없다', () => {
    render(
      <SeasonTitleAwardScreen
        role="타자"
        titles={[타이틀('홈런왕', 5, '김선수', false), 타이틀('타점왕', 7, '이선수', false)]}
        onNext={vi.fn()}
      />,
    )

    expect(창글()).toContain('이벤트 370 → 372')
    expect(창글()).toContain('우리 팀 수상자 없음')
  })

  it('우리 팀 수상자가 있으면 373 이고 평판 +10 · 소지금 500만이다', () => {
    render(
      <SeasonTitleAwardScreen
        role="타자"
        titles={[타이틀('홈런왕', 0, '내선수', true), 타이틀('타점왕', 7, '이선수', false)]}
        onNext={vi.fn()}
      />,
    )

    expect(창글()).toContain('이벤트 370 → 373')
    expect(창글()).toContain('평판 +10')
    // 소지금은 100만 원 단위 5 → 만원 500 → "500만"
    expect(창글()).toContain('소지금 +500만')
  })

  it('수상자 팀·이름을 그대로 보여 주고, 팀 칸이 10 이면 "없음" 이다', () => {
    render(
      <SeasonTitleAwardScreen
        role="타자"
        titles={[타이틀('홈런왕', 3, '박선수', false), 타이틀('타율왕', NO_TEAM, '', false)]}
        onNext={vi.fn()}
      />,
    )

    expect(창글()).toContain(`${TEAMS[3].name} 박선수`)
    expect(창글()).toContain('없음')
  })
})

describe('투수시상 0xec', () => {
  it('우리 팀 수상자가 없으면 이벤트 371 → 374 다', () => {
    render(
      <SeasonTitleAwardScreen role="투수" titles={[타이틀('다승왕', 4, '최투수', false)]} onNext={vi.fn()} />,
    )

    expect(창글()).toContain('이벤트 371 → 374')
  })

  it('우리 팀 수상자가 있으면 375 다 — ⚠️ 나리의 "371 + 수상 개수" 와 다른 번호다', () => {
    render(
      <SeasonTitleAwardScreen role="투수" titles={[타이틀('다승왕', 0, '내투수', true)]} onNext={vi.fn()} />,
    )

    expect(창글()).toContain('이벤트 371 → 375')
    expect(창글()).not.toContain('→ 372')
  })
})

describe('키', () => {
  it('확인(Enter) 으로 다음 단계로 간다', () => {
    const onNext = vi.fn()
    render(<SeasonTitleAwardScreen role="타자" titles={[타이틀('홈런왕', 0, '내선수', true)]} onNext={onNext} />)

    fireEvent.keyDown(window, { key: 'Enter' })

    expect(onNext).toHaveBeenCalled()
  })

  it('취소(−16) 도 같은 곳으로 간다 — 시상은 되돌아갈 데가 없다', () => {
    const onNext = vi.fn()
    render(<SeasonTitleAwardScreen role="타자" titles={[타이틀('홈런왕', 0, '내선수', true)]} onNext={onNext} />)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onNext).toHaveBeenCalled()
  })
})

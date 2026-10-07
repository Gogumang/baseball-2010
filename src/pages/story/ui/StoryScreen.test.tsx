// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { StoryScreen } from '@/pages/story/ui/StoryScreen'
import type { OriginalEvent } from '@/shared/config/original/eventTypes'

const 이벤트: OriginalEvent = {
  id: 1,
  audience: 0,
  repeatable: false,
  trigger: 0,
  requiresEvent: 0,
  dateFrom: [0, 0],
  dateTo: [0, 0],
  conditions: [],
  commands: [{ op: 'say', text: '안녕', speaker: 0, format: 0, portraits: [] }],
} as unknown as OriginalEvent

describe('StoryScreen — 관리 화면 위에 겹치는 덮개다', () => {
  it('자기 배경을 칠하지 않는다 — 뒤 화면이 비쳐야 원본과 같다', () => {
    const { container } = render(
      <StoryScreen
        events={[이벤트]}
        event={이벤트}
        playerName="테스트"
        teamName="드래곤즈"
        onComplete={() => {}}
        onMatch={() => {}}
      />,
    )

    // 예전에는 PixelScreen 제목줄("이벤트")과 소프트키를 스스로 그려 화면을 통째로 덮었다
    expect(screen.queryByText('이벤트')).toBeNull()
    const root = container.firstElementChild as HTMLElement
    expect(root.className).toContain('overlay')
  })

  it('선택지는 원본 대사 창 갈래로 그린다 — 화살표 없이 고른 줄만 색이 바뀐다 (0x7fd22)', () => {
    const 선택지이벤트 = {
      ...이벤트,
      commands: [{ op: 'choice', portraits: [], choices: [{ text: '예', gotoEvent: 2 }, { text: '아니오', gotoEvent: 3 }] }],
    } as unknown as OriginalEvent

    render(
      <StoryScreen
        events={[선택지이벤트]}
        event={선택지이벤트}
        playerName="테스트"
        teamName="드래곤즈"
        onComplete={() => {}}
        onMatch={() => {}}
      />,
    )

    const 줄 = screen.getAllByRole('option')
    expect(줄).toHaveLength(2)
    // 원본은 고른 줄 글자색만 바꾼다 — ▶ 커서를 그리지 않는다
    expect(줄.map((item) => item.textContent).join('')).not.toContain('▶')
    expect(줄[0].getAttribute('aria-selected')).toBe('true')
    expect(줄[0].className).toContain('choiceItem')
  })

  it('대사는 그대로 보여 준다', () => {
    render(
      <StoryScreen
        events={[이벤트]}
        event={이벤트}
        playerName="테스트"
        teamName="드래곤즈"
        onComplete={() => {}}
        onMatch={() => {}}
      />,
    )

    // MarkupText 가 글자를 여러 조각으로 나눠 그리므로 대사 버튼 전체 글로 본다
    expect(screen.getAllByRole('button')[0].textContent).toContain('안녕')
  })
})

describe('StoryScreen — 이벤트별 %s 글 (replacementsFor)', () => {
  const 연봉이벤트 = {
    ...이벤트,
    id: 380,
    commands: [{ op: 'say', text: '%s만 상승해서 %s만이다', speaker: 0, format: 0, portraits: [] }],
  } as unknown as OriginalEvent

  it('넘기면 그 이벤트의 %s 자리에 넣는다 (380 연봉 제시액 0x8bc4c)', () => {
    render(
      <StoryScreen
        events={[연봉이벤트]}
        event={연봉이벤트}
        playerName="테스트"
        teamName="드래곤즈"
        replacementsFor={(eventId) => (eventId === 380 ? ['5000', '1억'] : undefined)}
        onComplete={() => {}}
        onMatch={() => {}}
      />,
    )

    expect(screen.getByText(/5000만 상승해서 1억만이다/)).toBeTruthy()
  })

  it('undefined 면 예전대로 이름·팀이다', () => {
    render(
      <StoryScreen
        events={[연봉이벤트]}
        event={연봉이벤트}
        playerName="테스트"
        teamName="드래곤즈"
        replacementsFor={() => undefined}
        onComplete={() => {}}
        onMatch={() => {}}
      />,
    )

    expect(screen.getByText(/테스트만 상승해서 드래곤즈만이다/)).toBeTruthy()
  })
})

describe('StoryScreen — system 3·4 발표 창 (0x8cf64 → 0x8b3bc · 0x8b23c)', () => {
  const 발표이벤트 = {
    ...이벤트,
    commands: [
      { op: 'say', text: '누가 잘했는지 볼까?', speaker: 0, format: 0, portraits: [] },
      { op: 'reward', items: [{ kind: 3, value: 1 }] },
      { op: 'system', sub: 3, arg: 77 },
      { op: 'reward', items: [{ kind: 0, value: 2 }] },
    ],
  } as unknown as OriginalEvent

  it('글을 주면 창에서 멈추고, 넘기면 창 뒤 명령까지 지나 끝난다 — 보상은 한 번씩만', () => {
    const 끝: { rewards: readonly unknown[] }[] = []
    const { container } = render(
      <StoryScreen
        events={[발표이벤트]}
        event={발표이벤트}
        playerName="테스트"
        teamName="드래곤즈"
        onComplete={(rewards) => 끝.push({ rewards })}
        onMatch={() => {}}
        systemWindowTextOf={(command) => (command.sub === 3 ? '!C[홈런왕] 선정!N서울 드래곤즈 테스트' : null)}
      />,
    )
    const 대사창 = () => within(container).getByRole('button')
    fireEvent.click(대사창())
    expect(대사창().textContent).toContain('홈런왕')
    expect(끝).toHaveLength(0)
    fireEvent.click(대사창())
    expect(끝).toHaveLength(1)
    expect(끝[0].rewards).toHaveLength(2)
  })

  it('글을 안 주면 예전처럼 지나간다', () => {
    const 끝: number[] = []
    const { container } = render(
      <StoryScreen
        events={[발표이벤트]}
        event={발표이벤트}
        playerName="테스트"
        teamName="드래곤즈"
        onComplete={() => 끝.push(1)}
        onMatch={() => {}}
      />,
    )
    fireEvent.click(within(container).getByRole('button'))
    expect(끝).toHaveLength(1)
  })
})

describe('StoryScreen — 명령 5 화면효과', () => {
  it('id 4(효과기 종류 2)는 검정 덮기 단계 0 — 완전 검정부터 띄운다 (0x9aac4 단계 0 = 0)', () => {
    const 효과이벤트 = {
      ...이벤트,
      commands: [{ op: 'effect', id: 4 }, { op: 'say', text: '안녕', speaker: 0, format: 0, portraits: [] }],
    } as unknown as OriginalEvent

    render(
      <StoryScreen
        events={[효과이벤트]}
        event={효과이벤트}
        playerName="테스트"
        teamName="드래곤즈"
        onComplete={() => {}}
        onMatch={() => {}}
      />,
    )

    const 덮개 = screen.getByTestId('screen-effect-cover')
    expect(덮개.style.opacity).toBe('1')
    expect(덮개.style.background).toContain('0, 0, 0')
  })
})

describe('system 1 — 올해의 목표 창 (0x8d304 → 0x741a1 · 그리기 0x86fdc)', () => {
  const 연초 = {
    ...이벤트,
    id: -115,
    commands: [
      { op: 'say', text: '올해의 목표다!!', speaker: 2, format: 0, portraits: [] },
      { op: 'system', sub: 1, arg: 0 },
    ],
  } as unknown as OriginalEvent
  const 값 = { labelSet: 0 as const, current: [0, 0, 0, 0, 0], goals: [260, 44, 3, 22, 50] }

  it('대사 뒤 창에서 멈추고, 누르면 닫혀 이벤트가 끝난다', () => {
    let 끝 = 0
    render(
      <StoryScreen events={[연초]} event={연초} playerName="테스트" teamName="드래곤즈"
        onComplete={() => { 끝 += 1 }} onMatch={() => {}} yearGoalWindowOf={() => 값} />,
    )
    fireEvent.click(screen.getByText('올해의 목표다!!'))
    const 창 = screen.getByTestId('올해의-목표-창')
    // 제목 358 · 이름 318 58 180 319 327 · 머리 87 148
    const 글 = [...창.querySelectorAll('img[data-frame]')].map((node) => Number(node.getAttribute('data-frame')))
    expect(글).toEqual([358, 318, 58, 180, 319, 327, 87, 148])
    expect(끝).toBe(0)
    fireEvent.click(창)
    expect(끝).toBe(1)
  })

  it('값을 안 넘기면 예전처럼 지나간다', () => {
    let 끝 = 0
    render(
      <StoryScreen events={[연초]} event={연초} playerName="테스트" teamName="드래곤즈"
        onComplete={() => { 끝 += 1 }} onMatch={() => {}} />,
    )
    fireEvent.click(screen.getByText('올해의 목표다!!'))
    expect(screen.queryByTestId('올해의-목표-창')).toBeNull()
    expect(끝).toBe(1)
  })
})

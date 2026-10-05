// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
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

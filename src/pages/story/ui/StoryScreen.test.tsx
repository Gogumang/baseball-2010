// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { StoryScreen } from '@/pages/story/ui/StoryScreen'
import type { OriginalEvent } from '@/shared/config/original/eventTypes'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** 재생기 틀 n 번 (0x7fbc4 가 그릴 때마다 상자가 오르고 글자가 찍힌다) */
const 틀 = (n = 1) => act(() => {
  vi.advanceTimersByTime(n * millisecondsPerFrame())
})
const 대사글 = () => screen.getByTestId('대사-상자').textContent ?? ''
/** 상자가 다 오르고 글을 끝까지 찍은 뒤 확인 — 글 끝(단계 4)이면 다음 명령 */
const 대사넘기기 = () => {
  틀(200)
  fireEvent.click(screen.getByRole('button', { name: '대사 넘기기' }))
}

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

    틀(200)
    expect(대사글()).toContain('안녕')
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

    틀(200)
    expect(대사글()).toContain('5000만 상승해서 1억만이다')
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

    틀(200)
    expect(대사글()).toContain('테스트만 상승해서 드래곤즈만이다')
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
    대사넘기기()
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
    void container
    대사넘기기()
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
    대사넘기기()
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
    대사넘기기()
    expect(screen.queryByTestId('올해의-목표-창')).toBeNull()
    expect(끝).toBe(1)
  })
})

describe('say 대사 상자 — 0x7fbc4 · 0x7fad0 · 키 0x8b804', () => {
  const 띄우기 = (commands: readonly unknown[], props: Partial<Parameters<typeof StoryScreen>[0]> = {}) => {
    const 이벤트들 = { ...이벤트, commands } as unknown as OriginalEvent
    let 끝 = 0
    render(
      <StoryScreen events={[이벤트들]} event={이벤트들} playerName="테스트" teamName="드래곤즈"
        onComplete={() => { 끝 += 1 }} onMatch={() => {}} {...props} />,
    )
    return { 끝: () => 끝 }
  }
  const 본체 = () => screen.getByTestId('대사-상자').querySelector('[data-part="본체"]') as SVGRectElement
  const 띠 = () => screen.getByTestId('대사-상자').querySelector('[data-part="띠"]') as SVGRectElement
  const 글줄 = () => [...screen.getByTestId('대사-상자').querySelectorAll('[data-part="글줄"]')] as HTMLElement[]

  it('첫 say 는 아래에서 틀마다 15 씩 올라와 55 에서 멈추고, 띠 12 는 그 위 — 다 오른 뒤에야 글을 찍는다', () => {
    띄우기([{ op: 'say', text: '안녕', speaker: 0, format: 0, portraits: [] }])
    expect(본체().getAttribute('height')).toBe('0')
    틀()
    expect(본체().getAttribute('height')).toBe('15')
    expect(띠().getAttribute('y')).toBe(String(320 - 15 - 12))
    expect(글줄()).toHaveLength(0)
    틀(3)
    expect(본체().getAttribute('y')).toBe('265')
    expect(띠().getAttribute('y')).toBe('253')
    // 다 오른 그 틀에 3 바이트 — "안"(2) · "녕"(시작 바이트 2 < 3) 이 함께 나온다
    expect(글줄()[0].textContent).toBe('안녕')
    expect(글줄()[0].style.left).toBe('5px')
    expect(글줄()[0].style.top).toBe('270px')
  })

  it('틀마다 3 바이트 — 한글은 2 바이트, 색 표시 !cRRGGBB 는 8 바이트를 먹는다', () => {
    띄우기([{ op: 'say', text: '가나다라!cFF0000마바', speaker: 0, format: 0, portraits: [] }])
    틀(4)
    expect(글줄()[0].textContent).toBe('가나')
    틀()
    expect(글줄()[0].textContent).toBe('가나다')
    틀()
    expect(글줄()[0].textContent).toBe('가나다라')
    // 12 · 15 바이트는 아직 색 표시(8~15) 안이다
    틀(2)
    expect(글줄()[0].textContent).toBe('가나다라')
    틀()
    expect(글줄()[0].textContent).toBe('가나다라마')
  })

  it('확인: 찍는 중이면 쪽을 다 보이고(단계 2), 글 끝이면 다음 명령 — 상자가 오르는 동안은 아무 일도 없다', () => {
    const 결과 = 띄우기([{ op: 'say', text: '가나다라마바사아자차', speaker: 0, format: 0, portraits: [] }])
    const 누르기 = () => fireEvent.keyDown(window, { key: 'Enter' })
    누르기()
    틀(4)
    expect(글줄()[0].textContent).toBe('가나')
    누르기()
    틀()
    expect(글줄()[0].textContent).toBe('가나다라마바사아자차')
    expect(결과.끝()).toBe(0)
    누르기()
    expect(결과.끝()).toBe(1)
  })

  it('세 줄이 넘으면 쪽을 끊고, 쪽 끝에서 확인하면 다음 세 줄을 이어 찍는다 (0x7f7f4)', () => {
    띄우기([{ op: 'say', text: '하나!N둘!N셋!N넷', speaker: 0, format: 0, portraits: [] }])
    틀(200)
    expect(글줄().map((line) => line.textContent)).toEqual(['하나', '둘', '셋'])
    fireEvent.keyDown(window, { key: '5' })
    틀(200)
    expect(글줄().map((line) => line.textContent)).toEqual(['넷'])
  })

  it('말하는 이는 글 머리말 "[이름] : " — 이름은 초록 #00CC00 (0x8bab8 · 0xd4f50)', () => {
    띄우기([{ op: 'say', text: '좋아', speaker: 2, format: 0, portraits: [] }])
    틀(200)
    expect(대사글()).toContain('[감독] : 좋아')
    const 이름 = [...글줄()[0].querySelectorAll('span')].filter((span) => span.style.color === 'rgb(0, 204, 0)')
    expect(이름.map((span) => span.textContent).join('')).toBe('감독')
  })

  it('말하는 이 1 은 선수 이름 — 시즌모드(0x7b999)면 머리말이 없다', () => {
    띄우기([{ op: 'say', text: '좋아', speaker: 1, format: 0, portraits: [] }])
    틀(200)
    expect(대사글()).toContain('[테스트] : 좋아')
    cleanup()
    띄우기([{ op: 'say', text: '좋아', speaker: 1, format: 0, portraits: [] }], { isSeasonMode: true })
    틀(200)
    expect(대사글()).toBe('좋아')
  })

  it('둘째 say 는 상자가 다시 오르지 않는다 — [mgr+0x2c0] 이 이미 1 (0x8d1f2)', () => {
    띄우기([
      { op: 'say', text: '하나', speaker: 0, format: 0, portraits: [] },
      { op: 'say', text: '둘', speaker: 0, format: 0, portraits: [] },
    ])
    대사넘기기()
    expect(본체().getAttribute('height')).toBe('55')
    expect(글줄().map((line) => line.textContent).join('')).toBe('')
    틀()
    expect(글줄()[0].textContent).toBe('둘')
  })
})

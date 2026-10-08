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

  it('선택지는 대사 상자 안 글줄이다 — 줄 k 는 y + k × 14, 고른 줄은 노랑 테두리 (0x7fd22 · 0x6a978)', () => {
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

    // 재생은 높이 0 에서 시작한다 — 다 올라온(55) 틀부터 줄을 그린다
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    틀(3)
    const 줄 = screen.getAllByRole('option')
    expect(줄.map((item) => item.textContent)).toEqual(['예', '아니오'])
    expect(줄.map((item) => item.style.top)).toEqual(['270px', '284px'])
    expect(줄[0].getAttribute('aria-selected')).toBe('true')
    // 화살표 · 판이 없다 — 글은 흰색 그대로, 고른 줄에만 (3, y − 1) 폭 211 · 높이 13 노랑 테두리
    expect(screen.getByTestId('대사-상자').textContent).not.toContain('▶')
    const 테두리 = screen.getByTestId('대사-상자').querySelector('[data-part="고른줄"] rect') as SVGRectElement
    expect(테두리.getAttribute('stroke')).toBe('#FFFF00')
    expect([테두리.getAttribute('x'), 테두리.getAttribute('y'), 테두리.getAttribute('width'), 테두리.getAttribute('height')])
      .toEqual(['3.5', '269.5', '210', '12'])
  })

  it('선택지 키 — 위 · 아래는 갈래 수로 돌고, 확인은 상자가 오르는 중에도 그 줄의 이벤트로 간다 (0x8b804)', () => {
    const 선택지이벤트 = {
      ...이벤트,
      commands: [{
        op: 'choice', portraits: [],
        choices: [{ text: '하나', gotoEvent: 2 }, { text: '둘', gotoEvent: 3 }, { text: '셋', gotoEvent: 4 }],
      }],
    } as unknown as OriginalEvent
    const 갈래 = (id: number, text: string) =>
      ({ ...이벤트, id, commands: [{ op: 'say', text, speaker: 0, format: 0, portraits: [] }] }) as unknown as OriginalEvent
    render(
      <StoryScreen events={[선택지이벤트, 갈래(2, '첫째'), 갈래(3, '둘째'), 갈래(4, '셋째')]} event={선택지이벤트}
        playerName="테스트" teamName="드래곤즈" onComplete={() => {}} onMatch={() => {}} />,
    )
    // 위(−1) — (0 + 3 − 1) % 3 = 2 · 아래 '8' — (2 + 1) % 3 = 0 · '2' 다시 위 — 2
    fireEvent.keyDown(window, { key: 'ArrowUp' })
    fireEvent.keyDown(window, { key: '8' })
    fireEvent.keyDown(window, { key: '2' })
    // 좌우는 아무 일도 없다
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    fireEvent.keyDown(window, { key: 'Enter' })
    틀(200)
    expect(대사글()).toContain('셋째')
  })

  it('고른 이벤트가 say 없이 창을 띄우면 밑의 상자에는 선택지 줄과 고른 줄 테두리가 남는다 (0x8ba2c · 0x8b924)', () => {
    const 선택지이벤트 = {
      ...이벤트,
      commands: [{ op: 'choice', portraits: [], choices: [{ text: '갈래 하나', gotoEvent: 2 }, { text: '갈래 둘', gotoEvent: 3 }] }],
    } as unknown as OriginalEvent
    const 알림 = {
      ...이벤트, id: 3,
      commands: [
        { op: 'system', sub: 0, arg: 1, text: '알림 글' },
        { op: 'say', text: '다음 대사', speaker: 0, format: 0, portraits: [] },
      ],
    } as unknown as OriginalEvent
    render(
      <StoryScreen events={[선택지이벤트, 알림]} event={선택지이벤트} playerName="테스트" teamName="드래곤즈"
        onComplete={() => {}} onMatch={() => {}} />,
    )
    틀(3)
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'Enter' })
    틀()
    expect(screen.getByRole('dialog').textContent).toContain('알림 글')
    const 줄 = screen.getAllByRole('option')
    expect(줄.map((item) => item.textContent)).toEqual(['갈래 하나', '갈래 둘'])
    expect(줄[1].getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('대사-상자').querySelector('[data-part="고른줄"]')).not.toBeNull()
    // 창의 확인 — 옮긴 이벤트의 첫 say 는 [mgr+0x2c0] 이 0 이라(0x8be20) 상자를 내렸다 다시 올린다
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'OK' }))
    expect(screen.getByTestId('대사-상자').querySelector('[data-part="본체"]')?.getAttribute('height')).toBe('15')
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    틀(200)
    expect(대사글()).toContain('다음 대사')
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
    대사넘기기()
    // 보상 명령이 한 틀을 쓴다 — 그동안 창은 아직 없다 (0x8dac2 → 다음 0x8cf64)
    expect(within(container).queryByRole('dialog')).toBeNull()
    틀()
    // 0x8d404 — 공용 알림 창 0x74ef4(…, 종류 1): 대사 상자 밖 공용 판에 글 · [OK] 하나
    const 창 = within(container).getByRole('dialog')
    expect(창.textContent).toContain('홈런왕')
    expect(끝).toHaveLength(0)
    fireEvent.click(within(창).getByRole('button', { name: 'OK' }))
    expect(끝).toHaveLength(0)
    틀()
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
    // 보상 · system 3 · 보상 — 명령 하나에 한 틀
    틀(2)
    expect(끝).toHaveLength(0)
    틀()
    expect(끝).toHaveLength(1)
  })
})

describe('system 0 알림 · 예아니오 — 공용 창 0x74ef4 (0x8d288 · 0x8d426)', () => {
  const 띄우기 = (events: readonly OriginalEvent[]) => {
    const 끝: number[] = []
    render(
      <StoryScreen events={events} event={events[0]} playerName="테스트" teamName="드래곤즈"
        onComplete={() => 끝.push(1)} onMatch={() => {}} />,
    )
    return 끝
  }

  it('알림은 대사 상자 밖 공용 창 — 앞 say 상자는 글을 남긴 채 밑에 그려지고, 키는 창 것이다', () => {
    const 알림이벤트 = {
      ...이벤트,
      commands: [
        { op: 'say', text: '아이템을 볼까?', speaker: 0, format: 0, portraits: [] },
        { op: 'sound', id: 52 },
        { op: 'system', sub: 0, arg: 197, text: '!C하단 다섯 번째에 위치한!N아이템' },
      ],
    } as unknown as OriginalEvent
    const 끝 = 띄우기([알림이벤트])
    대사넘기기()
    // 소리 명령이 한 틀 — 그동안 앞 say 상자만 남고 키도 없다
    expect(screen.queryByRole('dialog')).toBeNull()
    틀()
    const 창 = screen.getByRole('dialog')
    expect(창.textContent).toContain('아이템')
    expect(within(창).getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual(['OK'])
    // 0x8b5ac 는 창이 떠 있어도 0x7fbc4 로 앞 say 를 그린다 — 다시 오르지도, 글을 다시 찍지도 않는다
    expect(대사글()).toContain('아이템을 볼까?')
    expect(screen.getByTestId('대사-상자').querySelector('[data-part="본체"]')?.getAttribute('height')).toBe('55')
    틀(10)
    expect(screen.getAllByTestId('대사-상자')[0].querySelector('[data-part="글줄"]')?.textContent).toBe('아이템을 볼까?')
    expect(끝).toHaveLength(0)
    // 상자 넘기기 단추는 지금 명령이 say 가 아니라 아무 일도 없다(0x8b804) — 창의 확인만 닫는다
    fireEvent.click(screen.getByRole('button', { name: '대사 넘기기' }))
    expect(끝).toHaveLength(0)
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(끝).toHaveLength(1)
  })

  it('예아니오는 [예] · [아니오] 그림 버튼 — 처음 커서는 [예], 답대로 그 이벤트로 간다 (0x8d954)', () => {
    const 질문 = {
      ...이벤트,
      commands: [
        { op: 'say', text: '갈래?', speaker: 0, format: 0, portraits: [] },
        { op: 'yesno', sub: 0, text: '정말 갈까요?', yesEvent: 2, noEvent: 3 },
      ],
    } as unknown as OriginalEvent
    const 예 = { ...이벤트, id: 2, commands: [{ op: 'say', text: '예를 골랐다', speaker: 0, format: 0, portraits: [] }] } as unknown as OriginalEvent
    const 아니오 = { ...이벤트, id: 3, commands: [{ op: 'say', text: '아니오를 골랐다', speaker: 0, format: 0, portraits: [] }] } as unknown as OriginalEvent
    띄우기([질문, 예, 아니오])
    대사넘기기()
    const 창 = screen.getByRole('dialog')
    expect(창.textContent).toContain('정말 갈까요?')
    expect(대사글()).toContain('갈래?')
    const 버튼 = within(창).getAllByRole('button')
    expect(버튼.map((button) => button.getAttribute('aria-label'))).toEqual(['예', '아니오'])
    // 고른 칸은 주황 그림 6 — 0x749d5 를 안 불러 첫 버튼
    expect(버튼[0].querySelector('img')?.getAttribute('src')).toContain('006.png')
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.queryByRole('dialog')).toBeNull()
    틀(200)
    expect(대사글()).toContain('아니오를 골랐다')
  })

  it('예아니오 취소(CLR)는 [아니오] (0x7514a — 키 −16 → 1)', () => {
    const 질문 = {
      ...이벤트,
      commands: [{ op: 'yesno', sub: 0, text: '정말?', yesEvent: 2, noEvent: 3 }],
    } as unknown as OriginalEvent
    const 아니오 = { ...이벤트, id: 3, commands: [{ op: 'say', text: '취소', speaker: 0, format: 0, portraits: [] }] } as unknown as OriginalEvent
    띄우기([질문, 아니오])
    // 앞 say 가 없으면 상자도 없다 — 0x7fbc4 는 상자 글 길이 0 이면 그리지 않는다(0x7fbe0)
    expect(screen.queryByTestId('대사-상자')).toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    틀(200)
    expect(대사글()).toContain('취소')
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
    // 창 없는 system 도 한 틀(0x8d91c — [창+9] == 0 → 0x8dac2)
    틀()
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
    // 0x8d1f2 가 높이를 0 으로 내린 그 틀의 그리기(0x7fad0)가 곧바로 15 로 올린다 — 높이 0 은 화면에 안 나간다
    expect(본체().getAttribute('height')).toBe('15')
    expect(띠().getAttribute('y')).toBe(String(320 - 15 - 12))
    expect(글줄()).toHaveLength(0)
    틀()
    expect(본체().getAttribute('height')).toBe('30')
    틀(2)
    expect(본체().getAttribute('y')).toBe('265')
    expect(띠().getAttribute('y')).toBe('253')
    // 다 오른 그 틀에 3 바이트 — "안"(2) · "녕"(시작 바이트 2 < 3) 이 함께 나온다
    expect(글줄()[0].textContent).toBe('안녕')
    expect(글줄()[0].style.left).toBe('5px')
    expect(글줄()[0].style.top).toBe('270px')
  })

  it('틀마다 3 바이트 — 한글은 2 바이트, 색 표시 !cRRGGBB 는 8 바이트를 먹는다', () => {
    띄우기([{ op: 'say', text: '가나다라!cFF0000마바', speaker: 0, format: 0, portraits: [] }])
    틀(3)
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
    틀(3)
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
    // 둘째 say 가 도는 틀의 그리기가 곧바로 3 바이트를 찍는다 (0x7f7d5 뒤 0x7fc64)
    expect(본체().getAttribute('height')).toBe('55')
    expect(글줄()[0].textContent).toBe('둘')
  })
})

describe('초상화 바닥 y · 효과 칠 — 0x7fbc4 끝 0x7fdee · 대화창 0x8b5ac', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame',
        'performance', 'Date'],
    })
  })
  const 띄우기 = (commands: readonly unknown[], props: Partial<Parameters<typeof StoryScreen>[0]> = {}) => {
    const 이벤트들 = { ...이벤트, commands } as unknown as OriginalEvent
    render(
      <StoryScreen events={[이벤트들]} event={이벤트들} playerName="테스트" teamName="드래곤즈"
        onComplete={() => {}} onMatch={() => {}} {...props} />,
    )
  }
  const 초상화판 = () => screen.getByTestId('event-portrait-layer')
  const 칠 = () => screen.queryByTestId('event-backdrop-fill')
  const 본체높이 = () =>
    screen.getByTestId('대사-상자').querySelector('[data-part="본체"]')?.getAttribute('height')
  const 말 = { op: 'say', text: '안녕', speaker: 0, format: 0, portraits: [] }
  /** 한 틀씩 — act 한 번 안에서는 효과기(rAF)가 푼 걸음을 끝에야 그리므로, 풀린 뒤 상자가 도는 것을 보려면 나눠 돌린다 */
  const 틀씩 = (n: number) => {
    for (let index = 0; index < n; index += 1) 틀()
  }

  it('관리 · 연초 · 시즌 위(기본)는 135 — 판 아래 여백 320 − 135', () => {
    띄우기([말])
    expect(초상화판().style.bottom).toBe('185px')
    expect(칠()).toBeNull()
  })

  it('외출 지도 · 장소 · 대결결과 위([gfx+0x174] 0x70 · 0x71)는 252', () => {
    띄우기([말], { isOverOutingMap: true })
    expect(초상화판().style.bottom).toBe('68px')
  })

  it('id 6 은 끝날 때까지 뒤 say 를 막는다 — 도는 동안 앞 say 상자 · 135 · 칠 없음, 끝난 그리기에 검정 칠 · 252 · 상자 높이 0, 그다음 틀에 뒤 say (0x8b564)', () => {
    띄우기([
      { op: 'say', text: '앞', speaker: 0, format: 0, portraits: [] },
      { op: 'effect', id: 6 },
      { op: 'say', text: '뒤', speaker: 0, format: 0, portraits: [] },
    ])
    틀(200)
    fireEvent.click(screen.getByRole('button', { name: '대사 넘기기' }))
    틀(4)
    // 효과가 도는 동안은 명령 5 에 머문다 — 앞 say 상자가 다 오른 채 남고, 키 0x8b804 는 아무 일도 안 한다
    expect(본체높이()).toBe('55')
    expect(대사글()).toBe('앞')
    expect(초상화판().style.bottom).toBe('185px')
    expect(칠()).toBeNull()
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(대사글()).toBe('앞')
    // 프레임 9 가 '끝'(+0x10 = 2) 그리기 — 칠 · 252 · 상자 높이 0(0x7f7cc)
    틀(6)
    expect(칠()?.style.background).toContain('0, 0, 0')
    expect(초상화판().style.bottom).toBe('68px')
    expect(Number(본체높이())).toBeLessThan(55)
    // 그다음 틀부터 뒤 say — 상자가 다시 올라 글을 처음부터 찍는다
    틀씩(20)
    expect(대사글()).toBe('뒤')
    expect(본체높이()).toBe('55')
    // 효과기가 비워진 뒤에도 [mgr+0x2c8] 은 남아 틀마다 칠한다
    expect(칠()).not.toBeNull()
    expect(초상화판().style.bottom).toBe('68px')
  })

  it('id 6 이 끝난 그리기는 상자를 0 으로 내리고 곧바로 15 로 올린다 — 뒤 say 는 그 높이에서 이어 오른다 (0x8b6d0 · 0x7fad0 · 0x8d1f2)', () => {
    띄우기([
      { op: 'say', text: '앞', speaker: 0, format: 0, portraits: [] },
      { op: 'effect', id: 6 },
      { op: 'say', text: '뒤', speaker: 0, format: 0, portraits: [] },
    ])
    틀(200)
    fireEvent.click(screen.getByRole('button', { name: '대사 넘기기' }))
    for (let index = 0; index < 20 && 본체높이() === '55'; index += 1) 틀씩(1)
    // '끝' 그리기 — 0x7f7cc 로 0 이 된 높이를 그 그리기의 0x7fad0 이 15 로 올린다(높이 0 은 화면에 안 나간다)
    const 상자글 = () => screen.getByTestId('대사-상자').getAttribute('data-text')
    expect(본체높이()).toBe('15')
    expect(상자글()).toBe('앞')
    for (let index = 0; index < 5 && 상자글() !== '뒤'; index += 1) 틀씩(1)
    // 뒤 say 는 이 이벤트의 첫 say 가 아니라 상자를 다시 내리지 않는다 — 15 에서 이어 오른다
    expect(상자글()).toBe('뒤')
    expect(['30', '45']).toContain(본체높이())
  })

  it('이벤트 첫 명령이 id 6 이면 끝날 때까지 상자가 없다 — 앞 글이 없으면 0x7fbc4 는 안 그린다', () => {
    띄우기([{ op: 'effect', id: 6 }, 말])
    틀(4)
    expect(screen.queryByTestId('대사-상자')).toBeNull()
    틀씩(20)
    expect(대사글()).toBe('안녕')
  })

  it('알림 창도 id 6 이 끝나 상자 · 초상화를 처음으로 돌린 뒤에 뜬다 — 처음으로 돌리기는 공용 창을 안 건드린다', () => {
    띄우기([
      { op: 'say', text: '앞', speaker: 0, format: 0, portraits: [] },
      { op: 'effect', id: 6 },
      { op: 'system', sub: 0, arg: 1, text: '알림' },
    ])
    틀(200)
    fireEvent.click(screen.getByRole('button', { name: '대사 넘기기' }))
    틀(4)
    expect(screen.queryByRole('dialog')).toBeNull()
    틀씩(20)
    expect(screen.getByRole('dialog').textContent).toContain('알림')
    // 처음으로 돌린 상자는 창 밑에서 다시 올라 앞 글을 처음부터 찍는다
    expect(대사글()).toBe('앞')
    expect(본체높이()).toBe('55')
  })

  it('id 6 바로 뒤가 경기 명령이면 끝난 틀에 상자 · 초상화를 비운다 — 처음으로 돌린 상자도 안 그린다 (0x8d9c2)', () => {
    const 경기 = vi.fn()
    const 얼굴 = [{ file: 'event_char_0', animation: 1, side: 'left' }]
    const 이벤트들 = {
      ...이벤트,
      commands: [
        { op: 'say', text: '한판 붙자', speaker: 0, format: 0, portraits: 얼굴 },
        { op: 'effect', id: 6 },
        { op: 'match', team: 1, resultEvents: [] },
      ],
    } as unknown as OriginalEvent
    render(
      <StoryScreen events={[이벤트들]} event={이벤트들} playerName="테스트" teamName="드래곤즈"
        onComplete={() => {}} onMatch={경기} />,
    )
    틀(200)
    fireEvent.click(screen.getByRole('button', { name: '대사 넘기기' }))
    for (let index = 0; index < 20 && 칠() === null; index += 1) 틀씩(1)
    // '끝' 그리기 — 검정 칠은 들었지만 칸 0 이 비어 0x7fbc4 가 상자를 안 그린다(id 6 만으로는 15 로 다시 오른다)
    expect(칠()).not.toBeNull()
    expect(screen.queryByTestId('대사-상자')).toBeNull()
    expect(초상화판().querySelectorAll('img')).toHaveLength(0)
    틀씩(3)
    expect(경기).toHaveBeenCalledTimes(1)
  })

  it('id 6 뒤 경기 명령은 효과가 끝난 뒤에 나간다', () => {
    const 경기 = vi.fn()
    const 이벤트들 = { ...이벤트, commands: [{ op: 'effect', id: 6 }, { op: 'match', team: 1, resultEvents: [] }] } as unknown as OriginalEvent
    render(
      <StoryScreen events={[이벤트들]} event={이벤트들} playerName="테스트" teamName="드래곤즈"
        onComplete={() => {}} onMatch={경기} />,
    )
    틀(5)
    expect(경기).not.toHaveBeenCalled()
    틀(10)
    expect(경기).toHaveBeenCalledTimes(1)
  })

  it('흔들기(2 · 3)는 안 막는다 — 효과를 건 다음 틀에 뒤 say 가 돈다', () => {
    띄우기([{ op: 'effect', id: 3 }, 말])
    expect(screen.queryByTestId('대사-상자')).toBeNull()
    // 효과기(rAF 16ms 칸)가 틀 1 에 닿으면 풀린다 — 막는 효과(10 틀)와 달리 곧바로다
    틀씩(2)
    expect(본체높이()).toBe('15')
    틀씩(3)
    expect(본체높이()).toBe('55')
  })

  it('id 4 가 끝나면 칠을 걷어 다시 135', () => {
    띄우기([{ op: 'effect', id: 6 }, 말, { op: 'effect', id: 4 }, 말])
    틀(30)
    expect(칠()).not.toBeNull()
    대사넘기기()
    // 건 직후 그리기(+0x10 = 0)는 남은 색을 칠한다(0x8b69a) — 도는 동안은 칠도 효과 칠 인자도 없다(0x8b6f0)
    expect(칠()).not.toBeNull()
    틀(2)
    expect(칠()).toBeNull()
    expect(초상화판().style.bottom).toBe('185px')
    틀(30)
    expect(칠()).toBeNull()
    expect(초상화판().style.bottom).toBe('185px')
  })
})

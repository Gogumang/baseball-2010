// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PitcherRegisterScreen } from '@/pages/pitcher-league/ui/PitcherRegisterScreen'
import { PitcherCreateFlow } from '@/pages/pitcher-league/ui/PitcherCreateFlow'
import type { PitcherRookieProfile } from '@/entities/pitcher-career/model/pitcherRegistration'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

// 들어올 때 연출(머리띠 다섯 그림 · 격자 열림 애니 0x79fa8)과 그동안의 키 막음(`useListPageEntry`)은 따로 시험한다 — 여기서는 다 연 뒤로 본다
vi.mock('@/widgets/screen-frame/model/useListPageEntry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/widgets/screen-frame/model/useListPageEntry')>()
  return { ...actual, useListPageEntry: actual.settledListPageEntry }
})

/**
 * 투수 등록 (0x66 · 그리기 0x15f34) · 기본 변화구 고르기 (0x67 · 0x162bc) — 원본 화면 한 장(`RawScreen`).
 * 웹 단추 대신 원본 그림 자리의 투명 누름 칸(`PressArea`)으로 누른다.
 */

afterEach(cleanup)

type OnCreate = (name: string, profile: PitcherRookieProfile) => void

const 화면 = (onCreate: OnCreate = () => {}, onCancel: () => void = () => {}) =>
  render(<PitcherRegisterScreen onCreate={onCreate} onCancel={onCancel} />)

const 이름넣기 = (name: string) => fireEvent.change(screen.getByLabelText('이름'), { target: { value: name } })
const 키 = (key: string) => fireEvent.keyDown(window, { key })
/** 0x66 마지막 줄까지 OK — 피부 줄에서 한 번 더면 0x67 */
const 변화구로 = () => {
  for (let row = 0; row < 5; row += 1) 키('Enter')
}
const 칸 = (name: string) => screen.getByRole('option', { name })
const 구질 = (name: string) => fireEvent.click(칸(name))
const 골랐나 = (cell: number) => screen.getByTestId(`변화구칸-${cell}`).dataset.chosen
const OK = () => fireEvent.click(칸('OK'))

describe('투수 등록 화면 (0x66)', () => {
  it('정보 칸 흰 글은 타입 · 보직 · 손 · 피부이고 기본값은 오버핸드 · 선발 · 우완 · 황인이다 (0x7c450 모드 3)', () => {
    화면()

    expect(screen.getByText('오버핸드')).toBeTruthy()
    expect(screen.getByText('선발')).toBeTruthy()
    expect(screen.getByText('우완')).toBeTruthy()
    expect(screen.getByText('황인')).toBeTruthy()
  })

  it('값 칸을 눌러 줄을 고르고 화살 누름 칸으로 바꾼다 — 보직 → 구원', () => {
    화면()

    fireEvent.click(칸('2줄 값'))
    fireEvent.click(screen.getByRole('button', { name: '2줄 다음' }))

    expect(screen.getByText('구원')).toBeTruthy()
  })

  it('고른 줄의 값 칸을 한 번 더 누르면 OK — 피부 줄이면 변화구 고르기(0x67)로 간다', () => {
    화면()
    이름넣기('투수')

    fireEvent.click(칸('4줄 값'))
    fireEvent.click(칸('4줄 값'))

    expect(screen.getByTestId('변화구-고르기')).toBeTruthy()
  })

  it('커서는 값 칸을 1 넓힌 노랑 둥근 테두리다 (0xba015) — 이름 줄 (59,200)', () => {
    vi.useFakeTimers()
    try {
      화면()
      act(() => {
        vi.advanceTimersByTime(millisecondsPerFrame() * 3)
      })
      const cursor = screen.queryByTestId('선수등록-커서')
      if (cursor !== null) expect(cursor.getAttribute('style')).toContain('left: 59px; top: 200px')
    } finally {
      vi.useRealTimers()
    }
  })

  it('이름이 비면 OK 가 막힌다 (strlen 0)', () => {
    화면()

    키('Enter')

    expect(screen.queryByTestId('변화구-고르기')).toBeNull()
  })

  it('이름이 빈 채 되돌아가기(CLR)면 팀 고르기로 (0x16f28)', () => {
    let canceled = false
    화면(
      () => {},
      () => {
        canceled = true
      },
    )

    fireEvent.click(screen.getByRole('button', { name: '되돌아가기' }))

    expect(canceled).toBe(true)
  })
})

describe('기본 변화구 고르기 (0x67)', () => {
  it('처음엔 아무것도 안 골라져 있고 정보 칸은 안 그린다 (0x15ef0)', () => {
    화면()
    이름넣기('테스트')

    변화구로()

    expect(골랐나(0)).toBe('false')
    expect(골랐나(1)).toBe('false')
    expect(screen.queryByTestId('등록-정보칸')).toBeNull()
  })

  it('StrMODE[12] 띠는 들어온 뒤 상태 틱 ≤ 0x31(50 틀) 동안만 — 다시 들어오면 다시 선다 (0x16690)', () => {
    vi.useFakeTimers()
    try {
      화면()
      이름넣기('테스트')
      변화구로()
      const 띠 = () => screen.getByTestId('변화구-고르기').querySelector('[data-description-band]')
      expect(띠()).not.toBeNull()

      act(() => {
        vi.advanceTimersByTime(millisecondsPerFrame() * 0x31)
      })
      expect(띠()).not.toBeNull()
      act(() => {
        vi.advanceTimersByTime(millisecondsPerFrame())
      })
      expect(띠()).toBeNull()

      키('Escape')
      키('Enter')
      expect(띠()).not.toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('0x67 에서 CLR 로 돌아오면 0x66 띠를 다시 펴지 않는다 — 0x10b18 이 편 같은 띠 [장면+0xd8] 를 이어받아 곧장 160 (0x17360 1736a → 1764e)', () => {
    vi.useFakeTimers()
    try {
      화면()
      이름넣기('테스트')
      const 띠폭 = () => document.querySelector('[data-description-band]')?.getAttribute('data-description-band')
      변화구로()
      act(() => {
        vi.advanceTimersByTime(millisecondsPerFrame() * 10)
      })
      키('Escape')
      expect(screen.queryByTestId('변화구-고르기')).toBeNull()
      expect(띠폭()).toBe('160')
    } finally {
      vi.useRealTimers()
    }
  })

  it('하나 이하로 OK 를 누르면 StrMODE[13] 알림, 두 개면 확인 상자다', () => {
    화면()
    이름넣기('테스트')
    변화구로()

    OK()
    expect(screen.getByText(/기본 변화구를/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '확인' }))

    구질('CURVE')
    OK()
    expect(screen.getByText(/기본 변화구를/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '확인' }))

    구질('FORK')
    OK()
    expect(screen.getByText(/이대로 결정/)).toBeTruthy()
  })

  it('짝 칸을 켜면 같은 계열이 꺼진다 (0x123ac, k^1)', () => {
    화면()
    이름넣기('테스트')
    변화구로()

    구질('SHOOT')
    구질('SINKER')

    expect(골랐나(2)).toBe('false')
    expect(골랐나(3)).toBe('true')
  })

  it('키: 마지막 줄(피부)에서 OK 를 누르면 변화구 고르기로, CLR 은 등록 줄로 (0x16f28 · 0x12410)', () => {
    화면()
    이름넣기('투수')
    for (let row = 0; row < 4; row += 1) 키('Enter')
    expect(screen.queryByTestId('변화구-고르기')).toBeNull()

    키('Enter')
    expect(screen.getByTestId('변화구-고르기')).toBeTruthy()

    키('Escape')
    expect(screen.getByLabelText('이름')).toBeTruthy()
  })

  it('칸 커서 — 처음 칸 0, ↓ 는 +2, OK 로 켠 뒤 두 개면 OK 칸으로 간다 (0x12410)', () => {
    화면()
    이름넣기('투수')
    변화구로()
    const 커서 = (name: string) => 칸(name).getAttribute('aria-selected')
    expect(커서('TWO-SEAM')).toBe('true')

    키('ArrowDown')
    expect(커서('SHOOT')).toBe('true')
    키('Enter')
    expect(골랐나(2)).toBe('true')
    expect(커서('CURVE')).toBe('true')

    키('6')
    키('5')
    expect(골랐나(5)).toBe('true')
    expect(커서('OK')).toBe('true')

    키('Enter')
    expect(screen.getByText(/이대로 결정/)).toBeTruthy()
  })

  it('CLR 로 등록 줄에 돌아갔다 와도 고른 변화구가 남는다', () => {
    화면()
    이름넣기('테스트')
    변화구로()
    구질('CURVE')

    fireEvent.click(screen.getByRole('button', { name: '되돌아가기' }))
    expect(screen.getByLabelText('이름')).toBeTruthy()
    키('Enter')

    expect(골랐나(4)).toBe('true')
  })

  it('[예] 로 고른 값이 그대로 넘어간다', () => {
    let created: { name: string; profile: PitcherRookieProfile } | null = null
    화면((name, profile) => {
      created = { name, profile }
    })
    이름넣기('투수')
    fireEvent.click(칸('2줄 값'))
    fireEvent.click(screen.getByRole('button', { name: '2줄 다음' }))
    fireEvent.click(칸('3줄 값'))
    fireEvent.click(screen.getByRole('button', { name: '3줄 다음' }))
    fireEvent.click(칸('4줄 값'))
    fireEvent.click(칸('4줄 값'))
    구질('TWO-SEAM')
    구질('FORK')
    OK()
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect(created).not.toBeNull()
    expect(created!.name).toBe('투수')
    expect(created!.profile.role).toBe(PITCHER_ROLE.relief)
    expect(created!.profile.handIndex).toBe(1)
    expect(created!.profile.breakingPitchSlots).toEqual([0, 6])
  })
})

describe('만들기 흐름 — 0x65 팀 고르기 → 0x66 등록', () => {
  it('팀을 고르면 등록 화면으로 간다', () => {
    render(<PitcherCreateFlow onCreate={() => {}} onCancel={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: '인천 돌핀즈' }))

    expect(screen.getByTestId('등록-정보칸')).toBeTruthy()
  })

  it('등록에서 취소하면 팀 고르기로 되돌아간다 (102 → 101)', () => {
    render(<PitcherCreateFlow onCreate={() => {}} onCancel={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: '서울 드래곤즈' }))

    fireEvent.click(screen.getByRole('button', { name: '되돌아가기' }))

    expect(screen.queryByTestId('등록-정보칸')).toBeNull()
    expect(screen.getByRole('button', { name: '되돌아가기' })).toBeTruthy()
  })

  it('고른 팀이 프로필에 실려 넘어온다', () => {
    let created: PitcherRookieProfile | null = null
    render(
      <PitcherCreateFlow
        onCreate={(_, profile) => {
          created = profile
        }}
        onCancel={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '대전 호크스' }))
    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '투수' } })
    변화구로()
    구질('TWO-SEAM')
    구질('FORK')
    OK()
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect(created).not.toBeNull()
    expect(created!.teamId).toBe(3)
  })
})

describe('터치 기기 OK 상황 버튼 (웹 — 원본 그림에 OK 자리가 없다)', () => {
  it('등록 줄 · 변화구 고르기에서 OK 버튼을 띄우고, 확인 상자가 뜨면 거둔다', async () => {
    const { touchKeyOffersNow } = await import('@/shared/lib/touchKeyOffer/touchKeyOffer')
    const okOffered = () => touchKeyOffersNow().some((offer) => offer.key === 'Enter' && offer.label === 'OK')
    화면()
    expect(okOffered()).toBe(true)
    이름넣기('투수')
    변화구로()
    expect(okOffered()).toBe(true)
    구질('CURVE')
    구질('FORK')
    OK()
    expect(screen.getByText(/이대로 결정/)).toBeTruthy()
    expect(okOffered()).toBe(false)
  })
})

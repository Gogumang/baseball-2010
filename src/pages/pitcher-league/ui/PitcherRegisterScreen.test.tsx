// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PitcherRegisterScreen } from '@/pages/pitcher-league/ui/PitcherRegisterScreen'
import { PitcherCreateFlow } from '@/pages/pitcher-league/ui/PitcherCreateFlow'
import type { PitcherRookieProfile } from '@/entities/pitcher-career/model/pitcherRegistration'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'

/**
 * 투수 등록 (0x66) — 고르는 줄은 타자편과 같은 다섯이고 뜻만 다르다.
 * 확인(0x67)도 화면을 비우지 않고 상자만 얹는다.
 */

afterEach(cleanup)

type OnCreate = (name: string, profile: PitcherRookieProfile) => void

const 화면 = (onCreate: OnCreate = () => {}) =>
  render(<PitcherRegisterScreen onCreate={onCreate} onCancel={() => {}} />)

const 이름넣기 = (name: string) =>
  fireEvent.change(screen.getByLabelText('이름'), { target: { value: name } })
const 등록버튼 = () => screen.getByRole<HTMLButtonElement>('button', { name: '등록' })
const OK버튼 = () => screen.getByRole<HTMLButtonElement>('button', { name: 'OK' })
const 구질 = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
const 눌림 = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed')

describe('투수 등록 화면', () => {
  it('고르는 줄은 타입·보직·손·피부이고 기본값은 타입1 · 선발 · 우완 · 황인이다', () => {
    화면()

    expect(screen.getByText('타입 1')).toBeTruthy()
    expect(screen.getByText('선발')).toBeTruthy()
    expect(screen.getByText('우완')).toBeTruthy()
    expect(screen.getByText('황인')).toBeTruthy()
  })

  it('보직을 구원으로 바꾸면 시작 능력치가 표 0xcc3f2 의 구원 줄로 바뀐다 (체력 200 → 100)', () => {
    화면()
    expect(screen.getByText('200')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '보직 다음' }))

    expect(screen.getByText('구원')).toBeTruthy()
    expect(screen.getByText('100')).toBeTruthy()
  })

  it('[등록] 은 변화구 고르기(0x67)로 간다 — 처음엔 아무것도 안 골라져 있고 정보 칸은 안 그린다', () => {
    화면()
    이름넣기('테스트')
    expect(screen.queryByRole('button', { name: 'TWO-SEAM' })).toBeNull()

    fireEvent.click(등록버튼())

    expect(눌림('TWO-SEAM')).toBe('false')
    expect(눌림('H.FAST')).toBe('false')
    expect(screen.queryByLabelText('이름')).toBeNull()
  })

  it('하나 이하로 OK 를 누르면 StrMODE[13] 알림, 두 개면 확인 상자다', () => {
    화면()
    이름넣기('테스트')
    fireEvent.click(등록버튼())

    fireEvent.click(OK버튼())
    expect(screen.getByText(/기본 변화구를/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '확인' }))

    구질('CURVE')
    fireEvent.click(OK버튼())
    expect(screen.getByText(/기본 변화구를/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '확인' }))

    구질('FORK')
    fireEvent.click(OK버튼())
    expect(screen.getByText(/이대로 결정/)).toBeTruthy()
  })

  it('짝 칸을 켜면 같은 계열이 꺼진다 (0x123ac, k^1)', () => {
    화면()
    이름넣기('테스트')
    fireEvent.click(등록버튼())

    구질('SHOOT')
    구질('SINKER')

    expect(눌림('SHOOT')).toBe('false')
    expect(눌림('SINKER')).toBe('true')
  })

  it('CLR 로 등록 줄에 돌아갔다 와도 고른 변화구가 남는다', () => {
    화면()
    이름넣기('테스트')
    fireEvent.click(등록버튼())
    구질('CURVE')

    fireEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(screen.getByLabelText('이름')).toBeTruthy()
    fireEvent.click(등록버튼())

    expect(눌림('CURVE')).toBe('true')
  })

  it('이름이 비면 등록할 수 없다', () => {
    화면()

    expect(등록버튼().disabled).toBe(true)
  })

  it('[등록] → [예] 로 고른 값이 그대로 넘어간다', () => {
    let created: { name: string; profile: PitcherRookieProfile } | null = null
    화면((name, profile) => { created = { name, profile } })
    이름넣기('투수')
    fireEvent.click(screen.getByRole('button', { name: '보직 다음' }))
    fireEvent.click(screen.getByRole('button', { name: '손 다음' }))
    fireEvent.click(등록버튼())
    구질('TWO-SEAM')
    구질('FORK')
    fireEvent.click(OK버튼())
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect(created).not.toBeNull()
    expect(created!.name).toBe('투수')
    expect(created!.profile.role).toBe(PITCHER_ROLE.relief)
    expect(created!.profile.handIndex).toBe(1)
    expect(created!.profile.breakingPitchSlots).toEqual([0, 6])
  })

  it('확인 상자는 화면을 비우지 않는다 — 뒤 항목이 그대로 보인다', () => {
    화면()
    이름넣기('투수')
    fireEvent.click(등록버튼())
    구질('TWO-SEAM')
    구질('FORK')
    fireEvent.click(OK버튼())

    expect(screen.getByText(/이대로 결정/)).toBeTruthy()
    expect(screen.getByText('200')).toBeTruthy()
  })
})

describe('만들기 흐름 — 0x65 팀 고르기 → 0x66 등록', () => {
  it('팀을 고르면 등록 화면으로 가고 그 팀이 딱지에 뜬다', () => {
    render(<PitcherCreateFlow onCreate={() => {}} onCancel={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: '인천 돌핀즈' }))

    expect(screen.getByText('선수 등록')).toBeTruthy()
    expect(screen.getByText('인천 돌핀즈')).toBeTruthy()
  })

  it('등록에서 취소하면 팀 고르기로 되돌아간다 (102 → 101)', () => {
    render(<PitcherCreateFlow onCreate={() => {}} onCancel={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: '서울 드래곤즈' }))

    fireEvent.click(screen.getByRole('button', { name: '취소' }))

    expect(screen.queryByText('선수 등록')).toBeNull()
    expect(screen.getByRole('button', { name: '되돌아가기' })).toBeTruthy()
  })

  it('고른 팀이 프로필에 실려 넘어온다', () => {
    let created: PitcherRookieProfile | null = null
    render(<PitcherCreateFlow onCreate={(_, profile) => { created = profile }} onCancel={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: '대전 호크스' }))
    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '투수' } })
    fireEvent.click(screen.getByRole('button', { name: '등록' }))
    구질('TWO-SEAM')
    구질('FORK')
    fireEvent.click(OK버튼())
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect(created).not.toBeNull()
    expect(created!.teamId).toBe(3)
  })
})

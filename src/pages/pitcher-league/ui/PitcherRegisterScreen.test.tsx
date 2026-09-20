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

  it('변화구를 두 개 고르기 전에는 등록할 수 없다 (StrMODE[13])', () => {
    화면()
    이름넣기('테스트')
    expect(등록버튼().disabled).toBe(false)

    // 기본으로 고른 두 칸 중 하나를 끄면 막힌다
    fireEvent.click(screen.getByRole('button', { name: 'TWO-SEAM' }))

    expect(등록버튼().disabled).toBe(true)
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
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect(created).not.toBeNull()
    expect(created!.name).toBe('투수')
    expect(created!.profile.role).toBe(PITCHER_ROLE.relief)
    expect(created!.profile.handIndex).toBe(1)
    expect(created!.profile.breakingPitchSlots).toHaveLength(2)
  })

  it('확인 상자는 화면을 비우지 않는다 — 뒤 항목이 그대로 보인다', () => {
    화면()
    이름넣기('투수')
    fireEvent.click(등록버튼())

    expect(screen.getByText(/이대로 결정/)).toBeTruthy()
    expect(screen.getByText('선발')).toBeTruthy()
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
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect(created).not.toBeNull()
    expect(created!.teamId).toBe(3)
  })
})

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SeasonMvpScreen } from '@/pages/season/ui/SeasonMvpScreen'
import { SEASON_MVP_LEADER_KINDS } from '@/widgets/season/lib/seasonAwardEvents'
import { LEADER_KIND } from '@/entities/awards/model/leaderboard'
import { TEAMS } from '@/shared/config/original/teams'

/**
 * 최우수선수 (0xed) — P4 1a·2a 절 · B-3.
 * 시즌모드 결과 이벤트는 **378 없음 / 379 있음**이고, 379 는 인기도 +10 · 평판 +20 · 소지금 1000만이다.
 */

afterEach(cleanup)

const 창글 = () => screen.getByRole('group', { name: '최우수선수' }).textContent ?? ''

describe('MVP 발표', () => {
  it('내 팀 MVP 가 아니면 이벤트 376 → 378 이고 보상이 없다', () => {
    render(<SeasonMvpScreen winner={{ teamId: 6, name: '남의선수' }} isMine={false} onNext={vi.fn()} />)

    expect(창글()).toContain('이벤트 376 → 378')
    expect(창글()).toContain('우리 팀 MVP 없음')
    expect(창글()).toContain(`${TEAMS[6].name} 남의선수`)
  })

  it('내 팀 MVP 면 379 이고 인기도 +10 · 평판 +20 · 소지금 1000만이다', () => {
    render(<SeasonMvpScreen winner={{ teamId: 0, name: '내선수' }} isMine onNext={vi.fn()} />)

    expect(창글()).toContain('이벤트 376 → 379')
    expect(창글()).toContain('인기도 +10')
    expect(창글()).toContain('평판 +20')
    expect(창글()).toContain('소지금 +1000만')
  })

  it('MVP 가 없으면 "없음" 으로 둔다 — 성적을 지어내지 않는다', () => {
    render(<SeasonMvpScreen winner={null} isMine={false} onNext={vi.fn()} />)

    expect(창글()).toContain('없음')
  })

  it('확인으로 정규시즌 순위(0xf0)로 넘어간다', () => {
    const onNext = vi.fn()
    render(<SeasonMvpScreen winner={null} isMine={false} onNext={onNext} />)

    fireEvent.keyDown(window, { key: 'Enter' })

    expect(onNext).toHaveBeenCalled()
  })
})

describe('시즌모드 MVP 후보 표 0xd4f34', () => {
  it('일곱 종류 [9, 11, 12, 1, 6, 4, 3] 차례 그대로다', () => {
    expect(SEASON_MVP_LEADER_KINDS).toEqual([
      LEADER_KIND.홈런, LEADER_KIND.타점, LEADER_KIND.타율,
      LEADER_KIND.승, LEADER_KIND.탈삼진, LEADER_KIND.방어율, LEADER_KIND.세이브,
    ])
    expect([...SEASON_MVP_LEADER_KINDS]).toEqual([9, 11, 12, 1, 6, 4, 3])
  })
})

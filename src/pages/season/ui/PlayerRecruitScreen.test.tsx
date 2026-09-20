// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PlayerRecruitScreen } from '@/pages/season/ui/PlayerRecruitScreen'
import { PLAYER_KIND, PLAYER_OWN_BIT, RECRUIT_PITCHER_STAMINA } from '@/entities/season-mode/model/playerRecruit'
import type { RecruitResult, SeasonPlayer, SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import type { RecruitListInput } from '@/widgets/season/lib/recruitList'

/**
 * 선수영입 (0xe2 → 0xdf → 0xc554) — S6 4절 · R13 9절 확정.
 * 칸 배치(0 나리 투수 · 1~4 명예 투수 · 5 나리 타자 · 6~ 명예 타자)와
 * **끼워넣기**(교체가 아니다)를 못박는다.
 */

afterEach(cleanup)

const 선수 = (id: number, kindByte: number): SeasonPlayer => ({
  id, kindByte, fieldPosition: 0, stamina: 0,
})

/** 팀 투수 3명·타자 3명 (전부 일반 선수) */
const 로스터 = (): SeasonTeamRoster => ({
  pitchers: [선수(1, PLAYER_KIND.일반투수 | 0), 선수(2, PLAYER_KIND.일반투수 | 1), 선수(3, PLAYER_KIND.일반투수 | 2)],
  batters: [선수(4, PLAYER_KIND.일반타자 | 0), 선수(5, PLAYER_KIND.일반타자 | 1), 선수(6, PLAYER_KIND.일반타자 | 2)],
})

const 후보 = (): RecruitListInput => ({
  careerPitcher: { name: '나리투수', player: 선수(0xfe, PLAYER_KIND.일반투수 | PLAYER_OWN_BIT) },
  careerBatter: { name: '나리타자', player: 선수(0xfe, PLAYER_KIND.일반타자 | PLAYER_OWN_BIT) },
  hallOfFamePitchers: [{ name: '명예투수A', player: 선수(0xb4, PLAYER_KIND.일반투수 | PLAYER_OWN_BIT) }],
  hallOfFameBatters: [{ name: '명예타자A', player: 선수(0xc8, PLAYER_KIND.일반타자 | PLAYER_OWN_BIT) }],
})

const 띄우기 = (roster = 로스터(), list = 후보()) => {
  const onRecruit = vi.fn()
  render(<PlayerRecruitScreen roster={roster} list={list} onRecruit={onRecruit} onBack={vi.fn()} />)
  return onRecruit
}

/** 줄 글 — 이름 칸과 값 칸을 사람이 읽는 차례로 잇는다 (커서 ▶ 는 aria-hidden 이라 뺀다) */
const 줄글 = () =>
  screen.getAllByRole('button').map((button) =>
    Array.from(button.querySelectorAll('span'))
      .filter((span) => span.getAttribute('aria-hidden') === null)
      .map((span) => span.textContent ?? '')
      .join(' ')
      .trim(),
  )

describe('선수영입 목록 (상태 0xe2)', () => {
  it('칸 배치가 0 나리 투수 · 1~4 명예 투수 · 5 나리 타자 · 6~ 명예 타자 다', () => {
    띄우기()

    const 줄 = 줄글()
    expect(줄[0]).toBe('나리투수 나리투수')
    expect(줄[1]).toBe('명예투수A 명예투수')
    // 2~4 는 아직 안 산 명예 투수 칸이라 빈 줄이다
    expect(줄[2]).toBe('- 빈 칸 - 명예투수')
    expect(줄[5]).toBe('나리타자 나리타자')
    expect(줄[6]).toBe('명예타자A 명예타자')
  })

  it('이미 나리 선수가 있는 쪽은 StrMODE[181] 로 막힌다 (0xb5054: +0xa < 0)', () => {
    const roster = 로스터()
    띄우기({
      ...roster,
      pitchers: [...roster.pitchers, 선수(0xfe, PLAYER_KIND.일반투수 | PLAYER_OWN_BIT)],
    })

    fireEvent.click(screen.getByRole('button', { name: '나리투수 나리투수' }))

    expect(screen.getByRole('dialog', { name: '알림' }).textContent).toContain('이미 영입된 선수 입니다')
  })

  it('같은 명예의 전당 선수 번호가 있으면 막힌다 (0xb50ac)', () => {
    const roster = 로스터()
    띄우기({ ...roster, pitchers: [...roster.pitchers, 선수(0xb4, PLAYER_KIND.일반투수)] })

    fireEvent.click(screen.getByRole('button', { name: '명예투수A 명예투수' }))

    expect(screen.getByRole('dialog', { name: '알림' }).textContent).toContain('이미 영입된 선수 입니다')
  })
})

describe('자리 고르기와 확정 (0xdf → 0xc554)', () => {
  it('투수를 고르면 팀 투수 자리 목록이 나온다', () => {
    띄우기()

    fireEvent.click(screen.getByRole('button', { name: '나리투수 나리투수' }))

    expect(screen.getByRole('group', { name: '자리 고르기' })).toBeTruthy()
    expect(줄글().slice(0, 3)).toEqual(['투수 1번 #0', '투수 2번 #1', '투수 3번 #2'])
  })

  it('⚠️ 영입은 교체가 아니라 끼워넣기다 — 자리 수가 늘고 밀려난 선수는 맨 끝으로 간다', () => {
    const onRecruit = 띄우기()

    fireEvent.click(screen.getByRole('button', { name: '나리투수 나리투수' }))
    fireEvent.click(screen.getByRole('button', { name: '투수 2번 #1' }))

    const [result, asPitcher] = onRecruit.mock.calls[0] as [RecruitResult, boolean]
    expect(asPitcher).toBe(true)
    expect(result.roster.pitchers).toHaveLength(4) // 3 → 4, 아무도 빠지지 않는다
    expect(result.roster.pitchers[1].id).toBe(0xfe)
    expect(result.roster.pitchers[3].id).toBe(2) // 밀려난 선수는 맨 끝
    // 영입된 투수의 스태미나는 10000 으로 채워진다 (선수+0x2c = 0x2710)
    expect(result.roster.pitchers[1].stamina).toBe(RECRUIT_PITCHER_STAMINA)
    expect(screen.getByRole('dialog', { name: '알림' }).textContent).toContain('선수 영입을 완료하였습니다')
  })

  it('⚠️ 투수 쪽은 밀려난 선수의 칸 번호를 고치는 줄이 빠져 있다 (S6 4-4)', () => {
    const onRecruit = 띄우기()

    fireEvent.click(screen.getByRole('button', { name: '나리투수 나리투수' }))
    fireEvent.click(screen.getByRole('button', { name: '투수 2번 #1' }))

    const [result] = onRecruit.mock.calls[0] as [RecruitResult, boolean]
    const 칸번호 = (index: number) => result.roster.pitchers[index].kindByte & 0x1f
    // 새 투수와 밀려난 투수가 **같은** 칸 번호 1 을 갖는다 — 타자 쪽에만 있는 뒷정리가 여기엔 없다
    expect(칸번호(1)).toBe(1)
    expect(칸번호(3)).toBe(1)
  })

  it('타자 쪽은 밀려난 선수의 칸 번호를 마지막으로 고쳐 준다', () => {
    const onRecruit = 띄우기()

    fireEvent.click(screen.getByRole('button', { name: '나리타자 나리타자' }))
    fireEvent.click(screen.getByRole('button', { name: '타자 1번 #0' }))

    const [result, asPitcher] = onRecruit.mock.calls[0] as [RecruitResult, boolean]
    expect(asPitcher).toBe(false)
    expect(result.roster.batters).toHaveLength(4)
    expect(result.roster.batters[3].kindByte & 0x1f).toBe(3)
  })

  it('자리 고르기에서 취소하면 목록으로 되돌아간다 (0xdf 취소 → 0xe2)', () => {
    띄우기()

    fireEvent.click(screen.getByRole('button', { name: '나리투수 나리투수' }))
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.getByRole('group', { name: '선수영입' })).toBeTruthy()
  })
})

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TradeScreen } from '@/pages/season/ui/TradeScreen'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord, SeasonState } from '@/entities/season-mode/model/seasonRecord'
import { PLAYER_OWN_BIT } from '@/entities/season-mode/model/playerRecruit'
import type { SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import { teamBatters } from '@/entities/team/model/teamRoster'
import { TEAMS } from '@/shared/config/original/teams'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 트레이드 네 칸 (0xe4 팀 고르기 → 0xe5 영입 선수 → 0xe6 보상 선수 → 0xe7 확인·진행).
 * 성공률·비용은 J 4-4 확정이고, 나리·명예 선수 거절(StrMODE[165]/[166])도 함께 본다.
 */

afterEach(cleanup)

const MY_TEAM = 0
const OPPONENT = 1

const 상태 = (덮어쓰기: Partial<SeasonRecord> = {}): SeasonState => {
  const base = startNewSeason(MY_TEAM, '테스터')
  return { ...base, record: { ...base.record, ...덮어쓰기 } }
}

/** 내 팀 명단 — 세션이 만드는 것과 같은 모양(칸 번호만 채운다) */
const 명단 = (덮어쓰기: Partial<SeasonTeamRoster> = {}): SeasonTeamRoster => ({
  pitchers: Array.from({ length: 8 }, (_unused, slot) => ({
    id: slot, kindByte: slot, fieldPosition: 0, stamina: 0,
  })),
  batters: Array.from({ length: 12 }, (_unused, slot) => ({
    id: slot, kindByte: slot, fieldPosition: 0, stamina: 0,
  })),
  ...덮어쓰기,
})

/** 뽑기를 정해 놓은 난수 — `bfa55(1,101)` */
const 고정난수 = (value: number): RandomPort => ({
  next: () => (value - 1) / 100,
  nextInRange: (minimum) => minimum,
  pick: (candidates) => candidates[0],
})

const 띄우기 = (
  state: SeasonState,
  나머지: Partial<Parameters<typeof TradeScreen>[0]> = {},
) => {
  const onTrade = vi.fn()
  const onBack = vi.fn()
  render(
    <TradeScreen
      state={state}
      roster={명단()}
      gamePoints={9999}
      random={고정난수(1)}
      onTrade={onTrade}
      onBack={onBack}
      {...나머지}
    />,
  )
  return { onTrade, onBack }
}

const 누르기 = (이름: string | RegExp) => fireEvent.click(screen.getByRole('button', { name: 이름 }))
const 알림글 = () => screen.getByRole('dialog', { name: '알림' }).textContent ?? ''

/** 0xe4 → 0xe5 : 상대 팀을 고른다 */
const 상대팀고르기 = () => 누르기(TEAMS[OPPONENT].name)

describe('0xe4 팀 고르기', () => {
  it('팀 격자가 먼저 뜬다 (선수 등록 화면을 빌려 쓴다)', () => {
    띄우기(상태())

    expect(screen.getAllByRole('button', { name: TEAMS[OPPONENT].name }).length).toBeGreaterThan(0)
  })

  it('⚠️ 원본 목록에는 내 팀이 없다 — 골라도 넘어가지 않는다 (근사)', () => {
    띄우기(상태())

    누르기(TEAMS[MY_TEAM].name)

    expect(screen.getAllByRole('button', { name: TEAMS[OPPONENT].name }).length).toBeGreaterThan(0)
  })
})

describe('0xe5 영입 선수 → 0xe6 보상 선수', () => {
  it('고른 팀의 타자 명단이 나온다 (StrMODE[163])', () => {
    띄우기(상태())

    상대팀고르기()

    expect(document.body.textContent).toContain('영입할 선수를 선택합니다')
    expect(screen.getByRole('button', { name: teamBatters(OPPONENT)[0].name })).toBeDefined()
  })

  it('영입할 선수를 고르면 내 팀 명단(StrMODE[164])으로 넘어간다', () => {
    띄우기(상태())

    상대팀고르기()
    누르기(teamBatters(OPPONENT)[0].name)

    expect(document.body.textContent).toContain('보상할 우리')
    expect(screen.getByRole('button', { name: teamBatters(MY_TEAM)[0].name })).toBeDefined()
  })

  it('영입해 온 나리 선수는 보상으로 못 낸다 (StrMODE[165])', () => {
    const 나리가낀명단 = 명단({
      batters: [
        { id: 0xfe, kindByte: PLAYER_OWN_BIT | 0, fieldPosition: 0, stamina: 0 },
        ...명단().batters.slice(1),
      ],
    })
    띄우기(상태(), { roster: 나리가낀명단 })

    상대팀고르기()
    누르기(teamBatters(OPPONENT)[0].name)
    // ⚠️ 나리 선수도 칸 번호(+0xa 하위 5비트)로 이름을 빌려 와 같은 줄 이름이 나온다 (근사)
    누르기(teamBatters(MY_TEAM)[0].name)

    expect(알림글()).toContain('나만의 리그 선수는')
  })
})

describe('0xe7 확인·진행 (J 4-4)', () => {
  const 확인까지 = (나머지: Partial<Parameters<typeof TradeScreen>[0]> = {}) => {
    const handles = 띄우기(상태(), 나머지)
    상대팀고르기()
    누르기(teamBatters(OPPONENT)[0].name)
    누르기(teamBatters(MY_TEAM)[0].name)
    return handles
  }

  it('비용 세 칸과 그 성공률이 나온다 — 자리 벌점 10+10 이라 기본은 20% 다', () => {
    확인까지()

    expect(screen.getByRole('button', { name: /기본 진행/ }).textContent).toContain('20%')
    expect(screen.getByRole('button', { name: /\+50%/ }).textContent).toContain('70%')
    expect(screen.getByRole('button', { name: /\+20%/ }).textContent).toContain('40%')
  })

  it('성공하면 그 자리가 상대 선수로 바뀌고 커맨드가 닫힌다', () => {
    // 기본 진행 20% → 뽑기 19 면 성공 (19 < 20)
    const { onTrade } = 확인까지({ random: 고정난수(19) })

    누르기(/기본 진행/)
    누르기('예')

    expect(알림글()).toContain('성공')
    const settlement = onTrade.mock.calls[0][0]
    expect(settlement.isSuccess).toBe(true)
    expect(settlement.record.tradeUsed).toBe(1)
    expect(settlement.roster.batters[0].id).toBe(0)
    expect(settlement.gamePointCost).toBe(0)
  })

  it('실패해도 커맨드는 쓴 것이고 명단은 그대로다', () => {
    const { onTrade } = 확인까지({ random: 고정난수(20) })

    누르기(/기본 진행/)
    누르기('예')

    expect(알림글()).toContain('실패')
    const settlement = onTrade.mock.calls[0][0]
    expect(settlement.isSuccess).toBe(false)
    expect(settlement.record.tradeUsed).toBe(1)
  })

  it('+50% 칸은 2000G 를 쓴다 (성공·실패와 상관없이 나간다)', () => {
    const { onTrade } = 확인까지({ random: 고정난수(100) })

    누르기(/\+50%/)
    누르기('예')

    expect(onTrade.mock.calls[0][0].gamePointCost).toBe(2000)
  })
})

describe('커맨드 가드 (SR+0x56)', () => {
  it('이미 쓴 뒤에 들어오면 팀 고르기 대신 막는 알림이 뜨고 나간다', () => {
    const { onBack } = 띄우기(상태({ tradeUsed: 1 }))

    expect(알림글()).toContain('이미 사용했습니다')
    expect(screen.queryAllByRole('button', { name: TEAMS[OPPONENT].name })).toHaveLength(0)

    누르기('확인')
    expect(onBack).toHaveBeenCalled()
  })
})

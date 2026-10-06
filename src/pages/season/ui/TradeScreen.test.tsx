// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TradeScreen } from '@/pages/season/ui/TradeScreen'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord, SeasonState } from '@/entities/season-mode/model/seasonRecord'
import { PLAYER_OWN_BIT } from '@/entities/season-mode/model/playerRecruit'
import type { SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
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
  const onFinish = vi.fn()
  const onCancelRequest = vi.fn()
  render(
    <TradeScreen
      state={state}
      roster={명단()}
      gamePoints={9999}
      random={고정난수(1)}
      onTrade={onTrade}
      onBack={onBack}
      onFinish={onFinish}
      onCancelRequest={onCancelRequest}
      {...나머지}
    />,
  )
  return { onTrade, onBack, onFinish, onCancelRequest }
}

const 누르기 = (이름: string | RegExp) => fireEvent.click(screen.getByRole('button', { name: 이름 }))
const 알림글 = () => screen.getByRole('dialog', { name: '알림' }).textContent ?? ''

/** 0xe4 → 0xe5 : 상대 팀을 고른다 — 0x4774 가 탭을 0(투수)으로 지워 투수 목록으로 열린다 */
const 상대팀고르기 = () => 누르기(TEAMS[OPPONENT].name)
/** 0xe4 → 0xe5 → '*' : 타자 목록으로 뒤집는다 */
const 타자로 = () => {
  상대팀고르기()
  누르기('타자')
}

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
  it('고른 팀의 **투수** 명단이 먼저 나온다 — 0xe4 진입이 탭(this+0x154)을 0 으로 지운다 (StrMODE[163])', () => {
    띄우기(상태())

    상대팀고르기()

    expect(document.body.textContent).toContain('영입할 선수를 선택합니다')
    expect(screen.getByRole('button', { name: teamPitchers(OPPONENT)[0].name })).toBeDefined()
    expect(screen.getByRole('button', { name: '투수' }).getAttribute('aria-current')).toBe('true')
  })

  it('탭 단추 첫째가 투수(탭 0) · 둘째가 타자(탭 1)다 — 타자를 누르면 타자 명단', () => {
    띄우기(상태())
    상대팀고르기()

    const 단추들 = screen.getByRole('group', { name: '트레이드 탭' }).querySelectorAll('button')
    expect([...단추들].map((단추) => 단추.textContent)).toEqual(['투수', '타자'])
    누르기('타자')
    expect(screen.getByRole('button', { name: teamBatters(OPPONENT)[0].name })).toBeDefined()
  })

  it("'*' 키도 목록 탭을 뒤집는다 (편집기 559b2)", () => {
    띄우기(상태())
    상대팀고르기()

    fireEvent.keyDown(window, { key: '*' })
    expect(screen.getByRole('button', { name: teamBatters(OPPONENT)[0].name })).toBeDefined()
  })

  it('⚠️ 0xe6 에서 목록을 뒤집어도 트레이드 탭은 0xe5 에서 정한 그대로다 (원본 그대로 — 0x727c 는 this+0x154 를 본다)', () => {
    const { onTrade } = 띄우기(상태(), { random: 고정난수(1) })
    상대팀고르기() // 투수 탭
    누르기(teamPitchers(OPPONENT)[1].name)
    누르기('타자') // 0xe6 목록만 타자로
    누르기(teamBatters(MY_TEAM)[2].name) // 보이는 것은 타자 2번이지만 투수 탭 2번 칸이 된다
    누르기(/기본 진행/)
    누르기('예')

    expect(onTrade.mock.calls[0][0].swap).toEqual({ opponentTeamId: OPPONENT, tab: 0, myIndex: 2, opponentIndex: 1 })
  })

  it('영입할 선수를 고르면 내 팀 명단(StrMODE[164])으로 넘어간다', () => {
    띄우기(상태())

    타자로()
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

    타자로()
    누르기(teamBatters(OPPONENT)[0].name)
    // 기록 사본이 없는 표 밖 선수는 `타자 N번` 으로 적힌다
    누르기('타자 1번')

    expect(알림글()).toContain('나만의 리그 선수는')
  })
})

describe('0xe7 확인·진행 (J 4-4)', () => {
  // 두 팀 타자 6번은 +0x1b 가 둘 다 9 라 d = 0 이다 (표 값)
  const 같은값칸 = 6
  const 확인까지 = (나머지: Partial<Parameters<typeof TradeScreen>[0]> = {}, 상대칸 = 같은값칸, 내칸 = 같은값칸) => {
    const handles = 띄우기(상태(), 나머지)
    타자로()
    누르기(teamBatters(OPPONENT)[상대칸].name)
    누르기(teamBatters(MY_TEAM)[내칸].name)
    return handles
  }

  it('시험 전제 — 6번끼리는 값이 같고, 0번끼리는 40 · 29 다', () => {
    expect(teamBatters(MY_TEAM)[같은값칸].grade).toBe(teamBatters(OPPONENT)[같은값칸].grade)
    expect([teamBatters(MY_TEAM)[0].grade, teamBatters(OPPONENT)[0].grade]).toEqual([40, 29])
  })

  it('+0x1b 차이가 성공률을 깎는다 — d = 110 이면 40 − 44 − 20 → 바닥 3%', () => {
    확인까지({}, 0, 0)

    expect(screen.getByRole('button', { name: /기본 진행/ }).textContent).toContain('3%')
    expect(screen.getByRole('button', { name: /\+50%/ }).textContent).toContain('53%')
  })

  it('성공하면 소지금에 d 가 더해진다 (0xd180 — 좋은 선수를 내주면 들어온다)', () => {
    const { onTrade } = 확인까지({ random: 고정난수(2) }, 0, 0)

    누르기(/기본 진행/)
    누르기('예')

    const settlement = onTrade.mock.calls[0][0]
    expect(settlement.isSuccess).toBe(true)
    // 새 시즌 소지금 50 + (40 − 29) × 10
    expect(settlement.record.money).toBe(160)
  })

  it('결과 알림을 닫으면 관리 메뉴 쪽으로 나간다 (0xc7ba → 0xc9)', () => {
    const { onFinish, onBack } = 확인까지({ random: 고정난수(19) })

    누르기(/기본 진행/)
    누르기('예')
    누르기('확인')

    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onBack).not.toHaveBeenCalled()
  })

  it('비용 세 칸과 그 성공률이 나온다 — 두 타자 다 마스터 칸 6 이라 벌점 0, 기본은 40% 다 (0xb6561)', () => {
    확인까지()

    expect(screen.getByRole('button', { name: /기본 진행/ }).textContent).toContain('40%')
    expect(screen.getByRole('button', { name: /\+50%/ }).textContent).toContain('90%')
    expect(screen.getByRole('button', { name: /\+20%/ }).textContent).toContain('60%')
  })

  it('타자 탭 마스터 칸 3 은 벌점 10 · 0 은 6 이다 — 3번끼리면 d 를 빼고 40 − 20 (표 값으로 견준다)', () => {
    확인까지({}, 3, 3)
    const d = (teamBatters(MY_TEAM)[3].grade - teamBatters(OPPONENT)[3].grade) * 10
    const 깎임 = Math.trunc((Math.abs(d < 0 ? d * 2 : d) * 100) / 250)

    expect(screen.getByRole('button', { name: /기본 진행/ }).textContent).toContain(`${Math.max(40 - 깎임 - 20, 3)}%`)
  })

  it('성공하면 맞바꿀 두 칸(탭·내 칸·상대 칸·상대 팀)을 넘기고 커맨드가 닫힌다', () => {
    // 기본 진행 40% → 뽑기 29 면 성공 (29 < 40)
    const { onTrade } = 확인까지({ random: 고정난수(29) })

    누르기(/기본 진행/)
    누르기('예')

    expect(알림글()).toContain('성공')
    const settlement = onTrade.mock.calls[0][0]
    expect(settlement.isSuccess).toBe(true)
    expect(settlement.record.tradeUsed).toBe(1)
    expect(settlement.swap).toEqual({ opponentTeamId: OPPONENT, tab: 1, myIndex: 같은값칸, opponentIndex: 같은값칸 })
    expect(settlement.gamePointCost).toBe(0)
    // d = 0 이라 소지금은 그대로
    expect(settlement.record.money).toBe(50)
  })

  it('실패해도 커맨드는 쓴 것이고 명단은 그대로다', () => {
    const { onTrade } = 확인까지({ random: 고정난수(41) })

    누르기(/기본 진행/)
    누르기('예')

    expect(알림글()).toContain('실패')
    const settlement = onTrade.mock.calls[0][0]
    expect(settlement.isSuccess).toBe(false)
    expect(settlement.record.tradeUsed).toBe(1)
    expect(settlement.swap).toBeUndefined()
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

describe('CPU 트레이드 요청으로 들어오면 (0xe5 진입 0x5cd0 · 키 0x7104 · 0x727c · 0xc66c)', () => {
  const 요청 = {
    isRequested: true, myIndex: 3, opponentIndex: 2, tab: 1, opponentTeamId: OPPONENT,
  } as const

  it('팀 고르기를 건너뛰고 [204] 알림부터 — 닫으면 상대 칸이 묶인 목록이다', () => {
    띄우기(상태(), { request: 요청 })

    expect(알림글()).toContain('상대 팀에서 제시한')
    누르기('확인')
    expect(screen.getByRole('button', { name: teamBatters(OPPONENT)[2].name })).toBeDefined()
  })

  it('다른 줄을 눌러도 요청 칸으로 진행하고 [205] → 확인 단계, 성공이 강제된다 (뽑기 100 이어도)', () => {
    const { onTrade, onFinish } = 띄우기(상태({ tradeUsed: 1 }), { request: 요청, random: 고정난수(100) })

    누르기('확인')
    누르기(teamBatters(OPPONENT)[0].name)
    expect(알림글()).toContain('상대 팀에서 원하는')
    누르기('확인')
    누르기(teamBatters(MY_TEAM)[0].name)
    // 0xc756 — 비용 칸은 안 움직여 늘 기본 진행이다
    누르기(/\+50%/)
    누르기('예')

    const settlement = onTrade.mock.calls[0][0]
    expect(settlement.isSuccess).toBe(true)
    expect(settlement.gamePointCost).toBe(0)
    expect(settlement.record.tradeUsed).toBe(1)
    // 요청 칸끼리 맞바꾼다 — 내 3번 자리와 상대 2번
    expect(settlement.swap).toEqual({ opponentTeamId: OPPONENT, tab: 1, myIndex: 3, opponentIndex: 2 })
    누르기('확인')
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('영입 단계에서 취소하면 [216] — 예면 요청을 버린다', () => {
    const { onCancelRequest, onBack } = 띄우기(상태(), { request: 요청 })
    누르기('확인')

    누르기('되돌아가기')
    expect(screen.getByRole('dialog', { name: '알림' }).textContent).toContain('트레이드를 취소')
    누르기('예')

    expect(onCancelRequest).toHaveBeenCalledTimes(1)
    expect(onBack).not.toHaveBeenCalled()
  })

  it('탭 0 이면 투수 명단이다 (0xb5695 탭 0 = 0xb51fc 투수 배열)', () => {
    띄우기(상태(), { request: { ...요청, tab: 0 } })
    누르기('확인')

    expect(screen.getByRole('button', { name: teamPitchers(OPPONENT)[2].name })).toBeDefined()
  })
})

describe('상대 팀 레코드 (시즌 저장의 CPU 명단)', () => {
  it('지난 트레이드로 간 내 옛 선수가 상대 목록에 제 이름(옛 팀 표)으로 나온다', () => {
    const 상대 = {
      pitchers: teamPitchers(OPPONENT).map((_p, slot) => ({ id: slot, kindByte: slot, fieldPosition: 0, stamina: 0 })),
      batters: teamBatters(OPPONENT).map((_p, slot) => (slot === 4
        ? { id: 1, kindByte: slot, fieldPosition: 0, stamina: 0, tableTeamId: MY_TEAM }
        : { id: slot, kindByte: slot, fieldPosition: 0, stamina: 0 })),
    }
    띄우기(상태(), { opponentRosterOf: () => 상대 })
    타자로()

    expect(screen.getByRole('button', { name: teamBatters(MY_TEAM)[1].name })).toBeDefined()
    expect(screen.queryByRole('button', { name: teamBatters(OPPONENT)[4].name })).toBeNull()
  })

  it('데려온 선수는 내 목록에서 옛 팀 표 이름으로 나온다 — 내 팀 표의 같은 칸 이름이 아니다', () => {
    const 내명단 = 명단({
      batters: 명단().batters.map((player, slot) => (slot === 2 ? { ...player, id: 7, tableTeamId: OPPONENT } : player)),
    })
    띄우기(상태(), { roster: 내명단 })
    타자로()
    누르기(teamBatters(OPPONENT)[0].name)

    expect(screen.getAllByRole('button', { name: teamBatters(OPPONENT)[7].name }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: teamBatters(MY_TEAM)[2].name })).toBeNull()
  })
})

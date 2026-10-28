// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { TradeScreen, tradeQuestionTextOf } from '@/pages/season/ui/TradeScreen'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord, SeasonState } from '@/entities/season-mode/model/seasonRecord'
import { PLAYER_OWN_BIT } from '@/entities/season-mode/model/playerRecruit'
import type { SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import { TEAMS } from '@/shared/config/original/teams'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createConstantRandom } from '@/shared/api/random/fractionRandom'

// 들어올 때 연출(머리띠 다섯 그림 · 격자 열림 애니 0x79fa8)과 그동안의 키 막음(`useListPageEntry`)은 따로 시험한다 — 여기서는 다 연 뒤로 본다
vi.mock('@/widgets/screen-frame/model/useListPageEntry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/widgets/screen-frame/model/useListPageEntry')>()
  return { ...actual, useListPageEntry: actual.settledListPageEntry }
})

/**
 * 트레이드 네 칸 (0xe4 팀 고르기 → 0xe5 영입 선수 → 0xe6 보상 선수 → 0xe7 확인·진행).
 * 성공률·비용은 J 4-4 확정이고, 나리·명예 선수 거절(StrMODE[165]/[166])도 함께 본다.
 */

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'setTimeout', 'clearTimeout'] })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const MY_TEAM = 0
const OPPONENT = 1

const 상태 = (덮어쓰기: Partial<SeasonRecord> = {}): SeasonState => {
  const base = startNewSeason(MY_TEAM, '테스터')
  return { ...base, record: { ...base.record, ...덮어쓰기 } }
}

/** 내 팀 명단 — 세션이 만드는 것과 같은 모양(칸 번호만 채운다) */
const 명단 = (덮어쓰기: Partial<SeasonTeamRoster> = {}): SeasonTeamRoster => ({
  pitchers: Array.from({ length: 8 }, (_unused, slot) => ({
    id: slot,
    kindByte: slot,
    fieldPosition: 0,
    stamina: 0,
  })),
  batters: Array.from({ length: 12 }, (_unused, slot) => ({
    id: slot,
    kindByte: slot,
    fieldPosition: 0,
    stamina: 0,
  })),
  ...덮어쓰기,
})

/** 뽑기를 정해 놓은 난수 — `bfa55(1,101)` */
const 고정난수 = (value: number): RandomPort => createConstantRandom((value - 0.5) / 100)

const 띄우기 = (state: SeasonState, 나머지: Partial<Parameters<typeof TradeScreen>[0]> = {}) => {
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

/** 0xe7 진행 게이지(0xcecc, 틀마다 +2)가 다 찰 만큼 틀을 보낸다 — 누를 때마다 보내 둔다 */
const 틀보내기 = () =>
  act(() => {
    vi.advanceTimersByTime(millisecondsPerFrame() * 120)
  })
/** 누름 칸 — 보통 단추, 엔트리 목록 창 줄은 목록 칸(option) */
const 칸 = (이름: string | RegExp) => screen.queryByRole('button', { name: 이름 }) ?? screen.getByRole('option', { name: 이름 })
const 누르기 = (이름: string | RegExp) => {
  fireEvent.click(칸(이름))
  틀보내기()
}
/** 0xe5 · 0xe6 진입 알림 [163] · [164] (요청이면 [204] · [205]) 을 닫는다 — 0x5cd0 · 0x5b28 이 늘 띄운다 */
const 알림닫기 = () => {
  const 창 = screen.queryByRole('dialog', { name: '알림' })
  if (창 !== null) fireEvent.click(within(창).getByRole('button', { name: '확인' }))
}
/** 단계 2·3 의 결과 글 [174]/[175] — 판 위에 그린다(팝업이 아니다) */
const 결과글 = () => screen.getByRole('status', { name: '트레이드 진행' }).textContent ?? ''
/** 단계 2·3 확인 — 0xc7ba → 0xc9 */
const 결과닫기 = () => fireEvent.keyDown(window, { key: 'Enter' })
const 알림글 = () => screen.getByRole('dialog', { name: '알림' }).textContent ?? ''

/** 0xe4 → 0xe5 : 상대 팀을 고른다 — 0x4774 가 탭을 0(투수)으로 지워 투수 목록으로 열린다 */
const 상대팀고르기 = () => {
  누르기(TEAMS[OPPONENT].name)
  알림닫기()
}
/** 0xe4 → 0xe5 → '*' : 타자 목록으로 뒤집는다 — 바닥띠 "*타자" 표시 자리 */
const 타자로 = () => {
  상대팀고르기()
  누르기('* 타자')
}
/** 0xe5 에서 영입할 선수를 고르고 0xe6 진입 알림 [164] 를 닫는다 */
const 영입고르기 = (이름: string) => {
  누르기(이름)
  알림닫기()
}

describe('0xe4 팀 고르기', () => {
  it('내 팀 칸만 로고 위를 검정 덮기 단계 7(9/16 검정)로 어둡게 한다 — 그림 0xa14c → 0x7a570', () => {
    띄우기(상태())

    const 덮기 = screen.getAllByTestId('팀칸-덮기')
    expect(덮기).toHaveLength(1)
    expect(덮기[0].closest('button')?.getAttribute('aria-label')).toBe(TEAMS[MY_TEAM].name)
    expect(Number(덮기[0].style.opacity)).toBeCloseTo(9 / 16)
  })

  it('팀 격자가 먼저 뜬다 (선수 등록 화면을 빌려 쓴다)', () => {
    띄우기(상태())

    expect(screen.getAllByRole('button', { name: TEAMS[OPPONENT].name }).length).toBeGreaterThan(0)
  })

  it('내 팀 칸은 골라도 넘어가지 않는다 — 키 0x8250 이 칸 == SR+1 이면 아무것도 안 한다 (82be · 82c0 → 8392)', () => {
    띄우기(상태())

    누르기(TEAMS[MY_TEAM].name)

    expect(screen.getAllByRole('button', { name: TEAMS[OPPONENT].name }).length).toBeGreaterThan(0)
  })
})

describe('0xe5 영입 선수 → 0xe6 보상 선수', () => {
  it('고른 팀의 **투수** 명단이 먼저 나온다 — 0xe4 진입이 탭(this+0x154)을 0 으로 지운다 (StrMODE[163])', () => {
    띄우기(상태())

    누르기(TEAMS[OPPONENT].name)
    // 0x5cd0 — 들어올 때 늘 [163] 알림
    expect(알림글()).toContain('영입할 선수를 선택합니다')
    알림닫기()

    expect(칸(teamPitchers(OPPONENT)[0].name)).toBeDefined()
    // 투수 탭 바닥 0xf — "*타자" 표시 · 제목 7 "투수엔트리"
    expect(screen.getByRole('button', { name: '* 타자' })).toBeDefined()
    expect(screen.getByTestId('엔트리-열-등판순서-8000000')).toBeDefined()
  })

  it('바닥띠 "*타자" 표시를 누르면 타자 명단 — 바닥이 0x17("*투수")로 바뀐다', () => {
    띄우기(상태())
    상대팀고르기()

    누르기('* 타자')
    expect(칸(teamBatters(OPPONENT)[0].name)).toBeDefined()
    expect(screen.getByRole('button', { name: '* 투수' })).toBeDefined()
  })

  it("'*' 키도 목록 탭을 뒤집는다 (편집기 559b2)", () => {
    띄우기(상태())
    상대팀고르기()

    fireEvent.keyDown(window, { key: '*' })
    expect(칸(teamBatters(OPPONENT)[0].name)).toBeDefined()
  })

  it("0xe6 은 '*' 를 편집기에 안 넘긴다 — 0x727c 72ac `cmp r1, #0x2a ; beq` (바닥 7 에도 표시가 없다)", () => {
    // 소지금은 넉넉히 — 내 선수가 낮아 d < 0 이면 진행 가드 [77] 이 먼저 걸린다
    const { onTrade } = 띄우기(상태({ money: 9999 }), { random: 고정난수(1) })
    상대팀고르기() // 투수 탭
    영입고르기(teamPitchers(OPPONENT)[1].name)
    fireEvent.keyDown(window, { key: '*' }) // 0xe6 — 아무 일도 없다
    expect(screen.queryByRole('button', { name: '* 투수' })).toBeNull()
    누르기(teamPitchers(MY_TEAM)[2].name) // 목록은 0xe5 에서 정한 투수 탭 그대로
    누르기(/기본 진행/)
    누르기('예')

    expect(onTrade.mock.calls[0][0].swap).toEqual({ opponentTeamId: OPPONENT, tab: 0, myIndex: 2, opponentIndex: 1 })
  })

  it("'0' 은 0xe5 · 0xe6 모두 편집기 55920 에 가 선수 정보 창 0x5b798 을 연다 — 단계 진입(0x5561c 556d6)이 닫는다", () => {
    띄우기(상태())
    상대팀고르기()
    expect(screen.queryByTestId('선수 정보 창')).toBeNull()
    fireEvent.keyDown(window, { key: '0' })
    expect(screen.getByTestId('선수 정보 창')).toBeDefined()
    // 다시 '0' 이면 닫힌다
    fireEvent.keyDown(window, { key: '0' })
    expect(screen.queryByTestId('선수 정보 창')).toBeNull()
    // 바닥띠 "0상세정보" 표시 자리
    누르기('0 상세정보')
    expect(screen.getByTestId('선수 정보 창')).toBeDefined()
    // 0xe6 진입(0x5b28 → 0x5561c)이 닫고, 0xe6 에서도 '0' 이 연다
    영입고르기(teamPitchers(OPPONENT)[1].name)
    expect(screen.queryByTestId('선수 정보 창')).toBeNull()
    fireEvent.keyDown(window, { key: '0' })
    expect(screen.getByTestId('선수 정보 창')).toBeDefined()
  })

  it('영입할 선수를 고르면 내 팀 명단(StrMODE[164])으로 넘어간다', () => {
    띄우기(상태())

    타자로()
    누르기(teamBatters(OPPONENT)[0].name)

    // 0x5b28 — [164] 알림
    expect(알림글()).toContain('보상할 우리')
    알림닫기()
    expect(칸(teamBatters(MY_TEAM)[0].name)).toBeDefined()
  })

  it('영입해 온 나리 선수는 보상으로 못 낸다 (StrMODE[165])', () => {
    const 나리가낀명단 = 명단({
      batters: [{ id: 0xfe, kindByte: PLAYER_OWN_BIT | 0, fieldPosition: 0, stamina: 0 }, ...명단().batters.slice(1)],
    })
    띄우기(상태(), { roster: 나리가낀명단 })

    타자로()
    영입고르기(teamBatters(OPPONENT)[0].name)
    // 기록 사본이 없는 표 밖 선수는 `타자 N번` 으로 적힌다
    누르기('타자 1번')

    expect(알림글()).toContain('나만의 리그 선수는')
  })
})

describe('r263 — 키 다시 뜸 (0x7104 · 0x727c · 0xc66c · 목록 0x55724 · 비용 칸 0x3c60)', () => {
  const 커서줄 = () => screen.getAllByRole('option').find((option) => option.getAttribute('aria-selected') === 'true')

  it("0xe5 목록은 '8' · '2' 로도 위아래로 감아 옮긴다 — 0x55724 vt+0x1c(1, n, 숫자키 꼴 1, 0x20)", () => {
    띄우기(상태())
    상대팀고르기()

    expect(커서줄()?.getAttribute('aria-label')).toContain(teamPitchers(OPPONENT)[0].name)
    fireEvent.keyDown(window, { key: '8' })
    expect(커서줄()?.getAttribute('aria-label')).toContain(teamPitchers(OPPONENT)[1].name)
    fireEvent.keyDown(window, { key: '2' })
    fireEvent.keyDown(window, { key: '2' })
    expect(커서줄()?.getAttribute('aria-label')).toContain(teamPitchers(OPPONENT)[7].name)
    // '4' '6' 은 1열 · 꼴 0x20 이라 안 움직인다
    fireEvent.keyDown(window, { key: '6' })
    expect(커서줄()?.getAttribute('aria-label')).toContain(teamPitchers(OPPONENT)[7].name)
  })

  it('0xe6 진입은 목록 커서를 첫 줄로 — 0x5b28 → 0x5561c 의 vt+0x14(0, 0) (0xe5 에서 고른 줄 번호가 남지 않는다)', () => {
    띄우기(상태())
    타자로()
    영입고르기(teamBatters(OPPONENT)[6].name)

    expect(커서줄()?.getAttribute('aria-label')).toContain(teamBatters(MY_TEAM)[0].name)
  })

  it('0xe5 에서 상대 팀의 나리 선수를 고르면 [165] 알림만 — 0x71bc~0x723a (0xb6389)', () => {
    const 나리가낀상대 = 명단({
      batters: [{ id: 0xfe, kindByte: PLAYER_OWN_BIT | 0, fieldPosition: 0, stamina: 0 }, ...명단().batters.slice(1)],
    })
    띄우기(상태(), { opponentRosterOf: () => 나리가낀상대 })
    타자로()
    누르기('타자 1번')

    expect(알림글()).toContain('나만의 리그 선수는')
    알림닫기()
    // 0xe5 에 남는다 — 바닥 0x17 "*투수" 표시가 그대로
    expect(screen.getByRole('button', { name: '* 투수' })).toBeDefined()
  })

  it("0xe7 비용 칸은 ← → · '4' '6' · '2' '8' 도 옮긴다 — [this+0x7c] 1×3 · 꼴 0x330 · 숫자키 꼴 1", () => {
    띄우기(상태())
    타자로()
    영입고르기(teamBatters(OPPONENT)[6].name)
    누르기(teamBatters(MY_TEAM)[6].name)

    fireEvent.keyDown(window, { key: '6' })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByRole('dialog').textContent).toContain('2000')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '아니오' }))
    틀보내기()

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: '5' })
    expect(screen.getByRole('dialog').textContent).toContain('1000')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '아니오' }))
    틀보내기()

    fireEvent.keyDown(window, { key: '4' })
    fireEvent.keyDown(window, { key: '2' })
    fireEvent.keyDown(window, { key: 'Enter' })
    // 칸 2 → 1 → 0 : 기본 진행 (비용 글 없음)
    expect(screen.getByRole('dialog').textContent).not.toMatch(/\d000/)
  })
})

describe('0xe7 확인·진행 (J 4-4)', () => {
  // 두 팀 타자 6번은 +0x1b 가 둘 다 9 라 d = 0 이다 (표 값)
  const 같은값칸 = 6
  const 확인까지 = (나머지: Partial<Parameters<typeof TradeScreen>[0]> = {}, 상대칸 = 같은값칸, 내칸 = 같은값칸) => {
    const handles = 띄우기(상태(), 나머지)
    타자로()
    영입고르기(teamBatters(OPPONENT)[상대칸].name)
    누르기(teamBatters(MY_TEAM)[내칸].name)
    return handles
  }

  it('시험 전제 — 6번끼리는 값이 같고, 0번끼리는 40 · 29 다', () => {
    expect(teamBatters(MY_TEAM)[같은값칸].grade).toBe(teamBatters(OPPONENT)[같은값칸].grade)
    expect([teamBatters(MY_TEAM)[0].grade, teamBatters(OPPONENT)[0].grade]).toEqual([40, 29])
  })

  it('+0x1b 차이가 성공률을 깎는다 — d = 110 이면 40 − 44 − 20 → 바닥 3%', () => {
    확인까지({}, 0, 0)

    expect(screen.getByRole('button', { name: /기본 진행/ }).getAttribute('aria-label')).toContain('3%')
    expect(screen.getByRole('button', { name: /\+50%/ }).getAttribute('aria-label')).toContain('53%')
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
    결과닫기()

    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onBack).not.toHaveBeenCalled()
  })

  it('비용 세 칸과 그 성공률이 나온다 — 두 타자 다 마스터 칸 6 이라 벌점 0, 기본은 40% 다 (0xb6561)', () => {
    확인까지()

    expect(screen.getByRole('button', { name: /기본 진행/ }).getAttribute('aria-label')).toContain('40%')
    expect(screen.getByRole('button', { name: /\+50%/ }).getAttribute('aria-label')).toContain('90%')
    expect(screen.getByRole('button', { name: /\+20%/ }).getAttribute('aria-label')).toContain('60%')
  })

  it('타자 탭 마스터 칸 3 은 벌점 10 · 0 은 6 이다 — 3번끼리면 d 를 빼고 40 − 20 (표 값으로 견준다)', () => {
    확인까지({}, 3, 3)
    const d = (teamBatters(MY_TEAM)[3].grade - teamBatters(OPPONENT)[3].grade) * 10
    const 깎임 = Math.trunc((Math.abs(d < 0 ? d * 2 : d) * 100) / 250)

    expect(screen.getByRole('button', { name: /기본 진행/ }).getAttribute('aria-label')).toContain(`${Math.max(40 - 깎임 - 20, 3)}%`)
  })

  it('성공하면 맞바꿀 두 칸(탭·내 칸·상대 칸·상대 팀)을 넘기고 커맨드가 닫힌다', () => {
    // 기본 진행 40% → 뽑기 29 면 성공 (29 < 40)
    const { onTrade } = 확인까지({ random: 고정난수(29) })

    누르기(/기본 진행/)
    누르기('예')

    expect(결과글()).toContain('성공')
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

    expect(결과글()).toContain('실패')
    const settlement = onTrade.mock.calls[0][0]
    expect(settlement.isSuccess).toBe(false)
    expect(settlement.record.tradeUsed).toBe(1)
    expect(settlement.swap).toBeUndefined()
  })

  /** 굴림을 세는 난수 — 가드에 걸리면 굴리지 않는다 */
  const 세는난수 = () => {
    const rolls: number[][] = []
    const random: RandomPort = {
      rand: (lo, hi) => {
        rolls.push([lo, hi])
        return lo
      },
      rand9d: (n) => {
        rolls.push([n])
        return 0
      },
    }
    return { random, rolls }
  }

  it('진행 가드 0xd41e — G < 비용표 × 100 이면 [65] (예/아니오) 만 띄우고 굴림·진행·SR+0x56 이 없다', () => {
    const { random, rolls } = 세는난수()
    const { onTrade } = 확인까지({ random, gamePoints: 1999 })

    누르기(/\+50%/)
    누르기('예')

    expect(알림글()).toContain('G포인트가 부족합니다')
    누르기('예')
    expect(onTrade).not.toHaveBeenCalled()
    expect(rolls).toEqual([])
    // 0xe7 에 남는다 — 비용 칸이 그대로 보인다
    expect(screen.getByRole('button', { name: /기본 진행/ })).toBeDefined()
  })

  it('G 가 비용과 같으면 지난다 (cmp 비용, G · ble)', () => {
    const { onTrade } = 확인까지({ random: 고정난수(100), gamePoints: 2000 })

    누르기(/\+50%/)
    누르기('예')

    expect(onTrade).toHaveBeenCalledTimes(1)
  })

  it('진행 가드 0xd436 — d < 0 이고 소지금 < −d 면 [77] (확인) 만 띄우고 굴림이 없다', () => {
    const 내타자 = teamBatters(MY_TEAM)
    const 상대타자 = teamBatters(OPPONENT)
    const 내칸 = 내타자.reduce((best, entry, index) => (entry.grade < 내타자[best].grade ? index : best), 0)
    const 상대칸 = 상대타자.reduce((best, entry, index) => (entry.grade > 상대타자[best].grade ? index : best), 0)
    const d = (내타자[내칸].grade - 상대타자[상대칸].grade) * 10 * 2
    // 시험 전제 — 새 시즌 소지금 50 으로는 모자란다
    expect(d).toBeLessThan(-50)

    const { random, rolls } = 세는난수()
    const { onTrade, onFinish } = 확인까지({ random }, 상대칸, 내칸)

    누르기(/기본 진행/)
    누르기('예')

    expect(알림글()).toContain('소지금이 부족합니다')
    누르기('확인')
    expect(onTrade).not.toHaveBeenCalled()
    expect(onFinish).not.toHaveBeenCalled()
    expect(rolls).toEqual([])
  })

  it('[171] 팝업 글 — 칸 0 은 "!C" + [171], 비용 칸은 "!C" + 비용 + [172] + "!N" + [171] (0xc6ae~0xc736)', () => {
    expect(tradeQuestionTextOf(0)).toBe('!C!C트레이드를 하시겠습니까?')
    expect(tradeQuestionTextOf(1)).toBe('!C2000 !cFFFF00G포인트!cFFFFFF가 소모됩니다!N!C트레이드를 하시겠습니까?')
    expect(tradeQuestionTextOf(2)).toBe('!C1000 !cFFFF00G포인트!cFFFFFF가 소모됩니다!N!C트레이드를 하시겠습니까?')

    확인까지()
    누르기(/\+20%/)
    expect(알림글()).toContain('1000 G포인트가 소모됩니다') // [172] 앞 빈칸(원문)
    expect(알림글()).toContain('트레이드를 하시겠습니까?')
  })

  it('+50% 칸은 2000G 를 쓴다 (성공·실패와 상관없이 나간다)', () => {
    const { onTrade } = 확인까지({ random: 고정난수(100) })

    누르기(/\+50%/)
    누르기('예')

    expect(onTrade.mock.calls[0][0].gamePointCost).toBe(2000)
  })
})

describe('0xe7 진행 연출 (0xcecc · 0xc66c 단계 1~3)', () => {
  it('[171] 예 → [173] 진행 중 게이지가 틀마다 2 씩 차고, 다 찬 틀에 굴려 [174]/[175] 를 판 위에 쓴다', () => {
    const 굴림: number[][] = []
    const random: RandomPort = { rand: (lo, hi) => (굴림.push([lo, hi]), lo), rand9d: () => 0 }
    띄우기(상태(), { random })
    상대팀고르기()
    영입고르기(teamPitchers(OPPONENT)[0].name)
    fireEvent.click(칸(teamPitchers(MY_TEAM)[0].name))
    fireEvent.click(screen.getByRole('button', { name: /기본 진행/ }))
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    // 가드를 지난 그 자리 — 아직 굴리지 않았다
    expect(결과글()).toContain('트레이드 진행 중')
    expect(굴림).toEqual([])
    act(() => {
      vi.advanceTimersByTime(millisecondsPerFrame() * 10)
    })
    const 게이지 = screen.getByTestId('트레이드-게이지') as HTMLElement
    const 너비 = 게이지.style.width
    expect(Number.parseInt(너비, 10)).toBeGreaterThan(2)
    expect(Number.parseInt(너비, 10)).toBeLessThan(169)
    // mode_ui 프레임 72 박스 1 (37, 216, 169, 13) — 0xcecc · 0xdc6c
    expect([게이지.style.left, 게이지.style.top, 게이지.style.height]).toEqual(['37px', '216px', '13px'])
    expect(굴림).toEqual([])

    틀보내기()
    expect(굴림).toEqual([[1, 101]])
    expect(결과글()).toMatch(/성공|실패/)
  })

  it('진행 중 확인 키는 게이지를 채워 다음 틀에 끝낸다 (0xc76e → this+0x164 = 너비)', () => {
    const { onTrade } = 띄우기(상태(), { random: 고정난수(1) })
    상대팀고르기()
    영입고르기(teamPitchers(OPPONENT)[0].name)
    fireEvent.click(칸(teamPitchers(MY_TEAM)[0].name))
    fireEvent.click(screen.getByRole('button', { name: /기본 진행/ }))
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    fireEvent.keyDown(window, { key: '5' })
    expect(onTrade).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(millisecondsPerFrame() * 2)
    })
    expect(onTrade).toHaveBeenCalledTimes(1)
  })
})

describe('0xe4 팀 고르기 키 0x8250', () => {
  it('히든 칸(> 9)은 힌트 팝업만 — 0xca 와 같은 글이고 트레이드로 안 넘어간다', () => {
    띄우기(상태())

    fireEvent.click(screen.getAllByRole('button', { name: '???' })[0])

    expect(알림글()).toContain('히든 팀 오픈 힌트')
    expect(알림글()).toContain('선택 할 수 없는 팀입니다')
    누르기('확인')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('열린 히든 팀도 못 고른다 — 힌트에서 [0] 줄만 빠진다', () => {
    띄우기(상태(), { openedHiddenIds: [14] })

    누르기(TEAMS[14].name)

    expect(알림글()).toContain('마선수 총출동')
    expect(알림글()).not.toContain('선택 할 수 없는 팀입니다')
  })

  it('내 팀 칸(SR+1)은 아무 일도 안 한다', () => {
    띄우기(상태())

    누르기(TEAMS[MY_TEAM].name)

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getAllByRole('button', { name: TEAMS[OPPONENT].name }).length).toBeGreaterThan(0)
  })
})

describe('SR+0x56 (이번 주기에 트레이드를 썼다)', () => {
  it('0xe4 는 막지 않는다 — 0x4e40 · 0x4774 가 켬 표를 안 본다(막는 것은 구단관리 이동 0x6c444 뿐)', () => {
    띄우기(상태({ tradeUsed: 1 }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getAllByRole('button', { name: TEAMS[OPPONENT].name }).length).toBeGreaterThan(0)
  })
})

describe('CPU 트레이드 요청으로 들어오면 (0xe5 진입 0x5cd0 · 키 0x7104 · 0x727c · 0xc66c)', () => {
  const 요청 = {
    isRequested: true,
    myIndex: 3,
    opponentIndex: 2,
    tab: 1,
    opponentTeamId: OPPONENT,
  } as const

  it('팀 고르기를 건너뛰고 [204] 알림부터 — 닫으면 상대 칸이 묶인 목록이다', () => {
    띄우기(상태(), { request: 요청 })

    expect(알림글()).toContain('상대 팀에서 제시한')
    누르기('확인')
    expect(칸(teamBatters(OPPONENT)[2].name)).toBeDefined()
  })

  it('다른 줄을 눌러도 요청 칸으로 진행하고 [205] → 확인 단계, 성공이 강제된다 (뽑기 100 이어도)', () => {
    // 요청도 진행 가드 [77] 을 지난다 — 소지금은 넉넉히
    const { onTrade, onFinish } = 띄우기(상태({ tradeUsed: 1, money: 9999 }), { request: 요청, random: 고정난수(100) })

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
    결과닫기()
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('위·아래를 눌러도 커서가 요청 칸에서 안 움직인다 (−3 → 보기 전용 편집기 0x559f8 은 끝 코드만 적는다)', () => {
    띄우기(상태(), { request: 요청 })
    누르기('확인')
    const 커서줄 = () => screen.getAllByRole('option').find((option) => option.getAttribute('aria-selected') === 'true')

    expect(커서줄()?.getAttribute('aria-label')).toContain(teamBatters(OPPONENT)[2].name)
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'ArrowUp' })
    fireEvent.keyDown(window, { key: 'ArrowUp' })
    expect(커서줄()?.getAttribute('aria-label')).toContain(teamBatters(OPPONENT)[2].name)
  })

  it("요청 중에는 '*' 가 편집기에 안 가 탭이 묶인다 (0x7104 `키 == 0x2a` 거르기)", () => {
    띄우기(상태(), { request: 요청 })
    누르기('확인')

    fireEvent.keyDown(window, { key: '*' })
    expect(칸(teamBatters(OPPONENT)[2].name)).toBeDefined()
    // 요청이면 0xe5 바닥이 7 — "*투수" · "*타자" 표시가 없다 (0xb116~0xb124)
    expect(screen.queryByRole('button', { name: '* 투수' })).toBeNull()
    expect(screen.queryByRole('button', { name: '* 타자' })).toBeNull()
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

    expect(칸(teamPitchers(OPPONENT)[2].name)).toBeDefined()
  })
})

describe('상대 팀 레코드 (시즌 저장의 CPU 명단)', () => {
  it('지난 트레이드로 간 내 옛 선수가 상대 목록에 제 이름(옛 팀 표)으로 나온다', () => {
    const 상대 = {
      pitchers: teamPitchers(OPPONENT).map((_p, slot) => ({ id: slot, kindByte: slot, fieldPosition: 0, stamina: 0 })),
      batters: teamBatters(OPPONENT).map((_p, slot) =>
        slot === 4
          ? { id: 1, kindByte: slot, fieldPosition: 0, stamina: 0, tableTeamId: MY_TEAM }
          : { id: slot, kindByte: slot, fieldPosition: 0, stamina: 0 },
      ),
    }
    띄우기(상태(), { opponentRosterOf: () => 상대 })
    타자로()

    expect(칸(teamBatters(MY_TEAM)[1].name)).toBeDefined()
    expect(screen.queryByRole('option', { name: teamBatters(OPPONENT)[4].name })).toBeNull()
  })

  it('데려온 선수는 내 목록에서 옛 팀 표 이름으로 나온다 — 내 팀 표의 같은 칸 이름이 아니다', () => {
    const 내명단 = 명단({
      batters: 명단().batters.map((player, slot) => (slot === 2 ? { ...player, id: 7, tableTeamId: OPPONENT } : player)),
    })
    띄우기(상태(), { roster: 내명단 })
    타자로()
    영입고르기(teamBatters(OPPONENT)[0].name)

    expect(screen.getAllByRole('option', { name: teamBatters(OPPONENT)[7].name }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('option', { name: teamBatters(MY_TEAM)[2].name })).toBeNull()
  })
})

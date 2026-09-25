// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSeasonSession } from '@/app/model/useSeasonSession'
import { SEASON_GAME_COUNT } from '@/entities/season-mode/model/seasonRecord'
import { SEASON_PHASE, SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { GAME_POINT_LIMIT } from '@/entities/season-mode/model/seasonRewards'
import { clearSeasonGameRecord } from '@/entities/season-mode/model/seasonReputation'
import { useGamePointWallet } from '@/entities/wallet/model/useGamePointWallet'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { TeamGameSummary } from '@/features/play-team-game/model/teamGameFlow'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'

/** 시즌 모드 한 판을 잇는 훅 (원본 장면 0x105) — 저장·장면 전환만 본다 */

function 메모리저장(): JsonStorePort {
  let held: unknown = null
  return {
    load: () => held,
    save: (value: object) => {
      held = value
    },
  }
}

const 띄우기 = (store: JsonStorePort = 메모리저장()) =>
  renderHook(() => useSeasonSession(store, createSeededRandom(20100901)))

/** 팀 경기가 끝나고 오는 요약 — 정산에 쓰는 칸만 채운다 */
const 요약 = (overrides: Partial<TeamGameSummary> = {}): TeamGameSummary => ({
  result: '승',
  won: true,
  ourScore: 5,
  opponentScore: 3,
  ourTeamId: 0,
  opponentTeamId: 1,
  inningsPlayed: 9,
  pitching: { hitsAllowed: 6, walksAllowed: 2, outsRecorded: 27, runsAllowed: 3, allowedBaserunner: true },
  leaguePlateAppearances: [],
  popularityCompleteGame: null,
  reputationCompleteGame: null,
  gameRecord: clearSeasonGameRecord(),
  ...overrides,
})

describe('시즌 세션', () => {
  it('저장이 없으면 팀 고르기부터다 (0xca)', () => {
    const { result } = 띄우기()

    expect(result.current.state).toBeNull()
    expect(result.current.scene).toBe(SEASON_SCENE_STATE.팀고르기)
  })

  it('팀을 고르면 새 시즌이 서고 관리 메뉴로 간다 — 소지금 50 · 인기도 0 · 사기 100 (0x5758)', () => {
    const { result } = 띄우기()

    act(() => result.current.actions.chooseTeam(3))

    expect(result.current.scene).toBe(SEASON_SCENE_STATE.관리메뉴)
    expect(result.current.state?.record.teamId).toBe(3)
    expect(result.current.state?.record.money).toBe(50)
    expect(result.current.state?.teamMorale).toBe(100)
  })

  it('저장 칸에 담기고 다시 띄우면 이어진다', () => {
    const store = 메모리저장()
    const 첫판 = 띄우기(store)
    act(() => 첫판.result.current.actions.chooseTeam(5))

    const 둘째판 = 띄우기(store)

    expect(둘째판.result.current.state?.record.teamId).toBe(5)
    // 경기 수 0 · phase 새시즌이면 관리 메뉴가 열린다 (enterSeasonScene)
    expect(둘째판.result.current.scene).toBe(SEASON_SCENE_STATE.관리메뉴)
  })

  it('다음경기를 고르면 **팀 경기 화면**으로 간다 — 옵션이 커리어에서 채워진다', () => {
    const { result } = 띄우기()
    act(() => result.current.actions.chooseTeam(0))

    act(() => result.current.actions.playNextGame())

    expect(result.current.scene).toBe(SEASON_SCENE_STATE.경기직전)
    // 시즌모드 = 원본 게임 모드 2 (능력치 보정 마스크 0x306 에 든다)
    expect(result.current.gameOptions?.mode).toBe(2)
    expect(result.current.gameOptions?.ourTeamId).toBe(0)
    // 경기 수는 아직 오르지 않는다 — 경기가 끝나야 센다
    expect(result.current.state?.record.games).toBe(0)
  })

  it('경기로 들어갈 때 평판 기록 16칸을 지운다 — 원본 0xa3424 는 **시작** 쪽 한 곳뿐이다', () => {
    const { result } = 띄우기()
    act(() => result.current.actions.chooseTeam(0))
    const 레코드 = result.current.state?.record
    if (레코드 === undefined) throw new Error('레코드가 없다')
    act(() => result.current.actions.updateRecord({ ...레코드, gameRecord: [...레코드.gameRecord].fill(3) }))
    expect(result.current.state?.record.gameRecord.every((칸) => 칸 === 3)).toBe(true)

    act(() => result.current.actions.playNextGame())

    expect(result.current.state?.record.gameRecord).toEqual(Array.from({ length: 16 }, () => 0))
  })

  it('경기가 끝나면 경기 수가 오르고 관중수입 창으로 간다 (0xe9)', () => {
    const { result } = 띄우기()
    act(() => result.current.actions.chooseTeam(0))
    act(() => result.current.actions.playNextGame())

    act(() => result.current.actions.finishGame(요약()))

    expect(result.current.state?.record.games).toBe(1)
    expect(result.current.scene).toBe(SEASON_SCENE_STATE.관중수입)
    // 경기를 치르면 이번 주기의 트레이닝·외출 표시를 지운다 (0x4f158)
    expect(result.current.state?.record.acted).toBe(false)
  })

  it('요약이 싣고 온 평판 16칸이 평가에 먹는다 (0xa3440 → 0xa6f1c)', () => {
    const { result } = 띄우기()
    act(() => result.current.actions.chooseTeam(0))
    act(() => result.current.actions.playNextGame())
    const 시작평판 = result.current.state?.record.reputation ?? 0

    // 16칸이 비면 s = −1(상대 3점) + 2(승리) = 1 → 등급 +1 이다.
    // 만루홈런 한 칸(S[13], ×5)을 세우면 s = 6 → 등급 +3 으로 올라간다.
    const 기록 = clearSeasonGameRecord()
    기록[13] = 1
    act(() => result.current.actions.finishGame(요약({ gameRecord: 기록 })))

    expect(result.current.state?.record.gameRecord).toEqual(기록)
    expect(result.current.state?.record.lastReputationGrade).toBe(3)
    expect(result.current.state?.record.reputation).toBe(시작평판 + 3)
  })

  it('수입을 확인하면 2경기 주기에 따라 다음이 갈린다 (afterGameNext)', () => {
    const { result } = 띄우기()
    act(() => result.current.actions.chooseTeam(0))
    act(() => result.current.actions.playNextGame())
    act(() => result.current.actions.finishGame(요약()))

    // 1경기째 뒤 → 홀수라 관리 메뉴가 안 열리고 다음경기로
    act(() => result.current.actions.confirmIncome(result.current.state!.record))
    expect(result.current.scene).toBe(SEASON_SCENE_STATE.다음경기)
  })

  it('정규시즌이 끝나면 **국가대항전 연차라도** 시즌 끝 사슬이 먼저다 (afterKoreanSeries)', () => {
    const { result } = 띄우기()
    act(() => result.current.actions.chooseTeam(0))
    // 1년차(연차idx 0)는 국가대항전 연차지만, 대회는 결산을 닫은 뒤에 열린다
    const 마지막경기 = { ...result.current.state!.record, games: SEASON_GAME_COUNT }

    act(() => result.current.actions.confirmIncome(마지막경기))

    expect(result.current.scene).toBe(SEASON_SCENE_STATE.포스트시즌시작)
    expect(result.current.state?.record.nationalCup).toBe(false)
  })
})

describe('시즌 관리 커맨드', () => {
  it('트레이닝은 고른 칸만 올리고 사기를 깎는다 (J 4-6)', () => {
    const { result } = 띄우기()
    act(() => result.current.actions.chooseTeam(0))
    const 전 = result.current.state!

    act(() => result.current.actions.runTraining(1))

    const 후 = result.current.state!
    const 내팀 = 후.record.teamId
    expect(후.teamAbilities[내팀][1]).toBeGreaterThan(전.teamAbilities[내팀][1])
    // 고르지 않은 칸은 그대로다
    expect(후.teamAbilities[내팀][0]).toBe(전.teamAbilities[내팀][0])
    expect(후.teamMorale).toBeLessThan(전.teamMorale)
    expect(후.record.acted).toBe(true)
  })

  it('지옥훈련은 네 칸을 모두 올린다', () => {
    const { result } = 띄우기()
    act(() => result.current.actions.chooseTeam(0))
    const 전 = result.current.state!.teamAbilities[0]

    act(() => result.current.actions.runTraining(4))

    const 후 = result.current.state!.teamAbilities[0]
    expect(후.every((value, index) => value > 전[index])).toBe(true)
  })

  it('친선경기는 사기를 깎고 소지금을 준다 — 사기 난수의 부호를 뒤집는다 (0xc8b0)', () => {
    const { result } = 띄우기()
    act(() => result.current.actions.chooseTeam(0))
    const 전 = result.current.state!
    // 새 시즌 사기는 100(최대)이라 올리는 쪽은 여기서 안 보인다 — 원본 0x5758 이 100 으로 시작한다
    expect(전.teamMorale).toBe(100)

    act(() => result.current.actions.runOuting(0))

    const 후 = result.current.state!
    expect(후.teamMorale).toBeLessThan(전.teamMorale)
    expect(후.record.money).toBeGreaterThan(전.record.money)
    expect(후.record.acted).toBe(true)
  })

  it('회식은 사기를 올리고 소지금 4 를 깎는다 — 사기가 깎여 있을 때 보인다', () => {
    const { result } = 띄우기()
    act(() => result.current.actions.chooseTeam(0))
    act(() => result.current.actions.runOuting(0)) // 친선경기로 사기를 먼저 깎는다
    const 전 = result.current.state!

    act(() => result.current.actions.runOuting(1))

    const 후 = result.current.state!
    expect(후.teamMorale).toBeGreaterThan(전.teamMorale)
    expect(후.record.money).toBe(전.record.money - 4)
  })
})

describe('구장 히든 해금 (app+0xe0)', () => {
  it('컬렉터 해금 id 를 쌓아 둔다 — 같은 id 를 두 번 열어도 한 번만 남는다', () => {
    const { result } = 띄우기()
    act(() => result.current.actions.chooseTeam(0))

    act(() => result.current.actions.openStadiumItems([13]))
    act(() => result.current.actions.openStadiumItems([13, 16]))

    expect(result.current.openedStadiumIds).toEqual([13, 16])
  })
})

describe('시즌 끝 사슬', () => {
  it('국가대항전이 아닌 연차는 정규시즌이 끝나면 **포스트시즌 시작(0xee)** 으로 간다', () => {
    const { result } = 띄우기()
    act(() => result.current.actions.chooseTeam(0))
    // 2년차(연차idx 1)는 국가대항전 연차가 아니다
    const 홀수연차 = { ...result.current.state!.record, games: SEASON_GAME_COUNT, yearIndex: 1 }

    act(() => result.current.actions.confirmIncome(홀수연차))

    expect(result.current.scene).toBe(SEASON_SCENE_STATE.포스트시즌시작)
  })

  it('사슬은 0xee → 0xeb → 0xec → 0xed → 0xf0 → 0xef 차례다', () => {
    const { result } = 띄우기()
    act(() => result.current.actions.chooseTeam(0))
    act(() => result.current.actions.confirmIncome({
      ...result.current.state!.record, games: SEASON_GAME_COUNT, yearIndex: 1,
    }))

    const 차례 = [result.current.scene]
    for (let step = 0; step < 5; step += 1) {
      act(() => result.current.actions.nextSeasonEndStep())
      차례.push(result.current.scene)
    }

    expect(차례).toEqual([
      SEASON_SCENE_STATE.포스트시즌시작,
      SEASON_SCENE_STATE.타자시상,
      SEASON_SCENE_STATE.투수시상,
      SEASON_SCENE_STATE.최우수선수,
      SEASON_SCENE_STATE.정규시즌순위,
      SEASON_SCENE_STATE.시즌결산,
    ])
  })

  it('결산을 닫으면 홀수 연차는 새 해로 간다 — 연차가 오르고 리그 전적이 비워진다 (0x6e0c)', () => {
    const { result } = 띄우기()
    act(() => result.current.actions.chooseTeam(0))
    act(() => result.current.actions.confirmIncome({
      ...result.current.state!.record, games: SEASON_GAME_COUNT, yearIndex: 1,
    }))

    act(() => result.current.actions.finishSeason())

    expect(result.current.state?.record.yearIndex).toBe(2)
    expect(result.current.scene).toBe(SEASON_SCENE_STATE.관리메뉴)
    expect(result.current.league.wins.every((wins) => wins === 0)).toBe(true)
  })

  it('**마지막 해(연차 idx 9)** 는 결산을 닫으면 새 해가 아니라 엔딩(0xf5)으로 간다 (0x6e0c 머리)', () => {
    const { result } = 띄우기()
    act(() => result.current.actions.chooseTeam(0))
    act(() => result.current.actions.confirmIncome({
      ...result.current.state!.record, games: SEASON_GAME_COUNT, yearIndex: 9,
    }))

    act(() => result.current.actions.finishSeason())

    expect(result.current.scene).toBe(SEASON_SCENE_STATE.엔딩)
    // phase 6 으로 저장해 두어야 다시 들어와도 엔딩으로 온다 (진입 분기 0xcb)
    expect(result.current.state?.record.phase).toBe(SEASON_PHASE.엔딩)
    expect(result.current.state?.record.yearIndex).toBe(9) // 연차를 올리지 않는다
  })

  it('엔딩을 보면 SR+0x1bc 가 서고, 다시 띄우면 관리 메뉴로 온다 (0x8bd8 → 0xcb)', () => {
    const store = 메모리저장()
    const 첫판 = 띄우기(store)
    act(() => 첫판.result.current.actions.chooseTeam(0))
    act(() => 첫판.result.current.actions.confirmIncome({
      ...첫판.result.current.state!.record, games: SEASON_GAME_COUNT, yearIndex: 9,
    }))
    act(() => 첫판.result.current.actions.finishSeason())

    act(() => 첫판.result.current.actions.markEndingSeen())

    expect(첫판.result.current.state?.record.endingSeen).toBe(true)
    const 둘째판 = 띄우기(store)
    expect(둘째판.result.current.state?.record.phase).toBe(SEASON_PHASE.엔딩)
    expect(둘째판.result.current.scene).toBe(SEASON_SCENE_STATE.관리메뉴)
  })

  it('짝수 연차는 결산 뒤 국가대항전이 열린다', () => {
    const { result } = 띄우기()
    act(() => result.current.actions.chooseTeam(0))
    act(() => result.current.actions.confirmIncome({
      ...result.current.state!.record, games: SEASON_GAME_COUNT, yearIndex: 1,
    }))
    // 결산 직전에 연차를 짝수로 바꾼다 (원본 afterKoreanSeries 가 보는 칸)
    act(() => result.current.actions.updateRecord({ ...result.current.state!.record, yearIndex: 2 }))

    act(() => result.current.actions.finishSeason())

    expect(result.current.scene).toBe(SEASON_SCENE_STATE.국가대항전)
    expect(result.current.cup).not.toBeNull()
  })
})

describe('포스트시즌', () => {
  const 시즌끝 = () => {
    const rendered = 띄우기()
    act(() => rendered.result.current.actions.chooseTeam(0))
    act(() => rendered.result.current.actions.confirmIncome({
      ...rendered.result.current.state!.record, games: SEASON_GAME_COUNT, yearIndex: 1,
    }))
    return rendered
  }

  it('정규시즌이 끝나면 **대진만 짜고** 경기는 아직 안 친다 — 결산 화면(0xef)이 진행시킨다', () => {
    const { result } = 시즌끝()

    expect(result.current.series?.round).toBe('준플레이오프')
    expect(result.current.series?.champion).toBeNull()
    expect(result.current.state?.record.inPostseason).toBe(true)
  })

  it('결산에서 진행시키면 — 내 차례면 경기 화면, 아니면 CPU 끼리 돈다 (0x13da0)', () => {
    const { result } = 시즌끝()
    const 내팀 = result.current.state!.record.teamId
    const 첫시리즈 = result.current.series!

    act(() => result.current.actions.continuePostseason())

    if (첫시리즈.teams.includes(내팀)) {
      expect(result.current.scene).toBe(SEASON_SCENE_STATE.경기직전)
      expect(result.current.gameKind).toBe('포스트시즌')
    } else {
      // 내 차례가 오거나 우승이 정해질 때까지 돌린다
      const series = result.current.series!
      expect(series.round === '종료' || series.teams.includes(내팀)).toBe(true)
    }
  })

  it('포스트시즌은 정규시즌 1~4위만 올라간다', () => {
    const { result } = 시즌끝()

    expect(result.current.series?.qualifiers).toEqual(result.current.ranking.slice(0, 4))
  })

  it('정규시즌 1위면 `+0x7a`(1위 횟수)가 오른다', () => {
    const { result } = 시즌끝()
    const 일위 = result.current.ranking[0]

    expect(result.current.state?.record.regularSeasonFirsts).toBe(일위 === 0 ? 1 : 0)
  })

  it('새 해로 넘어가면 시리즈·순위가 비워진다', () => {
    const { result } = 시즌끝()

    act(() => result.current.actions.finishSeason())

    expect(result.current.series).toBeNull()
    expect(result.current.ranking).toEqual([])
  })
})

describe('전역 G 지갑 (mgr[+0x64])', () => {
  /** 시즌 세션과 지갑을 같이 띄운다 — 실제 App 배선과 같은 모양이다 */
  const 지갑띄우기 = (시작G: number, seasonStore: JsonStorePort = 메모리저장()) => {
    let 적힌지갑: unknown = { gamePoint: 시작G }
    const walletStore: JsonStorePort = {
      load: () => 적힌지갑,
      save: (value) => {
        적힌지갑 = value
      },
    }
    return renderHook(() => {
      const wallet = useGamePointWallet(walletStore)
      return { wallet, session: useSeasonSession(seasonStore, createSeededRandom(20100901), wallet) }
    })
  }

  it('지갑을 넘기면 시즌 G 가 지갑 값이다 — 모드마다 다른 칸은 없다', () => {
    const { result } = 지갑띄우기(7000)

    expect(result.current.session.gamePoints).toBe(7000)
  })

  it('G 를 쓰면 세션이 아니라 **지갑**이 깎인다 (경기 중 자동진행 0x22c29)', () => {
    const { result } = 지갑띄우기(7000)

    act(() => result.current.session.actions.spendGamePoint(1500))

    expect(result.current.wallet.balance).toBe(5500)
    expect(result.current.session.gamePoints).toBe(5500)
  })

  it('리그 1위 보상 G 는 지갑에 쌓인다 (0x6900 → 0x87e8)', () => {
    const { result } = 지갑띄우기(1000)

    act(() => result.current.session.actions.awardLeagueFirst({ threshold: 1, bit: 0, gamePoint: 3000 }))

    expect(result.current.wallet.balance).toBe(4000)
    expect(result.current.session.leagueFirstAwardedBits).toBe(1)
  })

  it('지옥훈련은 지갑에서 500G 를 뺀다 (0xa2fca)', () => {
    const { result } = 지갑띄우기(2000)
    act(() => result.current.session.actions.chooseTeam(0))

    act(() => result.current.session.actions.runTraining(4))

    expect(result.current.wallet.balance).toBe(1500)
  })

  it('칸 0~3 팀 트레이닝은 G 를 안 쓴다 (J 4-6)', () => {
    const { result } = 지갑띄우기(2000)
    act(() => result.current.session.actions.chooseTeam(0))

    act(() => result.current.session.actions.runTraining(1))

    expect(result.current.wallet.balance).toBe(2000)
  })

  it('`?무한G` 면 **보여 주는 값과 판정이 같은 값**이고 지갑은 안 깎인다', () => {
    window.history.replaceState({}, '', '/?무한G')
    const { result } = 지갑띄우기(10)

    expect(result.current.session.gamePoints).toBe(GAME_POINT_LIMIT)
    act(() => result.current.session.actions.spendGamePoint(2000))
    expect(result.current.session.gamePoints).toBe(GAME_POINT_LIMIT)

    window.history.replaceState({}, '', '/')
  })

  it('지갑을 안 넘기면 예전처럼 세션 주머니로 논다 (기존 테스트가 사는 길)', () => {
    const { result } = 띄우기()

    act(() => result.current.actions.awardLeagueFirst({ threshold: 5, bit: 2, gamePoint: 2000 }))
    act(() => result.current.actions.spendGamePoint(500))

    expect(result.current.gamePoints).toBe(1500)
  })
})

// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { AnnalsStatEvent } from '@/entities/collection/model/annalsStats'
import { seasonGoalInputOf, useSeasonSession } from '@/app/model/useSeasonSession'
import { postseasonGameOf, postseasonRotationTurnsOf } from '@/entities/league/model/league'
import { SEASON_GAME_COUNT } from '@/entities/season-mode/model/seasonRecord'
import { SEASON_PHASE, SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { SEASON_PLAYABLE_EVENTS } from '@/entities/season-mode/model/seasonEventFlow'
import { PRE_GAME_ACE_PHASE, SQUAD_PURPOSE } from '@/entities/season-mode/model/preGameFlow'
import { ENTRY_SUB_TAB, ENTRY_TAB } from '@/entities/season-mode/model/entryEditor'
import { teamPitchers } from '@/entities/team/model/teamRoster'
import { FULL_PLAY_SETTINGS } from '@/features/play-team-game/model/matchSettings'
import { GAME_POINT_LIMIT } from '@/entities/season-mode/model/seasonRewards'
import { clearSeasonGameRecord } from '@/entities/season-mode/model/seasonReputation'
import { useGamePointWallet } from '@/entities/wallet/model/useGamePointWallet'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { TeamGameSummary } from '@/features/play-team-game/model/teamGameFlow'
import { rollOpponentAces } from '@/features/play-team-game/model/teamGameFlow'
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

type 세션결과 = { readonly current: ReturnType<typeof useSeasonSession> }

/**
 * 이벤트 재생 0xd3 을 끝까지 넘긴다 — 이벤트 명령의 보상을 그대로 모아 넘기고, 본 이벤트는 그 한 편으로 친다
 * (선택지로 건너가는 이벤트는 따로 고르지 않는다). 지나온 이벤트 번호를 차례대로 돌려준다.
 */
function 이벤트넘기기(result: 세션결과): number[] {
  const 지나온: number[] = []
  for (let guard = 0; guard < 20 && result.current.scene === SEASON_SCENE_STATE.이벤트재생; guard += 1) {
    const playback = result.current.eventPlayback
    if (playback === null) break
    const event = SEASON_PLAYABLE_EVENTS.find((candidate) => candidate.id === playback.eventId)
    const rewards = (event?.commands ?? []).flatMap((command) => (command.op === 'reward' ? command.items : []))
    지나온.push(playback.eventId)
    act(() => result.current.actions.finishSeasonEvent(rewards, [playback.eventId]))
  }
  return 지나온
}

/** 팀을 고르고 첫 관리 메뉴의 이벤트(400 → 연초 목표 → 1)를 넘긴다 */
function 시작(result: 세션결과, teamId: number): void {
  act(() => result.current.actions.chooseTeam(teamId))
  이벤트넘기기(result)
}

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

    시작(result, 3)

    expect(result.current.scene).toBe(SEASON_SCENE_STATE.관리메뉴)
    expect(result.current.state?.record.teamId).toBe(3)
    expect(result.current.state?.record.money).toBe(50)
    expect(result.current.state?.teamMorale).toBe(100)
  })

  it('저장 칸에 담기고 다시 띄우면 이어진다', () => {
    const store = 메모리저장()
    const 첫판 = 띄우기(store)
    시작(첫판.result, 5)

    const 둘째판 = 띄우기(store)

    expect(둘째판.result.current.state?.record.teamId).toBe(5)
    // 경기 수 0 · phase 새시즌이면 관리 메뉴가 열린다 (enterSeasonScene)
    expect(둘째판.result.current.scene).toBe(SEASON_SCENE_STATE.관리메뉴)
  })

  it('다음경기를 고르면 **팀 경기 화면**으로 간다 — 옵션이 커리어에서 채워진다', () => {
    const { result } = 띄우기()
    시작(result, 0)

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
    시작(result, 0)
    const 레코드 = result.current.state?.record
    if (레코드 === undefined) throw new Error('레코드가 없다')
    act(() => result.current.actions.updateRecord({ ...레코드, gameRecord: [...레코드.gameRecord].fill(3) }))
    expect(result.current.state?.record.gameRecord.every((칸) => 칸 === 3)).toBe(true)

    act(() => result.current.actions.playNextGame())

    expect(result.current.state?.record.gameRecord).toEqual(Array.from({ length: 16 }, () => 0))
  })

  it('경기가 끝나면 경기 수가 오르고 관중수입 창으로 간다 (0xe9)', () => {
    const { result } = 띄우기()
    시작(result, 0)
    act(() => result.current.actions.playNextGame())

    act(() => result.current.actions.finishGame(요약()))

    expect(result.current.state?.record.games).toBe(1)
    expect(result.current.scene).toBe(SEASON_SCENE_STATE.관중수입)
    // 경기를 치르면 이번 주기의 트레이닝·외출 표시를 지운다 (0x4f158)
    expect(result.current.state?.record.acted).toBe(false)
  })

  it('요약이 싣고 온 평판 16칸이 평가에 먹는다 (0xa3440 → 0xa6f1c)', () => {
    const { result } = 띄우기()
    시작(result, 0)
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

  it('동점으로 끝난 경기는 **선공(칸 0) 쪽 승**으로 리그에 적는다 — 0x4f072 `R(1) > R(0)` 가 아니면 칸 0 승', () => {
    const { result } = 띄우기()
    시작(result, 0)
    act(() => result.current.actions.playNextGame())
    const 측 = result.current.gameOptions!.playerSide
    const 상대 = result.current.gameOptions!.opponentTeamId

    act(() => result.current.actions.finishGame(요약({
      result: '무', won: false, ourScore: 2, opponentScore: 2, opponentTeamId: 상대,
    })))

    const 내승 = result.current.league.wins[0] ?? 0
    const 상대승 = result.current.league.wins[상대] ?? 0
    // 리그 하루의 나머지 네 경기는 0·상대 팀을 안 건드린다
    expect(내승).toBe(측 === 0 ? 1 : 0)
    expect(상대승).toBe(측 === 0 ? 0 : 1)
  })

  it('관리 메뉴의 다음경기는 0xd8 로 가며 phase 를 4 로 남긴다 — 다시 띄우면 0xd8 이다 (0x4cb8)', () => {
    const store = 메모리저장()
    const { result } = 띄우기(store)
    시작(result, 0)

    act(() => result.current.actions.openNextGame())

    expect(result.current.scene).toBe(SEASON_SCENE_STATE.다음경기)
    expect(result.current.state?.record.phase).toBe(SEASON_PHASE.다음경기)
    expect(result.current.gameOptions).toBeNull()
    expect(띄우기(store).result.current.scene).toBe(SEASON_SCENE_STATE.다음경기)
  })

  it('0xd8 취소는 관리 메뉴에서 왔을 때만 돌아간다 (0x48ea) — phase 도 3 으로', () => {
    const { result } = 띄우기()
    시작(result, 0)
    act(() => result.current.actions.openNextGame())

    act(() => result.current.actions.cancelNextGame())

    expect(result.current.scene).toBe(SEASON_SCENE_STATE.관리메뉴)
    expect(result.current.state?.record.phase).toBe(SEASON_PHASE.기본)
  })

  it('홀수 경기 뒤 0xd8 은 취소가 안 먹고, 확인하면 경기로 간다', () => {
    const { result } = 띄우기()
    시작(result, 0)
    act(() => result.current.actions.playNextGame())
    act(() => result.current.actions.finishGame(요약()))
    act(() => result.current.actions.confirmIncome(result.current.state!.record))
    expect(result.current.scene).toBe(SEASON_SCENE_STATE.다음경기)
    expect(result.current.state?.record.phase).toBe(SEASON_PHASE.다음경기)

    act(() => result.current.actions.cancelNextGame())
    expect(result.current.scene).toBe(SEASON_SCENE_STATE.다음경기)

    act(() => result.current.actions.confirmNextGame())
    // 0x48fc: this+0x11c = 1 → 0xd7 경기 전 마선수 고르기 (마투수부터)
    expect(result.current.scene).toBe(SEASON_SCENE_STATE.선수단)
    expect(result.current.squadPurpose).toBe(SQUAD_PURPOSE.경기전)
    expect(result.current.gameOptions).toBeNull()
  })

  it('포스트시즌 중 0xd8 확인은 결산 0xef 로 간다 (0x48fc SR+0xb4)', () => {
    const { result } = 띄우기()
    시작(result, 0)
    act(() => result.current.actions.updateRecord({ ...result.current.state!.record, inPostseason: true }))
    act(() => result.current.actions.goto(SEASON_SCENE_STATE.다음경기))

    act(() => result.current.actions.confirmNextGame())

    expect(result.current.scene).toBe(SEASON_SCENE_STATE.시즌결산)
  })

  it('수입을 확인하면 2경기 주기에 따라 다음이 갈린다 (afterGameNext)', () => {
    const { result } = 띄우기()
    시작(result, 0)
    act(() => result.current.actions.playNextGame())
    act(() => result.current.actions.finishGame(요약()))

    // 1경기째 뒤 → 홀수라 관리 메뉴가 안 열리고 다음경기로
    act(() => result.current.actions.confirmIncome(result.current.state!.record))
    expect(result.current.scene).toBe(SEASON_SCENE_STATE.다음경기)
  })

  it('정규시즌이 끝나면 **국가대항전 연차라도** 시즌 끝 사슬이 먼저다 (afterKoreanSeries)', () => {
    const { result } = 띄우기()
    시작(result, 0)
    // 1년차(연차idx 0)는 국가대항전 연차지만, 대회는 결산을 닫은 뒤에 열린다
    const 마지막경기 = { ...result.current.state!.record, games: SEASON_GAME_COUNT }

    act(() => result.current.actions.confirmIncome(마지막경기))

    // 0xee 진입 0x6d6c 가 phase 0xb 를 세우고 392 를 튼다 — 다음은 0xeb
    expect(result.current.scene).toBe(SEASON_SCENE_STATE.이벤트재생)
    expect(result.current.eventPlayback).toMatchObject({ eventId: 392, returnScene: SEASON_SCENE_STATE.타자시상 })
    expect(result.current.state?.record.phase).toBe(SEASON_PHASE.포스트시즌시작)
    expect(result.current.state?.record.nationalCup).toBe(false)
  })
})

describe('시즌 관리 커맨드', () => {
  it('트레이닝은 고른 칸만 올리고 사기를 깎는다 (J 4-6)', () => {
    const { result } = 띄우기()
    시작(result, 0)
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
    시작(result, 0)
    const 전 = result.current.state!.teamAbilities[0]

    act(() => result.current.actions.runTraining(4))

    const 후 = result.current.state!.teamAbilities[0]
    expect(후.every((value, index) => value > 전[index])).toBe(true)
  })

  it('친선경기는 사기를 깎고 소지금을 준다 — 사기 난수의 부호를 뒤집는다 (0xc8b0)', () => {
    const { result } = 띄우기()
    시작(result, 0)
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
    시작(result, 0)
    act(() => result.current.actions.runOuting(0)) // 친선경기로 사기를 먼저 깎는다
    const 전 = result.current.state!

    act(() => result.current.actions.runOuting(1))

    const 후 = result.current.state!
    expect(후.teamMorale).toBeGreaterThan(전.teamMorale)
    expect(후.record.money).toBe(전.record.money - 4)
  })
})

describe('시즌 이벤트 재생 0xd3', () => {
  it('새 시즌 첫 관리 메뉴는 400(오프닝) → 연초 목표(0xd4 내장) → 1(환영) 차례로 튼다', () => {
    const { result } = 띄우기()
    act(() => result.current.actions.chooseTeam(0))

    expect(이벤트넘기기(result)).toEqual([400, 0, 1])
    expect(result.current.scene).toBe(SEASON_SCENE_STATE.관리메뉴)
    expect(result.current.state?.record.seenEvents).toEqual([400, 1])
    // 목표 창이 닫히면 SR+0x187 = 1 (0x7fe90) — 같은 해에는 다시 안 뜬다
    expect(result.current.state?.record.yearGoalShown).toBe(true)
  })

  it('20경기 뒤 관리 메뉴에 들어오면 100 이 G 1000 을 준다 — 한 번 받으면 다시 안 뜬다 (전역 +0xbe)', () => {
    const { result } = 띄우기()
    시작(result, 0)
    act(() => result.current.actions.updateRecord({ ...result.current.state!.record, games: 20 }))
    act(() => result.current.actions.goto(SEASON_SCENE_STATE.외출지도))
    act(() => result.current.actions.goto(SEASON_SCENE_STATE.관리메뉴))

    expect(result.current.eventPlayback?.eventId).toBe(100)
    이벤트넘기기(result)
    expect(result.current.gamePoints).toBe(1000)
    expect(result.current.state?.record.seenEvents).toContain(100)
  })

  it('외출 지도(209)에 들어와도 s_event 는 안 뜬다', () => {
    const { result } = 띄우기()
    시작(result, 0)
    act(() => result.current.actions.updateRecord({ ...result.current.state!.record, games: 20 }))

    act(() => result.current.actions.goto(SEASON_SCENE_STATE.외출지도))

    expect(result.current.scene).toBe(SEASON_SCENE_STATE.외출지도)
  })

  it('경기 옵션의 질병 칸은 SR+6 이다 (0xb5824) — 종류 SR+5 가 서 있어도 SR+6 이 0 이면 −30% 가 없다', () => {
    const { result } = 띄우기()
    시작(result, 0)
    act(() => result.current.actions.updateRecord({ ...result.current.state!.record, illness: 2, illnessSlack: 0 }))
    act(() => result.current.actions.playNextGame())
    expect(result.current.gameOptions?.season?.illness).toBe(0)
  })

  it('어느 경기든 끝나면 질병 쿨다운이 하나 준다 (4f3a2)', () => {
    const { result } = 띄우기()
    시작(result, 0)
    act(() => result.current.actions.updateRecord({ ...result.current.state!.record, illnessCooldown: 5 }))
    act(() => result.current.actions.playNextGame())
    act(() => result.current.actions.finishGame(요약()))
    expect(result.current.state?.record.illnessCooldown).toBe(4)
  })
})

describe('시즌 목표 ③④ 의 재료 (seasonGoalInputOf)', () => {
  it('팀 타율은 리그 선수 기록표의 내 팀 타자 0~8번에서 센다 (0xa3700)', () => {
    const { result } = 띄우기()
    시작(result, 0)
    act(() => result.current.actions.playNextGame())
    // 타자 0~8번이 각자 두 타수 한 안타 → 타율 500 씩
    const 타석 = Array.from({ length: 9 }, (_unused, slot) => [
      { teamId: 0, battingOrderIndex: slot, outcome: { kind: '안타', bases: 1 } as const, runsBattedIn: 0 },
      { teamId: 0, battingOrderIndex: slot, outcome: { kind: '아웃', detail: '땅볼아웃' } as const, runsBattedIn: 0 },
    ]).flat()
    act(() => result.current.actions.finishGame(요약({ leaguePlateAppearances: 타석 })))

    const { state, league, roster, playerStats, series } = result.current
    const 입력 = seasonGoalInputOf({ state: state!, league, roster, playerStats, series })
    expect(입력.teamBattingAverage).toBe(500)
    expect(입력.wins).toBe(1)
  })
})

describe('구장 히든 해금 (app+0xe0)', () => {
  it('컬렉터 해금 id 를 쌓아 둔다 — 같은 id 를 두 번 열어도 한 번만 남는다', () => {
    const { result } = 띄우기()
    시작(result, 0)

    act(() => result.current.actions.openStadiumItems([13]))
    act(() => result.current.actions.openStadiumItems([13, 16]))

    expect(result.current.openedStadiumIds).toEqual([13, 16])
  })
})

describe('시즌 끝 사슬', () => {
  it('국가대항전이 아닌 연차는 정규시즌이 끝나면 **포스트시즌 시작(0xee)** 으로 간다', () => {
    const { result } = 띄우기()
    시작(result, 0)
    // 2년차(연차idx 1)는 국가대항전 연차가 아니다
    const 홀수연차 = { ...result.current.state!.record, games: SEASON_GAME_COUNT, yearIndex: 1 }

    act(() => result.current.actions.confirmIncome(홀수연차))

    expect(result.current.eventPlayback?.eventId).toBe(392)
  })

  it('사슬은 0xee → 0xeb → 0xec → 0xed → 0xf0 → 0xef 차례다', () => {
    const { result } = 띄우기()
    시작(result, 0)
    act(() => result.current.actions.confirmIncome({
      ...result.current.state!.record, games: SEASON_GAME_COUNT, yearIndex: 1,
    }))

    // 0xee: 392 → (끝에서 목표 판정) 393~396 → 0xeb
    const 목표 = 이벤트넘기기(result)
    expect(목표[0]).toBe(392)
    expect([393, 394, 395, 396]).toContain(목표[1])
    const 차례 = [result.current.scene]
    for (let step = 0; step < 3; step += 1) {
      act(() => result.current.actions.nextSeasonEndStep())
      차례.push(result.current.scene)
    }
    // 0xf0 은 화면 없이 정규시즌 순위로 401·402·403 을 튼다 → 0xef
    expect(result.current.eventPlayback?.returnScene).toBe(SEASON_SCENE_STATE.시즌결산)
    expect(result.current.state?.record.phase).toBe(SEASON_PHASE.정규시즌순위)
    const 순위 = 이벤트넘기기(result)
    차례.push(result.current.scene)

    expect([401, 402, 403]).toContain(순위[0])
    expect(차례).toEqual([
      SEASON_SCENE_STATE.타자시상,
      SEASON_SCENE_STATE.투수시상,
      SEASON_SCENE_STATE.최우수선수,
      SEASON_SCENE_STATE.이벤트재생,
      SEASON_SCENE_STATE.시즌결산,
    ])
  })

  it('392 의 목표 결과는 달성 수로 갈리고 보상에 연차 보정이 붙는다 (0x8d0d2 · 0x8d508)', () => {
    const { result } = 띄우기()
    시작(result, 0)
    // 2년차(idx 1), 아무 목표도 못 채움: 순위는 대진 밖(10), 승률 0, 인기도 상승 0 → 396
    act(() => result.current.actions.updateRecord({ ...result.current.state!.record, popularity: 100, reputation: 100 }))
    act(() => result.current.actions.confirmIncome({
      ...result.current.state!.record, games: SEASON_GAME_COUNT, yearIndex: 1,
      popularityAtSeasonStart: 100,
    }))
    const 전 = result.current.state!.record

    expect(이벤트넘기기(result).slice(0, 2)).toEqual([392, 396])

    // 396: 인기도 −10 −10y · 평판 −5 −2y (y = 1)
    const 후 = result.current.state!.record
    expect(후.popularity).toBe(전.popularity - 20)
    expect(후.reputation).toBe(전.reputation - 7)
    expect(후.seenEvents).toEqual(expect.arrayContaining([392, 396]))
  })

  it('결산을 닫으면 홀수 연차는 새 해로 간다 — 연차가 오르고 리그 전적이 비워진다 (0x6e0c)', () => {
    const { result } = 띄우기()
    시작(result, 0)
    act(() => result.current.actions.confirmIncome({
      ...result.current.state!.record, games: SEASON_GAME_COUNT, yearIndex: 1,
    }))

    act(() => result.current.actions.finishSeason())

    expect(result.current.state?.record.yearIndex).toBe(2)
    // 새 해는 SR+0x187 을 0 으로 되돌려 첫 관리 메뉴에서 연초 목표(0xd4)가 다시 뜬다
    expect(이벤트넘기기(result)).toEqual([0])
    expect(result.current.state?.record.yearGoalShown).toBe(true)
    expect(result.current.scene).toBe(SEASON_SCENE_STATE.관리메뉴)
    expect(result.current.league.wins.every((wins) => wins === 0)).toBe(true)
  })

  it('**마지막 해(연차 idx 9)** 는 결산을 닫으면 새 해가 아니라 엔딩(0xf5)으로 간다 (0x6e0c 머리)', () => {
    const { result } = 띄우기()
    시작(result, 0)
    act(() => result.current.actions.confirmIncome({
      ...result.current.state!.record, games: SEASON_GAME_COUNT, yearIndex: 9,
    }))

    act(() => result.current.actions.finishSeason())

    // 이벤트 500 "10년은 모두 종료" 를 틀고 [다음 0xf5] (6e54~6e76)
    expect(result.current.eventPlayback).toMatchObject({ eventId: 500, returnScene: SEASON_SCENE_STATE.엔딩 })
    이벤트넘기기(result)
    expect(result.current.scene).toBe(SEASON_SCENE_STATE.엔딩)
    // phase 6 으로 저장해 두어야 다시 들어와도 엔딩으로 온다 (진입 분기 0xcb)
    expect(result.current.state?.record.phase).toBe(SEASON_PHASE.엔딩)
    expect(result.current.state?.record.yearIndex).toBe(9) // 연차를 올리지 않는다
  })

  it('엔딩을 보면 SR+0x1bc 가 서고, 다시 띄우면 관리 메뉴로 온다 (0x8bd8 → 0xcb)', () => {
    const store = 메모리저장()
    const 첫판 = 띄우기(store)
    시작(첫판.result, 0)
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

  it('국가대항전 경기는 평가를 안 탄다 — 인기도·평판·사기가 그대로다 (0x4ea0c 4f216)', () => {
    const { result } = 띄우기()
    시작(result, 0)
    act(() => result.current.actions.confirmIncome({
      ...result.current.state!.record, games: SEASON_GAME_COUNT, yearIndex: 1,
    }))
    act(() => result.current.actions.updateRecord({ ...result.current.state!.record, yearIndex: 2 }))
    act(() => result.current.actions.finishSeason())
    act(() => result.current.actions.playCupGame(10, 11))
    act(() => result.current.actions.startPendingGame())
    expect(result.current.gameKind).toBe('국가대항전')
    const 전 = result.current.state!

    // 정규시즌이면 만루홈런(S[13]) 한 칸으로 평판 등급 +3 이 될 경기다
    const 기록 = clearSeasonGameRecord()
    기록[13] = 1
    act(() => result.current.actions.finishGame(요약({ ourTeamId: 10, opponentTeamId: 11, gameRecord: 기록 })))

    const 후 = result.current.state!
    expect(result.current.scene).toBe(SEASON_SCENE_STATE.국가대항전)
    expect(후.record.reputation).toBe(전.record.reputation)
    expect(후.record.lastReputationGrade).toBe(전.record.lastReputationGrade)
    expect(후.record.popularity).toBe(전.record.popularity)
    expect(후.record.lastPopularityChange).toBe(전.record.lastPopularityChange)
    expect(후.teamMorale).toBe(전.teamMorale)
    // 16칸 자체는 SR+0x1a0 에 남는다 — 읽는 곳(0xa6f1c)이 안 돌 뿐이다
    expect(후.record.gameRecord).toEqual(기록)
  })

  it('국가대항전 내 팀은 시즌 팀이 아니라 대한민국(10)이고, 이긴 경기가 대한민국 승으로 쌓인다 (0x6548 65e2)', () => {
    const { result } = 띄우기()
    시작(result, 3)
    act(() => result.current.actions.confirmIncome({
      ...result.current.state!.record, games: SEASON_GAME_COUNT, yearIndex: 1,
    }))
    act(() => result.current.actions.updateRecord({ ...result.current.state!.record, yearIndex: 2 }))
    act(() => result.current.actions.finishSeason())

    act(() => result.current.actions.playCupGame(10, 11))
    act(() => result.current.actions.startPendingGame())
    // 경기[0x28+내side] = 10 — 시즌 팀(3) 명단이 아니라 대표팀 명단으로 친다
    expect(result.current.gameOptions?.ourTeamId).toBe(10)
    // 국가대항전은 0x6548 66ae 에서 마선수 싣기·굴리기를 건너뛴다
    expect(result.current.gameOptions?.opponentAces).toBeUndefined()
    expect(result.current.gameOptions?.opponentTeamId).toBe(11)

    act(() => result.current.actions.finishGame(요약({
      ourTeamId: result.current.gameOptions!.ourTeamId, opponentTeamId: 11,
    })))

    const cup = result.current.cup!
    // 참가국 칸 차례 = 한·일·쿠·미. 대한민국 1승, 일본 1패
    expect(cup.wins[0]).toBe(1)
    expect(cup.losses[1]).toBe(1)
    expect(cup.wins[0] + cup.wins[1] + cup.wins[2] + cup.wins[3]).toBe(2)
    expect(cup.losses[0] + cup.losses[1] + cup.losses[2] + cup.losses[3]).toBe(2)
  })

  it('국가대항전 옵션은 시즌 팀 번호를 따로 넘기고 날짜 카운터는 대회 날짜다 (0xb5804 · 0x6548 670e)', () => {
    const { result } = 띄우기()
    시작(result, 3)
    act(() => result.current.actions.confirmIncome({
      ...result.current.state!.record, games: SEASON_GAME_COUNT, yearIndex: 1,
    }))
    act(() => result.current.actions.updateRecord({ ...result.current.state!.record, yearIndex: 2 }))
    act(() => result.current.actions.finishSeason())

    act(() => result.current.actions.playCupGame(10, 11))
    act(() => result.current.actions.startPendingGame())
    // 내 팀은 대한민국(10)이지만 [시즌+1] 은 시즌 팀(3) 그대로 — 질병·보직·사기 보정이 아무 팀에도 안 붙는다
    expect(result.current.gameOptions?.ourTeamId).toBe(10)
    expect(result.current.gameOptions?.seasonTeamId).toBe(3)
    expect(result.current.gameOptions?.dayCounter).toBe(result.current.cup!.day)
    // 상대국 슬롯은 매일 마스터에서 새로 복사돼 그날 한 번만 돈다 — 첫날 0번, 그 뒤 늘 1번 (7dd3826)
    expect(result.current.gameOptions?.opponentDayCounter).toBe(0)

    act(() => result.current.actions.finishGame(요약({ ourTeamId: 10, opponentTeamId: 11 })))
    const day = result.current.cup!.day
    expect(day).toBe(1)
    const games = result.current.state!.record.games
    act(() => result.current.actions.playCupGame(10, 12))
    act(() => result.current.actions.startPendingGame())
    // 시즌 경기 수(SR+0xb2 의 시즌 값)가 아니라 대회 하루 넘기기가 올린 L+0x32 다
    expect(result.current.gameOptions?.dayCounter).toBe(day)
    expect(result.current.gameOptions?.opponentDayCounter).toBe(1)
    expect(games).not.toBe(day)
  })

  it('시즌 경기 옵션에 전역 마선수 레벨을 싣는다 — 0xb6414 는 모드를 안 가린다', () => {
    const 레벨 = { 0: 3, 6: 2 }
    const { result } = renderHook(() => useSeasonSession(메모리저장(), createSeededRandom(20100901), null, 레벨))
    시작(result, 0)
    act(() => result.current.actions.playNextGame())
    expect(result.current.gameOptions?.aceLevels).toEqual(레벨)
  })

  it('정규 경기 옵션의 시즌 팀 번호는 내 팀과 같다', () => {
    const { result } = 띄우기()
    시작(result, 4)
    act(() => result.current.actions.playNextGame())
    expect(result.current.gameOptions?.ourTeamId).toBe(4)
    expect(result.current.gameOptions?.seasonTeamId).toBe(4)
  })

  it('짝수 연차는 결산 뒤 국가대항전이 열린다', () => {
    const { result } = 띄우기()
    시작(result, 0)
    act(() => result.current.actions.confirmIncome({
      ...result.current.state!.record, games: SEASON_GAME_COUNT, yearIndex: 1,
    }))
    // 결산 직전에 연차를 짝수로 바꾼다 (원본 afterKoreanSeries 가 보는 칸)
    act(() => result.current.actions.updateRecord({ ...result.current.state!.record, yearIndex: 2 }))

    act(() => result.current.actions.finishSeason())

    // 0xf2 진입 0xe5f8 — 461 "2년에 한번 치러지는 국가대항전" 을 틀고 [다음 0xf3]
    expect(result.current.eventPlayback).toMatchObject({ eventId: 461, returnScene: SEASON_SCENE_STATE.국가대항전 })
    이벤트넘기기(result)
    expect(result.current.scene).toBe(SEASON_SCENE_STATE.국가대항전)
    expect(result.current.cup).not.toBeNull()
  })

  it('대회가 끝나면 곧장 새 해 0x6e0c — 리그 초기화 memset 이 국가대항전 플래그를 지운다 (0x8b88 → 0xa305c → 0xb7b34)', () => {
    const { result } = 띄우기()
    시작(result, 0)
    act(() => result.current.actions.confirmIncome({
      ...result.current.state!.record, games: SEASON_GAME_COUNT, yearIndex: 1,
    }))
    act(() => result.current.actions.updateRecord({ ...result.current.state!.record, yearIndex: 2 }))
    act(() => result.current.actions.finishSeason())
    expect(result.current.state?.record.nationalCup).toBe(true)

    act(() => result.current.actions.finishCup({
      champion: 11,
      isKoreaChampion: false,
      koreaInFinal: false,
      reward: { popularity: 0, reputation: 0, money: 0, gamePoint: 0, messageId: 0 },
      openedTeams: [],
    }))

    const record = result.current.state!.record
    expect(record.nationalCup).toBe(false)
    expect(record.yearIndex).toBe(3)
    expect(record.inPostseason).toBe(false)
    expect(record.games).toBe(0)
    expect(result.current.cup).toBeNull()
    // 새 해 첫 관리 메뉴 — 연초 목표가 먼저 뜬다
    expect(이벤트넘기기(result)).toEqual([0])
    expect(result.current.scene).toBe(SEASON_SCENE_STATE.관리메뉴)
  })
})

describe('포스트시즌', () => {
  const 시즌끝 = () => {
    const rendered = 띄우기()
    시작(rendered.result, 0)
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
      // 0xef 키도 this+0x11c = 1 → 0xd7 경기 전 마선수 고르기로 간다
      expect(result.current.scene).toBe(SEASON_SCENE_STATE.선수단)
      expect(result.current.pendingGame?.kind).toBe('포스트시즌')
    } else {
      // 내 차례가 오거나 우승이 정해질 때까지 돌린다
      const series = result.current.series!
      expect(series.round === '종료' || series.teams.includes(내팀)).toBe(true)
    }
  })

  it('포스트시즌 사람 경기의 날짜 카운터는 시리즈 g 다 — 정규 44칸 + 앞 시리즈 이월이 팀마다 얹힌다 (0x6548 670e)', () => {
    const { result } = 시즌끝()
    const 내팀 = result.current.state!.record.teamId
    for (let i = 0; i < 4 && result.current.pendingGame === null; i += 1) {
      act(() => result.current.actions.continuePostseason())
    }
    expect(result.current.pendingGame?.kind).toBe('포스트시즌')
    if (result.current.pendingGame === null) return
    const series = result.current.series!
    const 상대 = series.teams[0] === 내팀 ? series.teams[1] : series.teams[0]
    const options = result.current.pendingGame.options
    // 시즌 경기 수(45)가 아니다 — 0xb80a8 이 L+0x32 를 0 으로 놓는다
    expect(options.dayCounter).toBe(postseasonRotationTurnsOf(series, 내팀))
    expect(options.opponentDayCounter).toBe(postseasonRotationTurnsOf(series, 상대))
    expect(postseasonGameOf(series)).toBe(series.wins[0] + series.wins[1])
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

describe('경기 전 흐름 0xd8 → 0xd7 → 0xdd → 0xe1', () => {
  const 다음경기확인 = () => {
    const rendered = 띄우기()
    시작(rendered.result, 0)
    act(() => rendered.result.current.actions.openNextGame())
    act(() => rendered.result.current.actions.confirmNextGame())
    return rendered
  }

  it('마투수 → 마타자를 고르면 0xdd 경기정보로, 처음이면 경기진행 설정 창이 저절로 열린다 (0x6548 6564)', () => {
    const { result } = 다음경기확인()
    expect(result.current.preGameAces.phase).toBe(PRE_GAME_ACE_PHASE.마투수)

    act(() => result.current.actions.choosePreGameAce(2))
    expect(result.current.scene).toBe(SEASON_SCENE_STATE.선수단)
    expect(result.current.preGameAces).toEqual({ phase: PRE_GAME_ACE_PHASE.마타자, pitcher: 2, batter: -1 })

    act(() => result.current.actions.choosePreGameAce(6))
    expect(result.current.scene).toBe(SEASON_SCENE_STATE.경기정보)
    expect(result.current.isMatchSettingsOpen).toBe(true)
    expect(result.current.pendingGame?.kind).toBe('정규')
  })

  it('0xdd 확인이면 고른 마선수를 내 팀에 싣고 경기로 간다 — 설정은 시즌 칸 값이다', () => {
    const { result } = 다음경기확인()
    act(() => result.current.actions.choosePreGameAce(1))
    act(() => result.current.actions.choosePreGameAce(8))
    const 설정 = { ...FULL_PLAY_SETTINGS, kind: 1, value: 2 }
    act(() => result.current.actions.applyMatchSettings(설정))
    expect(result.current.isMatchSettingsOpen).toBe(false)

    act(() => result.current.actions.startPendingGame())

    expect(result.current.scene).toBe(SEASON_SCENE_STATE.경기직전)
    expect(result.current.gameKind).toBe('정규')
    expect(result.current.gameOptions?.acePitcherId).toBe(1)
    expect(result.current.gameOptions?.aceBatterId).toBe(3)
    expect(result.current.gameOptions?.settings).toEqual(설정)
  })

  it('0xdd 에 들어올 때 상대 마선수 둘을 굴린다 — 마투수 0x66968 → 마타자 0x66994 (0x6548 66ee·6700, rand 2)', () => {
    const { result } = 다음경기확인()
    act(() => result.current.actions.choosePreGameAce(1))
    act(() => result.current.actions.choosePreGameAce(8))
    // chooseTeam~0xd7 은 굴리지 않으므로 같은 씨앗의 첫 두 굴림이다
    const 기대 = rollOpponentAces(1, 3, createSeededRandom(20100901))
    expect(result.current.pendingGame?.options.opponentAces).toEqual(기대)
    expect(기대.pitcher).not.toBe(1)
    expect(기대.batter).not.toBe(3)

    // CPU 팀 엔트리(보기 전용)도 그 마선수를 8·9번에 보인다
    act(() => result.current.actions.toggleMatchSettings())
    act(() => result.current.actions.openEntryEdit(false))
    expect(result.current.entryEdit?.lists.pitchers[8]?.isAce).toBe(true)
    expect(result.current.entryEdit?.lists.batters[9]?.isAce).toBe(true)
    act(() => result.current.actions.pressEntryKey('왼'))

    // 0xe0 에서 돌아와도 다시 굴리지 않고(6556 → 6850) 경기는 그 값으로 선다
    act(() => result.current.actions.startPendingGame())
    expect(result.current.gameOptions?.opponentAces).toEqual(기대)
  })

  it('0xdd CLR → 0xd7 → 0xdd 로 다시 들어오면 다시 굴린다 — 들어올 때마다 +2', () => {
    // 난수 줄기 하나를 렌더 사이에 이어 쓴다 (띄우기는 렌더마다 새 씨앗을 만든다)
    const 줄기 = createSeededRandom(20100901)
    const store = 메모리저장()
    const { result } = renderHook(() => useSeasonSession(store, 줄기))
    시작(result, 0)
    act(() => result.current.actions.openNextGame())
    act(() => result.current.actions.confirmNextGame())
    act(() => result.current.actions.choosePreGameAce(0))
    act(() => result.current.actions.choosePreGameAce(5))
    act(() => result.current.actions.toggleMatchSettings())
    act(() => result.current.actions.cancelMatchInfo())
    act(() => result.current.actions.choosePreGameAce(0))
    act(() => result.current.actions.choosePreGameAce(5))
    const random = createSeededRandom(20100901)
    // 첫 관리 메뉴 폴링(400 → 연초 목표 → 1)에서 490 의 조건 22 가 굴린 한 번 (사기 100 이라 p = 0 이어도 돈다)
    random.next()
    rollOpponentAces(0, 0, random)
    expect(result.current.pendingGame?.options.opponentAces).toEqual(rollOpponentAces(0, 0, random))
  })

  it('설정 창은 한 번 열리고 나면 다음 경기정보에서는 저절로 안 열린다 (저장 +0x11e)', () => {
    const { result } = 다음경기확인()
    act(() => result.current.actions.choosePreGameAce(0))
    act(() => result.current.actions.choosePreGameAce(5))
    expect(result.current.isMatchSettingsOpen).toBe(true)
    act(() => result.current.actions.toggleMatchSettings())

    // 0xdd CLR → 0xd7 다시 들어옴(마투수부터) → 다시 0xdd
    act(() => result.current.actions.cancelMatchInfo())
    expect(result.current.scene).toBe(SEASON_SCENE_STATE.선수단)
    expect(result.current.preGameAces.phase).toBe(PRE_GAME_ACE_PHASE.마투수)
    act(() => result.current.actions.choosePreGameAce(0))
    act(() => result.current.actions.choosePreGameAce(5))
    expect(result.current.isMatchSettingsOpen).toBe(false)
  })

  it('0xd7 CLR — 마타자 단계는 마투수로, 마투수 단계는 0xd8 로 돌아가고 그때는 0xd8 취소가 안 먹는다', () => {
    const { result } = 다음경기확인()
    act(() => result.current.actions.choosePreGameAce(0))
    act(() => result.current.actions.cancelPreGameAce())
    expect(result.current.preGameAces.phase).toBe(PRE_GAME_ACE_PHASE.마투수)

    act(() => result.current.actions.cancelPreGameAce())
    expect(result.current.scene).toBe(SEASON_SCENE_STATE.다음경기)
    expect(result.current.pendingGame).toBeNull()
    // 이전 상태가 0xd7 이라 0x48ea 가 0xc9 로 안 보낸다
    act(() => result.current.actions.cancelNextGame())
    expect(result.current.scene).toBe(SEASON_SCENE_STATE.다음경기)
  })

  it('구단관리 코치채용으로 가면 선수단 용도가 코치채용(2)이다', () => {
    const { result } = 다음경기확인()
    act(() => result.current.actions.goto(SEASON_SCENE_STATE.선수단))
    expect(result.current.squadPurpose).toBe(SQUAD_PURPOSE.코치채용)
  })
})

describe('엔트리 편집 0xe0 (0x63dc · 0x7044 · 편집기 0x55864)', () => {
  const 경기정보까지 = (store: JsonStorePort = 메모리저장()) => {
    const rendered = 띄우기(store)
    시작(rendered.result, 0)
    act(() => rendered.result.current.actions.openNextGame())
    act(() => rendered.result.current.actions.confirmNextGame())
    act(() => rendered.result.current.actions.choosePreGameAce(0))
    act(() => rendered.result.current.actions.choosePreGameAce(5))
    act(() => rendered.result.current.actions.toggleMatchSettings())
    return rendered
  }

  it("'4' 는 유저 팀 엔트리를 투수 탭으로 연다 — 고른 마투수가 8번, 마타자가 9번에 앉아 있다", () => {
    const { result } = 경기정보까지()
    act(() => result.current.actions.openEntryEdit(true))
    expect(result.current.scene).toBe(SEASON_SCENE_STATE.엔트리편집)
    const edit = result.current.entryEdit
    expect(edit?.editor.tab).toBe(ENTRY_TAB.투수)
    expect(edit?.editor.subTab).toBe(ENTRY_SUB_TAB.타순)
    expect(edit?.lists.pitchers[8]?.isAce).toBe(true)
    expect(edit?.lists.batters[9]?.isAce).toBe(true)
  })

  it('선발을 바꾸면 시즌 명단에 남고, 오른쪽 끝(3)으로 경기정보에 돌아오면 "선발" 줄이 바뀐다 — 설정 창은 다시 안 열린다', () => {
    const store = 메모리저장()
    const { result } = 경기정보까지(store)
    act(() => result.current.actions.openEntryEdit(true))
    for (const key of ['확인', '아래', '아래', '확인'] as const) act(() => result.current.actions.pressEntryKey(key))
    expect(result.current.roster.pitchers.map((p) => p.id).slice(0, 3)).toEqual([2, 1, 0])
    expect(result.current.matchInfoStarterName).toBe(teamPitchers(0)[2]?.name)

    act(() => result.current.actions.pressEntryKey('오른'))
    expect(result.current.scene).toBe(SEASON_SCENE_STATE.경기정보)
    expect(result.current.entryEdit).toBeNull()
    expect(result.current.isMatchSettingsOpen).toBe(false)
    // 저장에도 남는다 — 다음 경기까지 이어진다
    expect((store.load() as { roster: { pitchers: { id: number }[] } }).roster.pitchers[0]?.id).toBe(2)
  })

  it('경기는 고친 명단 차례로 선다 — 옵션 ourEntryOrder = 시즌 저장 레코드 차례 (0xb891c → 0xb8680)', () => {
    const { result } = 경기정보까지()
    act(() => result.current.actions.openEntryEdit(true))
    for (const key of ['확인', '아래', '아래', '확인', '오른'] as const) act(() => result.current.actions.pressEntryKey(key))
    act(() => result.current.actions.startPendingGame())

    const order = result.current.gameOptions?.ourEntryOrder
    expect(order?.pitchers.slice(0, 3)).toEqual([2, 1, 0])
    expect(order?.batters.length).toBe(result.current.roster.batters.length)
    expect(order?.batters[0]).toEqual({
      rosterSlot: result.current.roster.batters[0]!.id,
      position: result.current.roster.batters[0]!.fieldPosition & 0xf,
    })
  })

  it('국가대항전 대한민국 명단(+0x918)은 대회 내내 남는다 — 다음 대회 경기도 고친 차례로 선다', () => {
    const { result } = 띄우기()
    시작(result, 3)
    act(() => result.current.actions.confirmIncome({
      ...result.current.state!.record, games: SEASON_GAME_COUNT, yearIndex: 1,
    }))
    act(() => result.current.actions.updateRecord({ ...result.current.state!.record, yearIndex: 2 }))
    act(() => result.current.actions.finishSeason())
    act(() => result.current.actions.playCupGame(10, 11))
    act(() => result.current.actions.toggleMatchSettings())
    act(() => result.current.actions.openEntryEdit(true))
    for (const key of ['확인', '아래', '아래', '확인', '오른'] as const) act(() => result.current.actions.pressEntryKey(key))
    // 시즌 팀 명단은 그대로다
    expect(result.current.roster.pitchers.map((p) => p.id).slice(0, 3)).toEqual([0, 1, 2])
    act(() => result.current.actions.startPendingGame())
    expect(result.current.gameOptions?.ourEntryOrder?.pitchers.slice(0, 3)).toEqual([2, 1, 0])
    act(() => result.current.actions.finishGame(요약({ ourTeamId: 10, opponentTeamId: 11 })))

    act(() => result.current.actions.playCupGame(10, 12))
    expect(result.current.matchInfoStarterName).not.toBeNull()
    act(() => result.current.actions.startPendingGame())
    // 둘째 날도 같은 슬롯 — 로테이션은 날짜로 셈하고 명단 차례는 이어진다
    expect(result.current.gameOptions?.ourEntryOrder?.pitchers.slice(0, 3)).toEqual([2, 1, 0])
  })

  it("'6' 은 CPU 팀 엔트리 — 보기 전용이라 OK 가 안 먹고, 왼쪽 끝(2)으로 돌아온다", () => {
    const { result } = 경기정보까지()
    const before = result.current.roster
    act(() => result.current.actions.openEntryEdit(false))
    expect(result.current.entryEdit?.editor.subTab).toBe(ENTRY_SUB_TAB.보기전용)
    for (const key of ['확인', '아래', '확인'] as const) act(() => result.current.actions.pressEntryKey(key))
    expect(result.current.roster).toBe(before)
    act(() => result.current.actions.pressEntryKey('오른'))
    expect(result.current.scene).toBe(SEASON_SCENE_STATE.엔트리편집)
    act(() => result.current.actions.pressEntryKey('왼'))
    expect(result.current.scene).toBe(SEASON_SCENE_STATE.경기정보)
  })

  it('마선수 줄을 고르면 팝업이 뜨고 닫기 전에는 키를 안 받는다', () => {
    const { result } = 경기정보까지()
    act(() => result.current.actions.openEntryEdit(true))
    act(() => result.current.actions.pointEntryCursor(8))
    act(() => result.current.actions.pressEntryKey('확인'))
    expect(result.current.entryEdit?.isAceLocked).toBe(true)
    act(() => result.current.actions.pressEntryKey('취소'))
    expect(result.current.scene).toBe(SEASON_SCENE_STATE.엔트리편집)
    act(() => result.current.actions.closeEntryAceLocked())
    act(() => result.current.actions.pressEntryKey('취소'))
    expect(result.current.scene).toBe(SEASON_SCENE_STATE.경기정보)
  })
})

describe('투수 스태미나 +0x2c — 첫날 6850 0xb6190 · 하루 끝 4f2bc 0xb617c (+20%)', () => {
  type 저장모양 = { cpuPitcherStaminas?: Record<number, number[]>; roster: { pitchers: { stamina: number }[] } }
  const 경기까지 = (rendered: ReturnType<typeof 띄우기>) => {
    act(() => rendered.result.current.actions.openNextGame())
    act(() => rendered.result.current.actions.confirmNextGame())
    act(() => rendered.result.current.actions.choosePreGameAce(0))
    act(() => rendered.result.current.actions.choosePreGameAce(5))
    if (rendered.result.current.isMatchSettingsOpen) act(() => rendered.result.current.actions.toggleMatchSettings())
    act(() => rendered.result.current.actions.startPendingGame())
    return rendered.result.current.gameOptions!
  }

  it('새 시즌은 열 팀 모두 10000 이고 경기 옵션에 내 명단 차례·상대 표 칸 차례로 싣는다', () => {
    const store = 메모리저장()
    const rendered = 띄우기(store)
    시작(rendered.result, 0)
    const options = 경기까지(rendered)

    expect(options.ourPitcherStaminas).toEqual(rendered.result.current.roster.pitchers.map(() => 10_000))
    expect(options.opponentPitcherStaminas).toEqual(teamPitchers(options.opponentTeamId).map(() => 10_000))
    expect(Object.keys((store.load() as 저장모양).cpuPitcherStaminas ?? {})).toHaveLength(9)
  })

  it('정규 경기 끝 값이 저장에 남고 하루 끝에 열 팀 +20% — 다음 경기는 그 값으로 선다', () => {
    const store = 메모리저장()
    const rendered = 띄우기(store)
    const { result } = rendered
    시작(result, 0)
    const options = 경기까지(rendered)
    const 투수수 = result.current.roster.pitchers.length
    const 내끝 = Array.from({ length: 투수수 }, (_v, i) => (i === 0 ? 3000 : i === 1 ? 9000 : 10_000))
    const 상대끝 = teamPitchers(options.opponentTeamId).map((_p, i) => (i === 0 ? 1000 : 10_000))

    act(() => result.current.actions.finishGame(요약({
      opponentTeamId: options.opponentTeamId, ourPitcherStaminas: 내끝, opponentPitcherStaminas: 상대끝,
    })))

    expect(result.current.roster.pitchers.map((p) => p.stamina).slice(0, 3)).toEqual([5000, 10_000, 10_000])
    const 저장 = store.load() as 저장모양
    expect(저장.cpuPitcherStaminas?.[options.opponentTeamId]?.[0]).toBe(3000)
    // 같은 날 CPU 끼리 경기도 그 표로 치러 깎이고 회복된다 — 값은 0..10000 안에 있다
    for (const staminas of Object.values(저장.cpuPitcherStaminas ?? {})) {
      for (const value of staminas) expect(value).toBeGreaterThanOrEqual(0)
    }

    // 둘째 날(SR+0xb2 = 1)은 첫날 고리를 안 탄다 — 이어진 값으로 선다
    act(() => result.current.actions.confirmIncome(result.current.state!.record))
    const 다음 = 경기까지(rendered)
    expect(다음.ourPitcherStaminas?.[0]).toBe(5000)
    expect(다음.opponentPitcherStaminas).toEqual((store.load() as 저장모양).cpuPitcherStaminas?.[다음.opponentTeamId])
  })

  it('시즌 첫날(경기 수 0)에 0xdd 에 들어오면 깎인 값도 10000 으로 채운다 (6850) — 그 뒤 날은 안 채운다', () => {
    const rendered = 띄우기()
    const { result } = rendered
    시작(result, 0)
    const 깎인명단 = (stamina: number) => ({
      ...result.current.roster,
      pitchers: result.current.roster.pitchers.map((p) => ({ ...p, stamina })),
    })
    act(() => result.current.actions.updateRoster(깎인명단(100)))
    expect(경기까지(rendered).ourPitcherStaminas?.[0]).toBe(10_000)

    act(() => result.current.actions.updateRecord({ ...result.current.state!.record, games: 2 }))
    act(() => result.current.actions.updateRoster(깎인명단(100)))
    expect(경기까지(rendered).ourPitcherStaminas?.[0]).toBe(100)
  })

  it('포스트시즌 하루 끝도 열 팀 +20% 뿐 — 내 팀을 10000 으로 채우지 않는다 (0xb818c L+0x34 갈래는 b8228 로 끝)', () => {
    const store = 메모리저장()
    const rendered = 띄우기(store)
    const { result } = rendered
    시작(result, 0)
    act(() => result.current.actions.confirmIncome({
      ...result.current.state!.record, games: SEASON_GAME_COUNT, yearIndex: 1,
    }))
    // 내 차례가 올 때까지 결산 0xef 를 진행시킨다 (CPU 시리즈는 0x13da0 이 돌린다)
    for (let i = 0; i < 4 && result.current.pendingGame === null; i += 1) {
      act(() => result.current.actions.continuePostseason())
    }
    expect(result.current.pendingGame?.kind).toBe('포스트시즌')
    act(() => result.current.actions.choosePreGameAce(0))
    act(() => result.current.actions.choosePreGameAce(5))
    if (result.current.isMatchSettingsOpen) act(() => result.current.actions.toggleMatchSettings())
    act(() => result.current.actions.startPendingGame())
    const options = result.current.gameOptions!
    const 내끝 = result.current.roster.pitchers.map(() => 2000)

    act(() => result.current.actions.finishGame(요약({
      opponentTeamId: options.opponentTeamId, ourPitcherStaminas: 내끝,
    })))

    expect(result.current.roster.pitchers.every((p) => p.stamina === 4000)).toBe(true)
  })

  it('CPU 끼리 포스트시즌 경기(0xc2760)도 표로 서서 깎인 값을 남긴다 — 회복은 없다', () => {
    const store = 메모리저장()
    const rendered = 띄우기(store)
    const { result } = rendered
    시작(result, 0)
    act(() => result.current.actions.confirmIncome({
      ...result.current.state!.record, games: SEASON_GAME_COUNT, yearIndex: 1,
    }))
    const 전 = (store.load() as 저장모양).cpuPitcherStaminas ?? {}
    for (let i = 0; i < 4 && result.current.pendingGame === null; i += 1) {
      act(() => result.current.actions.continuePostseason())
    }
    const 뒤 = (store.load() as 저장모양).cpuPitcherStaminas ?? {}
    const 깎인팀 = Object.keys(뒤).filter((team) =>
      (뒤[Number(team)] ?? []).some((value, slot) => value < (전[Number(team)]?.[slot] ?? 10_000)))
    expect(깎인팀.length).toBeGreaterThan(0)
    for (const staminas of Object.values(뒤)) {
      for (const value of staminas) expect(value).toBeGreaterThanOrEqual(0)
    }
  })

  it('국가대항전은 넘기지도 받지도 않는다 — 대한민국·상대국 모두 10000, 시즌 명단 값은 그대로', () => {
    const rendered = 띄우기()
    const { result } = rendered
    시작(result, 3)
    act(() => result.current.actions.confirmIncome({
      ...result.current.state!.record, games: SEASON_GAME_COUNT, yearIndex: 1,
    }))
    act(() => result.current.actions.updateRecord({ ...result.current.state!.record, yearIndex: 2 }))
    act(() => result.current.actions.finishSeason())
    const 전 = result.current.roster
    act(() => result.current.actions.playCupGame(10, 11))
    act(() => result.current.actions.startPendingGame())
    expect(result.current.gameOptions?.ourPitcherStaminas).toBeUndefined()
    expect(result.current.gameOptions?.opponentPitcherStaminas).toBeUndefined()

    act(() => result.current.actions.finishGame(요약({
      ourTeamId: 10, opponentTeamId: 11, ourPitcherStaminas: [0, 0, 0],
    })))
    expect(result.current.roster).toEqual(전)
  })

  it('스태미나 표가 없는 옛 저장은 10000 으로 채운다 — 명단 투수의 0(표에서 만든 값)도', () => {
    const store = 메모리저장()
    const 첫판 = 띄우기(store)
    시작(첫판.result, 2)
    const 옛저장 = { ...(store.load() as 저장모양) }
    delete 옛저장.cpuPitcherStaminas
    store.save({ ...옛저장, roster: { ...옛저장.roster, pitchers: 옛저장.roster.pitchers.map((p) => ({ ...p, stamina: 0 })) } })

    const 둘째판 = 띄우기(store)
    expect(둘째판.result.current.roster.pitchers.every((p) => p.stamina === 10_000)).toBe(true)
    act(() => 둘째판.result.current.actions.updateRecord({ ...둘째판.result.current.state!.record, games: 1 }))
    const options = 경기까지(둘째판)
    expect(options.opponentPitcherStaminas).toEqual(teamPitchers(options.opponentTeamId).map(() => 10_000))
  })

  it('트레이드로 데려온 투수는 그 팀 표의 스태미나를 들고 온다', () => {
    const store = 메모리저장()
    const rendered = 띄우기(store)
    const { result } = rendered
    시작(result, 0)
    const options = 경기까지(rendered)
    act(() => result.current.actions.finishGame(요약({
      opponentTeamId: options.opponentTeamId,
      opponentPitcherStaminas: teamPitchers(options.opponentTeamId).map((_p, i) => (i === 2 ? 1000 : 10_000)),
    })))
    const 표 = (store.load() as 저장모양).cpuPitcherStaminas![options.opponentTeamId]!
    const roster = result.current.roster
    const 데려옴 = { id: 2, kindByte: roster.pitchers[1]!.kindByte, fieldPosition: 0, stamina: 0 }

    act(() => result.current.actions.finishTrade({
      record: result.current.state!.record,
      roster: { ...roster, pitchers: roster.pitchers.map((p, i) => (i === 1 ? 데려옴 : p)) },
      gamePointCost: 0,
      isSuccess: true,
      acquiredTeamId: options.opponentTeamId,
    }))

    expect(result.current.roster.pitchers[1]?.stamina).toBe(표[2])
    expect(result.current.roster.pitchers[0]).toBe(roster.pitchers[0])
  })
})

describe('기록연감 통계 고리 — 시즌 G 사용처 k 3 (0xd152 · 0xa2fee · 0x3c862)', () => {
  it('시즌이 G 를 쓸 때마다 시즌 소모 GP 에 |액수| 를 적는다', () => {
    const events: AnnalsStatEvent[] = []
    const { result } = renderHook(() =>
      useSeasonSession(메모리저장(), createSeededRandom(20100901), null, undefined, (event) => {
        events.push(event)
      }))
    act(() => result.current.actions.spendGamePoint(500))
    expect(events).toEqual([{ kind: 'G사용', usage: 3, amount: 500 }])
  })
})

describe('팀 경기 기록 달성 G (경기 끝 0x4ea0c 4ec5a → 0x4ec82)', () => {
  it('요약의 gamePoints 를 시즌 G 에 더하고 획득 GP(모드 2)에 적는다', () => {
    const events: AnnalsStatEvent[] = []
    const { result } = renderHook(() =>
      useSeasonSession(메모리저장(), createSeededRandom(20100901), null, undefined, (event) => {
        events.push(event)
      }))
    시작(result, 0)
    act(() => result.current.actions.playNextGame())
    const before = result.current.gamePoints

    act(() => result.current.actions.finishGame(요약({ recordIds: [1], gamePoints: 25 })))

    expect(result.current.gamePoints).toBe(before + 25)
    expect(events).toEqual([{ kind: 'G획득', mode: 2, amount: 25 }])
  })
})

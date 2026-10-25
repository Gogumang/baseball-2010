// @vitest-environment jsdom
/**
 * **시즌모드 장기 진행 점검 (soak)** — 화면 없이 `useSeasonSession` 을 팀 고르기부터 10년차 엔딩까지 돌린다.
 *
 * 사람 입력은 단순한 정책으로 대신한다 (`SeasonRoute` 가 화면 대신 부르는 액션을 그대로 부른다):
 * - 관리 메뉴: 아직 안 했으면 트레이닝(칸 0~3 차례), 했으면 [다음경기]. 트레이드 요청은 거절.
 * - 경기 전 마선수: 마투수 칸 0 · 마타자 칸 5. 경기정보: 경기진행 설정을 "전부 자동"(상세 · 값 0)으로 두고 시작.
 * - 경기(0xe1): `TeamGameScreen` 대신 로딩 팁 굴림 → `startTeamGame`(전부 자동이라 한 번에 끝난다) → 정산 진입 → 끝.
 * - 이벤트는 보상 명령을 모아 끝에 한 번에 준다 (`useSeasonSession.test` 의 `이벤트넘기기` 와 같다).
 * - 결산·국가대항전·엔딩은 그 화면(`SeasonSummaryScreen` · `NationalCupScreen` · `SeasonEndingScreen`)의 판정 함수를 그대로 부른다.
 *
 * 걸음마다 불가능한 값(NaN · 음수 · 상한 넘김), 리그 전적 합, 순위 차례, 경기 기록 → 리그 기록표 반영, 날짜(경기 수) 진행,
 * 저장 → 불러오기 왕복(JSON · 새 세션 마운트)을 본다. 문제는 모아 두었다가 판 끝에 한꺼번에 보인다.
 *
 * **새 길(r235, `extras`)** — 정책이 안 밟던 길을 그 화면의 판정 · 가드 함수 그대로 밟는다: 구단관리 트레이드(0xe4~0xe7 — 등급 ·
 * 벌점 · 성공률 · [65]/[77] 가드 · 나리/명예 거절)와 CPU 요청 수락(0xe5 요청 칸 · 강제 성공), 아이템 상점(서브아이템 · GP 아이템 ·
 * 십전대보탕 0xe8 · 장착아이템 0xdf → 0xdc), 경기정보 0xdd → 엔트리 편집 0xe0, G 지갑(`useGamePointWallet`), 관리 메뉴에서 훅을
 * 내렸다 다시 띄우기와 경기 중간 저장(`saveGameProgress`) → 다시 띄워 `resumeSavedGame` → 30G 자동진행으로 끝내기.
 * 소지금 · G 수지, 장비 니블, 트레이드 뒤 열 팀 명단 크기 · 중복 · 맞바뀐 칸 · 니블 지움, 엔트리 편집 뒤 명단 · 선발 · 경기 옵션을
 * 더 본다. 긴 판: `SOAK=1 SOAK_SEEDS=1,2,3 yarn vitest run src/app/model/soak/seasonSoak.test.tsx -t "r235" --maxWorkers=2`
 * (`SOAK_MAX_GAMES=n` 이면 정규 n 경기에서 멈춘다)
 *
 * 길어서 기본은 짧은 판(첫 해 앞 몇 경기)만 돈다 — 긴 판은 `SOAK=1` 로 켠다:
 * `SOAK=1 SOAK_SEEDS=1,2,3 yarn vitest run src/app/model/soak/seasonSoak.test.tsx --maxWorkers=2`
 */
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSeasonSession } from '@/app/model/useSeasonSession'
import type { SeasonSession } from '@/app/model/useSeasonSession'
import { SEASON_PHASE, SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { SEASON_PLAYABLE_EVENTS, clearRepeatableSeen } from '@/entities/season-mode/model/seasonEventFlow'
import { PRE_GAME_ACE_PHASE } from '@/entities/season-mode/model/preGameFlow'
import {
  FINAL_YEAR_INDEX, MONEY_LIMIT, MORALE_LIMIT, POPULARITY_LIMIT, REPUTATION_LIMIT, SEASON_GAME_COUNT, TEAM_ABILITY_LIMIT,
} from '@/entities/season-mode/model/seasonRecord'
import { koreanSeriesRewardOf, nextLeagueFirstAward } from '@/entities/season-mode/model/seasonRewards'
import { seasonPostseasonRankOf } from '@/app/model/useSeasonSession'
import { confirmNationalCupStandings, finishNationalCup } from '@/entities/national-cup/model/nationalCupFlow'
import { nationalCupMatchupOf } from '@/entities/national-cup/model/nationalCup'
import { FULL_PLAY_SETTINGS, MATCH_SETTING_KIND } from '@/features/play-team-game/model/matchSettings'
import { startTeamGame, summaryOf } from '@/features/play-team-game/model/teamGameFlow'
import type { TeamGameSummary } from '@/features/play-team-game/model/teamGameFlow'
import { rollSceneLoadingTip } from '@/entities/game/model/sceneLoadingTip'
import { leagueSideOf, opponentOf, rankingOf } from '@/entities/league/model/league'
import {
  EMPTY_LEAGUE_PLAYER_STATS, leagueBatterIdOf, recordLeaguePlateAppearances,
} from '@/entities/league/model/leaguePlayerStats'
import type { LeaguePlayerStats } from '@/entities/league/model/leaguePlayerStats'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { settleGameIncome } from '@/entities/season-mode/model/seasonAttendance'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'
import { createSilentSound, setActiveSound } from '@/shared/api/audio/soundPort'
import { useGamePointWallet } from '@/entities/wallet/model/useGamePointWallet'
import type { GamePointWalletSession } from '@/entities/wallet/model/useGamePointWallet'
import {
  TRADE_TAB, canUseTradeCommand, markTradeUsed, rollTradeSuccess, tradeBoostCostOf, tradeMoneyChangeOf, tradeSuccessRate,
  withTradeMoney,
} from '@/entities/season-mode/model/playerTrade'
import type { TradeSettlement } from '@/entities/season-mode/model/playerTrade'
import { myTradeEntriesOf, opponentTradeEntriesOf } from '@/widgets/season/lib/tradeList'
import type { TradePlayerEntry } from '@/widgets/season/lib/tradeList'
import { isHallOfFameRecord, tableTeamOf } from '@/entities/season-mode/model/playerRecruit'
import type { SeasonPlayer, SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import {
  FULL_PITCHER_STAMINA, SEASON_GP_ITEM_COUNT, SEASON_SHOP_SLOT_COUNT, SEASON_STAMINA_ITEM, checkSeasonGpItem, checkSeasonSubItem,
  ownsSeasonShopSubItem, seasonGpItemPriceOf, seasonSubItemPriceOf,
} from '@/entities/season-mode/model/seasonItemShop'
import {
  SEASON_EQUIPMENT_LEVEL_COUNT, SEASON_EQUIPMENT_PART_COUNT, SEASON_FIRST_HIDDEN_LEVEL, applySeasonEquipment, checkSeasonEquipment,
} from '@/entities/season-mode/model/seasonEquipment'
import { seasonPlayerEquipmentOf } from '@/entities/season-mode/model/seasonPlayerRecord'
import type { EntryKey } from '@/entities/season-mode/model/entryEditor'
import { autoProgressCostOf, canAutoProgress, resumeTeamGame, runAutoProgress } from '@/features/play-team-game/model/teamGameFlow'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import {
  SoakProblems, batterLineProblemsOf, firstDiffOf, isSoakEnabled, jsonRoundTripDiffOf, leagueTallyProblemsOf,
  outOfRangeOf, rankingOrderProblemsOf, soakNumber, soakSeeds, unserializablePathsOf,
} from '@/app/model/soak/soakInvariants'

setActiveSound(createSilentSound())

/** 사람이 한 타석도 안 잡는 설정 — 상세 · 값 0 (`teamAutoRelay.test` 와 같다) */
const ALL_AUTO_SETTINGS = { ...FULL_PLAY_SETTINGS, kind: MATCH_SETTING_KIND.상세, value: 0 } as const

function memoryStore(): JsonStorePort & { readonly held: () => unknown } {
  let held: unknown = null
  return {
    load: () => held,
    save: (value: object) => {
      held = value
    },
    held: () => held,
  }
}

interface SeasonSoakResult {
  readonly problems: SoakProblems
  readonly steps: number
  readonly games: { 정규: number; 포스트시즌: number; 국가대항전: number }
  readonly years: number
  readonly reachedEnding: boolean
  readonly yearLog: readonly string[]
  readonly stoppedAt: string | null
  /** 새 길을 실제로 밟은 횟수 (r235) */
  readonly extraLog: Readonly<Record<string, number>>
}

interface SeasonSoakOptions {
  readonly seed: number
  readonly teamId: number
  /** 이만큼 정규시즌 경기를 치르면 멈춘다 (짧은 판) — 없으면 엔딩까지 */
  readonly maxRegularGames?: number
  /** 저장 왕복을 몇 번째 관리 메뉴마다 볼지 (새 세션 마운트는 무겁다) */
  readonly roundTripEvery?: number
  /**
   * 관리 메뉴 정책 — `사람` 은 병이면 입원 · 사기가 낮으면 회식 · 그 밖은 트레이닝, `훈련만` 은 늘 트레이닝(사기 0 · 질병 · 연패 길을 오래 탄다)
   */
  readonly policy?: '사람' | '훈련만'
  /** 정책이 안 밟던 길 (r235) — 없으면 r233 정책 그대로(난수 차례도 같다) */
  readonly extras?: SeasonSoakExtras
}

/**
 * r235 — 화면이 부르는 길을 더 밟는다. 판정 · 가드는 그 화면(`TradeScreen` · `SeasonItemShopScreen` · `SeasonEquipmentScreen` ·
 * `SeasonStaminaPickScreen` · `EntryEditorScreen`)이 쓰는 모델 함수를 그대로 부른다.
 */
interface SeasonSoakExtras {
  /** 구단관리 → 트레이드(0xe4~0xe7) 자기 트레이드 · CPU 요청 알림 수락(0xe5 요청 칸) */
  readonly trade?: boolean
  /** 아이템 → 서브아이템 · GP 아이템(십전대보탕은 0xe8) · 장착아이템(0xdf 목적 1 → 0xdc 종류 3) */
  readonly shop?: boolean
  /** 경기정보 0xdd → 엔트리 편집 0xe0 (투수 두 줄 · 타순 두 줄 맞바꾸기) */
  readonly entryEdit?: boolean
  /** G 지갑(`useGamePointWallet`)을 세워 세션에 넘긴다 — 시작 잔고 */
  readonly startGamePoints?: number
  /** 관리 메뉴에서 이만큼 정규 경기마다 훅을 내리고 같은 저장으로 다시 띄운다(장면 0x105 새로 — `constructScene`) */
  readonly reopenEvery?: number
  /**
   * 이만큼 정규 경기마다 경기를 기본 설정(사람 차례가 있는 설정)으로 세워 첫 진행을 이어하기 저장(`saveGameProgress`)에 쓰고,
   * 훅을 내렸다 다시 띄워 `resumeSavedGame` → `resumeTeamGame` → 30G 자동진행(`runAutoProgress`)으로 끝낸다
   */
  readonly midGameResumeEvery?: number
}

/** 리그 안 선수 신원 — 붙박이 표 팀 · 칸 id · 편 (트레이드로 옮겨 가도 따라간다) */
function playerKeyOf(player: SeasonPlayer, ownerTeamId: number, isPitcher: boolean): string {
  return `${isPitcher ? 'P' : 'B'}${tableTeamOf(player, ownerTeamId)}:${player.id}`
}

/** 열 팀 명단에 같은 선수가 둘 이상인 줄 · 명단 크기 */
function leagueRosterProblemsOf(rosterOf: (teamId: number) => SeasonTeamRoster, sizes?: ReadonlyMap<number, string>): string[] {
  const out: string[] = []
  const seen = new Map<string, number>()
  for (let team = 0; team < 10; team += 1) {
    const roster = rosterOf(team)
    const size = `${roster.pitchers.length}/${roster.batters.length}`
    const expected = sizes?.get(team)
    if (expected !== undefined && expected !== size) out.push(`팀 ${team} 명단 크기 ${expected} → ${size}`)
    for (const [isPitcher, players] of [[true, roster.pitchers], [false, roster.batters]] as const) {
      for (const player of players) {
        const key = playerKeyOf(player, team, isPitcher)
        const other = seen.get(key)
        if (other !== undefined) out.push(`선수 ${key} 가 팀 ${other} · 팀 ${team} 에 둘이다`)
        seen.set(key, team)
        const equipment = seasonPlayerEquipmentOf(player, team, isPitcher)
        if (equipment.length !== SEASON_EQUIPMENT_PART_COUNT) out.push(`선수 ${key} 장비 칸 ${equipment.length}`)
        out.push(...outOfRangeOf(`팀 ${team} ${key} 장비`, Object.fromEntries(equipment.map((v, i) => [i, v])), 0, SEASON_EQUIPMENT_LEVEL_COUNT))
      }
    }
  }
  return out
}

function rosterSizesOf(rosterOf: (teamId: number) => SeasonTeamRoster): ReadonlyMap<number, string> {
  const out = new Map<number, string>()
  for (let team = 0; team < 10; team += 1) {
    const roster = rosterOf(team)
    out.set(team, `${roster.pitchers.length}/${roster.batters.length}`)
  }
  return out
}

type Rendered = { readonly current: SeasonSession }

/** 같은 날 두 팀(내 팀 · 상대)의 타자 줄만 뽑는다 — 그날 다른 경기에 안 나온다 */
function battersOfTeams(stats: LeaguePlayerStats, teams: readonly number[], isOnTeams: (id: number) => boolean = (id) => teams.includes(Math.floor(id / 12))) {
  const out: Record<number, { atBats: number; hits: number; homeRuns: number; runsBattedIn: number }> = {}
  for (const [id, line] of Object.entries(stats.batters)) {
    if (!isOnTeams(Number(id))) continue
    out[Number(id)] = { atBats: line.atBats, hits: line.hits, homeRuns: line.homeRuns, runsBattedIn: line.runsBattedIn }
  }
  return out
}

function runSeasonSoak(options: SeasonSoakOptions): SeasonSoakResult {
  const { seed, teamId, maxRegularGames, roundTripEvery = 5, policy = '사람', extras } = options
  const store = memoryStore()
  const random = createSeededRandom(seed)
  // G 지갑 — 새 길을 켤 때만 세션에 넘긴다(안 켜면 r233 처럼 세션 주머니). 저장소는 이어하기 때 같이 다시 읽는다
  const walletStore = memoryStore()
  const useWallet = extras?.startGamePoints !== undefined
  if (extras?.startGamePoints !== undefined) walletStore.save({ gamePoint: extras.startGamePoints })
  const mount = () => renderHook(() => {
    const wallet = useGamePointWallet(walletStore)
    return { session: useSeasonSession(store, random, useWallet ? wallet : null), wallet }
  })
  let rendered = mount()
  const result: Rendered = { get current() { return rendered.result.current.session } }
  const walletNow = (): GamePointWalletSession => rendered.result.current.wallet
  const extraLog: Record<string, number> = {}
  const logExtra = (name: string) => {
    extraLog[name] = (extraLog[name] ?? 0) + 1
  }
  const problems = new SoakProblems()
  const games = { 정규: 0, 포스트시즌: 0, 국가대항전: 0 }
  let steps = 0
  let trainingSlot = 0
  let managementVisits = 0
  let handledSummaryEntry: number | null = null
  let reachedEnding = false
  const yearLog: string[] = []
  let stoppedAt: string | null = null
  const startYear = { value: 0 }
  // 장면 0x105 를 세운다 — 라우트가 들어올 때 한 번 (`SeasonRoute` 의 useLayoutEffect)
  act(() => result.current.actions.constructScene())

  const where = () => {
    const record = result.current.state?.record
    return `씨앗 ${seed} · ${record === undefined ? '-' : `${record.yearIndex + 1}년차 g${record.games}${record.inPostseason ? '(PS)' : ''}`}`
      + ` · 장면 0x${result.current.scene.toString(16)} · 걸음 ${steps}`
  }

  /** 걸음마다 보는 값 — 불가능한 값 · 리그 전적 · 순위 */
  const checkState = () => {
    const session = result.current
    const state = session.state
    if (state === null) return
    const { record } = state
    const at = where()
    problems.add(at, outOfRangeOf('record', {
      money: record.money, popularity: record.popularity, reputation: record.reputation, games: record.games,
      yearIndex: record.yearIndex, storeGames: record.storeGames, aimVisionGames: record.aimVisionGames,
      illness: record.illness, crowdLevel: record.crowdLevel, regularSeasonFirsts: record.regularSeasonFirsts,
      tradeRequestCount: record.tradeRequestCount, popularityAtSeasonStart: record.popularityAtSeasonStart,
    }, 0))
    problems.add(at, outOfRangeOf('record(상한)', { money: record.money }, 0, MONEY_LIMIT))
    problems.add(at, outOfRangeOf('record(상한)', { popularity: record.popularity }, 0, POPULARITY_LIMIT))
    problems.add(at, outOfRangeOf('record(상한)', { reputation: record.reputation }, 0, REPUTATION_LIMIT))
    problems.add(at, outOfRangeOf('record(상한)', { yearIndex: record.yearIndex }, 0, FINAL_YEAR_INDEX))
    problems.add(at, outOfRangeOf('state', { teamMorale: state.teamMorale }, 0, MORALE_LIMIT))
    state.teamAbilities.forEach((row, team) =>
      problems.add(at, outOfRangeOf(`teamAbilities[${team}]`, Object.fromEntries(row.map((v, i) => [i, v])), 0, TEAM_ABILITY_LIMIT)))
    if (!record.inPostseason && !record.nationalCup) {
      problems.add(at, outOfRangeOf('record(정규)', { games: record.games }, 0, SEASON_GAME_COUNT))
      // 정규시즌은 열 팀이 매일 한 경기씩 — 팀마다 승 + 패 = 경기 수 (무승부 없음)
      problems.add(at, leagueTallyProblemsOf('league', session.league, record.games))
    } else {
      problems.add(at, leagueTallyProblemsOf('league', session.league, null))
      // 정규시즌이 끝난 리그 — 일정표 0xd89cb 아홉 날 × 5 바퀴라 두 팀은 꼭 다섯 번 만났다
      if (record.inPostseason) {
        for (let a = 0; a < 10; a += 1) {
          for (let b = a + 1; b < 10; b += 1) {
            const met = (session.league.headToHead[a]?.[b] ?? 0) + (session.league.headToHead[b]?.[a] ?? 0)
            if (met !== SEASON_GAME_COUNT / 9) problems.add(at, [`정규시즌 끝 리그: 팀 ${a}·${b} 맞대결 ${met} ≠ 5`])
          }
        }
      }
    }
    const series = session.series
    if (series !== null) {
      problems.add(at, outOfRangeOf('series.wins', { a: series.wins[0], b: series.wins[1] }, 0, series.winsNeeded))
      if (series.round === '종료' && (series.champion === null || !series.qualifiers.includes(series.champion))) {
        problems.add(at, [`포스트시즌이 끝났는데 우승 팀이 대진 밖이다: ${series.champion}`])
      }
      if (series.teams[0] === series.teams[1]) problems.add(at, [`시리즈 두 칸이 같은 팀 ${series.teams[0]}`])
    }
    if (session.cup !== null) problems.add(at, outOfRangeOf('cup', { day: session.cup.day }, 0, 10))
    problems.add(at, rankingOrderProblemsOf('rankingOf', rankingOf(session.league), session.league.wins, session.league.losses))
    for (const [id, line] of Object.entries(session.playerStats.batters)) problems.add(at, batterLineProblemsOf(`batters[${id}]`, line))
    for (const [id, line] of Object.entries(session.playerStats.pitchers ?? {})) {
      problems.add(at, outOfRangeOf(`pitchers[${id}]`, {
        outs: line.outs, runsAllowed: line.runsAllowed, strikeouts: line.strikeouts, wins: line.wins, losses: line.losses, saves: line.saves,
      }, 0))
    }
  }

  /** 저장 왕복 — 담긴 값이 JSON 을 지나도 같고, 그 저장으로 새로 띄운 세션이 같은 상태를 본다 */
  const checkRoundTrip = () => {
    const held = store.held()
    if (held === null) return
    const at = where()
    problems.add(at, unserializablePathsOf(held, '저장').slice(0, 5))
    const diff = jsonRoundTripDiffOf(held)
    if (diff !== null) problems.add(at, [`저장 JSON 왕복이 다르다: ${diff}`])
    const reloadStore: JsonStorePort = { load: () => JSON.parse(JSON.stringify(held)), save: () => {} }
    const reloaded = renderHook(() => useSeasonSession(reloadStore, createSeededRandom(1)))
    try {
      const now = result.current
      const again = reloaded.result.current
      const pairs: readonly [string, unknown, unknown][] = [
        
        // 다시 띄우면 장면 0x105 가 새로 서며(0x3b14 → 0x8ce94 → 0xacf60) 반복 이벤트(490) 본 비트를 지운다 — 원본 그대로라 같은 지움을 얹어 견준다
        // 0xe9(관중수입)에서 끊으면 phase 가 경기 끝(2) 그대로라 다시 띄운 세션이 0xe9 진입 0xdea0 → 0x8a6fc 를 한 번 더 타
        // 구내매점 SR+0x55 가 또 준다 — 원본 그대로(`useSeasonSession` 0xe9 진입 주석, R13 10절). 같은 재진입을 얹어 견준다 (r235:
        // GP 아이템 칸 6 구내매점을 사야 SR+0x55 > 0 이라 r233 정책에선 안 보였다)
        ['state', now.state === null ? null : {
          ...now.state,
          record: clearRepeatableSeen(now.scene === SEASON_SCENE_STATE.관중수입 ? settleGameIncome(now.state.record).record : now.state.record),
        }, again.state], ['league', now.league, again.league], ['roster', now.roster, again.roster],
        ['playerStats', now.playerStats, again.playerStats], ['series', now.series, again.series], ['cup', now.cup, again.cup],
      ]
      for (const [name, a, b] of pairs) {
        const d = firstDiffOf(a, b, name)
        if (d !== null) problems.add(at, [`다시 띄운 세션이 다르다: ${d}`])
      }
    } finally {
      reloaded.unmount()
    }
  }

  /** 내 팀은 세션 명단, 나머지는 시즌 저장의 CPU 명단(트레이드로 바뀐 팀) · 붙박이 표 */
  const rosterOfTeam = (team: number): SeasonTeamRoster =>
    (team === result.current.state?.record.teamId ? result.current.roster : result.current.cpuRosterOf(team))

  /**
   * 훅을 내리고 같은 저장소로 다시 띄운다 — `SeasonRoute` 진입(useLayoutEffect 3284e): 경기 중간 저장(+0x4e)이 있으면
   * `resumeSavedGame`(곧장 경기), 없으면 `constructScene`(장면 0x105 — 로딩 팁 rand(0, 73)). 경기로 갔으면 참.
   * 내리기 전 상태와 다시 띄운 상태를 견준다(반복 이벤트 본 표시 지움 0x8ce94 · 이어하기 수입 0xa34b8 재적용은 원본 그대로라 뺀다)
   */
  const reopen = (label: string): boolean => {
    const before = result.current
    const balance = walletNow().balance
    rendered.unmount()
    rendered = mount()
    logExtra(label)
    const at = `${where()} · ${label}`
    if (walletNow().balance !== balance) problems.add(at, [`다시 띄운 G ${walletNow().balance} ≠ 내리기 전 ${balance}`])
    let went = false
    if (result.current.isGameInProgress) {
      act(() => {
        went = result.current.actions.resumeSavedGame()
      })
    } else {
      act(() => result.current.actions.constructScene())
    }
    const again = result.current
    const beforeState = before.state === null ? null : { ...before.state, record: clearRepeatableSeen(before.state.record) }
    const againState = again.state === null || !went ? again.state : { ...again.state, record: { ...again.state.record, money: before.state?.record.money ?? 0 } }
    const pairs: readonly [string, unknown, unknown][] = [
      ['state', beforeState, againState], ['league', before.league, again.league], ['roster', before.roster, again.roster],
      ['playerStats', before.playerStats, again.playerStats], ['series', before.series, again.series], ['cup', before.cup, again.cup],
    ]
    for (const [name, a, b] of pairs) {
      const d = firstDiffOf(a, b, name)
      if (d !== null) problems.add(at, [`다시 띄운 세션이 다르다: ${d}`])
    }
    return went
  }

  /**
   * 경기 중간에 끊고 이어 간다 — 시즌 칸 경기진행 설정(사람 차례가 있는 설정) 그대로 세운 첫 진행을 0xdd OK 몫 저장
   * (`saveGameProgress` — +0x4e = 1 · 블록)에 쓰고 훅을 내렸다 다시 띄운다. 다시 선 세션은 `resumeSavedGame` 으로 곧장
   * 경기직전(0xe1)이고, 경기 화면(`useTeamGame`)처럼 로딩 팁 → `resumeTeamGame` 을 세운 뒤 경기 중 메뉴 30G 자동진행
   * (`spendGamePoint` · `runAutoProgress`)으로 끝낸다. 첫 진행이 사람 차례 없이 끝났으면 그대로 쓴다.
   */
  const playGameWithMidResume = (options: NonNullable<SeasonSession['gameOptions']>): TeamGameProgress | null => {
    rollSceneLoadingTip(random)
    // 사람이 다 하는 설정(경기진행 설정 창에서 고친 값) — 첫 사람 차례에서 선다
    const first = startTeamGame({ ...options, settings: FULL_PLAY_SETTINGS }, random)
    if (first.game.isFinished) return first
    act(() => result.current.actions.saveGameProgress(first))
    if (!result.current.isGameInProgress) problems.add(where(), ['이어하기 저장을 썼는데 +0x4e 가 안 섰다'])
    if (!reopen('경기중이어하기')) {
      problems.add(where(), ['경기 중간 저장으로 다시 띄웠는데 경기로 가지 않았다'])
      return null
    }
    const saved = result.current.resumeGame
    if (result.current.scene !== SEASON_SCENE_STATE.경기직전 || saved === null) {
      problems.add(where(), [`이어하기 뒤 장면 0x${result.current.scene.toString(16)} · 블록 ${saved === null ? '없음' : '있음'}`])
      return null
    }
    rollSceneLoadingTip(random)
    let progress = resumeTeamGame(saved, random, false)
    const cost = autoProgressCostOf(progress.options.mode)
    const balance = result.current.gamePoints
    if (!canAutoProgress(progress) || balance < cost) {
      problems.add(where(), [`이어 선 경기를 자동진행할 수 없다 (G ${balance})`])
      return null
    }
    act(() => result.current.actions.spendGamePoint(cost))
    if (result.current.gamePoints !== balance - cost) problems.add(where(), [`자동진행 G ${balance} − ${cost} ≠ ${result.current.gamePoints}`])
    progress = runAutoProgress(progress, random)
    return progress
  }

  /** 트레이드 탭의 두 명단 — `TradeScreen` 과 같이 레코드 차례(`tradeRoster` · `tradeRosterOf`) */
  const tradeEntriesFor = (opponentTeamId: number, tab: number) => {
    const session = result.current
    const isPitcher = tab === TRADE_TAB.투수
    return {
      mine: myTradeEntriesOf(session.state?.record.teamId ?? 0, session.tradeRoster, isPitcher),
      theirs: opponentTradeEntriesOf(opponentTeamId, session.tradeRosterOf(opponentTeamId), isPitcher),
    }
  }

  type TradeOutcome = '성공' | '실패' | 'G부족' | '소지금부족' | '칸없음'

  /**
   * 0xe7 진행 — `TradeScreen.proceedTrade` 의 가드([65] G · [77] 소지금) → `runTrade`(굴림 `rollTradeSuccess` · 소지금 d ·
   * SR+0x56) → `finishTrade`. 성공 · 실패면 결과 알림을 닫는다(`closeTradeResult` 0xc7ba → 0xc9).
   * 새 검사: G 차감 · 소지금 d · SR+0x56 · 열 팀 명단 크기 그대로 · 리그에 같은 선수 둘 없음 · 맞바뀐 두 칸 · 장비 니블 지움(0xd1cc)
   */
  const tradeOnce = (
    opponentTeamId: number, tab: number, acquired: TradePlayerEntry, given: TradePlayerEntry, boost: number, isForced: boolean,
  ): TradeOutcome => {
    const record = result.current.state?.record
    if (record === undefined) return '칸없음'
    const cost = tradeBoostCostOf(boost)
    if (result.current.gamePoints < cost) return 'G부족'
    const moneyChange = tradeMoneyChangeOf(given.grade, acquired.grade)
    if (moneyChange < 0 && record.money < -moneyChange) return '소지금부족'
    const rate = tradeSuccessRate({
      myGrade: given.grade, opponentGrade: acquired.grade, myPenalty: given.penalty, opponentPenalty: acquired.penalty, boost,
    })
    const isSuccess = rollTradeSuccess(random, rate, isForced)
    const settled = isSuccess ? withTradeMoney(record, given.grade, acquired.grade) : record
    const sizes = rosterSizesOf(rosterOfTeam)
    const balance = result.current.gamePoints
    const myTeam = record.teamId
    const isPitcher = tab === TRADE_TAB.투수
    const settlement: TradeSettlement = {
      record: markTradeUsed(settled),
      gamePointCost: cost,
      isSuccess,
      ...(isSuccess ? { swap: { opponentTeamId, tab, myIndex: given.index, opponentIndex: acquired.index } } : {}),
    }
    act(() => result.current.actions.finishTrade(settlement))
    const at = `${where()} · 트레이드 ${isForced ? '요청' : '자기'} 팀 ${opponentTeamId} 탭 ${tab} 칸 ${given.index}↔${acquired.index}`
    const after = result.current
    if (useWallet && after.gamePoints !== balance - cost) problems.add(at, [`트레이드 G ${balance} − ${cost} ≠ ${after.gamePoints}`])
    const expectedMoney = isSuccess ? Math.min(MONEY_LIMIT, Math.max(0, record.money + moneyChange)) : record.money
    if (after.state?.record.money !== expectedMoney) {
      problems.add(at, [`트레이드 소지금 ${record.money} (d ${moneyChange}, ${isSuccess ? '성공' : '실패'}) → ${after.state?.record.money} ≠ ${expectedMoney}`])
    }
    if (after.state?.record.tradeUsed !== 1) problems.add(at, [`트레이드 뒤 SR+0x56 = ${after.state?.record.tradeUsed}`])
    problems.add(at, leagueRosterProblemsOf(rosterOfTeam, sizes))
    if (isSuccess) {
      const now = tradeEntriesFor(opponentTeamId, tab)
      const gotKey = playerKeyOf(acquired.player, opponentTeamId, isPitcher)
      const gaveKey = playerKeyOf(given.player, myTeam, isPitcher)
      const mine = now.mine[given.index]
      const theirs = now.theirs[acquired.index]
      if (mine === undefined || playerKeyOf(mine.player, myTeam, isPitcher) !== gotKey) {
        problems.add(at, [`트레이드 성공 뒤 내 칸 ${given.index} = ${mine === undefined ? '없음' : playerKeyOf(mine.player, myTeam, isPitcher)} ≠ 데려온 ${gotKey}`])
      }
      if (theirs === undefined || playerKeyOf(theirs.player, opponentTeamId, isPitcher) !== gaveKey) {
        problems.add(at, [`트레이드 성공 뒤 상대 칸 ${acquired.index} = ${theirs === undefined ? '없음' : playerKeyOf(theirs.player, opponentTeamId, isPitcher)} ≠ 내준 ${gaveKey}`])
      }
      // 0xd1cc 고리 — 맞바꾼 두 레코드의 장비 니블 네 칸은 0 이 된다
      for (const [entry, owner] of [[mine, myTeam], [theirs, opponentTeamId]] as const) {
        if (entry === undefined) continue
        const equipment = seasonPlayerEquipmentOf(entry.player, owner, isPitcher)
        if (equipment.some((level) => level !== 0)) problems.add(at, [`맞바꾼 선수 장비 니블이 남았다 (${equipment.join(',')})`])
      }
    }
    act(() => result.current.actions.closeTradeResult())
    // 0xc9 진입 폴링(0xe9ac)이 이벤트를 틀면 곧장 0xd3 이다
    if (result.current.scene !== SEASON_SCENE_STATE.관리메뉴 && result.current.scene !== SEASON_SCENE_STATE.이벤트재생) {
      problems.add(at, [`트레이드 결과를 닫았는데 장면 0x${result.current.scene.toString(16)}`])
    }
    logExtra(isSuccess ? '트레이드성공' : '트레이드실패')
    return isSuccess ? '성공' : '실패'
  }

  let tradeTurn = 0
  /** 구단관리 칸 1 → 0xe4 팀 → 0xe5 영입 → 0xe6 보상(나리 · 명예 거절 [165]/[166] 이면 다른 칸) → 0xe7 비용 칸 → 진행 */
  const ownTrade = (): boolean => {
    const record = result.current.state?.record
    // 구단관리 위·아래 이동 0x6c444 가 SR+0x56 이 선 칸을 건너뛴다 — 트레이드 칸에 못 간다
    if (record === undefined || !canUseTradeCommand(record)) return false
    tradeTurn += 1
    act(() => result.current.actions.goto(SEASON_SCENE_STATE.구단관리))
    act(() => result.current.actions.goto(SEASON_SCENE_STATE.트레이드))
    // 0xe4 확인 → 0xe5 — 진입 0x5cd0 첫머리 0xb512c × 열 팀 (`onEnterAcquired`)
    const opponentTeamId = (record.teamId + 1 + (tradeTurn % 9)) % 10
    act(() => result.current.actions.clearRecordAces())
    const tab = tradeTurn % 2 === 0 ? TRADE_TAB.타자 : TRADE_TAB.투수
    const { mine, theirs } = tradeEntriesFor(opponentTeamId, tab)
    const acquired = theirs[(tradeTurn * 3) % Math.max(1, theirs.length)]
    const start = (tradeTurn * 5) % Math.max(1, mine.length)
    const given = mine.map((_, offset) => mine[(start + offset) % mine.length]!).find((entry) => entry.refusal === null)
    const refused = mine[start]?.refusal ?? null
    if (refused !== null) logExtra(`트레이드거절${refused}`)
    const outcome = acquired === undefined || given === undefined ? '칸없음' : tradeOnce(opponentTeamId, tab, acquired, given, tradeTurn % 3, false)
    if (outcome !== '성공' && outcome !== '실패') {
      // 가드에 걸리면 0xe7 에 남는다 — 사람은 취소로 구단관리 → 관리 메뉴
      logExtra(`트레이드${outcome}`)
      act(() => result.current.actions.goto(SEASON_SCENE_STATE.구단관리))
      act(() => result.current.actions.goto(SEASON_SCENE_STATE.관리메뉴))
    }
    return true
  }

  /** CPU 요청을 받아 0xe5 에 온 판 — 커서가 요청 칸에 묶이고 비용 칸 0 · 강제 성공(this+0x148) */
  const requestedTrade = () => {
    const request = result.current.tradeRequest
    act(() => result.current.actions.clearRecordAces())
    const { mine, theirs } = tradeEntriesFor(request.opponentTeamId, request.tab)
    const acquired = theirs[request.opponentIndex]
    const given = mine[request.myIndex]
    const outcome = !request.isRequested || acquired === undefined || given === undefined
      ? '칸없음'
      : tradeOnce(request.opponentTeamId, request.tab, acquired, given, 0, true)
    if (outcome === '실패') problems.add(where(), ['요청 트레이드(강제 성공)가 실패했다'])
    if (outcome !== '성공' && outcome !== '실패') {
      // [216] "예" — 0x712a: 요청을 지우고 구단관리 0xce
      logExtra(`요청트레이드${outcome}`)
      act(() => result.current.actions.cancelTradeRequest())
      act(() => result.current.actions.goto(SEASON_SCENE_STATE.관리메뉴))
    }
  }

  let shopTurn = 0
  /** 아이템 0xd0 → 상점 0xdc — 서브아이템 · GP 아이템 · 장착아이템을 차례로 한 번 */
  const shopOnce = (): boolean => {
    const session = result.current
    const state = session.state
    if (state === null) return false
    const turn = shopTurn
    shopTurn += 1
    const { record } = state
    act(() => result.current.actions.goto(SEASON_SCENE_STATE.아이템))
    const at = () => `${where()} · 상점`
    const back = () => act(() => result.current.actions.goto(SEASON_SCENE_STATE.관리메뉴))
    if (turn % 3 === 0) {
      // 종류 1 서브아이템 — `checkSeasonSubItem` 가드 → [79] 예 → `buySeasonSubItem`
      act(() => result.current.actions.goto(SEASON_SCENE_STATE.아이템상점))
      const slots = Array.from({ length: SEASON_SHOP_SLOT_COUNT }, (_, offset) => (Math.floor(turn / 3) + offset) % SEASON_SHOP_SLOT_COUNT)
      const slot = slots.find((candidate) => checkSeasonSubItem(record, candidate).ok)
      if (slot !== undefined) {
        act(() => {
          result.current.actions.buySeasonSubItem(slot)
        })
        const after = result.current.state?.record
        const expected = record.money - seasonSubItemPriceOf(slot) * 10
        if (after?.money !== expected) problems.add(at(), [`서브아이템 ${slot} 소지금 ${record.money} → ${after?.money} ≠ ${expected}`])
        if (after === undefined || !ownsSeasonShopSubItem(after, slot)) problems.add(at(), [`서브아이템 ${slot} 을 샀는데 보유가 아니다`])
        logExtra('서브아이템')
      }
      back()
      return true
    }
    if (turn % 3 === 1) {
      // 종류 2 GP 아이템 — `checkSeasonGpItem` 가드 → [82] 예 → `buySeasonGpItem` (칸 3 은 0xe8)
      act(() => result.current.actions.goto(SEASON_SCENE_STATE.아이템상점))
      const slots = Array.from({ length: SEASON_GP_ITEM_COUNT }, (_, offset) => (Math.floor(turn / 3) + offset) % SEASON_GP_ITEM_COUNT)
      const slot = slots.find((candidate) => checkSeasonGpItem({ record, teamMorale: state.teamMorale, gamePoint: session.gamePoints }, candidate)?.ok === true)
      if (slot === undefined) {
        back()
        return true
      }
      const balance = session.gamePoints
      let text: string | null = ''
      act(() => {
        text = result.current.actions.buySeasonGpItem(slot)
      })
      if (slot === SEASON_STAMINA_ITEM) {
        if (text !== null) problems.add(at(), ['십전대보탕이 0xe8 로 안 갔다'])
        if (result.current.gamePoints !== balance) problems.add(at(), ['십전대보탕 칸이 0xe8 앞에서 G 를 뺐다'])
        act(() => result.current.actions.goto(SEASON_SCENE_STATE.스태미나회복))
        const pitchers = result.current.tradeRoster.pitchers
        // 0x5870 목록 — 남은 마투수 줄이 있으면 칸이 밀리므로 그때는 0 번(가득이면 [211] 만)
        const index = result.current.myRecordAces === undefined
          ? Math.max(0, pitchers.findIndex((pitcher) => pitcher.stamina < FULL_PITCHER_STAMINA))
          : 0
        let recovered = false
        act(() => {
          recovered = result.current.actions.recoverSeasonPitcherStamina(index).recovered
        })
        const spent = balance - result.current.gamePoints
        const price = seasonGpItemPriceOf(SEASON_STAMINA_ITEM)
        if (useWallet && spent !== (recovered ? price : 0)) problems.add(at(), [`십전대보탕 G 차감 ${spent} ≠ ${recovered ? price : 0}`])
        if (recovered && result.current.myRecordAces === undefined && result.current.tradeRoster.pitchers[index]?.stamina !== FULL_PITCHER_STAMINA) {
          problems.add(at(), [`십전대보탕 뒤 투수 ${index} 스태미나 ${result.current.tradeRoster.pitchers[index]?.stamina}`])
        }
        logExtra(recovered ? '십전대보탕' : '십전대보탕가득')
        act(() => result.current.actions.goto(SEASON_SCENE_STATE.아이템상점))
        back()
        return true
      }
      const price = seasonGpItemPriceOf(slot)
      const after = result.current.state
      if (useWallet && balance - result.current.gamePoints !== price) problems.add(at(), [`GP 아이템 ${slot} G ${balance} − ${price} ≠ ${result.current.gamePoints}`])
      if (after !== null) {
        const money = after.record.money
        // 복권(0xa310c 칸 0) — 0xd7ce3 상금 100·50·20·10·5·2 (100만 원) 또는 꽝(사기 +40)
        const allowed = slot === 0 ? [0, 100, 50, 20, 10, 5, 2].map((prize) => Math.min(MONEY_LIMIT, record.money + prize)) : [record.money]
        if (!allowed.includes(money)) problems.add(at(), [`GP 아이템 ${slot} 소지금 ${record.money} → ${money}`])
        if (slot === 0 && money === record.money && after.teamMorale !== Math.min(MORALE_LIMIT, state.teamMorale + 40)) {
          problems.add(at(), [`복권 꽝인데 사기 ${state.teamMorale} → ${after.teamMorale}`])
        }
        if (slot === 1 && after.teamMorale !== Math.min(MORALE_LIMIT, state.teamMorale + 40)) problems.add(at(), [`영지버섯 사기 ${state.teamMorale} → ${after.teamMorale}`])
        if (slot === 2 && after.record.illness !== 0) problems.add(at(), [`치료제 뒤 질병 ${after.record.illness}`])
        if (slot === 4 && after.record.aimVisionGames !== Math.min(99, record.aimVisionGames + 20)) problems.add(at(), [`이글아이 ${record.aimVisionGames} → ${after.record.aimVisionGames}`])
        if (slot === 5 && after.record.tradeUsed !== 0) problems.add(at(), [`협회허가증 뒤 SR+0x56 = ${after.record.tradeUsed}`])
        if (slot === 6 && after.record.storeGames !== 45) problems.add(at(), [`구내매점 뒤 남은 경기 ${after.record.storeGames}`])
      }
      logExtra(`GP${slot}`)
      back()
      return true
    }
    // 종류 3 장착아이템 — 0xd0 칸 0 → 선수 고르기 0xdf 목적 1(진입 0x5980 이 0xb512c) → 0xdc 장비 창 → 가드 → 구매(0x7d90 0x14)
    act(() => result.current.actions.goto(SEASON_SCENE_STATE.선수고르기))
    const isPitcher = Math.floor(turn / 3) % 2 === 0
    const listed = isPitcher ? result.current.tradeRoster.pitchers : result.current.tradeRoster.batters
    const start = (turn * 7) % Math.max(1, listed.length)
    const cursor = listed.map((_, offset) => (start + offset) % listed.length)
      .find((index) => !isHallOfFameRecord(listed[index]!) && listed[index]!.id < 0xb4)
    if (cursor === undefined) {
      back()
      return true
    }
    const player = listed[cursor]!
    act(() => result.current.actions.goto(SEASON_SCENE_STATE.아이템상점))
    const recordNow = result.current.state?.record ?? record
    const equipment = seasonPlayerEquipmentOf(player, record.teamId, isPitcher)
    const isBatter = !isPitcher
    const opened = result.current.openedHiddenIds
    const part = turn % SEASON_EQUIPMENT_PART_COUNT
    const level = equipment[part] ?? 0
    const checked = level < SEASON_FIRST_HIDDEN_LEVEL
      ? checkSeasonEquipment(recordNow, { isBatter, equipment }, part, level, (id) => opened.includes(id))
      : null
    if (checked !== null && checked.ok) {
      const bought = applySeasonEquipment(recordNow.money, { isBatter, equipment }, part, level)
      const others = listed.filter((_, index) => index !== cursor).map((other) => seasonPlayerEquipmentOf(other, record.teamId, isPitcher).join(','))
      act(() => result.current.actions.equipSeasonPlayer({ isPitcher, recordIndex: cursor, money: bought.money, equipment: bought.equipment }))
      const now = (isPitcher ? result.current.tradeRoster.pitchers : result.current.tradeRoster.batters)
      const target = now[cursor]
      if (target === undefined || playerKeyOf(target, record.teamId, isPitcher) !== playerKeyOf(player, record.teamId, isPitcher)) {
        problems.add(at(), [`장비를 산 칸 ${cursor} 의 선수가 바뀌었다`])
      } else {
        const got = seasonPlayerEquipmentOf(target, record.teamId, isPitcher)
        if (got.join(',') !== bought.equipment.join(',')) problems.add(at(), [`장비 니블 ${got.join(',')} ≠ 산 값 ${bought.equipment.join(',')}`])
        if (got[part] !== level + 1) problems.add(at(), [`장비 부위 ${part} 레벨 ${got[part]} ≠ ${level + 1}`])
      }
      const othersNow = now.filter((_, index) => index !== cursor).map((other) => seasonPlayerEquipmentOf(other, record.teamId, isPitcher).join(','))
      if (othersNow.join('|') !== others.join('|')) problems.add(at(), ['장비를 산 선수 말고 다른 선수의 니블이 바뀌었다'])
      const money = result.current.state?.record.money
      if (money !== bought.money || bought.money !== recordNow.money - checked.price * 10) {
        problems.add(at(), [`장비 소지금 ${recordNow.money} − ${checked.price}×10 → ${money} (계산 ${bought.money})`])
      }
      logExtra(`장비${isPitcher ? '투수' : '타자'}`)
    } else if (checked !== null && !checked.ok) {
      logExtra(`장비거절${checked.reason}`)
    }
    // 0x5980 — 선수 고르기로 돌아갔다가 아이템 메뉴 → 관리 메뉴
    act(() => result.current.actions.goto(SEASON_SCENE_STATE.선수고르기))
    back()
    return true
  }

  let entryTurn = 0
  /**
   * 경기정보 0xdd '4' → 0xe0(유저 팀) — 투수 탭 0 · 1 줄, '*' 로 타자 탭 타순 0 · 2 줄을 맞바꾸고 CLR(끝 코드 1)로 0xdd.
   * 새 검사: 명단 크기 · 같은 선수 그대로(차례만) · 중복 없음, 경기정보 선발 이름 · 경기 옵션 `ourEntryOrder` 가 바뀐다
   */
  const editEntry = () => {
    const session = result.current
    const pending = session.pendingGame
    entryTurn += 1
    if (pending === null || pending.kind === '국가대항전' || entryTurn % 2 === 0) return
    const at = () => `${where()} · 엔트리편집`
    const roster = session.roster
    const keysOf = (r: SeasonTeamRoster) => [
      ...r.pitchers.map((p) => playerKeyOf(p, session.state?.record.teamId ?? 0, true)),
      ...r.batters.map((p) => playerKeyOf(p, session.state?.record.teamId ?? 0, false)),
    ].sort().join(',')
    const starterBefore = session.matchInfoStarterName
    const orderBefore = pending.options.ourEntryOrder
    act(() => result.current.actions.openEntryEdit(true))
    const edit = result.current.entryEdit
    if (result.current.scene !== SEASON_SCENE_STATE.엔트리편집 || edit === null) {
      problems.add(at(), ['엔트리 편집에 못 들어갔다'])
      return
    }
    const press = (key: EntryKey) => {
      act(() => result.current.actions.pressEntryKey(key))
      if (result.current.entryEdit?.isAceLocked === true) {
        problems.add(at(), ['마선수가 아닌 줄을 골랐는데 잠금 팝업이 떴다'])
        act(() => result.current.actions.closeEntryAceLocked())
      }
    }
    const swapsPitchers = edit.lists.pitchers[0]?.isAce === false && edit.lists.pitchers[1]?.isAce === false
    if (swapsPitchers) {
      press('확인')
      press('아래')
      press('확인')
    }
    press('별')
    const lists = result.current.entryEdit?.lists
    if (lists?.batters[0]?.isAce === false && lists.batters[2]?.isAce === false) {
      press('확인')
      press('아래')
      press('아래')
      press('확인')
    }
    press('취소')
    // `press` 가 act 안에서 장면을 바꾸므로 앞의 좁힘을 버리고 다시 읽는다
    const sceneAfter: number = result.current.scene
    if (sceneAfter !== SEASON_SCENE_STATE.경기정보) {
      problems.add(at(), [`CLR(끝 코드 1)인데 0xdd 로 안 돌아왔다 — 장면 0x${sceneAfter.toString(16)}`])
      return
    }
    const after = result.current
    if (after.roster.pitchers.length !== roster.pitchers.length || after.roster.batters.length !== roster.batters.length) {
      problems.add(at(), [`엔트리 편집 뒤 명단 크기 ${roster.pitchers.length}/${roster.batters.length} → ${after.roster.pitchers.length}/${after.roster.batters.length}`])
    }
    if (keysOf(after.roster) !== keysOf(roster)) problems.add(at(), ['엔트리 편집이 명단의 선수를 바꿨다(차례만 바뀌어야)'])
    problems.add(at(), leagueRosterProblemsOf(rosterOfTeam))
    if (swapsPitchers && after.matchInfoStarterName === starterBefore) {
      problems.add(at(), [`투수 0 · 1 줄을 바꿨는데 경기정보 선발이 그대로 ${starterBefore}`])
    }
    act(() => result.current.actions.startPendingGame())
    const orderAfter = result.current.gameOptions?.ourEntryOrder
    if (firstDiffOf(orderBefore, orderAfter) === null) problems.add(at(), ['엔트리 편집 뒤 경기 옵션 ourEntryOrder 가 그대로'])
    logExtra('엔트리편집')
  }

  /** 경기 한 판 — `TeamGameScreen` 대신 */
  const playGame = () => {
    const session = result.current
    const options = session.gameOptions
    if (options === null) {
      problems.add(where(), ['경기직전인데 경기 옵션이 없다'])
      return false
    }
    const kind = session.gameKind
    const before = session.playerStats
    const recordBefore = session.state?.record
    const every = extras?.midGameResumeEvery
    // 30G 자동진행으로 끝낼 수 있을 때만 끊는다(사람은 G 가 모자라면 끝까지 손으로 친다 — 여기엔 손이 없다)
    const midResume = every !== undefined && kind === '정규' && games.정규 % every === every - 1
      && session.gamePoints >= autoProgressCostOf(options.mode)
    const progress = midResume ? playGameWithMidResume(options) : (() => {
      rollSceneLoadingTip(random)
      return startTeamGame({ ...options, settings: ALL_AUTO_SETTINGS }, random)
    })()
    if (progress === null) return false
    if (!progress.game.isFinished) {
      problems.add(where(), ['전부 자동 경기가 한 번에 끝나지 않았다'])
      return false
    }
    const summary: TeamGameSummary = summaryOf(progress)
    if (process.env.SOAK_DEBUG === '1') console.info(`[경기] ${where()} ${kind} ${summary.ourTeamId}:${summary.opponentTeamId} ${summary.ourScore}-${summary.opponentScore} 이닝 ${summary.inningsPlayed} side ${options.playerSide} 결과 ${summary.result} 사기 ${session.state?.teamMorale} 질병 ${session.state?.record.illness} 스태미나 ${(options.ourPitcherStaminas ?? []).join(',')}`)
    problems.add(where(), outOfRangeOf('summary', {
      ourScore: summary.ourScore, opponentScore: summary.opponentScore, inningsPlayed: summary.inningsPlayed,
      hitsAllowed: summary.pitching.hitsAllowed, outsRecorded: summary.pitching.outsRecorded,
    }, 0))
    act(() => result.current.actions.enterGameSettlement(summary))
    act(() => result.current.actions.finishGame(summary))
    games[kind] += 1
    // 정규시즌이면 그날 두 팀(내 팀 · 상대)의 타자 기록 증가분이 이 경기 타석과 같아야 한다 — 그날 다른 경기에 안 나온다
    if (kind === '정규' && recordBefore !== undefined) {
      // 일정표 0xd89cb · 홈/원정 0xb7844 대로 — 그날(경기 수 g) 상대와 측
      if (summary.opponentTeamId !== opponentOf(recordBefore.games, recordBefore.teamId)) {
        problems.add(where(), [`정규 g${recordBefore.games} 상대 ${summary.opponentTeamId} ≠ 일정표 ${opponentOf(recordBefore.games, recordBefore.teamId)}`])
      }
      if (options.playerSide !== leagueSideOf(recordBefore.games, recordBefore.teamId)) {
        problems.add(where(), [`정규 g${recordBefore.games} 측 ${options.playerSide} ≠ 일정표 ${leagueSideOf(recordBefore.games, recordBefore.teamId)}`])
      }
      const teams = [summary.ourTeamId, summary.opponentTeamId]
      // 기록표 열쇠는 붙박이 표 자리(팀 × 12 + 칸)다 — 트레이드로 옮긴 선수는 열쇠가 옛 팀 그대로라 그날 다른 경기(0xc2a48)에서
      // 쌓일 수 있다(원본도 기록이 선수 레코드 +0x20~ 에 붙어 따라간다). 그래서 지금 두 팀 명단에 선 선수의 열쇠만 본다 (r235)
      const onTeams = new Set<number>()
      const elsewhere = new Set<number>()
      for (let team = 0; team < 10; team += 1) {
        for (const player of rosterOfTeam(team).batters) {
          if (player.id >= 0xb4) continue
          const id = leagueBatterIdOf(tableTeamOf(player, team), player.id)
          if (teams.includes(team)) onTeams.add(id)
          else elsewhere.add(id)
        }
      }
      const isOnTeams = (id: number) => onTeams.has(id) || (teams.includes(Math.floor(id / 12)) && !elsewhere.has(id))
      const after = battersOfTeams(result.current.playerStats, teams, isOnTeams)
      const prior = battersOfTeams(before, teams, isOnTeams)
      const expectedDelta = recordLeaguePlateAppearances(EMPTY_LEAGUE_PLAYER_STATS, summary.leaguePlateAppearances)
      const ids = new Set([...Object.keys(after), ...Object.keys(expectedDelta.batters)].map(Number))
      for (const id of ids) {
        const team = Math.floor(id / 12)
        if (!isOnTeams(id)) continue
        const a = after[id] ?? { atBats: 0, hits: 0, homeRuns: 0, runsBattedIn: 0 }
        const p = prior[id] ?? { atBats: 0, hits: 0, homeRuns: 0, runsBattedIn: 0 }
        const e = expectedDelta.batters[id] ?? { atBats: 0, hits: 0, homeRuns: 0, runsBattedIn: 0 }
        for (const key of ['atBats', 'hits', 'homeRuns', 'runsBattedIn'] as const) {
          if (a[key] - p[key] !== e[key]) {
            problems.add(where(), [`경기 기록 → 리그 기록표: 타자 ${id}(팀 ${team}) ${key} 증가 ${a[key] - p[key]} ≠ 경기 타석 ${e[key]}`])
          }
        }
      }
      // 경기 수는 한 경기에 하나 — 날짜(L+0x32 = SR+0xb2)가 일정표대로 하루씩 간다
      const recordAfter = result.current.state?.record
      if (recordAfter !== undefined && !recordAfter.inPostseason && recordAfter.games !== recordBefore.games + 1) {
        problems.add(where(), [`정규 경기 뒤 경기 수 ${recordBefore.games} → ${recordAfter.games} (하루 한 칸이어야)`])
      }
      if (leagueBatterIdOf(summary.ourTeamId, 0) !== summary.ourTeamId * 12) problems.add(where(), ['타자 열쇠 꼴이 바뀌었다'])
    }
    return true
  }

  let requestAnswers = 0
  let lastReopenAt = -1
  let lastExtraDay = ''
  let extraTurn = 0
  const maxSteps = soakNumber('SOAK_MAX_STEPS', 60000)
  let lastProgressKey = ''
  let sameKeySteps = 0
  try {
    for (; steps < maxSteps; steps += 1) {
      const session = result.current
      const { state, scene, actions } = session
      // 멈춤 감지 — 걸음이 바뀌어도 장면 · 경기 수 · 연차가 수천 걸음 그대로면 고리다
      const progressKey = `${scene}:${state?.record.games}:${state?.record.yearIndex}:${state?.record.phase}:${session.eventPlayback?.serial}`
        + `:${games.정규 + games.포스트시즌 + games.국가대항전}:${session.series?.wins.join(',')}:${session.cup?.day}`
      if (progressKey === lastProgressKey) sameKeySteps += 1
      else sameKeySteps = 0
      lastProgressKey = progressKey
      if (sameKeySteps > 50) {
        stoppedAt = `멈춤: ${where()}`
        break
      }

      if (session.notice !== '') {
        act(() => actions.clearNotice())
        continue
      }
      if (session.trainingResult !== null) {
        act(() => actions.closeTrainingResult())
        continue
      }
      if (state === null || scene === SEASON_SCENE_STATE.팀고르기) {
        act(() => actions.chooseTeam(teamId, '소크'))
        startYear.value = result.current.state?.record.yearIndex ?? 0
        continue
      }
      if (maxRegularGames !== undefined && games.정규 >= maxRegularGames) break

      switch (scene) {
        case SEASON_SCENE_STATE.이벤트재생: {
          const playback = session.eventPlayback
          if (playback === null) {
            stoppedAt = `이벤트재생인데 재생할 이벤트가 없다: ${where()}`
            break
          }
          const event = SEASON_PLAYABLE_EVENTS.find((candidate) => candidate.id === playback.eventId)
          const rewards = (event?.commands ?? []).flatMap((command) => (command.op === 'reward' ? command.items : []))
          act(() => result.current.actions.finishSeasonEvent(rewards, [playback.eventId]))
          break
        }
        case SEASON_SCENE_STATE.관리메뉴: {
          if (session.isTradeRequestAlertOpen) {
            // r235 — 새 길이면 요청을 번갈아 받는다(예 → 0xe5 요청 칸)
            const accept = extras?.trade === true && requestAnswers % 2 === 0
            requestAnswers += 1
            if (accept) logExtra('요청수락')
            act(() => actions.answerTradeRequest(accept))
            break
          }
          if (state.record.phase === SEASON_PHASE.엔딩 || state.record.endingSeen) {
            reachedEnding = true
            break
          }
          managementVisits += 1
          if (managementVisits % roundTripEvery === 0) checkRoundTrip()
          if (extras !== undefined) {
            problems.add(where(), leagueRosterProblemsOf(rosterOfTeam))
            const every = extras.reopenEvery
            if (every !== undefined && games.정규 > 0 && games.정규 % every === 0 && lastReopenAt !== games.정규) {
              lastReopenAt = games.정규
              reopen('관리메뉴이어하기')
              break
            }
            // 하루(경기 수 칸) 한 번 — 트레이드 · 상점을 번갈아
            const dayKey = `${state.record.yearIndex}:${state.record.games}:${state.record.inPostseason}:${state.record.acted}`
            if (lastExtraDay !== dayKey) {
              lastExtraDay = dayKey
              extraTurn += 1
              const order = extraTurn % 2 === 0 ? ['trade', 'shop'] as const : ['shop', 'trade'] as const
              let didExtra = false
              for (const which of order) {
                if (didExtra) break
                if (which === 'trade' && extras.trade === true) didExtra = ownTrade()
                if (which === 'shop' && extras.shop === true) didExtra = shopOnce()
              }
              if (didExtra) break
            }
          }
          if (!state.record.acted) {
            // 사람 흉내 — 병이 들면 입원(외출 2, 비용 5) · 사기가 낮으면 회식(외출 1, 비용 4) · 그 밖은 트레이닝 칸 0~3 차례.
            // 트레이닝만 하면 사기가 0 까지 내려가 내 팀이 끝없이 져 포스트시즌을 한 번도 못 본다
            const outing = policy === '훈련만' ? null : state.record.illness > 0 && state.record.money >= 5 ? 2
              : state.teamMorale < 70 && state.record.money >= 4 ? 1 : null
            if (outing !== null) {
              act(() => actions.enterOuting(outing))
            } else {
              act(() => actions.runTraining(trainingSlot % 4))
              trainingSlot += 1
            }
          } else {
            act(() => actions.openNextGame())
          }
          break
        }
        case SEASON_SCENE_STATE.외출연출:
          // 연출이 끝난 틀에 결과 0xc81c → 결과 팝업 0x17 을 닫으면 0xc9
          if (session.outingResultText === null && session.outingPlace !== null) {
            const place = session.outingPlace
            act(() => actions.runOuting(place))
          } else {
            act(() => actions.closeOutingResult())
          }
          break
        case SEASON_SCENE_STATE.다음경기:
          act(() => actions.confirmNextGame())
          break
        case SEASON_SCENE_STATE.선수단:
          act(() => actions.choosePreGameAce(session.preGameAces.phase === PRE_GAME_ACE_PHASE.마투수 ? 0 : 5))
          break
        case SEASON_SCENE_STATE.트레이드영입선수:
          requestedTrade()
          break
        case SEASON_SCENE_STATE.경기정보:
          if (session.isMatchSettingsOpen) act(() => actions.applyMatchSettings(ALL_AUTO_SETTINGS))
          if (result.current.isMatchSettingsOpen) act(() => result.current.actions.toggleMatchSettings())
          if (extras?.entryEdit === true) {
            editEntry()
            if (result.current.scene !== SEASON_SCENE_STATE.경기정보) break
          }
          act(() => result.current.actions.startPendingGame())
          break
        case SEASON_SCENE_STATE.경기직전:
          if (!playGame()) stoppedAt = `경기를 못 끝냈다: ${where()}`
          break
        case SEASON_SCENE_STATE.관중수입:
          act(() => actions.confirmIncome(state.record))
          break
        case SEASON_SCENE_STATE.경기뒤마무리:
          act(() => actions.confirmDayResults())
          break
        case SEASON_SCENE_STATE.시즌결산: {
          // `SeasonSummaryScreen` — 진입마다 리그 1위 G 검사 한 번, 시리즈가 안 끝났으면 [경기], 끝났으면 우승 문구 → 보상
          const entry = session.summaryEntry
          if (entry !== null && handledSummaryEntry !== entry.serial) {
            handledSummaryEntry = entry.serial
            if (session.series !== null && session.series.round === '준플레이오프' && session.series.wins[0] + session.series.wins[1] === 0) {
              yearLog.push(`${state.record.yearIndex + 1}년차 ${session.series.qualifiers.indexOf(state.record.teamId) + 1}시드 (${session.league.wins[state.record.teamId]}승)`)
            }
            const award = nextLeagueFirstAward(state.record, session.leagueFirstAwardedBits)
            if (award !== null) act(() => actions.awardLeagueFirst(award))
            break
          }
          const series = session.series
          if (series !== null && series.round !== '종료') {
            act(() => actions.continuePostseason())
            break
          }
          const reward = koreanSeriesRewardOf(seasonPostseasonRankOf(state.record, session.league, series))
          act(() => actions.finishSeason(reward.messageId === 0 ? null : reward))
          break
        }
        case SEASON_SCENE_STATE.국가대항전: {
          const cup = session.cup
          if (cup === null) {
            stoppedAt = `국가대항전인데 대회가 없다: ${where()}`
            break
          }
          // `NationalCupScreen` — 대진 확인(0xe6f8)이 다음 경기면 순위 → 경기, 끝났으면 결과 → 보상 → 끝
          const next = confirmNationalCupStandings(cup, random)
          if (next.kind === '다음경기') {
            const matchup = nationalCupMatchupOf(cup)
            if (matchup === null) {
              stoppedAt = `대회 다음 경기인데 대진이 없다: ${where()}`
              break
            }
            act(() => actions.playCupGame(matchup.myTeam, matchup.opponent))
          } else {
            act(() => actions.finishCup(finishNationalCup('시즌모드', next.cup)))
          }
          break
        }
        case SEASON_SCENE_STATE.엔딩:
          reachedEnding = true
          act(() => actions.receiveEndingBonus())
          act(() => result.current.actions.finishEnding())
          break
        default:
          stoppedAt = `다룰 줄 모르는 장면: ${where()}`
      }
      if (stoppedAt !== null) break
      checkState()
      if (reachedEnding && result.current.scene === SEASON_SCENE_STATE.관리메뉴) break
    }
    if (steps >= maxSteps) stoppedAt = `걸음 한도 ${maxSteps}: ${where()}`
    checkRoundTrip()
  } finally {
    rendered.unmount()
  }
  const years = (result.current.state?.record.yearIndex ?? 0) - startYear.value + 1
  return { problems, steps, games, years, reachedEnding, stoppedAt, yearLog, extraLog }
}

/** r235 새 길 전부 — G 는 넉넉히(트레이드 비용 칸 1·2 · GP 아이템 · 자동진행을 실제로 밟게) */
const NEW_PATHS: SeasonSoakExtras = {
  trade: true, shop: true, entryEdit: true, startGamePoints: 20_000, reopenEvery: 3, midGameResumeEvery: 4,
}

function report(result: SeasonSoakResult): string {
  return `걸음 ${result.steps} · 경기 정규 ${result.games.정규} · PS ${result.games.포스트시즌} · 대회 ${result.games.국가대항전}`
    + ` · 연차 ${result.years} · 엔딩 ${result.reachedEnding} · [${result.yearLog.join(' / ')}]`
    + `${Object.keys(result.extraLog).length === 0 ? '' : ` · 새 길 ${JSON.stringify(result.extraLog)}`}`
    + `${result.stoppedAt === null ? '' : `\n멈춘 곳: ${result.stoppedAt}`}`
    + (result.problems.size === 0 ? '' : `\n문제 ${result.problems.size}가지:\n${result.problems.report()}`)
}

describe('시즌모드 장기 진행 점검 (soak)', () => {
  it('짧은 판 — 첫 해 6경기를 정책대로 치러도 값이 맞고 저장 왕복이 같다', () => {
    const result = runSeasonSoak({ seed: 2010, teamId: 0, maxRegularGames: 6, roundTripEvery: 1 })
    expect(result.stoppedAt, report(result)).toBeNull()
    expect(result.problems.size, report(result)).toBe(0)
    expect(result.games.정규).toBe(6)
  }, 60_000)

  it('짧은 판 (r235 새 길) — 트레이드 · 상점 · 장비 · 엔트리 편집 · G 지갑 · 관리 메뉴/경기 중간 이어하기를 밟아도 값이 맞는다', () => {
    const result = runSeasonSoak({ seed: 2010, teamId: 3, maxRegularGames: 24, roundTripEvery: 3, extras: NEW_PATHS })
    expect(result.stoppedAt, report(result)).toBeNull()
    expect(result.problems.size, report(result)).toBe(0)
    expect(result.games.정규).toBe(24)
    for (const name of ['엔트리편집', '관리메뉴이어하기', '경기중이어하기', '십전대보탕', '장비투수', '요청수락']) expect(result.extraLog[name] ?? 0, `${name} — ${report(result)}`).toBeGreaterThan(0)
    expect((result.extraLog.트레이드성공 ?? 0) + (result.extraLog.트레이드실패 ?? 0), report(result)).toBeGreaterThan(0)
  }, 60_000)

  for (const seed of soakSeeds([1, 2, 3])) {
    it.runIf(isSoakEnabled())(`긴 판 (r235 새 길) — 씨앗 ${seed}: 트레이드 · 상점 · 엔트리 편집 · 이어하기로 10년차 엔딩까지`, () => {
      const started = Date.now()
      const result = runSeasonSoak({
        seed, teamId: (seed + 2) % 10, extras: NEW_PATHS, roundTripEvery: soakNumber('SOAK_ROUND_TRIP_EVERY', 10),
        ...(soakNumber('SOAK_MAX_GAMES', 0) > 0 ? { maxRegularGames: soakNumber('SOAK_MAX_GAMES', 0) } : {}),
      })
      console.info(`[시즌 soak 새 길] 씨앗 ${seed} · ${(Date.now() - started) / 1000}s · ${report(result)}`)
      expect(result.stoppedAt, report(result)).toBeNull()
      if (soakNumber('SOAK_MAX_GAMES', 0) === 0) expect(result.reachedEnding, report(result)).toBe(true)
      expect(result.problems.size, report(result)).toBe(0)
    }, 3_600_000)
  }

  for (const seed of soakSeeds([1, 2, 3])) {
    it.runIf(isSoakEnabled())(`긴 판 — 씨앗 ${seed} · 훈련만: 사기 0 · 질병 길로 10년차 엔딩까지`, () => {
      const result = runSeasonSoak({ seed, teamId: (seed + 5) % 10, policy: '훈련만', roundTripEvery: soakNumber('SOAK_ROUND_TRIP_EVERY', 10) })
      expect(result.stoppedAt, report(result)).toBeNull()
      expect(result.reachedEnding, report(result)).toBe(true)
      expect(result.problems.size, report(result)).toBe(0)
    }, 3_600_000)
    it.runIf(isSoakEnabled())(`긴 판 — 씨앗 ${seed}: 팀 고르기부터 10년차 엔딩까지`, () => {
      const started = Date.now()
      const result = runSeasonSoak({ seed, teamId: seed % 10, roundTripEvery: soakNumber('SOAK_ROUND_TRIP_EVERY', 10) })
      console.info(`[시즌 soak] 씨앗 ${seed} · ${(Date.now() - started) / 1000}s · ${report(result)}`)
      expect(result.stoppedAt, report(result)).toBeNull()
      expect(result.reachedEnding, report(result)).toBe(true)
      expect(result.years, report(result)).toBe(FINAL_YEAR_INDEX + 1)
      expect(result.problems.size, report(result)).toBe(0)
    }, 3_600_000)
  }
})

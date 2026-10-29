import { startingMoundOf } from '@/entities/game/model/simulateHalfInning'
import type { HalfInningMound } from '@/entities/game/model/simulateHalfInning'
import { rosterLineupOf } from '@/entities/game/model/quickLineup'
import type { QuickLineup } from '@/entities/game/model/quickLineup'
import type { QuickAtBatBatter, QuickAtBatPitcher } from '@/entities/game/model/quickAtBat'
import { BATTERS_PER_TEAM, rollStartingPitcherIndex, startingPitcherOf } from '@/entities/team/model/teamRoster'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { LeagueAbilityContext } from '@/entities/league/model/leagueDay/ability/abilityContext'
import { gameQuickBatterOf } from '@/entities/league/model/leagueDay/ability/cpuGameAbility'
import { aceBatterOf, acePitcherOf, withAceBatterLineup } from '@/entities/league/model/leagueDay/aces/acePlayers'
import type { LeagueAcePitcher } from '@/entities/league/model/leagueDay/aces/acePlayers'
import { ACE_BATTER_ROSTER_SLOT, ACE_PITCHER_SLOT, ALL_PITCHER_SLOTS } from '@/entities/league/model/leagueDay/roster/slots'
import { recordBatterAt, recordQuickPitcherAt } from '@/entities/league/model/leagueDay/roster/teamRecord'
import type { LeagueTeamRecord } from '@/entities/league/model/leagueDay/roster/teamRecord'
import type { LeagueGameAces, LeagueGameExtras } from '@/entities/league/model/leagueDay/types/leagueGameExtras'
import type { LeagueMatchup } from '@/entities/league/model/leagueDay/schedule/matchups'

/**
 * 한 명단(원정 · 홈)이 경기 내내 들고 다니는 칸 — 팀 객체 `team+…` 와 그 팀 레코드. 반 이닝마다
 * `playLeagueHalfInning` 이 마운드 · 명단 · 타순 커서 · 점수 · 스태미나 표를 고친다.
 */
export interface LeagueGameSide {
  readonly teamId: number
  /** 팀 레코드 선수 배열 — 트레이드로 바뀐 팀만 (`LeagueTeamRecord`) */
  readonly record: LeagueTeamRecord | undefined
  readonly acePitcher: LeagueAcePitcher | undefined
  /** 투수 레코드 차례 — 벤치를 이 차례로 훑는다 (`LeagueGameExtras.pitcherOrders`) */
  readonly pitcherOrder: readonly number[]
  /** 투수 칸별 스태미나 +0x2c — `sharedRoster` 면 두 명단이 **같은 배열**을 깎는다 */
  readonly staminas: number[]
  /** 선발 능력 기본값 — 수비 쪽을 넘기지 않는 길(포스트시즌 한 경기 등)의 투수. 실제 마운드는 `defenseOf` 가 칸으로 다시 집는다 */
  readonly startingPitcher: QuickAtBatPitcher
  /** 간이 타석의 타자 — `0xb570c(…, 1, 90, 1)` 밑값 위에 팀 능력치 정액 · 코치 (`cpuBatterGameAbilityOf`) */
  readonly batterOf: (slot: number) => QuickAtBatBatter
  mound: HalfInningMound
  /** 명단 `team+0xe` — CPU 대타(0xac228)가 들어오면 바뀐다 */
  lineup: QuickLineup
  /** 타순 커서 `team+0x32` (mod 9) */
  battingOrder: number
  runs: number
}

export interface LeagueGameSides {
  readonly away: LeagueGameSide
  readonly home: LeagueGameSide
  readonly sharedRoster: boolean
}

/** 선발 칸 — 수 하나면 양 팀 같은 칸, 명단별 칸, 안 주면 `rand(0,4)` (팀마다 한 번씩, 원정 먼저) */
type StartingPitcherSlot = number | { readonly away: number; readonly home: number } | undefined

/**
 * 두 명단을 세운다 — 차례는 원본 경기 세우기 그대로다: 마선수(굴림 없음) → 선발 칸(원정 · 홈 차례로 굴릴 수 있다) →
 * 스태미나 표(마투수 8번 칸은 레코드 +0x2c, 0xb521c) → 마운드 · 명단.
 */
export function createLeagueGameSides(
  matchup: LeagueMatchup,
  random: RandomPort,
  startingPitcherSlot: StartingPitcherSlot,
  startingStaminas: StartingStaminas | undefined,
  extras: LeagueGameExtras | undefined,
): LeagueGameSides {
  const aces = aceSeatsOfSides(extras)
  // 선발은 경기를 세울 때 로스터 앞 4명 중 하나로 정해진다 (0x3107a·0x31090, S13 1-4b)
  // 칸 번호를 먼저 정해 두는 것은 **투수 기록을 그 칸에 쌓아야** 하기 때문이다. 난수를 부르는 횟수·순서는 예전과 같다
  const awaySlot = startingSlotOf(startingPitcherSlot, 'away', random)
  const homeSlot = startingSlotOf(startingPitcherSlot, 'home', random)
  const sharedRoster = extras?.sharedRoster === true
  const orders = pitcherOrdersOf(extras, sharedRoster)
  const staminas = staminaTablesOf(startingStaminas, sharedRoster)
  seatAcePitcherStamina(staminas.away, aces.away.pitcher)
  seatAcePitcherStamina(staminas.home, aces.home.pitcher)
  const context = extras?.abilityContext
  const records = extras?.records
  return {
    away: createSide(matchup.away, records?.away, aces.away, awaySlot, staminas.away, orders.away, context),
    home: createSide(matchup.home, records?.home, aces.home, homeSlot, staminas.home, orders.home, context),
    sharedRoster,
  }
}

type StartingStaminas = { readonly away?: readonly number[]; readonly home?: readonly number[] }

/** 명단마다 한 벌 — 원정 · 홈 */
interface PerSide<T> {
  readonly away: T
  readonly home: T
}

interface AceSeats {
  readonly batter: QuickAtBatBatter | undefined
  readonly pitcher: LeagueAcePitcher | undefined
}

function aceSeatsOfSides(extras: LeagueGameExtras | undefined): PerSide<AceSeats> {
  const levels = extras?.aceLevels
  const aces = extras?.aces
  return { away: aceSeatsOf(aces?.away, levels), home: aceSeatsOf(aces?.home, levels) }
}

function aceSeatsOf(aces: LeagueGameAces | undefined, levels: Readonly<Record<number, number>> | undefined): AceSeats {
  if (aces === undefined) return { batter: undefined, pitcher: undefined }
  return { batter: aceBatterOf(aces.batter, levels), pitcher: acePitcherOf(aces.pitcher, levels) }
}

function startingSlotOf(given: StartingPitcherSlot, side: 'away' | 'home', random: RandomPort): number {
  if (typeof given === 'object') return given[side]
  return given ?? rollStartingPitcherIndex(random)
}

/** 명단마다의 투수 레코드 차례 — 한 레코드를 같이 쓰면(\`sharedRoster\`) 홈도 원정 차례다 */
function pitcherOrdersOf(extras: LeagueGameExtras | undefined, sharedRoster: boolean): PerSide<readonly number[]> {
  const orders = extras?.pitcherOrders
  const away = orders?.away ?? ALL_PITCHER_SLOTS
  return { away, home: sharedRoster ? away : (orders?.home ?? ALL_PITCHER_SLOTS) }
}

/** 명단마다의 스태미나 표 — 한 레코드를 같이 쓰면 두 명단이 **같은 배열**을 깎는다 */
function staminaTablesOf(given: StartingStaminas | undefined, sharedRoster: boolean): PerSide<number[]> {
  const away = staminaTableOf(given?.away)
  return { away, home: sharedRoster ? away : staminaTableOf(given?.home) }
}

/** 마투수는 팀 레코드 8번 칸에 레코드째 들어온다 — 그 +0x2c 로 선다 (0xb521c) */
function seatAcePitcherStamina(staminas: number[], acePitcher: LeagueAcePitcher | undefined): void {
  if (acePitcher !== undefined) staminas[ACE_PITCHER_SLOT] = acePitcher.stamina
}

/** 투수 칸별 스태미나 — 모자란 칸은 가득 */
function staminaTableOf(given: readonly number[] | undefined): number[] {
  return ALL_PITCHER_SLOTS.map((slot) => given?.[slot] ?? FULL_STAMINA)
}

function createSide(
  teamId: number,
  record: LeagueTeamRecord | undefined,
  aces: AceSeats,
  startingSlot: number,
  staminas: number[],
  pitcherOrder: readonly number[],
  context: LeagueAbilityContext | undefined,
): LeagueGameSide {
  const aceBatter = aces.batter
  // 마타자는 첫 벤치 칸(9번)에 앉는다 — 원본에서 마타자가 타석에 서는 길은 CPU 대타뿐이다
  const roster = rosterLineupOf(BATTERS_PER_TEAM)
  return {
    teamId,
    record,
    acePitcher: aces.pitcher,
    pitcherOrder,
    staminas,
    startingPitcher: record === undefined ? startingPitcherOf(teamId, startingSlot) : recordQuickPitcherAt(record, teamId, startingSlot),
    batterOf: (slot) =>
      gameQuickBatterOf(
        slot === ACE_BATTER_ROSTER_SLOT && aceBatter !== undefined ? aceBatter : recordBatterAt(teamId, record, slot),
        teamId,
        context,
      ),
    mound: startingMoundOf(startingSlot, staminas[startingSlot]),
    lineup: aceBatter === undefined ? roster : withAceBatterLineup(roster),
    battingOrder: 0,
    runs: 0,
  }
}

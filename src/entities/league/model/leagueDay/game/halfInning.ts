import { simulateHalfInning } from '@/entities/game/model/simulateHalfInning'
import type { HalfInningMound, HalfInningResult } from '@/entities/game/model/simulateHalfInning'
import { isGameOverAt } from '@/entities/game/model/gameState'
import type { DecisionState } from '@/entities/game/model/winLossSave'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { LeagueAbilityContext } from '@/entities/league/model/leagueDay/ability/abilityContext'
import { decisionsAfterHalfInning } from '@/entities/league/model/leagueDay/game/decisions'
import { leagueDefenseOf, withStaleMorale } from '@/entities/league/model/leagueDay/game/defense'
import type { LeagueGameSide, LeagueGameSides } from '@/entities/league/model/leagueDay/game/gameSides'
import { chargeDefense, collectOffense } from '@/entities/league/model/leagueDay/game/gameTally'
import type { LeagueGameTally } from '@/entities/league/model/leagueDay/game/gameTally'
import { ACE_BATTER_ROSTER_SLOT, AWAY_SIDE, BATTING_ORDER_SIZE, HOME_SIDE } from '@/entities/league/model/leagueDay/roster/slots'
import { recordBatterAt } from '@/entities/league/model/leagueDay/roster/teamRecord'

/** 경기 한 판의 진행 칸 — 두 명단 · 기록 모음 · 승패세 칸 · 공용 칸 */
export interface LeagueGameRun extends LeagueGameSides {
  readonly random: RandomPort
  readonly abilityContext: LeagueAbilityContext | undefined
  readonly tally: LeagueGameTally
  /** CPU 대타 막음 칸 `state[0xe]` — 두 팀 공용 한 칸 */
  pinchHitUsed: boolean
  /** 승·패·세 칸 `state+0x44..+0x64` — 경기 상태 초기화 0xb6814 가 셋 다 2(없음)로 둔다 */
  decision: DecisionState
  /** 원정 팀 레코드 +2 를 이 경기에서 0xb570c 가 덮었는가 — 1회초 공격 중에만 갈린다 (`HalfInningResult.offenseRecordTouched`) */
  awayRecordTouched: boolean
}

// CPU 대타 0xac228 은 타석 타자가 마선수(0xb633c)면 안 낸다 — 대타로 들어선 마타자는 다시 안 바뀐다.
// 마타자 칸(12)은 마선수를 넣은 명단에만 있다
const isAceRosterSlot = (slot: number) => slot === ACE_BATTER_ROSTER_SLOT

/**
 * 반 이닝 하나 — 간이 엔진 `0xc262c` 를 3아웃(또는 경기 끝)까지 돌리고, 그 결과를 승패세 판정 · 점수 · 타순 · 스태미나 표 ·
 * 마운드 · 명단 · 기록 모음에 차례대로 적는다. 굴림은 `simulateHalfInning` 안에서만 나간다.
 */
export function playLeagueHalfInning(game: LeagueGameRun, inning: number, half: '초' | '말'): HalfInningResult {
  const isTop = half === '초'
  const offense = isTop ? game.away : game.home
  const defense = isTop ? game.home : game.away
  const offenseSide = isTop ? AWAY_SIDE : HOME_SIDE
  defense.mound = resyncedMound(game, defense.mound, defense.staminas)
  const scoresBefore: [number, number] = [game.away.runs, game.home.runs]
  const result = simulateHalfInning(
    offense.battingOrder,
    (order) => recordBatterAt(offense.teamId, offense.record, order % BATTING_ORDER_SIZE),
    defense.startingPitcher,
    inning,
    game.random,
    undefined,
    // 0xc2198 c21d6 — 타석마다 경기 끝 판정 0xb68fc
    { endsGame: ({ runs, outs }) => isGameOverAt({ inning, half, outs, ...scoresWithRuns(game, isTop, runs) }) },
    withStaleMorale(
      leagueDefenseOf(defense, defense.runs - offense.runs, game.abilityContext, {
        inningIndex: inning - 1,
        sideTeamIds: [game.away.teamId, game.home.teamId],
        scoresBefore,
        offenseSide,
      }),
      staleMoraleOf(game, inning, isTop),
    ),
    { lineup: offense.lineup, batterOf: offense.batterOf, pinchHitUsed: game.pinchHitUsed, isAceRosterSlot },
  )
  game.decision = decisionsAfterHalfInning(game.decision, result, {
    inningIndex: inning - 1,
    offenseSide,
    scoresBefore,
    offenseMoundSlot: offense.mound.pitcherSlot,
    defenseMoundSlot: defense.mound.pitcherSlot,
  })
  applyHalfInningResult(game, offense, defense, result)
  if (isTop && result.offenseRecordTouched) game.awayRecordTouched = true
  return result
}

/** 반 이닝 결과를 두 명단 · 기록 모음에 적는다 */
function applyHalfInningResult(game: LeagueGameRun, offense: LeagueGameSide, defense: LeagueGameSide, result: HalfInningResult): void {
  offense.runs += result.runs
  offense.battingOrder = result.nextBattingOrderIndex % BATTING_ORDER_SIZE
  // 반 이닝이 내놓은 교체(내려간 투수 값)와 끝 마운드를 칸별 표에 되적는다
  for (const change of result.pitcherChanges ?? []) defense.staminas[change.outgoingPitcherSlot] = change.outgoingStamina
  if (result.mound !== undefined) defense.staminas[result.mound.pitcherSlot] = result.mound.stamina
  defense.mound = result.mound ?? defense.mound
  offense.lineup = result.lineup ?? offense.lineup
  game.pinchHitUsed = result.pinchHitUsed ?? game.pinchHitUsed
  collectOffense(game.tally, offense, result)
  chargeDefense(game.tally, defense.teamId, result)
}

/** 같은 레코드를 쓰면 마운드 값이 다른 쪽 반 이닝에 깎였을 수 있다 — 표(레코드)의 값으로 다시 선다 */
function resyncedMound(game: LeagueGameRun, mound: HalfInningMound, table: readonly number[]): HalfInningMound {
  return game.sharedRoster ? { ...mound, stamina: table[mound.pitcherSlot] ?? mound.stamina } : mound
}

/** 경기 끝 판정에 넘길 점수 — 이번 반 이닝 득점을 공격 쪽에 얹는다 */
function scoresWithRuns(game: LeagueGameRun, isTop: boolean, runs: number): { readonly awayScore: number; readonly homeScore: number } {
  if (isTop) return { awayScore: game.away.runs + runs, homeScore: game.home.runs }
  return { awayScore: game.away.runs, homeScore: game.home.runs + runs }
}

/**
 * 수비 팀 첫 투수 첫 공이 볼 레코드 +2 앞 값 (`LeagueAbilityContext.staleRecordMorales`).
 * 1회초는 홈 팀. 원정 팀 첫 투수 첫 공도 앞 값일 수 있다 — 1회초에 그 팀(공격)을 0xb570c 가 한 번도 안 덮었으면(스윙 경로 0xab214 ·
 * 주자 있는 판정 경로 c19ec 가 없던 반 이닝) 1회말 첫 공의 소모 c26cc 가 c1446 · c1852 보다 먼저라 레코드에 남은 값을 본다 (r104).
 * 두 팀이 한 레코드면(`sharedRoster`) 1회초 첫 공의 c1446 이 이미 덮었다
 */
function staleMoraleOf(game: LeagueGameRun, inning: number, isTop: boolean): number | undefined {
  const morales = game.abilityContext?.staleRecordMorales
  if (isTop) return morales?.[game.home.teamId]
  const isAwayRecordStale = inning === 1 && !game.awayRecordTouched && !game.sharedRoster
  return isAwayRecordStale ? morales?.[game.away.teamId] : undefined
}

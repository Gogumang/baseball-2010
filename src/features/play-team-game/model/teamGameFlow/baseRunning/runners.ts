import { type GameState, runnersOfGame } from '@/entities/game/model/gameState'
import { runnerTeamGradeFor } from '@/features/play-team-game/model/teamGameRoster'
import type { ControlSide } from '@/entities/defense-controls/model/defenseKeys'
import { runnerOnBase } from '@/entities/game/model/baseRunners'
import { abilityContextOf } from '@/features/play-team-game/model/teamGameFlow/context/abilityContext'
import { runAbilityFor } from '@/features/play-team-game/model/teamGameFlow/roster/batters'
import { isOurOffense } from '@/features/play-team-game/model/teamGameFlow/turn/turns'
import { BATTING_ORDER_SIZE } from '@/features/play-team-game/model/teamGameFlow/types/constants'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

export function hasRunnerOn(bases: GameState['bases'], base: number): boolean {
  return base === 1 ? bases.first : base === 2 ? bases.second : base === 3 ? bases.third : false
}

/** 판정 입력(st[0x14 + i])만 거둔다 — 표시(`stealDisplayFrom`)는 0xf 진입 · 타구 판 시작까지 남는다 */
export function withoutSteal(progress: TeamGameProgress): TeamGameProgress {
  return progress.stealingFrom.length === 0 ? progress : { ...progress, stealingFrom: [] }
}

/** 판정 입력과 표시를 함께 지운다 — 0xf 진입 3d966~3d976 · 타구 판(종류 1) 시작 리드 0x3d7b8 3d8c6~3d8d2 */
export function withoutStealDisplay(progress: TeamGameProgress): TeamGameProgress {
  const cleared = withoutSteal(progress)
  return (cleared.stealDisplayFrom ?? []).length === 0 ? cleared : { ...cleared, stealDisplayFrom: [] }
}

/**
 * 루별 주자 주루 (경기용 칸 3) — 0 은 지금 타자(낫아웃 타자주자). 루의 주자는 신원(`GameState.runners`, 원본 주자 목록 —
 * 공격 팀 타순 칸)대로다. 신원이 루 상황과 어긋나는 옛 상태만 예전 근사(타순을 거꾸로 센다)로 본다.
 */
/**
 * **주자 속도의 팀 등급** — 주자 만들기 0xa93ac a9488: 전역 모드 1·2·8 이면 `0xbbe98(s16 팀레코드+0xa)`.
 * 팀레코드는 주자의 팀(공격 팀)이다 — 루 위 주자 0xa9a10(a9a3e) · 타자주자 0x46418(4650e) 모두 공격 팀 `0xb8680(팀)`.
 * 모드 9(대전 이벤트)는 0 이다(수비 보너스 b10d0 과 다르다).
 */
export function offenseRunnerTeamGradeOf(progress: TeamGameProgress, ourOffense: boolean): number {
  const { options } = progress
  return runnerTeamGradeFor(abilityContextOf(options), ourOffense ? options.ourTeamId : options.opponentTeamId)
}

export function runAbilitiesOnBaseOf(progress: TeamGameProgress, humanSide: ControlSide): Partial<Record<0 | 1 | 2 | 3, number>> {
  const ours = humanSide === '공격'
  const teamId = ours ? progress.options.ourTeamId : progress.options.opponentTeamId
  const order = ours ? progress.game.battingOrderIndex : progress.opponentOrderIndex
  const runners = runnersOfGame(progress.game, order)
  const runs: Partial<Record<0 | 1 | 2 | 3, number>> = {
    0: runAbilityFor(progress, teamId, ((order % BATTING_ORDER_SIZE) + BATTING_ORDER_SIZE) % BATTING_ORDER_SIZE),
  }
  for (const base of [1, 2, 3] as const) {
    const runner = runnerOnBase(runners, base)
    if (runner !== null) runs[base] = runAbilityFor(progress, teamId, runner)
  }
  return runs
}

/**
 * 타석 화면 HUD 의 루별 주자 주력 — 0x35b94 상태 0xe 주루 칸(35f74)이 0xb570d(ctx, 3, 주자, 1, 90, 1) 로 읽는다.
 * 사람이 치는 타석(우리 공격)의 주자는 우리 팀 신원(`runAbilitiesOnBaseOf`)대로다.
 */
export function runnerRunAbilitiesOf(progress: TeamGameProgress): Partial<Record<'first' | 'second' | 'third', number>> {
  const runs = runAbilitiesOnBaseOf(progress, isOurOffense(progress) ? '공격' : '수비')
  return {
    ...(runs[1] === undefined ? {} : { first: runs[1] }),
    ...(runs[2] === undefined ? {} : { second: runs[2] }),
    ...(runs[3] === undefined ? {} : { third: runs[3] }),
  }
}

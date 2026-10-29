import { MISSION_ACE_ROSTER_SLOT, masterGameAbilityOf } from '@/entities/mission/model/missionCpuTeam'
import { MISSION_NARI_RECORD } from '@/entities/mission/model/missionGame'
import { missionBatterSlotOf, offenseOf, rowAtRecord } from '@/entities/mission/model/missionRunners/offense'
import { rosterSlotAt, runnerOnBase, teamBatters } from '@/entities/mission/model/missionRunners/otherSlices'
import { missionRunnersOf } from '@/entities/mission/model/missionRunners/runners/identity'
import { DEFAULT_RUN_ABILITY, type MissionRunnerSituation, type MissionSpecialRunners } from '@/entities/mission/model/missionRunners/types'

/** 경기용 칸 3 = 주력 */
const RUN_SLOT = 3

/** 미션 타자 · 마타자 칸이면 부르는 쪽이 넘긴 값 (모르면 기본 주루), 마스터 줄이면 undefined */
function specialRunOf(row: number, special: MissionSpecialRunners): number | undefined {
  if (row === MISSION_NARI_RECORD) return special.missionBatterRun ?? DEFAULT_RUN_ABILITY
  if (row === MISSION_ACE_ROSTER_SLOT) return special.aceBatterRun ?? DEFAULT_RUN_ABILITY
  return undefined
}

/**
 * **그 타순 칸 선수의 경기용 주력** `0xb570d(ctx, 3, 선수, 1, 90, 1)` — 마스터 줄은 0xb570c 첫머리 b5728 의 `0xb6415(선수, 3, 1)`
 * (장비 니블 · 장착 스킬 보정, 모드 5 · 6 은 모드 갈래 · 팀 능력치 마스크를 안 타고 체력 인자 90 은 피로 감소가 없다 —
 * `masterGameAbilityOf`). 미션 타자 · 마타자 칸이면 부르는 쪽이 넘긴 값.
 */
export function missionRunnerRunAt(run: MissionRunnerSituation, slot: number, special: MissionSpecialRunners = {}): number {
  const offense = offenseOf(run)
  if (offense === null) return DEFAULT_RUN_ABILITY
  const row = rowAtRecord(offense, rosterSlotAt(offense.lineup, slot))
  const specialRun = specialRunOf(row, special)
  if (specialRun !== undefined) return specialRun
  const player = teamBatters(offense.teamId)[row]
  return player === undefined ? DEFAULT_RUN_ABILITY : masterGameAbilityOf(player, false, RUN_SLOT)
}

/** 루별 주자 주력 (0 = 지금 타자 — 낫아웃 타자주자) — 공 도착 판(도루 · 폭투) · CPU 도루 출발이 읽는다 */
export function missionRunAbilitiesOnBaseOf(
  run: MissionRunnerSituation,
  special: MissionSpecialRunners = {},
): Partial<Record<0 | 1 | 2 | 3, number>> {
  const runners = missionRunnersOf(run)
  const runs: Partial<Record<0 | 1 | 2 | 3, number>> = { 0: missionRunnerRunAt(run, missionBatterSlotOf(run), special) }
  for (const base of [1, 2, 3] as const) {
    const runner = runnerOnBase(runners, base)
    if (runner !== null) runs[base] = missionRunnerRunAt(run, runner, special)
  }
  return runs
}

/** 타석 화면 HUD 의 루별 주자 주력 — 0x35b94 상태 0xe 주루 칸(35f74 `0xb570d(ctx, 3, 주자, 1, 90, 1)`) */
export function missionRunnerRunAbilitiesOf(
  run: MissionRunnerSituation,
  special: MissionSpecialRunners = {},
): Partial<Record<'first' | 'second' | 'third', number>> {
  const runs = missionRunAbilitiesOnBaseOf(run, special)
  return {
    ...(runs[1] === undefined ? {} : { first: runs[1] }),
    ...(runs[2] === undefined ? {} : { second: runs[2] }),
    ...(runs[3] === undefined ? {} : { third: runs[3] }),
  }
}

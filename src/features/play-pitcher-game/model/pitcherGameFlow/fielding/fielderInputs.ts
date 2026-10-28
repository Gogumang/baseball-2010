import { runnersOfGame } from '@/entities/game/model/gameState'
import { type DrawnFieldingError, fielderRecordIndexOf, fieldingErrorRecordsOf } from '@/features/defense-play/model/fieldingErrors'
import { runnerOnBase } from '@/entities/game/model/baseRunners'
import { ACE_BATTER_ROSTER_SLOT } from '@/features/play-game/model/gameAces'
import { skillIdsOfBits, teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import { rosterSlotAt } from '@/entities/game/model/quickLineup'
import { defenseAbilitiesOf, defenseFielderPlatesOf, defenseSkillIdsOf } from '@/features/defense-play/model/runDefensePlay'
import type { RunnerAces } from '@/features/defense-play/model/runnerAces'
import { fielderRecordsAtPlayStart, type FielderRecordSeat } from '@/entities/fielding/model/fielderRecords'
import { opponentBatterAbility } from '@/features/play-pitcher-game/model/pitcherGameFlow/roster/opponentBatters'
import { acePitcherSlotOf, teamAcePitcherOf, teamAcesOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/roster/pitcherOrder'
import { MY_PITCHER_SLOT } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/constants'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/**
 * 수비 아홉 칸의 **이름 판 선수** (0x43cb0 — `defenseFielderPlatesOf`) — 칸 고르기는 `myDefenseAbilitiesOf` 와 같다.
 *
 * 칸 0 은 **수비 팀의 지금 마운드 투수**다 — 0x43cb0 은 공 가진 야수 +0x88 이 0(투수)이면 야수 +0xec 를 안 보고
 * `0xae83c(팀[st[0xa]])` = `0xb89dc(팀, 팀[0])`(43e48~43e60) 로 레코드를 다시 찾고 보직은 `0xb6dec`(43e6a, 레코드 +0xb & 3) 다.
 * - 내가 마운드에 서 있으면(또는 강판 교체 0xc1b48 이 벤치가 비어 못 바꿔 팀[0] 이 내 줄 그대로면) 나 — 이름 `myName` · 보직 `role`.
 * - 강판 뒤 팀[0] 은 교체 0xac428 이 고른 **교체 투수 레코드**다(`ourMound.pitcherSlot`) — 로스터 투수면 이름 + 보직(+0xb & 3),
 *   마투수 칸이면 이름만(보직 없음 → 판 없음, 타자편 `opponentFielderPlatesOf` 와 같다).
 * ⚠️ 모드 3 은 강판 뒤 늘 간이 엔진(0x21 — 0xc1eac 가 0xc1d38 거짓으로 자동)이라 수비 화면이 안 서서 실제로는 그려지지 않는다.
 */
/**
 * 수비 그림이 올린 실책(+0x2e, `features/defense-play/model/fieldingErrors`)을 리그 기록 재료에 얹는다 — 화면이 판 끝에 넘긴다.
 * 야수 +0xec 는 그림이 실은 레코드(판 입력 `fielderRecords` — `myFielderRecordsOf`)다: 칸 1..8 은 우리 명단에서 자리 니블이 칸 + 1 인
 * 첫 타자, 칸 0 은 1회초 판이 넣은 지명타자라 내 투수의 실책도 지명타자에게 붙고, 판이 안 섰으면 0 이라 안 쌓인다.
 * 그림의 수비 팀이 우리가 아니면 버린다.
 */
export function recordDrawnPitcherFieldingErrors(progress: PitcherGameProgress, drawn: readonly DrawnFieldingError[]): PitcherGameProgress {
  const teamId = progress.options.ourTeamId
  const lineup = teamBatters(teamId)
  const ourDrawn = drawn.filter((error) => error.teamIndex === teamId)
  const errors = fieldingErrorRecordsOf(ourDrawn, (error) => {
    const index = fielderRecordIndexOf(lineup, error.slot)
    return index < 0 ? null : { teamId, battingOrderIndex: index }
  })
  if (errors.length === 0) return progress
  return { ...progress, leagueErrors: [...(progress.leagueErrors ?? []), ...errors] }
}

export function myFielderPlatesOf(progress: PitcherGameProgress) {
  return defenseFielderPlatesOf(teamBatters(progress.options.ourTeamId), ourMoundPlateOf(progress))
}

/** 수비 판 칸 0 — 우리 마운드의 지금 투수 (`0xae83c` → 이름 0xb62c0 · 보직 0xb6dec) */
function ourMoundPlateOf(progress: PitcherGameProgress): { readonly name: string; readonly role?: number } | undefined {
  const slot = progress.ourMound.pitcherSlot
  if (progress.onMound || slot === MY_PITCHER_SLOT) {
    const myName = progress.options.myName
    return myName === undefined ? undefined : { name: myName, role: progress.options.role }
  }
  if (slot === acePitcherSlotOf(true)) {
    const ace = teamAcePitcherOf(progress.options, true)
    return ace === undefined ? undefined : { name: ace.player.name }
  }
  const pitcher = teamPitchers(progress.options.ourTeamId)[slot]
  return pitcher === undefined ? undefined : { name: pitcher.name, role: pitcher.profile & 3 }
}

/**
 * 상대 타자 · 루 위 주자의 **마선수 번호** (`runnerAces` — 주자 그림 0x79d10 · 적재 0x483a0). 명단 칸이 마타자 칸이면 142 가 넣은 마타자.
 */
export function opponentRunnerAcesOf(progress: PitcherGameProgress): RunnerAces {
  const ace = teamAcesOf(progress.options, false).batter
  const aceOf = (slot: number | null) =>
    slot !== null && ace >= 0 && rosterSlotAt(progress.opponentLineup, slot) === ACE_BATTER_ROSTER_SLOT ? ace : null
  const runners = runnersOfGame(progress.game, progress.opponentOrderIndex)
  return {
    batter: aceOf(progress.opponentOrderIndex),
    first: aceOf(runnerOnBase(runners, 1)),
    second: aceOf(runnerOnBase(runners, 2)),
    third: aceOf(runnerOnBase(runners, 3)),
  }
}

/**
 * 수비 아홉 칸 — 우리 팀. 칸 0(투수 = 나)은 판 시작 0xb0fb4 가 선수를 찾지 않아(b1032) 진행기가 고정값으로 둔다
 * (송구 g = 2 · 악송구 보정 8 · 펌블 0 — `fielderAbilityOf`). 견제 · 공 도착 판도 같은 값을 쓴다.
 */
export function myDefenseAbilitiesOf(progress: PitcherGameProgress): readonly (number | null)[] {
  const abilities: (number | null)[] = defenseAbilitiesOf(
    teamBatters(progress.options.ourTeamId).map((player) => ({
      position: player.position,
      defense: player.ability[2],
    })),
  )
  // 칸 0 은 +0xec(1회초 판이 넣은 지명타자) — 비었으면 null(펌블 0 · 레이저 굴림 없음). 모드 3 이라 팀 보정이 없어 레코드 밑값이다
  const seat = myFielderRecordsOf(progress)[0]
  abilities[0] = seat == null ? null : (teamBatters(seat.teamId)[seat.index]?.ability[2] ?? null)
  return abilities
}

/** 수비 아홉 칸의 스킬 번호 — `myDefenseAbilitiesOf` 와 같은 칸 고르기(레이저 0x66a8c · 필살수비의 초감각 21, `defenseSkillIdsOf`) */
export function myFielderSkillIdsOf(progress: PitcherGameProgress): (readonly number[])[] {
  const skills = defenseSkillIdsOf(
    teamBatters(progress.options.ourTeamId).map((player) => ({
      position: player.position,
      skillIds: skillIdsOfBits(player.skillBits, false),
    })),
  )
  // 칸 0 — 66ad4 0xb62b4(+0xec, 0x15) 도 +0xec 레코드에 묻는다
  const seat = myFielderRecordsOf(progress)[0]
  const seatPlayer = seat == null ? undefined : teamBatters(seat.teamId)[seat.index]
  skills[0] = seatPlayer === undefined ? [] : skillIdsOfBits(seatPlayer.skillBits, false)
  return skills
}

/** `teamId` 레코드 차례 칸 `index` 의 +0xec 자리 — 실책 열쇠는 그 타순 칸 */
export function fielderSeatOf(teamId: number, index: number): FielderRecordSeat {
  return { teamId, index, errorKey: { teamId, battingOrderIndex: index } }
}

/** 판 시작 0xb0fb4 뒤의 야수 +0xec 아홉 칸 — 투수편 수비 판의 수비 팀은 늘 우리다. 칸 0 은 진행기가 든 값(`fielderRecords`) */
export function myFielderRecordsOf(progress: PitcherGameProgress): readonly (FielderRecordSeat | null)[] {
  const teamId = progress.options.ourTeamId
  return fielderRecordsAtPlayStart(progress.fielderRecords, teamBatters(teamId), (index) => fielderSeatOf(teamId, index))
}

/**
 * 루별 주자 주루 — 0 은 지금 타자(낫아웃 타자주자). 루의 주자는 신원(`GameState.runners`, 원본 주자 목록 — 상대 타순 칸)대로
 * 그 칸에 지금 선 로스터 선수다. 신원이 루 상황과 어긋나는 옛 상태만 예전 근사(상대 타순을 거꾸로 센다)로 본다.
 */
export function runAbilitiesOnBaseOf(progress: PitcherGameProgress): Partial<Record<0 | 1 | 2 | 3, number>> {
  const runOf = (slot: number) => opponentBatterAbility(progress.options, rosterSlotAt(progress.opponentLineup, slot)).run
  const runners = runnersOfGame(progress.game, progress.opponentOrderIndex)
  const runs: Partial<Record<0 | 1 | 2 | 3, number>> = { 0: runOf(progress.opponentOrderIndex) }
  for (const base of [1, 2, 3] as const) {
    const runner = runnerOnBase(runners, base)
    if (runner !== null) runs[base] = runOf(runner)
  }
  return runs
}

/** 루별 주루 표에서 루 위 주자 칸(1~3)만 — 견제 판 입력(`PickoffPlayInput.runAbilities`) */
export function runnerRunsOnBaseOf(runs: Partial<Record<0 | 1 | 2 | 3, number>>): Partial<Record<1 | 2 | 3, number>> {
  const onBase: Partial<Record<1 | 2 | 3, number>> = {}
  for (const base of [1, 2, 3] as const) {
    const run = runs[base]
    if (run !== undefined) onBase[base] = run
  }
  return onBase
}

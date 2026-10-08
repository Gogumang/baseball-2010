import type { RandomPort } from '@/shared/api/random/randomPort'
import type { SeasonPlayer, SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import { seasonPlayerEquipmentOf } from '@/entities/season-mode/model/seasonPlayerRecord'

/**
 * **새 해 CPU 선수 장비 굴림 `0x665e8`** — 새 해 0x6e0c 가 연차 +1 · 사기 100 · SR+0x187 = 0 뒤, CPU 능력치 +30 고리 앞에서
 * `0x665e8([0x1552cfc], SR+0xb3(새 연차), SR[1](내 팀))` 을 부른다(6eb4~6ec6, 직접 떴다).
 *
 * ```
 * 0x665e8(g, y, 팀)   r4 = y + 1
 *   [0x1552d10] == 2(시즌) 이면 r4 > 10 → 끝, 그 밖 r4 > 13 → 끝
 *   아래 열 줄을 차례로 — 조건이 맞는 줄마다 0x66530(g, 타자?, 부위, 기준 = s8 표[r4 − c], 칸, 팀)
 * 0x66530             i = 0..9 (i == 내 팀 건너뜀):
 *                       레코드 = 0x1f571(전역, i)(시즌) · 선수 = 타자? 0xb53d1(레코드, 칸) : 0xb51fd(레코드, 칸)
 *                       v = 기준 + bfa55 rand(0, 2)
 *                       바이트 +0x19 + 부위/2 = (바이트 & (0xf << (부위%2)·4)) | ((v + 1) << ((부위+1)%2)·4)
 * ```
 * 곧 부위 t 의 니블(짝수 t 윗니블 — `SeasonPlayer.equipment[t]`)에 `기준 + rand + 1` 을 쓰고 같은 바이트의 다른 니블은 둔다.
 * 표 값은 0~3 이라 니블은 1~5 (넘침 없음). 칸은 **팀 레코드 배열의 칸**이다 — 투수 배열은 로테이션 0xb5ca8 로 섞여 있어
 * 부르는 쪽이 레코드 칸 → 명단 첨자로 바꾼다.
 */

/** [0x1552d10] == 2 — 시즌모드 연차 상한 (r4 = 새 연차 + 1 ≤ 10). 그 밖 모드(나리 0x1b86c)는 13 */
const SEASON_YEAR_LIMIT = 10
const LEAGUE_TEAM_COUNT = 10

/** s8 표 (0xd0a80 ~ 0xd0ada, 직접 떴다) */
const T_D0ADA: readonly number[] = [0, 0, 0, 1, 1, 2, 2, 3, 3, 3, 3, 0]
const T_D0AD0: readonly number[] = [0, 0, 0, 1, 1, 2, 2, 2, 3, 3, 0, 0]
const T_D0AC7: readonly number[] = [0, 0, 0, 1, 1, 1, 2, 2, 3, 0, 0, 0]
const T_D0ABB: readonly number[] = [0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3]
const T_D0AB2: readonly number[] = [0, 0, 0, 1, 1, 2, 2, 2, 3, 0, 0, 1]
const T_D0AA6: readonly number[] = [0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3]
const T_D0A9C: readonly number[] = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 0, 0]
const T_D0A93: readonly number[] = [0, 0, 0, 1, 1, 2, 2, 2, 3, 0, 0, 0]
const T_D0A88: readonly number[] = [0, 0, 1, 1, 1, 2, 2, 3, 3, 3, 3, 0]
const T_D0A80: readonly number[] = [0, 0, 0, 1, 1, 2, 2, 3, 0, 0, 1, 1]

/** 0x666a8~0x666c6 · 0x666e6~0x66704 — r0 를 (r0 + 3) % 4 로 r4 − 1 번 돌린 투수 칸 */
function rotatedPitcherIndex(start: number, r4: number): number {
  let index = start
  for (let turn = 0; turn < r4 - 1; turn += 1) index = (index + 3) % 4
  return index
}

/** 0x66530 한 번 — 아홉 팀에 같은 칸·부위를 쓴다 */
export interface CpuEquipmentCall {
  readonly isBatter: boolean
  readonly part: number
  /** 팀 레코드 배열의 칸 */
  readonly recordIndex: number
  /** 표에서 읽은 기준 — 니블 = 기준 + rand(0, 2) + 1 */
  readonly base: number
}

/** `0x665e8` 의 열 줄 차례 (0x665f6~0x6677c) — 새 연차 idx 로 걸리는 줄만 */
export function cpuEquipmentCallsOf(newYearIndex: number): readonly CpuEquipmentCall[] {
  const r4 = newYearIndex + 1
  if (r4 > SEASON_YEAR_LIMIT) return []
  const calls: CpuEquipmentCall[] = []
  const add = (when: boolean, isBatter: boolean, part: number, recordIndex: number, table: readonly number[], offset: number) => {
    if (when) calls.push({ isBatter, part, recordIndex, base: table[r4 - offset] ?? 0 })
  }
  add(r4 > 2, true, 0, 0, T_D0ADA, 3)
  add(r4 > 3, true, 0, 2, T_D0AD0, 4)
  add(r4 > 4, true, 0, 3, T_D0AC7, 5)
  add(r4 > 1, true, 1, 3, T_D0ABB, 2)
  add(r4 > 4, true, 1, 4, T_D0AB2, 5)
  add(r4 > 1, false, 0, rotatedPitcherIndex(0, r4), T_D0AA6, 2)
  add(r4 > 3, false, 0, rotatedPitcherIndex(1, r4), T_D0A9C, 4)
  add(r4 > 4, false, 1, 4, T_D0A93, 5)
  add(r4 > 2, false, 1, 7, T_D0A88, 3)
  add(r4 > 5, false, 0, 7, T_D0A80, 6)
  return calls
}

/** 한 번 쓰기 — 팀 레코드 칸의 부위 니블 = value */
export interface CpuEquipmentWrite {
  readonly teamId: number
  readonly isBatter: boolean
  readonly recordIndex: number
  readonly part: number
  readonly value: number
}

/** 난수 차례 그대로 — 줄마다 팀 0..9(내 팀 빼고) 한 번씩 `rand(0, 2)` */
export function rollCpuEquipment(random: RandomPort, newYearIndex: number, myTeamId: number): readonly CpuEquipmentWrite[] {
  const writes: CpuEquipmentWrite[] = []
  for (const call of cpuEquipmentCallsOf(newYearIndex)) {
    for (let teamId = 0; teamId < LEAGUE_TEAM_COUNT; teamId += 1) {
      if (teamId === myTeamId) continue
      const value = call.base + random.rand(0, 2) + 1
      writes.push({ teamId, isBatter: call.isBatter, recordIndex: call.recordIndex, part: call.part, value })
    }
  }
  return writes
}

function withPart(player: SeasonPlayer, teamId: number, isPitcher: boolean, part: number, value: number): SeasonPlayer {
  const equipment = [...seasonPlayerEquipmentOf(player, teamId, isPitcher)]
  equipment[part] = value
  return { ...player, equipment }
}

/**
 * 굴린 쓰기를 CPU 명단에 얹는다. `rosterOf` 는 그 팀의 지금 명단(트레이드로 바뀐 팀은 저장의 것, 나머지는 붙박이 표),
 * `pitcherRosterIndexOf` 는 레코드 칸 → 명단 첨자(로테이션 차례)다. 칸이 명단 밖이면 건너뛴다.
 */
export function applyCpuEquipment(
  writes: readonly CpuEquipmentWrite[],
  rosterOf: (teamId: number) => SeasonTeamRoster,
  pitcherRosterIndexOf: (teamId: number, roster: SeasonTeamRoster, recordIndex: number) => number,
): Readonly<Record<number, SeasonTeamRoster>> {
  const rosters: Record<number, SeasonTeamRoster> = {}
  for (const write of writes) {
    const roster = rosters[write.teamId] ?? rosterOf(write.teamId)
    if (write.isBatter) {
      const player = roster.batters[write.recordIndex]
      if (player === undefined) continue
      rosters[write.teamId] = {
        ...roster,
        batters: roster.batters.map((p, i) => (i === write.recordIndex ? withPart(player, write.teamId, false, write.part, write.value) : p)),
      }
    } else {
      const index = pitcherRosterIndexOf(write.teamId, roster, write.recordIndex)
      const player = roster.pitchers[index]
      if (player === undefined) continue
      rosters[write.teamId] = {
        ...roster,
        pitchers: roster.pitchers.map((p, i) => (i === index ? withPart(player, write.teamId, true, write.part, write.value) : p)),
      }
    }
  }
  return rosters
}

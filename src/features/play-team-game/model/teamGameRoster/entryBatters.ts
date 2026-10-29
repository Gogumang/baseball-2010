import { teamBatters } from '@/entities/team/model/teamRoster'
import { ACE_BATTERS } from '@/entities/game/model/aceOpponent'
import { gameAbilitiesOf } from '@/features/play-team-game/model/gameAbilities'
import { rowAbilityOf, teamAbilitiesOf, type TeamGameAbilityContext } from '@/features/play-team-game/model/teamGameRoster/abilityContext'
import { aceLeveledAbility } from '@/features/play-team-game/model/teamGameRoster/aceLevel'
import { BATTING_ORDER_SLOTS, NO_ACE_BATTER, NO_ROSTER_SLOT, type TeamEntryBatter } from '@/features/play-team-game/model/teamGameRoster/entryTypes'

/**
 * 경기 시작 명단에 레코드 칸 0xb6394 를 단다 — 마선수 아닌 줄은 첨자(0xb603c), 마타자는 순번 (`TeamEntryBatter.recordSlot`)
 */
export function withEntryRecordSlots(entry: readonly TeamEntryBatter[]): readonly TeamEntryBatter[] {
  return entry.map((batter, index) => ({ ...batter, recordSlot: batter.aceIndex >= 0 ? batter.aceIndex : index }))
}

/** 로스터 12명을 그대로 명단으로 — 앞 아홉이 타순, 9~11 이 벤치다 */
export function rosterEntryBattersOf(teamId: number): readonly TeamEntryBatter[] {
  return teamBatters(teamId).map((player, rosterSlot) => ({
    name: player.name,
    ability: rowAbilityOf(player, false),
    equipment: player.equipment,
    position: player.position ?? 0,
    aceIndex: NO_ACE_BATTER,
    rosterSlot,
    skillBits: player.skillBits,
  }))
}

/**
 * 고른 **마타자를 벤치 첫 칸(9번)에 끼워 넣는다** — 원본 `0xb8870(team, k)`:
 * `0x1f84c(저장, k)` 로 마타자 레코드를 꺼내 `0xb53f0(team, 레코드, 1)` 로 넣고, 성공하면
 * `team+0x27` 과 **벤치 타자 수 `team+0x28c`(= `0xa3<<2`)를 하나씩 올린다**
 * (`b8898~b88b2`). `0xb53f0` 의 `0x40`(마타자) 가지가 **9번 = 첫 벤치 칸**이다.
 *
 * ⚠️ **끼워 넣는 방식은 "밀기" 가 아니라 "옛 9번을 맨 끝으로 옮기기" 다** (직접 떴다 — 앞서
 * 웹이 쓰던 `splice` 는 오독이었다):
 * ```
 * b5418: cmp 타자수(=12), #9 ; ble b543a
 * b541e:   0xb53d0(명부, 9) → &타자[9] ; 0xb6720(그 칸, 0x40, …) 이 참이면 r4 = 0 (덮어쓰고 −1)
 * b543a: 0xb4e34(명부, 0)                      ; 타자 벡터를 한 칸 늘리고
 * b544a:   memcpy(&타자[수−1], &타자[9], 0x30) ; 옛 9번을 **맨 끝(12번)으로** 옮긴 뒤
 * b5462: memcpy(&타자[9], 레코드, 0x30)        ; 9번에 마타자를 넣는다
 * b547a: return 9
 * ```
 * 곧 벤치 차례가 `[마타자, 옛10, 옛11, 옛9]` 가 된다 — 밀어 넣은 `[마타자, 옛9, 옛10, 옛11]` 이
 * 아니다. 대타 화면 목록 차례와 CPU 대타 `0xaf06c(팀, rand(0, 벤치수), 0)` 가 고르는 선수가
 * 달라지는 자리라 원본대로 맞춘다 (굴림 수는 그대로다).
 *
 * 일반모드 경기 세우기 `0x30f20` 이 준비 기록의 마타자 칸으로 이 함수를 부른다
 * (`31046: 0xb8870(teamA, [sp+0x45])`).
 *
 * 마타자 레코드의 수비 위치 니블(`+0x1c & 0xf`)은 **0(자리 없음)** 이다 (직접 떴다): 레코드는 `0x1f84c` 의
 * `[g+0xac] + 0xd54 + i × 0x30` 이고, 그 덩어리는 0x20138 이 통째 0 으로 지운 뒤(2028e) `0x20094(7)` 이
 * `data/XlsACE_BAT_DATA.zt1` 을 풀어 머리 0x20 뒤를 그대로 베낀다(200dc~20104) — 다섯 행의 +0x1c 바이트가 모두 0 이다.
 * 대타 확정이 이 니블을 옛 타자 것과 맞바꾸므로(0xaecce~0xacfe) 빠진 선수가 벤치로 내려간다.
 */
export function withAceBatter(entry: readonly TeamEntryBatter[], aceIndex: number): readonly TeamEntryBatter[] {
  const ace = ACE_BATTERS[aceIndex]
  if (ace === undefined) return entry
  const inserted: TeamEntryBatter = {
    name: ace.name,
    ability: [ace.ability.hit, ace.ability.power, ace.ability.defense, ace.ability.run],
    position: 0,
    aceIndex,
    rosterSlot: NO_ROSTER_SLOT,
    // 레코드 +0x14 — 0xb53f0 이 XlsACE_BAT 행을 통째 베낀다 (압도 22 · 0xab214 스킬 갈래)
    skillBits: ace.skillBits,
  }
  const out = [...entry]
  const seated = out[BATTING_ORDER_SLOTS]
  // 이미 마타자가 앉아 있으면 원본은 늘리지 않고 그 자리를 덮어쓴다 (b5436 의 r4 = 0 가지)
  if (seated !== undefined && seated.aceIndex >= 0) {
    out[BATTING_ORDER_SLOTS] = inserted
    return out
  }
  // 옛 9번은 맨 끝으로 옮긴다 (b544a) — 밀어 넣는 것이 아니다
  if (seated !== undefined) out.push(seated)
  out[BATTING_ORDER_SLOTS] = inserted
  return out
}

/** 명단 한 칸의 경기용 능력치 — `batterGameAbilities` 와 같은 보정을 명단 쪽으로 돌린 것 */
export function entryBatterGameAbilities(
  context: TeamGameAbilityContext,
  teamId: number,
  entry: TeamEntryBatter,
  lineupSlot: number,
): [number, number, number, number] {
  const isMyTeam = context.seasonTeamId === teamId
  return gameAbilitiesOf(aceLeveledAbility(entry.ability, '타자', entry.aceIndex, context.aceLevels), {
    mode: context.mode,
    isPitcher: false,
    isMyTeam,
    teamAbilities: teamAbilitiesOf(context, teamId),
    season: context.season,
    assignment: isMyTeam ? context.lineup?.[lineupSlot] : undefined,
  })
}

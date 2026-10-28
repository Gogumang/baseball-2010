import { type SeasonTeamRoster, tableTeamOf, HALL_OF_FAME_FIRST_ID, type SeasonPlayer } from '@/entities/season-mode/model/playerRecruit'
import { tableRosterOf, SEASON_RECORD_ACE_PITCHER_SLOT, SEASON_RECORD_ACE_BATTER_SLOT } from '@/entities/season-mode/model/seasonEntry'
import { teamBatters } from '@/entities/team/model/teamRoster'
import type { LeagueTeamRecord } from '@/entities/league/model/leagueDay'
import { pitcherOrderOf } from '@/entities/league/model/league'
import type { SeasonSave } from '@/app/model/seasonSession/save/seasonSave'
import { withFullRosterStamina } from '@/app/model/seasonSession/stamina/stamina'

/**
 * 시즌 로스터를 팀 명단 표에서 만든다 — 원본 선수 레코드 구조가 안 풀려 **근사**다.
 * 칸 번호(`+0xa & 0x1f`)만 순서대로 채우고 종류 비트는 0(기본 선수)으로 둔다.
 * 타자 수비 위치(`+0x1c & 0xf`)는 표의 값을 넣는다 — 엔트리 편집(0xb5e99·0xb5fe5)과 트레이드 자리 벌점이
 * 이 칸을 본다. 스태미나(+0x2c)는 10000 — 시즌 시작 0xb6cc4 · 첫날 6850 의 0xb6190 과 같다.
 */
export function rosterOf(teamId: number): SeasonTeamRoster {
  return withFullRosterStamina(tableRosterOf(teamId))
}

/**
 * 엔트리 편집이 생기기 전 세이브는 타자 수비 위치를 모두 0 으로 적었다 — 그대로면 엔트리 편집의
 * 수비위치 탭이 아무것도 못 바꾸고(0xb5fe5 는 둘 다 ≠ 0 일 때만) 트레이드 벌점도 늘 10 이다.
 * **모든 타자가 0 일 때만** 리그 선수(id < 0xb4)의 표 값으로 채운다 (영입 선수는 그대로).
 */
export function withTablePositions(roster: SeasonTeamRoster, teamId: number): SeasonTeamRoster {
  if (roster.batters.some((player) => (player.fieldPosition & 0xf) !== 0)) return roster
  return {
    ...roster,
    batters: roster.batters.map((player) => {
      const table = teamBatters(tableTeamOf(player, teamId))
      const position = player.id < HALL_OF_FAME_FIRST_ID ? (table[player.id]?.position ?? 0) : 0
      return { ...player, fieldPosition: (player.fieldPosition & ~0xf) | position }
    }),
  }
}

export const EMPTY_ROSTER: SeasonTeamRoster = { pitchers: [], batters: [] }

/** CPU 팀 레코드 — 트레이드로 바뀌었으면 저장의 것, 아니면 붙박이 표 명단 */
export function cpuRosterOf(save: SeasonSave | null, teamId: number): SeasonTeamRoster {
  return save?.cpuRosters?.[teamId] ?? tableRosterOf(teamId)
}

/**
 * CPU 끼리 경기(0xc2a48 · 0xc2760 → 준비 0xc239c → 0xb891c·0xb8680)가 읽는 팀 레코드 — 저장에 명단이 있는 팀(트레이드로
 * 바뀌었거나 새 해 장비 굴림 0x665e8 이 니블을 쓴 팀)만 칸마다 붙박이 표 자리(`tableTeamOf` 팀 · id)와 장비 니블로 넘긴다.
 * 없는 팀은 undefined(표 그대로 — 예전과 같은 길).
 * CPU 팀 레코드에는 리그 선수만 있다(나리·명전은 트레이드에서 거절된다) — 그 밖의 칸은 표 칸 그대로 둔다.
 */
export function cpuLeagueRecordOf(save: SeasonSave, teamId: number): LeagueTeamRecord | undefined {
  const roster = save.cpuRosters?.[teamId]
  if (roster === undefined) return undefined
  // 장비 니블(새 해 0x665e8 이 쓴 것)도 레코드째 — CPU 간이 경기가 0xb6414 보너스로 먹는다 (`LeagueRecordPlayer.equipment`)
  const seatOf = (player: SeasonPlayer, index: number) =>
    player.id < HALL_OF_FAME_FIRST_ID
      ? {
          tableTeamId: tableTeamOf(player, teamId),
          tableSlot: player.id,
          ...(player.equipment === undefined ? {} : { equipment: player.equipment }),
        }
      : { tableTeamId: teamId, tableSlot: index }
  return { batters: roster.batters.map(seatOf), pitchers: roster.pitchers.map(seatOf) }
}

/**
 * **트레이드가 보는 레코드 차례** — 원본 트레이드(0xe5·0xe6 목록 · 요청 0x93c8 · 맞바꾸기 0xd1cc)는 `0x1f9a9(저장, 모드, 팀)` 의
 * 팀 레코드 배열을 칸 차례대로 본다. 투수 배열은 경기 준비마다 로테이션 `0xb5ca8`(0~3 한 칸 당김, 영구)로 섞여 있는데
 * 웹 명단(내 팀 `roster` · CPU `cpuRosters`)은 로테이션 전 자리 차례이고 섞인 차례는 리그가 든다(`League.pitcherOrders` —
 * 칸 p 에 앉은 명단 첨자). 트레이드는 관리 메뉴(정규시즌 경기 사이)에서만 열리고 그때 레코드는 지난 경기 준비까지 돈
 * 모양이라 리그 차례 그대로다(다음 경기 준비의 한 칸은 아직 안 돌았다). 그래서 목록·요청 칸은 이 차례로 보이고,
 * 맞바꿀 때 명단 첨자로 되돌린다(`recordPitcherIndexOf`). 차례가 명단 길이와 안 맞는 꼬리(영입으로 늘어난 칸)는 그대로다.
 */
export function recordPitcherOrderOf(save: SeasonSave, teamId: number, pitcherCount: number): readonly number[] {
  const order = pitcherOrderOf(save.league, teamId)
  const valid =
    order.length <= pitcherCount &&
    order.every((index) => Number.isInteger(index) && index >= 0 && index < order.length) &&
    new Set(order).size === order.length
  const head = valid ? order : []
  return [...head, ...Array.from({ length: pitcherCount - head.length }, (_unused, k) => head.length + k)]
}

/** 레코드 차례로 늘어세운 팀 명단 — 타자는 그대로(로테이션은 투수만 섞는다) */
export function tradeRecordRosterOf(save: SeasonSave, teamId: number, roster: SeasonTeamRoster): SeasonTeamRoster {
  const order = recordPitcherOrderOf(save, teamId, roster.pitchers.length)
  return { ...roster, pitchers: order.flatMap((index) => roster.pitchers[index] ?? []) }
}

/** 레코드 칸 p → 명단 첨자 */
export function recordPitcherIndexOf(save: SeasonSave, teamId: number, roster: SeasonTeamRoster, recordIndex: number): number {
  return recordPitcherOrderOf(save, teamId, roster.pitchers.length)[recordIndex] ?? recordIndex
}

/**
 * 내 팀 레코드에 마선수가 남은 칸 — 마투수 8 · 마타자 9 (`SeasonSave.recordAces`), 없으면 undefined.
 * 명전 삭제 0x221dc · 나리 초기화 0x223a8 는 마선수를 거르지 않고 레코드 맨 끝 줄을 옮긴다(U-105 r163 — `removeHallOfFamerFromRoster`)
 */
export function recordAceSlotOf(save: SeasonSave, isPitcher: boolean): number | undefined {
  const aces = save.recordAces?.[save.state.record.teamId]
  if (aces === undefined) return undefined
  if (isPitcher) return aces.pitcher >= 0 ? SEASON_RECORD_ACE_PITCHER_SLOT : undefined
  return aces.batter >= 0 ? SEASON_RECORD_ACE_BATTER_SLOT : undefined
}

import { defenseAbilitiesOf, defenseSkillIdsOf, defenseFielderPlatesOf } from '@/features/defense-play/model/runDefensePlay'
import { teamBatters, skillIdsOfBits, teamPitchers } from '@/entities/team/model/teamRoster'
import { type FielderRecordSeat, fielderRecordsAtPlayStart } from '@/entities/fielding/model/fielderRecords'
import { moundAcePitcherOf } from '@/features/play-game/model/gameFlow/roster/teamPlayers'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/**
 * 수비 아홉 칸의 능력치 — **상대 팀** 로스터에서 만든다.
 *
 * 나만의리그 타자편은 전역 모드 4 라 팀 능력치 보정(비트마스크 0x306 = 모드 1·2·8·9)이
 * 붙지 않는다 → 로스터에 적힌 밑값을 그대로 쓴다.
 * 칸 0(투수)은 판 시작 0xb0fb4 가 선수를 찾지 않아(b1032) 진행기가 고정값으로 둔다 — 여기서 넣지 않는다.
 */
export function opponentDefenseAbilitiesOf(progress: GameProgress): readonly (number | null)[] {
  const abilities: (number | null)[] = defenseAbilitiesOf(
    teamBatters(progress.opponentTeamId).map((player) => ({
      position: player.position,
      defense: player.ability[2],
    })),
  )
  // 칸 0 은 +0xec(마지막 교대 판의 지명타자) — 비었으면 null(펌블 0 · 레이저 굴림 없음). 모드 4 라 팀 보정이 없어 레코드 밑값이다
  const seat = opponentFielderRecordsOf(progress)[0]
  abilities[0] = seat == null ? null : (teamBatters(seat.teamId)[seat.index]?.ability[2] ?? null)
  return abilities
}

/** 수비 아홉 칸의 스킬 번호 — `opponentDefenseAbilitiesOf` 와 같은 칸 고르기(레이저 0x66a8c · 필살수비의 초감각 21, `defenseSkillIdsOf`) */
export function opponentFielderSkillIdsOf(progress: GameProgress): (readonly number[])[] {
  const skills = defenseSkillIdsOf(
    teamBatters(progress.opponentTeamId).map((player) => ({
      position: player.position,
      skillIds: skillIdsOfBits(player.skillBits, false),
    })),
  )
  // 칸 0 — 66ad4 0xb62b4(+0xec, 0x15) 도 +0xec 레코드에 묻는다
  const seat = opponentFielderRecordsOf(progress)[0]
  const seatPlayer = seat == null ? undefined : teamBatters(seat.teamId)[seat.index]
  skills[0] = seatPlayer === undefined ? [] : skillIdsOfBits(seatPlayer.skillBits, false)
  return skills
}

/** 상대(수비 팀) 레코드 차례 칸 `index` 의 +0xec 자리 — 실책 열쇠는 그 타순 칸(마타자 칸은 경기 요약이 거른다) */
export function opponentFielderSeatOf(progress: GameProgress, index: number): FielderRecordSeat {
  return { teamId: progress.opponentTeamId, index, errorKey: { teamId: progress.opponentTeamId, battingOrderIndex: index } }
}

/**
 * 판 시작 0xb0fb4 뒤의 야수 +0xec 아홉 칸 — 칸 1..8 은 상대 명단으로 다시 훑고 칸 0 은 진행기가 든 값(`fielderRecords`).
 * 타자편 수비 판의 수비 팀은 늘 상대다.
 */
export function opponentFielderRecordsOf(progress: GameProgress): readonly (FielderRecordSeat | null)[] {
  return fielderRecordsAtPlayStart(progress.fielderRecords, teamBatters(progress.opponentTeamId), (index) => opponentFielderSeatOf(progress, index))
}

export function opponentFielderPlatesOf(progress: GameProgress) {
  const ace = moundAcePitcherOf(progress, false)
  const pitcher = teamPitchers(progress.opponentTeamId)[progress.opponentMound.pitcherSlot]
  return defenseFielderPlatesOf(
    teamBatters(progress.opponentTeamId),
    ace !== undefined ? { name: ace.player.name } : pitcher === undefined ? undefined : { name: pitcher.name, role: pitcher.profile & 3 },
  )
}

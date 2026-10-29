import {
  FULL_STAMINA,
  hasFightingSpiritBit,
  pitcherAbilitySumOf,
  quickPitcherOf,
  rosterPitcherRoleOf,
  teamPitchers,
  withFightingSpirit,
  withQuickFightingSpirit,
  type HalfInningDefense,
} from '@/entities/mission/model/missionCpuTeam/otherSlices'
import { masterPitcherRowAt } from '@/entities/mission/model/missionCpuTeam/roster/records'
import { MISSION_ACE_ROSTER_SLOT } from '@/entities/mission/model/missionCpuTeam/types'
import type { MissionAcePitcher, MissionCpuPitching } from '@/entities/mission/model/missionCpuTeam/types'

/**
 * 팀 투수 칸의 0xac428 · 0xabfcc 재료 — 리그 `defenseOf` · 타자편 `quickDefenseOf` 와 같은 모양.
 * `ace` 를 주면 마투수 칸이 그 레코드로 던지고 그 체력 칸으로 깎인다(간이 엔진 — 자동진행 반 이닝).
 */
export function missionPitchingDefenseOf(
  pitching: MissionCpuPitching,
  lead: number,
  options: {
    readonly ace?: MissionAcePitcher
    readonly pitcherChangeBlocked?: boolean
    /** 스킬 14(투지) 갈래의 경기 상태 — 이 반 이닝 득점을 받아 (`HalfInningDefense.fightingSpiritAt`). 안 넘기면 늘 거짓 */
    readonly fightingSpiritAt?: (runsThisHalf: number) => boolean
  } = {},
): HalfInningDefense {
  const masters = teamPitchers(pitching.teamId)
  const isAce = (slot: number) => pitching.roster[slot] === MISSION_ACE_ROSTER_SLOT
  const masterAt = (slot: number) => masters[pitching.roster[slot] ?? slot] ?? masters[0]
  return {
    mound: pitching.mound,
    pitcherSlots: pitching.roster.map((_master, slot) => slot),
    // 0xb570c 스킬 14 갈래 — 모드 5 · 6 은 정액이 없어 밑값에 곧장 v/10 (`withQuickFightingSpirit`, 장착은 skillIds 30)
    pitcherAt: (slot, fightingSpirit) =>
      withQuickFightingSpirit(isAce(slot) && options.ace !== undefined ? options.ace.quick : quickPitcherOf(masterAt(slot)), fightingSpirit),
    ...(options.fightingSpiritAt === undefined ? {} : { fightingSpiritAt: options.fightingSpiritAt }),
    // 투수 능력치 칸 3 = 체력 — 소모(0x66e44 용량)에만 쓴다. 사람 타석의 마투수 소모는 세션이 든다(`ace` 를 안 넘긴다)
    staminaAbilityAt: (slot) => (isAce(slot) && options.ace !== undefined ? options.ace.staminaAbility : masterAt(slot).ability[3]),
    // 벤치 줄의 +0x2c — 확정(직접 떴다): 미션의 CPU 팀은 명부 0xb8680 의 모드 5·6 갈래(b86e2)라 g[0x11f] · g[0x176] 대기와
    // g[0xf6] == 2(시즌) 가 함께 설 때만 시즌 팀 0x1f571 이고(그 조합은 SYS 8 이 시즌에서 대기를 안 세워 안 생긴다) 늘 마스터 팀
    // 0x1f8c1 이다. 마스터 팀은 0x1ff98 이 XlsPITCHER_DATA 행(0x21 + 팀×0x180 + 칸×0x30)을 통째 베끼고, 그 +0x2c 는 15 팀 120 줄
    // 모두 10000 이다(zt1 을 풀어 확인). 마스터 팀을 쓰는 모드는 5·6 뿐이고(0xd8a30 점프표 — 1 · 2 · 3 · 4 · 8 · 9 는 다른 표)
    // 미션 끝 0x4ea0c(4ef18) · 다시하기 · 나가기가 0x20094 → 0x1ff98 로 다시 싣는다 → 미션 시작의 벤치는 늘 10000 이다
    staminaAt: () => FULL_STAMINA,
    lead,
    // 0x66e44 의 V = 0x1f9a8(앱, 모드, 팀) — 모드 5·6·7 은 0x1fa1e(늘 0)라 V 가 없어 사기 100
    morale: 100,
    // 0xb6c20 — 미션은 사람 칸 0 · 다른 칸 1 (aa658·aa666)
    bothTeamsAreCpu: false,
    // 보직은 줄째 따라간다 — 마스터 줄 +0xb & 3 (팀 안 차례 0,0,0,0,1,1,1,2). 마투수 칸은 표 밖이라 없다
    roleAt: (slot) => (isAce(slot) ? undefined : rosterPitcherRoleOf(pitching.roster[slot] ?? slot)),
    // 스킬 14 갈래(b5a16~b5a72)는 칸 0~2 에 v/10 을 얹고 자른다 (마스터 줄 +0x14 비트 14)
    abilitySumAt: (slot, fightingSpirit) => {
      const spirit = fightingSpirit === true && hasFightingSpiritBit(masterAt(slot).skillBits)
      return pitcherAbilitySumOf(
        masterAt(slot).ability.map((value, k) => Math.min(999, Math.max(0, spirit && k !== 3 ? withFightingSpirit(value) : value))),
      )
    },
    isSpecialPitcherAt: isAce,
    // 소모 0xa5e14 의 비트 18 · 10 — 마스터 줄 +0x14 (Xls 행 사본). 마투수 소모는 세션이 든다
    skillBitsAt: (slot) =>
      isAce(slot) && options.ace !== undefined ? (options.ace.skillBits ?? 0) : (masterPitcherRowAt(pitching, slot)?.skillBits ?? 0),
    ...(options.pitcherChangeBlocked === true ? { pitcherChangeBlocked: true } : {}),
  }
}

import type { OriginalMission } from '@/shared/config/original/missions'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { missionKeyOf } from '@/entities/mission/model/missionGoal'
import { quickPitcherOf, teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import { changePitcherIfNeeded, drainPitcherForPitch } from '@/entities/game/model/simulateHalfInning'
import type { HalfInningDefense, HalfInningMound } from '@/entities/game/model/simulateHalfInning'
import { pitcherAbilitySumOf, rosterPitcherRoleOf } from '@/entities/pitching/model/pitcherChange'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import {
  QUICK_LINEUP_SIZE,
  lineupSlotOf,
  recordLineupPlay,
  rosterLineupOf,
  rosterSlotAt,
  tryQuickCpuPinchHit,
} from '@/entities/game/model/quickLineup'
import type { QuickLineup } from '@/entities/game/model/quickLineup'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { QuickAtBatPitcher } from '@/entities/game/model/quickAtBat'
import { ACE_PITCHERS } from '@/entities/game/model/aceOpponent'
import { aceAbilityAtLevel, aceLevelOf, aceLevelSlotOf } from '@/entities/mission/model/aceLevel'
import type { RosterPlayer } from '@/shared/config/original/roster'
import { ROSTER_PITCHER_REPERTOIRES } from '@/shared/config/original/pitcherRepertoires'
import type { PitcherAbility } from '@/entities/pitching/model/pitch'
import type { BatterAbility } from '@/entities/batting/model/batter'
import { staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { equippedSeasonAbilityOf } from '@/entities/season-mode/model/seasonPlayerRecord'

/**
 * **미션 상대 CPU 팀** — 미션 경기 준비 `0xaa57c`(모드 5·6)가 세운 다른 칸 팀과, 그 팀의 CPU 교체가 보는 칸들.
 *
 * 원본 미션도 보통 경기 장면(0x104)이라 상태 0xf 진입 `0x3d954` 가 **공마다** CPU 교체를 묻는다 (직접 재역어셈 3d9ca~3da94):
 * ```
 * 3d9cc  r4 = 0x66864()
 * 3d9e4  수비 팀이 CPU(state[0x31 + state[0xa]] == 1)
 *          돌발 진행 중(0x8eb94) 또는 r4 == 0 → 건너뜀
 *          그 밖 → 0xac428([장면+0x21c], 수비 팀 [장면+0x224], 주자관리 [장면+0x20c], state, R, 0, 0, 0)   ; 3da3e
 *        아니면(수비가 사람)
 *          돌발 진행 중 → 건너뜀
 *          그 밖 → 0xac228([장면+0x21c], 공격 팀 [장면+0x220], 주자관리, state)                       ; 3da70
 * 3da74  참이면 22 "Time!"(3da88) · 0x16 예약(3da94) → 0xd(이전 0x16 이라 지우기 건너뜀, 48e94) → 0xe → 0xf 재진입
 * 66864  모드 5·6 이 아니면 1 · 모드 6 이면 미션 객체 +0xbd ∈ {3, 7} 일 때 0 · 모드 5 면 수비가 사람일 때 0
 * ```
 * 부르는 함수는 **다른 모드와 같다** — 0xac428 은 나리 타자편(`features/play-game` `changeOpponentPitcher`)과 같은 3da3e 자리,
 * 0xac228 은 나리 투수편(`features/play-pitcher-game` `enterPitchSelection`)과 같은 3da70 자리다. 그래서 판정은 공용 부품
 * (`changePitcherIfNeeded` · `tryQuickCpuPinchHit`)을 그대로 쓴다. 미션이 다른 것은 **팀과 그 칸**뿐이다:
 * - 모드 6(타자 미션) — 수비가 CPU 라 0xac428 투수 교체. 모드 5(투수 미션) — 수비가 사람이라 0xac228 대타(가림막 안 봄).
 * - 미션 객체 +0xbd = 고른 레코드 번호 = `id − 1` (보통 미션은 목록 칸, 마선수 대결은 SYS 8 이 team − 1 로 적는다 — 0xa5268 이
 *   ≤ 13 이면 그 줄, ≥ 15 면 한 줄 앞). 0x66864 가 막는 것은 **타자 4(레오니) · 8(발렌타인)** 둘뿐이다.
 *
 * 팀(직접 재역어셈 0xaa57c · 0xb8680 · 0x1ff98 · 0xaae7c):
 * - aa72a~aa76c `0xb891c(팀객체[칸], 모드, 팀, −1)` — 다른 칸 팀 = 레코드 +2 아래 4비트(`sideTeams[1 − humanSide]`).
 *   명부 0xb8680 은 모드 5·6 이면(b86e2) 마선수 대결이고 원래 모드가 시즌이 아닐 때 말고는 **마스터 팀**
 *   `0x1f8c0(저장, 팀)` = Xls 줄 그대로(0x1ff98 이 팀마다 투수 8 · 타자 12 줄을 통째 복사, 투수 +0x2c 는 모두 10000).
 *   마스터 팀은 미션 끝 정산 0x4ea0c(모드 5·6 갈래 4ef18) · 다시하기 · 나가기가 `0x20094(앱, 5)` → 0x1ff98 로 다시 싣는다
 *   → 미션마다 새 줄에서 선다(아래 맞바꾸기가 다음 미션으로 이어지지 않는다).
 * - aa87c~aa8ac 다른 칸 팀+0x32(타순) = 레코드 +7 아래 4비트 · `0xb8c94(다른 칸, 0, 레코드 +6 아래 4비트)` = 명부 투수
 *   0번 ↔ 그 칸 맞바꾸기 → 그 투수가 선발이다.
 * - 마선수 미션(레코드 +8 윗 4비트 > 0)은 0xd 메시지 0xaae7c(aafca~)가 마선수를 끼운다 — 모드 6 이면 마투수를 명부 투수
 *   8번(0xb521c, 옛 8번은 끝)에 베끼고 0 ↔ 8 맞바꿈, 모드 5 면 마타자를 명부 타자 9번(0xb53f0)에 베끼고 지금 타순 ↔ 9 맞바꿈.
 *   팀 객체의 투수 수 +0x26 · 벤치 +0x33 · +0x28c 는 0xb891c 때 값 그대로다(0xaae7c 는 안 고친다).
 */

/** 마선수가 들어선 명부 칸 표시 — 마스터 팀 줄이 아니다 */
export const MISSION_ACE_ROSTER_SLOT = -1

/** 팀 객체 투수 칸 수 — 마스터 팀 투수 8 줄 (`team+0x26`) */
const PITCHERS_PER_TEAM = 8
/** 마스터 팀 타자 12 줄 — 벤치 `team+0x28c` = 12 − 9 */
const BATTERS_PER_TEAM = 12

/**
 * 레코드 +6 · +7 의 **아래 4비트**(다른 칸 = CPU 팀) — 시작 투수 칸(0xb8c94)과 타순(team+0x32).
 * 생성기(`shared/config/original/missions`)가 싣지 않는 칸이라 원본 표(`base/extracted/Xls*_MISSION.json` 줄 바이트 6 · 7)에서
 * 옮겨 적었다. 윗 4비트는 사람 칸 몫이다(타순 · 레코드 +1 비트 0 일 때만 쓰는 투수 칸 — 원본 표는 모두 비트 0 이 꺼져 있다).
 * 열쇠는 `missionKeyOf`.
 */
export const MISSION_CPU_START: Readonly<Record<string, { readonly pitcherSlot: number; readonly battingOrder: number }>> = {
  '타자:1': { pitcherSlot: 3, battingOrder: 0 },
  '타자:2': { pitcherSlot: 3, battingOrder: 0 },
  '타자:3': { pitcherSlot: 3, battingOrder: 2 },
  '타자:4': { pitcherSlot: 2, battingOrder: 1 },
  '타자:5': { pitcherSlot: 1, battingOrder: 0 },
  '타자:6': { pitcherSlot: 7, battingOrder: 2 },
  '타자:7': { pitcherSlot: 1, battingOrder: 0 },
  '타자:8': { pitcherSlot: 2, battingOrder: 1 },
  '타자:9': { pitcherSlot: 3, battingOrder: 1 },
  '타자:10': { pitcherSlot: 4, battingOrder: 1 },
  '타자:11': { pitcherSlot: 0, battingOrder: 0 },
  '타자:12': { pitcherSlot: 0, battingOrder: 3 },
  '타자:13': { pitcherSlot: 0, battingOrder: 0 },
  '타자:14': { pitcherSlot: 0, battingOrder: 0 },
  '타자:16': { pitcherSlot: 0, battingOrder: 3 },
  '타자:17': { pitcherSlot: 0, battingOrder: 3 },
  '타자:18': { pitcherSlot: 0, battingOrder: 3 },
  '타자:19': { pitcherSlot: 0, battingOrder: 3 },
  '타자:20': { pitcherSlot: 0, battingOrder: 3 },
  '투수:1': { pitcherSlot: 6, battingOrder: 6 },
  '투수:2': { pitcherSlot: 4, battingOrder: 8 },
  '투수:3': { pitcherSlot: 2, battingOrder: 4 },
  '투수:4': { pitcherSlot: 3, battingOrder: 0 },
  '투수:5': { pitcherSlot: 2, battingOrder: 0 },
  '투수:6': { pitcherSlot: 2, battingOrder: 0 },
  '투수:7': { pitcherSlot: 0, battingOrder: 2 },
  '투수:8': { pitcherSlot: 0, battingOrder: 0 },
  '투수:9': { pitcherSlot: 0, battingOrder: 0 },
  '투수:10': { pitcherSlot: 0, battingOrder: 2 },
  '투수:11': { pitcherSlot: 0, battingOrder: 1 },
  '투수:12': { pitcherSlot: 0, battingOrder: 0 },
  '투수:13': { pitcherSlot: 0, battingOrder: 2 },
  '투수:14': { pitcherSlot: 0, battingOrder: 2 },
  '투수:16': { pitcherSlot: 0, battingOrder: 3 },
  '투수:17': { pitcherSlot: 0, battingOrder: 3 },
  '투수:18': { pitcherSlot: 0, battingOrder: 3 },
  '투수:19': { pitcherSlot: 0, battingOrder: 3 },
  '투수:20': { pitcherSlot: 0, battingOrder: 3 },
}

/** 타자 미션(모드 6) — CPU 수비 투수진 */
export interface MissionCpuPitching {
  /** CPU 팀 번호 (`sideTeams[1 − humanSide]`) */
  readonly teamId: number
  /** 팀 투수 칸(0~7)마다 마스터 줄(팀 안 0~7) — 마투수 칸은 `MISSION_ACE_ROSTER_SLOT` */
  readonly roster: readonly number[]
  /** 지금 마운드 — `pitcherSlot` 은 팀 투수 칸 */
  readonly mound: HalfInningMound
  /** A `+0x284` — 지금 투수의 이번 이닝 실점 (이닝 교대 0xa5b00 · 교체 0xaec64 가 0) */
  readonly inningRunsAllowed: number
  /** 사람 팀이 낸 점수(점수판) — 리드(0xb69b0 수비 − 공격)의 우리 쪽 = 시작 점수 + 이 값 */
  readonly ourRuns: number
}

/** 투수 미션(모드 5) — CPU 공격 타선 */
export interface MissionCpuBatting {
  readonly teamId: number
  /**
   * `team+0xe` 명단 — 칸마다 **레코드 번호**(팀 타자 레코드 배열 칸, 앞 아홉이 타순 · 그 뒤가 벤치). 대타 0xaebe4 는 이 목록만 맞바꾼다.
   */
  readonly lineup: QuickLineup
  /**
   * 레코드 칸마다 든 선수 — 마스터 줄(팀 안 0~11) 또는 마타자(`MISSION_ACE_ROSTER_SLOT`). 0xaae7c 의 0xb53f0(레코드 9 에 베낌) ·
   * 0xb8cb8(레코드 두 칸 맞바꿈)은 목록이 아니라 이 배열을 바꾼다.
   */
  readonly records: readonly number[]
  /** `team+0x32` 지금 타순 칸 (0~8, 0xaf020 이 타석마다 (+1) mod 9) */
  readonly order: number
  /** 필살 남은 칸 s8 `team+0x29 + 타순` — 타순 칸마다, 없는 칸은 −1(안 채움, 팀 new 0xb891c) */
  readonly specialSwing: Readonly<Record<number, number>>
}

export interface MissionCpuTeam {
  readonly pitching: MissionCpuPitching | null
  readonly batting: MissionCpuBatting | null
  /** `state[0xe]` — CPU 대타 막음. 대타가 세우고(ac33e) 공마다(0xa5e14 a5e7c)·새 타석 0xd(48eb6)가 내린다 */
  readonly pinchHitBlocked: boolean
}

/** 사람 칸 아닌 쪽 팀 번호 — 레코드 +2 아래 4비트 */
function cpuTeamIdOf(mission: OriginalMission): number {
  return mission.sideTeams[mission.humanSide === 0 ? 1 : 0]
}

/** 미션 객체 +0xbd — 고른 레코드 번호 (`id − 1`, 위 머리글) */
function missionSlotOf(mission: OriginalMission): number {
  return mission.id - 1
}

/** `0x66864` 의 모드 6 갈래 — +0xbd 가 3 · 7 이면 CPU 투수 교체를 막는다 */
const PITCHER_CHANGE_BLOCKED_SLOTS: readonly number[] = [3, 7]

/**
 * **CPU 팀 투수진** — 0xaa57c aa8a0 `0xb8c94(다른 칸 팀, 0, 레코드 +6 아래 4비트)` 로 명부 투수 0 ↔ 시작 칸(줄째 바뀌어 보직·능력치가
 * 따라간다). 마스터 줄 +0x2c 는 모두 10000. 타자 미션은 사람 타석의 수비, 투수 미션은 사람 칸 팀이 치는 자동진행 반 이닝의 수비다.
 */
export function startMissionCpuPitching(mission: OriginalMission): MissionCpuPitching {
  const start = MISSION_CPU_START[missionKeyOf(mission)] ?? { pitcherSlot: 0, battingOrder: 0 }
  const roster = Array.from({ length: PITCHERS_PER_TEAM }, (_unused, slot) => slot)
  roster[0] = start.pitcherSlot
  roster[start.pitcherSlot] = 0
  return {
    teamId: cpuTeamIdOf(mission),
    roster,
    mound: { pitcherSlot: 0, stamina: FULL_STAMINA, runsAllowed: 0, pitches: 0, usedSlots: [], justChanged: false },
    inningRunsAllowed: 0,
    ourRuns: 0,
  }
}

/** 미션 한 판의 CPU 팀 — 경기 준비 0xaa57c · 0xd 메시지 0xaae7c 뒤의 모습 */
export function startMissionCpuTeam(mission: OriginalMission): MissionCpuTeam {
  const start = MISSION_CPU_START[missionKeyOf(mission)] ?? { pitcherSlot: 0, battingOrder: 0 }
  const hasAce = mission.opponentAce > 0
  const teamId = cpuTeamIdOf(mission)
  if (mission.side === '타자') {
    const pitching = startMissionCpuPitching(mission)
    // 마투수 — 명부 8번에 베낀 뒤 0 ↔ 8 (aafca~ab06e). 0번에 섰던 투수는 팀 객체(8명) 밖으로 나간다
    const roster = hasAce ? [MISSION_ACE_ROSTER_SLOT, ...pitching.roster.slice(1)] : pitching.roster
    return { pitching: { ...pitching, roster }, batting: null, pinchHitBlocked: false }
  }
  const order = lineupSlotOf(start.battingOrder)
  const batting: MissionCpuBatting = {
    teamId,
    // 명단은 레코드 차례 그대로 (0xb891c)
    lineup: rosterLineupOf(BATTERS_PER_TEAM),
    records: Array.from({ length: BATTERS_PER_TEAM }, (_unused, record) => record),
    order,
    specialSwing: {},
  }
  return {
    pitching: null,
    // 마타자 — 첫 0xd 의 0xaae7c(aafca~)가 지금 타순 레코드에 끼운다
    batting: hasAce ? insertMissionAceBatter(batting) : batting,
    pinchHitBlocked: false,
  }
}

/**
 * **0xaae7c 의 마타자 끼우기** (ab078~ab0f4, 모드 5 · 수비가 사람) — `0xb53f0(명부, 마타자, 0)` 으로 레코드 9 에 저장된 마타자를 통째
 * 베끼고(옛 9 번 줄은 끝) `0xb8cb8(팀, team+0x32, 9)` 로 **레코드 [지금 타순 번호] ↔ 레코드 9** 를 맞바꾼 뒤 `0xaea84(팀, 1)` —
 * +0x295 를 세워 확정 0xaebe4(aee4c)가 그 타순 칸의 필살 남은 칸을 −1(0xae9e8)로 되돌린다(다음 타석 앞에 다시 채운다).
 * 인자가 목록 칸이 아니라 **레코드 번호**(= 타순 숫자)라, 목록이 레코드 차례 그대로인 칸이면 지금 타자가 마타자가 된다.
 */
export function insertMissionAceBatter(batting: MissionCpuBatting): MissionCpuBatting {
  const records = [...batting.records]
  const target = batting.order
  records[QUICK_LINEUP_SIZE] = records[target] ?? target
  records[target] = MISSION_ACE_ROSTER_SLOT
  const specialSwing = { ...batting.specialSwing }
  delete specialSwing[lineupSlotOf(batting.order)]
  return { ...batting, records, specialSwing }
}

/** 0x4e136 — 필살 스윙이 나간 틱에 그 타순 칸의 남은 횟수를 줄인 값으로 */
export function withMissionCpuSpecialSwing(team: MissionCpuTeam, order: number, remaining: number): MissionCpuTeam {
  const batting = team.batting
  if (batting === null) return team
  return {
    ...team,
    batting: { ...batting, specialSwing: { ...batting.specialSwing, [lineupSlotOf(order)]: remaining } },
  }
}

/** 명단 칸이 가리키는 레코드에 든 선수 (마스터 줄 또는 마타자 표지) */
function batterRecordAt(batting: MissionCpuBatting, order: number): number {
  const record = rosterSlotAt(batting.lineup, order)
  return batting.records[record] ?? record
}

/** 마운드에 지금 마투수가 서 있는가 — 아니면 상대 투수는 마선수가 아니다 */
export function isMissionCpuMoundAce(team: MissionCpuTeam): boolean {
  const pitching = team.pitching
  return pitching !== null && pitching.roster[pitching.mound.pitcherSlot] === MISSION_ACE_ROSTER_SLOT
}

/** 지금 타순에 선 CPU 타자가 마타자인가 */
export function isMissionCpuBatterAce(team: MissionCpuTeam): boolean {
  const batting = team.batting
  return batting !== null && batterRecordAt(batting, batting.order) === MISSION_ACE_ROSTER_SLOT
}

/** 그 팀 투수 칸의 마스터 줄 (팀 안 0~7) — 마투수 칸이면 null */
function masterPitcherRowAt(pitching: MissionCpuPitching, slot: number): RosterPlayer | null {
  const row = pitching.roster[slot] ?? slot
  if (row === MISSION_ACE_ROSTER_SLOT) return null
  return teamPitchers(pitching.teamId)[row] ?? null
}

/**
 * **`0xb6415(레코드, k, 1)`** — 마스터 줄(Xls 행 0x30 바이트 사본, 0x1ff98)의 기본값에 장비 니블 · 장착 스킬(+0x14)을 얹은 값.
 * 0xb570c 는 모드를 안 가리고 첫머리(b5728)에서 이 함수를 플래그 1 로 부른다. 마스터 줄은 마선수가 아니라(+0xa 비트 6 꺼짐)
 * 레벨 배율 단계는 건너뛴다 — 시즌 레코드 카드가 쓰는 `equippedSeasonAbilityOf` 와 같은 식이다.
 */
export function masterGameAbilityOf(row: RosterPlayer, isPitcher: boolean, slot: number): number {
  return equippedSeasonAbilityOf(
    {
      name: row.name,
      isPitcher,
      base: row.ability,
      profile: row.profile,
      skillBits: row.skillBits,
      equipment: row.equipment,
      fieldPosition: 0,
      isComplete: true,
    },
    slot,
  )
}

/** 원본 0~999 를 투구 엔진 0~100 칸으로 — 나리 타자편 `opponentPitcherAbilityOf` 와 같은 나눗셈 */
const STAGE_PITCHER_DIVISOR = 10

/**
 * **타자 미션 마운드의 마스터 줄 투수가 던지는 능력치** — 마투수가 서 있거나 CPU 수비 팀이 없으면 null(부르는 쪽이 마투수 값을 쓴다).
 *
 * 사람 타석의 투수는 수비 팀의 지금 투수 `0xae83c(팀)` → `0xb89dc(팀, team[0])` — 0xaa57c 가 0xb8c94 로 선발 칸(레코드 +6 아래 4비트)을
 * 0번에 세운 마스터 줄이고, CPU 투수 교체 0xac428 뒤에는 바뀐 줄이다. 투구 AI · 스윙 판정(0x34968 · 0x4dbac · 0xab214)은 0xb570c 를
 * 투수 체력% 0xaebb0(= 마운드 +0x2c / 100)로 부른다:
 * - 0xb570c 는 b5728 에서 0xb6415(P, k, 1) — 장비 · 스킬 보정(`masterGameAbilityOf`)을 먹인 값으로 시작한다.
 * - 모드 갈래(b573a~)는 2(시즌) · 3·4(나리)만 탄다 — 모드 6 은 곧장 b58e6(피로)으로 가고, 팀 능력치 마스크 {1, 2, 8, 9} 에도 없다.
 *   그래서 피로 앞 값이 위 보정값이다(`gameAbility.beforeFatigue`). 피로는 투구 AI 가 `staminaPercent` 로 먹인다.
 * 폼 · 보유 구질 · 마구 번호는 같은 줄의 +0xb · +0x1c · +0x18 (`ROSTER_PITCHER_REPERTOIRES`, 전역 번호 팀 × 8 + 줄).
 */
export function missionCpuMoundPitcherAbilityOf(team: MissionCpuTeam): PitcherAbility | null {
  const pitching = team.pitching
  if (pitching === null) return null
  const slot = pitching.mound.pitcherSlot
  const row = masterPitcherRowAt(pitching, slot)
  if (row === null) return null
  const control = masterGameAbilityOf(row, true, 0)
  const velocity = masterGameAbilityOf(row, true, 1)
  const breaking = masterGameAbilityOf(row, true, 2)
  const repertoire = ROSTER_PITCHER_REPERTOIRES[pitching.teamId * PITCHERS_PER_TEAM + (pitching.roster[slot] ?? slot)]
  return {
    control: Math.round(control / STAGE_PITCHER_DIVISOR),
    velocity: Math.round(velocity / STAGE_PITCHER_DIVISOR),
    breaking: Math.round(breaking / STAGE_PITCHER_DIVISOR),
    gameAbility: { beforeFatigue: { control, velocity, breaking } },
    staminaPercent: staminaPercentOf(pitching.mound.stamina),
    ...(repertoire === undefined
      ? {}
      : { repertoire: { form: repertoire.form, pitchMask: repertoire.pitchMask, magicId: repertoire.magicId } }),
    // 레코드 +0x14 — 실투 판정 0x33cbc 의 투수 비트 16 · 17 · 22 (마스터 줄 = Xls 행 사본)
    skillBits: row.skillBits,
  }
}

/**
 * **투수 미션의 지금 CPU 타자** `0xae89c(공격 팀)` — 타순 `team+0x32` 칸에 선 명단 줄. 마타자 칸이면 `isAce`(줄은 null),
 * 아니면 마스터 팀 타자 줄(Xls 행 사본, 0x1ff98 — 대타로 들어온 벤치 줄 포함). CPU 공격 팀이 없으면(타자 미션) null.
 */
export function missionCpuBatterOf(
  team: MissionCpuTeam,
): { readonly order: number; readonly isAce: boolean; readonly row: RosterPlayer | null } | null {
  const batting = team.batting
  if (batting === null) return null
  const rosterSlot = batterRecordAt(batting, batting.order)
  if (rosterSlot === MISSION_ACE_ROSTER_SLOT) return { order: batting.order, isAce: true, row: null }
  return { order: batting.order, isAce: false, row: teamBatters(batting.teamId)[rosterSlot] ?? null }
}

/**
 * **지금 CPU 타자(마스터 줄)의 경기용 능력치** — 네 칸 모두 `0xb6415(타자, k, 1)`(장비 니블 · 장착 스킬 보정). 마타자 칸이거나
 * CPU 공격 팀이 없으면 null — 부르는 쪽이 마타자 값(레벨 배율)을 쓴다.
 * CPU 타자 결정 0x34334 의 h 는 `0xb570d(ctx, 0, 타자, 1, 90, 1)` — 0xb570c 가 b5728 에서 이 값을 받고 모드 5 는 모드 갈래 ·
 * 팀 능력치 마스크를 안 탄다(부르는 쪽 `gameAbilityOf` 가 0..999 로 자른다).
 */
/** 마스터 줄 타자의 경기용 능력치 네 칸 — `0xb6415(타자, k, 1)` (사람 칸 팀 마스터 타자의 타석 화면도 같은 값) */
export function masterBatterAbilityOf(row: RosterPlayer): BatterAbility {
  return {
    hit: masterGameAbilityOf(row, false, 0),
    power: masterGameAbilityOf(row, false, 1),
    defense: masterGameAbilityOf(row, false, 2),
    run: masterGameAbilityOf(row, false, 3),
  }
}

export function missionCpuBatterAbilityOf(team: MissionCpuTeam): BatterAbility | null {
  const batter = missionCpuBatterOf(team)
  if (batter === null || batter.row === null) return null
  return masterBatterAbilityOf(batter.row)
}

/** 미션 마투수의 간이 타석 재료 — 레벨 배율 먹은 네 칸(0xb6414, 레코드 +0xc 부터 제구 · 구속 · 변화 · 체력) */
export interface MissionAcePitcher {
  readonly quick: QuickAtBatPitcher
  readonly staminaAbility: number
  /** 이름 0xb62c0 — 0x21 중계의 "PITCHER" 판(0x420dc)이 쓴다 */
  readonly name?: string
}

/** 타자 미션의 마투수 (마투수 미션이 아니면 undefined) */
export function missionAcePitcherOf(
  mission: OriginalMission,
  aceLevels?: Readonly<Record<number, number>>,
): MissionAcePitcher | undefined {
  if (mission.side !== '타자' || mission.opponentAce <= 0) return undefined
  const ace = ACE_PITCHERS[mission.opponentAce - 1]
  if (ace === undefined) return undefined
  const ability = aceAbilityAtLevel(ace.ability, aceLevelOf(aceLevels, aceLevelSlotOf('투수', mission.opponentAce)))
  return {
    quick: { control: ability.hit, velocity: ability.power, stamina: ability.run, skillIds: [] },
    staminaAbility: ability.run,
    name: ace.name,
  }
}

/** `0x66864` 의 모드 6 갈래 — 사람 타석 0x3d954 와 간이 엔진 0xc1ba4(c1c78) 둘 다 이것으로 투수 교체를 막는다 */
export function isMissionPitcherChangeBlocked(mission: OriginalMission): boolean {
  return mission.side === '타자' && PITCHER_CHANGE_BLOCKED_SLOTS.includes(missionSlotOf(mission))
}

/**
 * 팀 투수 칸의 0xac428 · 0xabfcc 재료 — 리그 `defenseOf` · 타자편 `quickDefenseOf` 와 같은 모양.
 * `ace` 를 주면 마투수 칸이 그 레코드로 던지고 그 체력 칸으로 깎인다(간이 엔진 — 자동진행 반 이닝).
 */
export function missionPitchingDefenseOf(
  pitching: MissionCpuPitching,
  lead: number,
  options: { readonly ace?: MissionAcePitcher; readonly pitcherChangeBlocked?: boolean } = {},
): HalfInningDefense {
  const masters = teamPitchers(pitching.teamId)
  const isAce = (slot: number) => pitching.roster[slot] === MISSION_ACE_ROSTER_SLOT
  const masterAt = (slot: number) => masters[pitching.roster[slot] ?? slot] ?? masters[0]
  return {
    mound: pitching.mound,
    pitcherSlots: pitching.roster.map((_master, slot) => slot),
    pitcherAt: (slot) => (isAce(slot) && options.ace !== undefined ? options.ace.quick : quickPitcherOf(masterAt(slot))),
    // 투수 능력치 칸 3 = 체력 — 소모(0x66e44 용량)에만 쓴다. 사람 타석의 마투수 소모는 세션이 든다(`ace` 를 안 넘긴다)
    staminaAbilityAt: (slot) =>
      isAce(slot) && options.ace !== undefined ? options.ace.staminaAbility : masterAt(slot).ability[3],
    // 벤치 줄의 +0x2c — 마스터 줄은 모두 10000 이고 미션 한 판 안에서는 벤치가 안 던진다
    staminaAt: () => FULL_STAMINA,
    lead,
    // 0x66e44 의 V = 0x1f9a8(앱, 모드, 팀) — 모드 5·6·7 은 0x1fa1e(늘 0)라 V 가 없어 사기 100
    morale: 100,
    // 0xb6c20 — 미션은 사람 칸 0 · 다른 칸 1 (aa658·aa666)
    bothTeamsAreCpu: false,
    // 보직은 줄째 따라간다 — 마스터 줄 +0xb & 3 (팀 안 차례 0,0,0,0,1,1,1,2). 마투수 칸은 표 밖이라 없다
    roleAt: (slot) => (isAce(slot) ? undefined : rosterPitcherRoleOf(pitching.roster[slot] ?? slot)),
    abilitySumAt: (slot) =>
      pitcherAbilitySumOf(masterAt(slot).ability.map((value) => Math.min(999, Math.max(0, value)))),
    isSpecialPitcherAt: isAce,
    // 소모 0xa5e14 의 비트 18 · 10 — 마스터 줄 +0x14 (Xls 행 사본). 마투수 소모는 세션이 든다
    skillBitsAt: (slot) => masterPitcherRowAt(pitching, slot)?.skillBits ?? 0,
    ...(options.pitcherChangeBlocked === true ? { pitcherChangeBlocked: true } : {}),
  }
}

const MAXIMUM_COUNTER = 99

/**
 * **점수판 득점** — 득점 처리 0xa5c34 가 1점마다 수비 투수의 A(+0x284) · B(+0x280)를 올린다(99 에서 멈춤, P7 E1).
 * 타자 미션에서만 뜻이 있다(CPU 가 수비). `inningEnded` 면 이어서 이닝 교대 0xa5b00 이 A 를 0 으로 —
 * 사람 칸 반 이닝이 3아웃이면 그 자리가 이닝 교대다(뒤이어 자동진행 — `missionRun.runBatterMissionAutoHalves`).
 */
export function missionCpuAfterRuns(team: MissionCpuTeam, runs: number, inningEnded: boolean): MissionCpuTeam {
  const pitching = team.pitching
  if (pitching === null || (runs <= 0 && !inningEnded)) return team
  const inningRuns = Math.min(MAXIMUM_COUNTER, pitching.inningRunsAllowed + runs)
  return {
    ...team,
    pitching: {
      ...pitching,
      mound: { ...pitching.mound, runsAllowed: Math.min(MAXIMUM_COUNTER, pitching.mound.runsAllowed + runs) },
      inningRunsAllowed: inningEnded ? 0 : inningRuns,
      ourRuns: pitching.ourRuns + Math.max(0, runs),
    },
  }
}

/**
 * **CPU 공격 타석 정산** — 0xa8024 가 그 타순 칸 기록(안타 +0x12 · 홈런 +0x13 · 타석 +0x14)을 올리고, 타석이 끝났으니
 * 0xaf020 이 타순을 (+1) mod 9 로 넘긴다. 투수 미션에서만 뜻이 있다(CPU 가 공격).
 */
export function missionCpuAfterPlateAppearance(team: MissionCpuTeam, outcome: AtBatOutcome): MissionCpuTeam {
  const batting = team.batting
  if (batting === null) return team
  return {
    ...team,
    batting: {
      ...batting,
      lineup: recordLineupPlay(batting.lineup, batting.order, outcome),
      order: lineupSlotOf(batting.order + 1),
    },
  }
}

/**
 * **공 하나** — 투구 처리 0xa5e14 (모드 갈래 없음, 0x3dec6). state[0xd](a5e72) · state[0xe](a5e7c)를 내리고, 던진 투수의
 * 투구 수 +0x27c 를 올리고 스태미나를 깎는다(0xaeb08). 투수 미션은 사람이 던지므로 막음 칸만 내린다.
 * 마투수 스태미나는 세션이 따로 든다(`missionOpponentStaminaAfterPitch`) — 여기서는 판정 때 받는다.
 */
export function missionCpuAfterPitch(
  team: MissionCpuTeam,
  pitch: {
    readonly pitchTypeNumber: number
    readonly batterIntimidates: boolean
    /** 마투수가 마운드면 세션이 깎은 그 레코드 +0x2c (`missionOpponentStaminaAfterPitch`) — 안 주면 그대로 */
    readonly aceStamina?: number
  },
): MissionCpuTeam {
  const pitching = team.pitching
  if (pitching === null) return team.pinchHitBlocked ? { ...team, pinchHitBlocked: false } : team
  const mound = pitching.mound
  const isAce = pitching.roster[mound.pitcherSlot] === MISSION_ACE_ROSTER_SLOT
  const stamina = isAce
    ? (pitch.aceStamina ?? mound.stamina)
    : drainPitcherForPitch(missionPitchingDefenseOf(pitching, 0), mound, pitch.pitchTypeNumber, pitch.batterIntimidates)
  return {
    ...team,
    pinchHitBlocked: false,
    pitching: {
      ...pitching,
      mound: { ...mound, stamina, pitches: Math.min(MAXIMUM_COUNTER * 100, mound.pitches + 1), justChanged: false },
    },
  }
}

/** 새 타석 0xd(0x48d50 48eb6) — state[0xe] 를 내린다 (앞 상태가 0x16 이면 건너뛰지만 그 길은 0xf 재진입이라 여기 안 온다) */
export function missionCpuAtNewPlateAppearance(team: MissionCpuTeam): MissionCpuTeam {
  return team.pinchHitBlocked ? { ...team, pinchHitBlocked: false } : team
}

/** 0xf 진입에서 난 CPU 교체 — 소리(22 · 등판음)와 0x16 → 0xd → 0xe 를 부르는 쪽이 잇는다 */
export interface MissionCpuSubstitution {
  readonly kind: '투수교체' | '대타'
  /** 들어온 선수가 마선수인가 — 등판음 0x38b64 의 26 */
  readonly incomingIsAce: boolean
}

export interface MissionPitchSelectionSituation {
  readonly mission: OriginalMission
  /** 주자 수 (0xa9598) */
  readonly runnerCount: number
  readonly balls: number
  readonly strikes: number
  /** 마투수가 마운드면 그 스태미나 +0x2c (세션 `missionOpponentStaminaAfterPitch` 값). 아니면 안 본다 */
  readonly aceStamina: number
  /** `st[0x6b]` 0부터 센 이닝 (`MissionRun.game`). 안 주면 시작 이닝 */
  readonly inningIndex?: number
  /** 리드 0xb69b0(수비 − 공격) = CPU 점수 − 사람 칸 점수 (`MissionRun.game.scores`). 안 주면 시작 점수 + 사람 득점으로 */
  readonly lead?: number
}

/**
 * **상태 0xf 진입 `0x3d954`** — 공 하나를 고르기 전마다 (위 머리글). 바꾸면 바뀐 팀과 무엇이 났는지, 아니면 받은 팀 그대로.
 * 난수: 모드 5 는 0xac228 의 막는 칸이 다 열려야 `rand(0, 1000)`, 들면 `rand(0, 벤치)`. 모드 6 은 0xac360 이 벤치에
 * 마선수가 있을 때만 구르는데 미션 팀 벤치에는 마선수가 없어(마투수는 0번 칸) 굴림이 없다.
 */
export function enterMissionPitchSelection(
  team: MissionCpuTeam,
  situation: MissionPitchSelectionSituation,
  random: RandomPort,
): { readonly team: MissionCpuTeam; readonly substitution: MissionCpuSubstitution | null } {
  const unchanged = { team, substitution: null }
  const { mission } = situation
  const pitching = team.pitching
  if (pitching !== null) {
    // 0x66864 — 모드 6 은 +0xbd ∈ {3, 7} 이면 막는다
    if (PITCHER_CHANGE_BLOCKED_SLOTS.includes(missionSlotOf(mission))) return unchanged
    const lead = situation.lead ?? mission.start.opponentScore - (mission.start.ourScore + pitching.ourRuns)
    const isAceMound = pitching.roster[pitching.mound.pitcherSlot] === MISSION_ACE_ROSTER_SLOT
    const mound = isAceMound ? { ...pitching.mound, stamina: situation.aceStamina } : pitching.mound
    const after = changePitcherIfNeeded(
      missionPitchingDefenseOf({ ...pitching, mound }, lead),
      mound,
      {
        // state[0x6b] — 0xaa57c 가 레코드 +3 아래 4비트로 적고 말이 끝날 때마다 0xb6b6c 가 올린다 (`MissionRun.game`)
        inningIndex: situation.inningIndex ?? mission.start.inning - 1,
        lead,
        runnerCount: situation.runnerCount,
        inningRunsAllowed: pitching.inningRunsAllowed,
        random,
        // 3da34 — 일곱째 인자 0, `[sp+4]`(모드 3) · `[sp+8]`(강제) 0
        minimumBench: 0,
      },
    )
    if (after === mound) return unchanged
    return {
      team: { ...team, pitching: { ...pitching, mound: after, inningRunsAllowed: 0 } },
      substitution: { kind: '투수교체', incomingIsAce: pitching.roster[after.pitcherSlot] === MISSION_ACE_ROSTER_SLOT },
    }
  }
  const batting = team.batting
  if (batting === null) return unchanged
  const pinch = tryQuickCpuPinchHit(
    batting.lineup,
    batting.order,
    {
      alreadyUsedThisGame: team.pinchHitBlocked,
      runnerCount: situation.runnerCount,
      strikes: situation.strikes,
      balls: situation.balls,
      // 0xae89c(공격 팀) 마선수(0xb633c) — 마타자 칸이면 굴림 없이 안 낸다
      batterIsAce: isMissionCpuBatterAce(team),
    },
    random,
  )
  if (pinch === null) return unchanged
  return {
    // state[0xe] = 1 (ac33e)
    team: { ...team, pinchHitBlocked: true, batting: { ...batting, lineup: pinch.lineup } },
    substitution: { kind: '대타', incomingIsAce: batting.records[pinch.incomingRosterSlot] === MISSION_ACE_ROSTER_SLOT },
  }
}

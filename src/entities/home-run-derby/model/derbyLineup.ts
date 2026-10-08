import { BATTERS_PER_TEAM, teamBatters } from '@/entities/team/model/teamRoster'
import type { RosterPlayer } from '@/shared/config/original/roster'
import type { BatterAbility } from '@/entities/batting/model/batter'
import { masterBatterAbilityOf } from '@/entities/mission/model/missionCpuTeam'

/**
 * **홈런더비의 공격 팀(팀 0) 타순** (직접 떴다) — 볼넷 · 사구 뒤에는 원본도 타순 다음 칸 타자가 친다.
 *
 * 팀 세우기 — 경기 초기화 0x39fdc 모드 7 갈래:
 * ```
 * 3a500  0xb891c(장면[0x228], 7, r7, −1)   ; 팀 0 = 내 타자편 팀 r7 — 0xb8680 은 모드 7 이면 b8728 → 0x1f8c1 마스터 명부
 * 3a53c  P = 0x1fc20(앱)                    ; 모드 타자 기록 (나리 타자편 저장 선수 · 명예 타자)
 * 3a546  0xb87cc(팀 0)                      ; → 0xb53f0(명부, P, 1) · 0xb8768(팀) · 팀+0x27++ · 팀+0x28c++
 * 3a550  팀+0x32 = 0xb6394(P) = P+0xa & 0x1f   ; 지금 타순 = k
 * ```
 * - 0xb53f0 의 0x80(내 선수) 갈래 b549e~b5530 (명예 타자는 0x20 갈래 b5532~ 가 같은 옮김): 타자 배열을 한 칸 늘리고(0xb4e34)
 *   옛 [k] 를 끝 칸으로 베낀 뒤 [k] 에 P 를 0x30 바이트 통째로 — **수비 위치(+0x1c)는 옛 [k] 선수 것**(b54b6 · b551a 0xb8e85).
 *   그래서 나머지 칸은 **마스터 팀 r7 의 타자 줄 그대로**다.
 * - 0xb8768 은 명부 첨자를 다시 매기고(0xb603c) `팀[0xe + i] = i` (b87a8) — 타순 칸 j 는 명부 줄 j 다.
 * - 지금 타자 0xae89c(팀) = 0xb8a34(팀, 팀[0xe + 팀[0x32]]) = 명부 줄 [팀+0x32].
 *
 * 타순이 넘어가는 길 — 판정 스위치 0x3dfac 의 볼넷 v3(0x3e1ae) → 사구 v4(0x3e1b4) 가 `0xaf020(공격 팀, 0)`:
 * ```
 * af02e  팀+0x291 ≠ 0 이면 아무것도 안 한다          ; 이미 예약이 서 있으면 다시 안 센다
 * af032  팀+0x291 = 1 · 팀+0x293 = (팀+0x32 + 1) mod 9
 * ```
 * 확정은 상태 0xd 진입 0x48d50 의 48ddc `0xaebe4(공격 팀, 0)` — aec8c 팀+0x291 ≠ 0 이고 +0x293 ≤ 8 이면 aedee 팀+0x32 = +0x293 ·
 * 팀+0x291 = 0. 0x48d50 에는 모드 7 이 타순을 되돌리는 곳이 없다(48d8e~48dd4 는 마투수 복사뿐). 맞은 공의 판 끝 0x35108 은
 * 플레이 종류 [+0x118] 이 8(더비 판)이면 0xaf020 을 안 부른다(3513a). 더비의 0xd 는 첫 공 앞 · 단계가 오를 때 · 보너스를 열 때뿐이라:
 * - 볼넷 · 사구가 나도 **그 0xd 까지는 같은 타자**가 치고, 그 사이 볼넷 · 사구가 또 나도 예약은 한 칸뿐이다.
 * - 0xd 를 지나면 타순 다음 칸 — 마스터 팀 r7 의 타자 줄 — 이 치고, 그 뒤 볼넷 · 사구 · 0xd 마다 또 한 칸씩 넘어간다.
 *   타순이 한 바퀴 돌아 k 에 오면 다시 모드 타자다. 원본 버그로 보이나 그대로 옮긴다.
 * - 타석 교대 0x47cc8(0x48d50 의 48e90 — 0xaebe4 뒤)이 지금 타자 0xae89c 로 타자 그림(손 0xb63c0 · 장비 +0x19 …)을 다시 싣고,
 *   스윙 판정 0xab214 · 실투 0x33d52 도 지금 타자 기록을 본다 — 능력치 · 스킬 · 그림 모두 그 줄 것이다.
 * 다시하기 · 재도전은 장면을 새로 세워(0x39fdc) 다시 k 부터다.
 */
export interface DerbyLineup {
  /** 팀 0 의 명부 팀 r7 (팀 객체 +0x25) — 마스터 명부 0x1f8c1 */
  readonly teamId: number
  /** 모드 타자가 든 명부 칸 k = 0xb6394(P) */
  readonly modeBatterSlot: number
  /** 지금 타순 팀+0x32 */
  readonly order: number
  /** 예약된 다음 타순 — 팀+0x291 이 서 있으면 +0x293, 아니면 null */
  readonly reservedOrder: number | null
}

/** 타순 한 바퀴 — 0xaf020 의 mod 9 (0xca911) */
const LINEUP_SIZE = 9

/**
 * **명예 타자의 칸 k** — 등록 0x1f680 이 +0xa = 0x20 을 통째로 적어(1f682 · 1f684) 0xb53f0 의 0x20 갈래가 k = 0x20 & 0x1f = 0 으로
 * 옮긴다(미션 사람 칸 팀과 같은 길 — Q2 2e-2). ⚠️ 미해결: 시즌 영입 0xc554 의 `0xb6604(원본, j)` 가 명전 기록 +0xa 아래 5비트를
 * 고친다(S6 4-4)는데 웹 명전 기록에는 그 칸이 없다 — 미션과 같이 0 으로 둔다.
 */
export const DERBY_HALL_OF_FAME_BATTER_SLOT = 0x20 & 0x1f

/**
 * **나리 저장 선수의 내 줄이 레코드에 없을 때의 칸** — 미션 `nariBatterRecordSlot` 과 같은 자리값(끝 칸 12).
 * ⚠️ 미해결: 원본은 0x1faa1 이 못 찾아 [저장+0x38] 에 옛 칸 주소가 남는다 — 그때 k 가 무엇인지는 안 읽었다.
 */
export const DERBY_MISSING_BATTER_SLOT = BATTERS_PER_TEAM

/** 경기 초기화 0x39fdc 모드 7 — 팀 0 을 세우고 팀+0x32 = k */
export function createDerbyLineup(teamId: number, modeBatterSlot: number): DerbyLineup {
  return { teamId, modeBatterSlot, order: modeBatterSlot, reservedOrder: null }
}

/** `0xaf020(공격 팀, 0)` — 볼넷 · 사구. 예약이 이미 서 있으면 그대로 */
export function reserveDerbyNextBatter(lineup: DerbyLineup): DerbyLineup {
  if (lineup.reservedOrder !== null) return lineup
  return { ...lineup, reservedOrder: (lineup.order + 1) % LINEUP_SIZE }
}

/** 상태 0xd 진입 48ddc `0xaebe4(공격 팀, 0)` — 예약이 서 있으면 타순을 그 칸으로 */
export function confirmDerbyNextBatter(lineup: DerbyLineup): DerbyLineup {
  if (lineup.reservedOrder === null) return lineup
  return { ...lineup, order: lineup.reservedOrder, reservedOrder: null }
}

/** 지금 타자 0xae89c — 모드 타자 칸이면 `isModeBatter`, 아니면 마스터 팀 r7 의 타자 줄 (없으면 null) */
export type DerbyLineupBatter =
  | { readonly isModeBatter: true; readonly order: number }
  | { readonly isModeBatter: false; readonly order: number; readonly row: RosterPlayer | null }

export function derbyLineupBatterOf(lineup: DerbyLineup): DerbyLineupBatter {
  if (lineup.order === lineup.modeBatterSlot) return { isModeBatter: true, order: lineup.order }
  // 타순은 k 아니면 (… + 1) mod 9 라 0~8 — 그 칸은 마스터 줄 그대로다(옛 [k] 가 간 끝 칸 12 에는 닿지 않는다)
  return { isModeBatter: false, order: lineup.order, row: teamBatters(lineup.teamId)[lineup.order] ?? null }
}

/**
 * **모드 타자의 수비 위치** — 0xb53f0 이 [k] 에 넣은 사본의 +0x1c 는 옛 [k] 선수(마스터 팀 r7 의 타자 줄 k)의 것이다(b54b6 · b551a).
 * 상태 0xe 소개 판의 수비 칸(0x54590)이 이 값을 그린다. k 가 마스터 줄 밖이면 undefined.
 */
export function derbyModeBatterPositionOf(lineup: DerbyLineup): number | undefined {
  const row = teamBatters(lineup.teamId)[lineup.modeBatterSlot]
  return row?.position === undefined ? undefined : row.position & 0xf
}

/** 마스터 타자 줄이 타석에 설 때의 재료 — 능력치 · 장착 스킬 · 겉모습 · 이름 */
export interface DerbyMasterBatter {
  /** 0xb6415(타자, k, 1) — 장비 니블 · 장착 스킬 보정 (`masterBatterAbilityOf`, 미션 마스터 타자와 같은 값) */
  readonly ability: BatterAbility
  /** +0x14 의 켜진 비트 (0xb62b4) */
  readonly skillIds: readonly number[]
  /** 폼 = +0xb 윗 니블 (2 × 타입 + 손, 0x10810 · 0x47cc8 의 0xb63c0) */
  readonly form: number
  /** 피부 = +0xb 비트 2~3 */
  readonly skinIndex: number
  /** 장비 니블 +0x19 · +0x1a (히트 · 파워 · 수비 · 주루 순) */
  readonly equipmentLevels: BatterAbility
  /** 0xb62c0 — 마스터 줄 이름 */
  readonly name: string
  /** +0x1c & 0xf */
  readonly position: number | undefined
}

const SKILL_BITS = 32

export function derbyMasterBatterOf(row: RosterPlayer): DerbyMasterBatter {
  const [hit, power, defense, run] = row.equipment
  return {
    ability: masterBatterAbilityOf(row),
    skillIds: Array.from({ length: SKILL_BITS }, (_unused, bit) => bit).filter((bit) => ((row.skillBits >>> bit) & 1) === 1),
    form: (row.profile >> 4) & 0xf,
    skinIndex: (row.profile >> 2) & 3,
    equipmentLevels: { hit, power, defense, run },
    name: row.name,
    position: row.position === undefined ? undefined : row.position & 0xf,
  }
}

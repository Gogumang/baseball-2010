import type { MissionCpuTeam } from '@/entities/mission/model/missionCpuTeam'
import type { MissionGame } from '@/entities/mission/model/missionGame'
import type { OriginalMission } from '@/shared/config/original/missions'
import type { BaseRunners, BaseState, QuickLineup, RunnerAces, defenseFielderPlatesOf } from '@/entities/mission/model/missionRunners/otherSlices'

/**
 * **미션 경기의 주자 신원** — 미션도 모드 5 · 6 짜리 보통 경기(장면 0x104)라 주자 목록(sim+0x80)이 선수 레코드를 든다
 * (`entities/game/model/baseRunners` 머리말). 웹은 루별 신원을 **사람이 맡은 반 이닝의 공격 팀 타순 칸**(0~8)으로 든다:
 * - 타자 미션(모드 6) — 공격 = 사람 칸 팀(`game.humanBatting`, 미션 타자 칸 `MISSION_NARI_RECORD` 포함)
 * - 투수 미션(모드 5, 투수편 마선수 대결 포함) — 공격 = CPU 팀(`cpu.batting`, 마타자 칸 `MISSION_ACE_ROSTER_SLOT` 포함)
 *
 * 시작 주자는 0xd 의 `0xaae7c(…, 0xd, 0x18, 0)` aafbc 가 `0xa9a9c(장면+0x18 주자관리, 팀[st[9]] 공격, 팀[st[0xa]] 수비,
 * 레코드 +5 의 1 · 2 · 3루 비트)` → `0xa9a10` 으로 세운다 — 앞선 찬 루부터 공격 팀 지금 타자 칸(team+0x32)에서 거꾸로 1 · 2 · 3 번째
 * 타순 칸(`runnersBehindCursor`). 그 0xd 앞 48c86 의 `0xaae7c(…, 1)` 이 마타자를 지금 타순 칸에 끼운 뒤라 주자는 마타자가 아니다.
 * 그 뒤 신원은 판마다 주자 운명(`survivorsFromBase`)으로 민다 — 다른 경기 모드(`GameState.runners`)와 같은 규칙이다.
 * 3아웃이면 빈 루다. 홈런더비(모드 7)는 0x46418 이 0xa9250 으로 주자를 비우고 타자주자를 안 만들어(464d8) 주자가 없다.
 */
export interface MissionRunnerSituation {
  readonly mission: Pick<OriginalMission, 'side'>
  readonly bases: BaseState
  /** 루에 선 주자의 신원(공격 팀 타순 칸). 없거나 루와 어긋나면 예전 근사(지금 타순에서 거꾸로 센다) */
  readonly runners?: BaseRunners
  readonly game: Pick<MissionGame, 'humanBatting'>
  readonly cpu: Pick<MissionCpuTeam, 'batting'>
}

/** 사람이 맡은 반 이닝의 공격 타선 — 명단 · 레코드 칸 · 지금 타순 칸 */
export interface MissionOffense {
  readonly teamId: number
  readonly lineup: QuickLineup
  readonly records: readonly number[]
  readonly order: number
}

/** 그 타순 칸에 선 사람 · 마선수 밖 선수의 경기용 주력 바깥 값 — 미션 타자 · 마타자는 부르는 쪽이 안다 */
export interface MissionSpecialRunners {
  /** 미션 타자(나리 타자편 저장 · 명예 타자)의 경기용 주력 */
  readonly missionBatterRun?: number
  /** 투수 미션 마타자의 경기용 주력 (마선수 레코드 레벨 배율) */
  readonly aceBatterRun?: number
}

/** 진행기 기본 주루(등급 3 = 500) — 미션 타자 · 마타자 값을 모르면 */
export const DEFAULT_RUN_ABILITY = 500
/** 수비 아홉 칸 (0 투수 … 8 중견) */
export const FIELDER_COUNT = 9
/** 타순 아홉 칸 */
export const QUICK_LINEUP_SLOTS = 9

/** 미션 경기에서 수비 판이 보는 두 팀 — 사람 칸 팀 타선과 (타자 미션이면) CPU 팀 타선 */
export interface MissionDefenseSituation {
  readonly mission: Pick<OriginalMission, 'side'>
  readonly game: Pick<MissionGame, 'humanBatting' | 'cpuAutoBatting'>
  /**
   * **야수 칸 0 의 +0xec** — 미션 시작 첫 0x18 판의 0x3fac4 가 적은 수비 팀 레코드(`records` 칸, 그때 자리 니블 1 = 지명타자 —
   * `missionBoardFielderZeroOf`). 첫 반 이닝이 사람 몫이 아니라 판이 안 섰으면 null(+0xec = 0). 미션은 3아웃 뒤 0x18 이 늘 0x21 이라
   * 판이 다시 안 서므로 미션 내내 이 레코드다 — 자동진행 반 이닝의 대타(0xc1ba4 → 0xaebe4)가 지명 자리를 다른 레코드로 옮겨도 그대로다.
   * 안 주면(옛 입구) 지금 지명타자로 본다
   */
  readonly fielderZeroRecord?: number | null
}

/** 미션 수비 판에 먹이는 능력치 — 아홉 칸 수비와 루별 주루(0 = 타자주자), 그리고 그림 전용 이름 판 · 마선수 주자 */
export interface MissionPlayAbilities {
  readonly defenseAbilities: readonly (number | null)[]
  readonly runAbilities: Partial<Record<0 | 1 | 2 | 3, number>>
  /** 수비 칸별 스킬 번호 — 레이저 0x66a8c · 필살수비의 초감각(21) (`missionFielderSkillIdsOf`) */
  readonly fielderSkillIds?: readonly (readonly number[])[]
  /** 수비 칸별 이름 판 선수 (0x43cb0 — `missionFielderPlatesOf`). 안 주면 고리만 그린다 */
  readonly fielderPlates?: ReturnType<typeof defenseFielderPlatesOf>
  /** 공격 팀 타자 · 루 위 주자의 마선수 번호 (주자 그림 0x79d10 · 적재 0x483a0 — `missionRunnerAcesOf`) */
  readonly runnerAces?: RunnerAces
  /**
   * 야수 · 주자 그림 팔레트 — 수비 · 공격 팀 번호 (defender.mpl 15벌 = 팀 번호, C-1). 미션은 경기[0x28 + 칸]의 두 팀
   * (`missionTeamIdsOf` — 사람 칸 · CPU 칸)에서 수비측 st[0xa] 로 고른다: 타자 미션은 CPU 수비, 투수 미션은 사람 칸 수비
   * (`missionDefenseFieldersOf` 와 같은 갈래). 그림 전용이라 난수와 무관하다
   */
  readonly defenseTeamIndex?: number
  readonly offenseTeamIndex?: number
}

/** 이름 판 · 마선수 주자를 고르는 데 쓰는 미션 경기 — 수비 팀 마운드(`cpu.pitching`) · 미션 투수 · 마선수 순번 */
export type MissionPlateSituation = MissionRunnerSituation &
  MissionDefenseSituation & {
    readonly mission: Pick<OriginalMission, 'side' | 'opponentAce'>
    readonly cpu: Pick<MissionCpuTeam, 'batting' | 'pitching'>
    /**
     * 투수 미션(모드 5)의 미션 투수 — 이름 0xb62c0 · 보직 0xb6dec(레코드 +0xb & 3). 선수 게터 0x1fbd0 의 기록(나리 투수 · 명예 투수).
     * 안 주면(대체 투수) 칸 0 판이 없다
     */
    readonly missionPitcher?: { readonly name: string; readonly role?: number }
  }

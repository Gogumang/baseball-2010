import type { OriginalMission } from '@/shared/config/original/missions'
import type { HalfInningMound, HeldCpuMagic, QuickAtBatPitcher, QuickLineup } from '@/entities/mission/model/missionCpuTeam/otherSlices'

/** 마선수가 들어선 명부 칸 표시 — 마스터 팀 줄이 아니다 */
export const MISSION_ACE_ROSTER_SLOT = -1

/** 팀 객체 투수 칸 수 — 마스터 팀 투수 8 줄 (`team+0x26`) */
export const PITCHERS_PER_TEAM = 8
/** 마스터 팀 타자 12 줄 — 벤치 `team+0x28c` = 12 − 9 */
export const BATTERS_PER_TEAM = 12

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
  /**
   * **CPU 팀 남은 마구 +0x28 · 공 객체 +0x10** — 타자 미션 사람 타석의 CPU 투구가 고르고(0x344dc) 줄이고(0x345fc) 싣는다(0x3de10).
   * 타석 교대 0xaebe4 가 +0x28 이 음수일 때만 채우므로(aeea8 → aeeae `bge`) 같은 투수가 서 있는 동안 미션 한 판 내내 이어지고,
   * 교체 가지만 −1 로 비운다(aec7a). 타석 화면(`BattingStage.cpuMagic`)은 이 값의 사본으로 고른다. 없으면 새 경기 값
   */
  readonly magic?: HeldCpuMagic
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

/** 미션 마투수의 간이 타석 재료 — 레벨 배율 먹은 네 칸(0xb6414, 레코드 +0xc 부터 제구 · 구속 · 변화 · 체력) */
export interface MissionAcePitcher {
  readonly quick: QuickAtBatPitcher
  readonly staminaAbility: number
  /** 이름 0xb62c0 — 0x21 중계의 "PITCHER" 판(0x420dc)이 쓴다 */
  readonly name?: string
  /** 레코드 +0x14 장착 스킬 비트 — XlsACE_PIT_DATA 행 그대로 (`acePlayers.skillBits`) */
  readonly skillBits?: number
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
  /** 스킬 14(투지) 갈래의 경기 상태가 CPU(수비) 팀에 섰나 — 마무리 정렬 열쇠 0xb5b50 이 본다 (`missionFightingSpiritOf`). 안 주면 거짓 */
  readonly fightingSpirit?: boolean
}

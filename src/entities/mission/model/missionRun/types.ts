import type { OriginalMission } from '@/shared/config/original/missions'
import type { MissionProgress } from '@/entities/mission/model/missionGoal'
import type { MissionCpuTeam } from '@/entities/mission/model/missionCpuTeam'
import type { MissionGame } from '@/entities/mission/model/missionGame'
import type { BaseRunners, BaseState } from '@/entities/mission/model/missionRun/otherSlices'

/**
 * 미션 한 판의 진행 상태.
 *
 * 원작 미션은 "제한 조건 내에서 목표 달성"이다 (StrHOWTO[27]).
 * 제한은 원본 레코드에 숫자로 들어 있다 — 제한 시간, 타석 수, 스윙 수.
 * 설명문("3타석 내에", "3번의 스윙으로")과 모두 일치한다.
 * 시작 상황(주자·아웃)도 레코드에 있어 타점은 주자 진루 규칙으로 센다 (예전에는 홈런만 타점이었다).
 */

export type MissionStatus = '진행중' | '성공' | '실패'

export interface MissionRun {
  readonly mission: OriginalMission
  readonly progress: MissionProgress
  readonly status: MissionStatus
  /** 남은 시간(초). 제한이 없으면 null. */
  readonly remainingSeconds: number | null
  /** 남은 타석 수. 제한이 없으면 null. */
  readonly remainingPlateAppearances: number | null
  /** 남은 스윙 수. 제한이 없으면 null. */
  readonly remainingSwings: number | null
  /** 누상 주자 */
  readonly bases: BaseState
  /**
   * **루에 선 주자의 신원** — 사람이 맡은 반 이닝의 공격 팀 타순 칸(`missionRunners`). 없거나 루와 어긋나면(옛 판) 예전 근사로 본다
   */
  readonly runners?: BaseRunners
  /** 현재 아웃 */
  readonly outs: number
  /**
   * 상대 CPU 팀 — 0xaa57c 가 세운 다른 칸 팀과 0xf 진입 0x3d954 의 CPU 교체가 보는 칸들 (`missionCpuTeam`).
   * 타자 미션은 CPU 수비 투수진(실점 A·B), 투수 미션은 CPU 공격 타선(타순 칸 기록)을 든다.
   */
  readonly cpu: MissionCpuTeam
  /** 경기의 이닝 · 공수 · 점수판과 자동진행 반 이닝이 쓰는 팀 (`missionGame`) */
  readonly game: MissionGame
  /**
   * 야수 칸 0 의 +0xec — 첫 0x18 판의 0x3fac4 가 적은 수비 팀 레코드(판이 안 섰으면 null). 미션 한 판에 판은 그 하나뿐이다
   * (`missionRunners.MissionDefenseSituation.fielderZeroRecord`)
   */
  readonly fielderZeroRecord?: number | null
}

/** 한 반 이닝의 아웃 수 — 3아웃이면 빈 루 · 0아웃으로 넘긴다 */
export const OUTS_PER_INNING = 3

import type { OriginalMission } from '@/shared/config/original/missions'
import type { MissionGame } from '@/entities/mission/model/missionGame/types'

export function humanSideOf(mission: OriginalMission): 0 | 1 {
  return mission.humanSide === 0 ? 0 : 1
}

export function cpuSideOf(mission: OriginalMission): 0 | 1 {
  return mission.humanSide === 0 ? 1 : 0
}

/**
 * **마선수 대결이 연 미션** — 이벤트 SYS 8(0x8d734 → 0x8d764)이 미션 장면으로 나가기 전에 적는 칸 (직접 재역어셈 0x8d782~0x8d846).
 * 타자편(0x7b971 참)은 g[0xf7] = team − 1 · **g[0x11f] = 1**, 투수편(0x7b985 참)은 g[0x175] = team − 1 · **g[0x176] = 1** 을 적고,
 * 두 갈래 모두 8d836~8d846 에서 **g[0xf6] = 그때 모드**(0x1552d10)를 적는다 — 나리 이벤트면 3(투수편) · 4(타자편).
 */
export interface MissionAceMatchOrigin {
  /** g[0xf6] — SYS 8 이 적은 그때 모드 (2 시즌 · 3 나리 투수편 · 4 나리 타자편) */
  readonly originalMode: number
  /**
   * 그 모드 저장 레코드(+0x11c 꼴) **+1 = 팀** — 모드 2 면 `0x1f55c(저장)` = [저장+0xb4]+0x11c(시즌 레코드 SR, SR[1] = 고른 팀),
   * 3·4 면 `0x1f8d4(저장, 모드)` = [저장+0xb8 · +0xbc]+0x11c(나리 투수편 · 타자편 레코드, 시즌 레코드와 같은 꼴 — H2 2-1a).
   * 웹은 그 편 나리 커리어의 `teamId` 다.
   */
  readonly savedTeamId: number
}

/**
 * **사람 칸 팀** — 0xaa57c aa6c2~aa734 (직접 재역어셈):
 * ```
 * aa6ca  r7 = 레코드 +2 아래 4비트 (다른 칸) · r5 = 윗 4비트 (사람 칸)
 * aa6d8  g = 0x1f1d8(저장)
 * aa6e0  g[0x11f] ≠ 0 || g[0x176] ≠ 0 (마선수 대결 중) 이면:
 * aa702    m = (s8) g[0xf6]
 * aa704    m == 2       → r5 = (s8) 0x1f55c(저장)[1]          ; aa712~aa728
 * aa70c    m ∈ {3, 4}   → r5 = (s8) 0x1f8d4(저장, m)[1]       ; aa71c~aa728
 *          그 밖        → r5 그대로
 * aa72a  0xb6bd4(st, 사람 칸, r5) · 0xb6bd4(st, 다른 칸, r7)   ; 경기[0x28 + 칸]
 * aa744  0xb891c(팀객체[사람 칸], 모드, r5, −1) · (팀객체[다른 칸], 모드, r7, −1)
 * ```
 * 그래서 마선수 대결은 **사람 칸에 그 편 나리 저장의 팀**이 선다 — 자동진행 반 이닝의 사람 칸 타선 · 투수진과 점수판 팀이 그 팀이다.
 * 다른 칸(CPU 팀)은 레코드 그대로다. 두 칸이 같은 팀이 되어도 거르지 않는다(원본 그대로).
 * 보통 미션(대결이 아님)이면 `aceMatch` 를 안 준다 — 레코드 팀(`sideTeams[사람 칸]`)이다.
 */
export function missionHumanTeamIdOf(mission: OriginalMission, aceMatch?: MissionAceMatchOrigin): number {
  const recordTeam = mission.sideTeams[humanSideOf(mission)]
  if (aceMatch === undefined) return recordTeam
  const mode = aceMatch.originalMode
  return mode >= 2 && mode <= 4 ? aceMatch.savedTeamId : recordTeam
}

/**
 * **경기[0x28 + 칸] — 두 칸의 팀 번호** (0xaa57c aa72a 의 `0xb6bd4(st, 칸, 팀)`). 사람 칸은 `humanBatting.teamId`(마선수 대결이면
 * 그 편 나리 저장 팀 — `missionHumanTeamIdOf`), 다른 칸은 레코드 +2 아래 4비트 그대로.
 * 경기 적재 0x48658 이 이 번호로 HUD 작은 로고(48a38~48a74 — `team_logo_ini` 그림[0xb6bdc(st, 0)] → 장면+0x1054,
 * [0xb6bdc(st, 1)] → +0x1058, 두 번호가 같으면 같은 그림)를 싣고, 타석 HUD 0x373d0 이 위 줄 = 측 0 · 아래 줄 = 측 1 로 그린다.
 */
export function missionTeamIdsOf(run: { readonly mission: OriginalMission; readonly game: Pick<MissionGame, 'humanBatting'> }): {
  readonly human: number
  readonly cpu: number
} {
  return { human: run.game.humanBatting.teamId, cpu: run.mission.sideTeams[cpuSideOf(run.mission)] }
}

import type { OriginalMission } from '@/shared/config/original/missions'

/**
 * **미션(모드 5·6)의 '#' 교체** — 공용 키 0x498d4 의 '#' 가지(0x4994a)는 `0x38984(장면)` 이 참일 때만 연다 (직접 떴다).
 *
 * ```
 * 38984  막힘 = (모드 == 4 || 모드 == 7)
 * 389a8  ctx = [장면+0x230] ; [ctx+0xa8] == 0 이면:
 * 389b4    모드 5: st[0x31 + st[9]] == 0(공격 팀이 사람)이면 막힘
 * 389d4    모드 6: st[0x31 + st[0xa]] == 0(수비 팀이 사람)이면 막힘
 * 389fc  [ctx+0xa8] ≠ 0 이고 모드 5·6 이면 막힘
 * 38a1a  참 = 막힘이 하나도 없을 때
 * ```
 * [ctx+0xa8] 은 미션 경기 준비 0xaa57c(모드 5·6 만)가 aa6b6~aa6c0 에서 `1 & ~레코드[1]` 로 적는다 —
 * 레코드 바이트 1(`stage`) 의 비트 0 이 **꺼져 있으면 '#' 를 막는다**. 바이트 1 의 비트 1~3 은 보상 등급 d(0xa52b0)라
 * 원본 표는 0 · 2 · 4 · 6 · 8 · 10 뿐이다 — **모든 미션(마선수 대결 포함)이 '#' 를 막는다.**
 * 사람·CPU 칸 검사(389b4~)는 레코드가 비트 0 을 켰을 때만 의미가 있다 (그때 투수 미션은 공격 CPU, 타자 미션은 수비 CPU 라 열린다).
 */
export function missionAllowsSubstitution(mission: OriginalMission): boolean {
  return (mission.stage & 1) !== 0
}

import type { HallOfFamePlayerPick } from '@/entities/collection/model/collection'

/**
 * **홈런더비의 모드 타자 게터 0x1fc20** — 치는 선수가 명예 타자 기록인지 (re.py 로 직접 뜸):
 * ```
 * 1fc24  [앱+0xbc] == 0 이면 0
 * 1fc32  m = 전역 모드 [0x1552d10] — m ∉ {5, 6, 7} 이면 [앱+0x38](나리 타자편 저장 선수)
 * 1fc3c  전역기록 [앱+0xac]+0x11f(g[0x11f] — 타자편 마선수 대결 대기) ≠ 0 이면 [앱+0x38]
 * 1fc4c  k = (s8) 0x1f1d8()+0xa6(선수 고르기 명전 타자 번호) — k < 0 이면 [앱+0x38]
 * 1fc5c  그 밖 0x1f640(앱, k) — 명예 타자 기록
 * ```
 * 모드 7 도 미션(5 · 6)과 같은 갈래다 — 타자편 대결 대기(g[0x11f])가 서 있으면 하위 16 에서 명예 타자를 골랐어도 **나리 타자편 저장
 * 선수**로 친다(능력치 · 장착 스킬 · 겉모습 · 0xe 소개 판 타자 칸 모두 이 기록에서 나온다). 투수편 대기 g[0x176] 은 안 본다.
 * 모드 7 에서 g[0x11f] 를 읽는 곳은 이 게터 하나다(xval 0x11f 전수: 0x10df8 · 0x11910 · 0x1cdec 는 나리 장면, 0x407f0 · 0x4a384 ·
 * 0x4ea0c 는 미션 결과, 0x4b100 은 모드 2~6 점프표, 0xb8680 은 팀 종류 5 · 6 갈래(종류 7 은 기본 명부), 0xaa57c 는 미션 객체,
 * 0x8cf64 는 SYS 8).
 *
 * 돌려주는 값은 쓸 명전 타자 번호 — null 이면 나리 타자편 저장 선수다.
 */
export function derbyHallOfFameBatterIndexOf(pick: HallOfFamePlayerPick, isBatterAceMatchHeld: boolean): number | null {
  if (isBatterAceMatchHeld) return null
  return pick.hallOfFameIndex
}

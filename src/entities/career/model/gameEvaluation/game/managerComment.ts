import type { PlayerCareer } from '@/entities/career/model/playerCareer'

/** 인기도 변화 −2~6 → 칸 0~8. 타순 2배 칸(0x1283c)은 투수편 전용이라 타자는 쓰지 않는다 (점검 7차) */
const COMMENT_GRADES = [-2, -1, 0, 1, 2, 3, 4, 5, 6]
/**
 * 평판 구간 문턱 0xcc562 · 모드 4 구간 바탕 0xcc56a.
 * 116 진입 0x1278c 는 평판 S+0x62 < 문턱인 첫 칸을 고르고(0x128d8~0x128f4), **다 넘으면(≥ 1000) 고르지 않아 구간 0 바탕 39**
 * 그대로 간다(0x12876 이 먼저 39 를 둔다). 평판을 바꾸는 곳은 모두 0~999 로 자르므로(0x8724 · 0x879a · 0x8ab6 · 0x8b70 ·
 * 0x15a7c · 0x1ba8a · 0x8e56a · 0xa6718 · 0xa7176, 신인 0x1127e = 300) 그 가지는 실제로는 닿지 않는다.
 */
const COMMENT_REPUTATION_LIMITS: readonly number[] = [150, 450, 750, 1000]
const COMMENT_SECTION_BASES: readonly number[] = [39, 48, 57, 66]

/** 감독 평가 글 번호 (StrUSER_EVT) */
export function managerCommentIndexOf(career: PlayerCareer, popularityChange: number): number {
  const section = COMMENT_REPUTATION_LIMITS.findIndex((limit) => career.reputation < limit)
  const base = COMMENT_SECTION_BASES[section < 0 ? 0 : section]
  const grade = COMMENT_GRADES.indexOf(popularityChange)
  return base + Math.max(0, grade)
}

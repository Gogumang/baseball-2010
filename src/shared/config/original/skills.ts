// 이 파일은 tools/generate_game_data.py 가 원본 패키지에서 생성했다.
// 직접 고치지 말고 생성기를 고칠 것.

import data from '@/shared/config/original/data/skills.json'

export interface OriginalSkill {
  readonly id: number
  readonly name: string
  /** 소개 (StrSKILL[id]) */
  readonly description: string
  /** 효과 (StrSKILL[40+id]) — 마크업 원문 */
  readonly effect: string
  /** 효과 문구로 나눈 대상 */
  readonly role: '공통' | '타자' | '투수'
}

/** 스킬 40종 (StrCOMMON[55~94] + StrSKILL) */
export const ORIGINAL_SKILLS: readonly OriginalSkill[] = data as readonly OriginalSkill[]

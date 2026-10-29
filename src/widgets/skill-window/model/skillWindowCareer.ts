import type { PlayerCareer } from '@/entities/career/model/playerCareer'

/** 창이 보는 칸 — 투수편(모드 3)도 같은 창(0x13140·0x147b0·0x81dc0)을 쓰므로 칸 꼴만 받는다 */
export type SkillWindowCareer = Pick<PlayerCareer, 'skillIds' | 'equippedSkillIds' | 'skillSlotLevel' | 'gamePoint' | 'subItemIds'>

/** 창에 뜬 대화 — 예/아니오 질문 또는 확인 알림 */
export type SkillWindowPrompt =
  | { readonly kind: '질문'; readonly text: string; readonly onYes: () => void; readonly onNo?: () => void }
  | { readonly kind: '알림'; readonly text: string }

/** 창의 키 자리 — 탭(`[win+0x1a8]` = 0) 또는 격자(= 1) */
export type SkillWindowFocus = '탭' | '격자'

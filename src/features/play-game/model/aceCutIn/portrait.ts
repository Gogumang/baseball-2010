import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

/** 표 0xd0108 — 번호(투수 0~4 · 타자 5~9) → event_char 인물 번호 */
export const ACE_CUT_IN_PORTRAITS: readonly number[] = [17, 11, 18, 13, 19, 10, 20, 12, 21, 22]

/** 0x63a04 의 인물 → 애니 바탕 (표 0xd0ae6, `pages/management/lib/centerStage` 와 같은 표) — n = 0 */
const PORTRAIT_ANIMATION_BASE: readonly number[] = [-1, -1, 16, 23, 30, 37, 44, 51, 58, 65, 0, 7, 15, 23, 72, 79, 86, 40, 16, 8, 0, 24, 32]

/** event_char 폴더 — 0x63a18~0x63a34: 인물 10~13 → _1 · 17~22 → _2, 그 밖 _0 */
function portraitFolderOf(index: number): string {
  if (index >= 10 && index <= 13) return 'event_char_1'
  if (index >= 17 && index <= 22) return 'event_char_2'
  return 'event_char_0'
}

/** 컷인 인물 그림 — event_char 폴더 · 애니 번호 */
export function aceCutInPortraitOf(aceSlot: number): { readonly folder: string; readonly animation: number } | null {
  const index = ACE_CUT_IN_PORTRAITS[aceSlot]
  if (index === undefined) return null
  return { folder: assetUrl(`./sprites/${portraitFolderOf(index)}/frames`), animation: PORTRAIT_ANIMATION_BASE[index] ?? 0 }
}

/** 컷인 번호 — 0xb63a1(들어온 선수) 에 타자면 +5 (474c0) */
export function aceCutInSlotOf(side: '투수' | '타자', aceIndex: number): number {
  return side === '타자' ? aceIndex + 5 : aceIndex
}

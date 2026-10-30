import { BallPatternBackdrop } from '@/pages/special/ui/skinBackdrops/BallPatternBackdrop'
import { MainTitleBackdrop } from '@/pages/special/ui/skinBackdrops/MainTitleBackdrop'

export { BallPatternTranslucentImage } from '@/pages/special/ui/skinBackdrops/BallPatternTranslucentImage'

/** 명예의 전당 목록을 쓰는 화면의 바탕 — 메뉴 바탕 0x58371 · 공 무늬 0x5fd61 (`lib/skinBackdrops.ts`) */
export type SkinBackdropKind = '메뉴바탕' | '공무늬'

export function SkinBackdrop({ kind }: { readonly kind: SkinBackdropKind }) {
  return kind === '메뉴바탕' ? <MainTitleBackdrop /> : <BallPatternBackdrop />
}

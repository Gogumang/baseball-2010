import type { EntryKey } from '@/entities/season-mode/model/entryEditor'
import { FOOTER_BITS } from '@/widgets/entry-editor/ui/entryListWindow/otherSlices'

/** 머리띠 0x54d95 셋째 인자 — 투수 탭 0xf · 타자 탭 0x17 (일반 0x2e09e~0x2e0aa · 시즌 0xe0 그림 0xb08c~0xb098) */
const ENTRY_FOOTER = { 투수: 0xf, 타자: 0x17 } as const

/** 탭대로 머리띠 제목 · 바닥 — 0x54d95(skin, 탭 1 ? 7 "투수엔트리"/바닥 0xf : 6 "타자엔트리"/바닥 0x17) */
export function entryFrameOfTab(isPitcherTab: boolean): { readonly title: '투수엔트리' | '타자엔트리'; readonly footer: number } {
  return isPitcherTab ? { title: '투수엔트리', footer: ENTRY_FOOTER.투수 } : { title: '타자엔트리', footer: ENTRY_FOOTER.타자 }
}

/**
 * 바닥띠 "#타자" · "#투수" 표시 = 탭 바꾸기 '*'(0x558c4) · "0상세정보" = '0' — 그 표시 위 투명 누름 칸. 마선수 잠금 창이 떠 있으면 키를 안 받는다
 */
export function entryFooterPressesOf(isAceLocked: boolean, onKey: (key: EntryKey) => void) {
  if (isAceLocked) return undefined
  return {
    [FOOTER_BITS.batter]: { label: '* 타자', onPress: () => onKey('별') },
    [FOOTER_BITS.pitcher]: { label: '* 투수', onPress: () => onKey('별') },
    [FOOTER_BITS.detail]: { label: '0 상세정보', onPress: () => onKey('영') },
  }
}

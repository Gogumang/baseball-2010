import { ENTRY_LIST_LAYOUT, entryArrowBlinkOf } from '@/widgets/entry-editor/lib/entryListWindow'
import type { EntryListGeometry } from '@/widgets/entry-editor/lib/entryListWindow'
import { SLT_FRAME, pad, pixel } from '@/widgets/entry-editor/ui/entryListWindow/entryListAssets'

/** ▲▼ — 줄이 둘 이상이면 키 수로 깜빡이며 드나든다 */
export function EntryVerticalArrows({ keyPresses }: { readonly keyPresses: number }) {
  const L = ENTRY_LIST_LAYOUT
  const blink = entryArrowBlinkOf(keyPresses)
  return (
    <>
      <img alt="" src={`${SLT_FRAME}/${pad(L.upArrowImage)}.png`} style={{ ...pixel, left: L.arrowX, top: L.upArrowY - blink }} />
      <img alt="" src={`${SLT_FRAME}/${pad(L.downArrowImage)}.png`} style={{ ...pixel, left: L.arrowX, top: L.downArrowY + blink }} />
    </>
  )
}

/** 옆 화살 — 넘길 열이 있는 쪽만 (오른쪽은 뒤집는다) */
export function EntrySideArrows({ geometry }: { readonly geometry: EntryListGeometry }) {
  const src = `${SLT_FRAME}/${pad(ENTRY_LIST_LAYOUT.sideArrowImage)}.png`
  return (
    <>
      {geometry.leftArrow !== null && <img alt="" src={src} style={{ ...pixel, left: geometry.leftArrow.x, top: geometry.leftArrow.y }} />}
      {geometry.rightArrow !== null && (
        <img alt="" src={src} style={{ ...pixel, left: geometry.rightArrow.x, top: geometry.rightArrow.y, transform: 'scaleX(-1)' }} />
      )}
    </>
  )
}

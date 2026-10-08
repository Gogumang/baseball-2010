import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { COMMAND_SLOTS } from '@/pages/management/lib/managementLayout'
import { nariMainMenuOffIdsOf } from '@/pages/management/lib/nariMenuEnable'
import type { NariMenuEnableInput } from '@/pages/management/lib/nariMenuEnable'
import { CommandBar } from '@/pages/management/ui/CommandBar'

/** 칸 등장 0x7ff8c 가 다 내려온 뒤 — 메뉴는 105 진입 때 열려 이벤트가 끝날 무렵에는 제자리다 */
const SETTLED_SLIDE_UPDATES = 1_000
const NO_IDS: ReadonlySet<string> = new Set()
const NOOP = () => undefined

/**
 * **나리 관리 메뉴의 커맨드 줄 그림만** — 이벤트 재생 114 의 끝 틀(0x19da4 → 0x7e418, `useEventEndFrame`)이 그린다.
 * 114 로는 0x7e84c 가 안 불려(0x1cdec 1ce1a `cmp #0x72`) 칸 표 [gfx+0x178] · [gfx+0x17c] · 칸 수 [gfx+0x180] 은 앞 상태의 것이다 —
 * 105(0x69)면 관리 6칸(`COMMAND_SLOTS`, 타자편 · 투수편 같은 표), 115 · 117 · 116 · 130~138 · 140 등은 0x7e84c 의 그 밖 갈래라
 * 칸 수 0(아무 칸도 안 그림). 메뉴 [gfx+0x158] 은 105 진입 0x11ae0 이 [this+0x8c](관리 6칸), [gfx+0x15c] = 0(하위 없음 — 부모 칸
 * 없음)이다. 칸이 0 인 켬 표는 흑백(`nariMainMenuOffIdsOf`).
 * ⚠️ 근사: 커서는 메뉴 [this+0x8c] 의 칸(105 진입이 S+4 면 0 으로 되돌림)인데 웹 관리 화면은 커서를 화면 안에만 들어 0 칸으로 둔다.
 */
export function NariMainCommandBar({ menuEnable }: { readonly menuEnable: NariMenuEnableInput }) {
  const labelOrigins = useFrameOrigins('./sprites/img_text/frames')
  const labelWidths = Object.fromEntries(
    COMMAND_SLOTS.map((slot) => [slot.labelFrame, labelOrigins?.[String(slot.labelFrame).padStart(3, '0')]?.width ?? 0]),
  )
  return (
    <CommandBar slots={COMMAND_SLOTS} cursor={0} bounce={0} slideUpdates={SETTLED_SLIDE_UPDATES}
      disabledIds={NO_IDS} grayedIds={nariMainMenuOffIdsOf(menuEnable)} labelWidths={labelWidths} parent={null}
      onHover={NOOP} onSelect={NOOP} />
  )
}

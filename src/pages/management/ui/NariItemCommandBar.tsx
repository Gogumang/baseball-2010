import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { COMMAND_MENUS, COMMAND_SLOTS } from '@/pages/management/lib/managementLayout'
import { CommandBar } from '@/pages/management/ui/CommandBar'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

/** 칸 등장 0x7ff8c 가 다 내려온 뒤 — 110 에서 펼친 하위 메뉴가 111 동안 그대로 남는다 */
const SETTLED_SLIDE_UPDATES = 1_000
const NO_IDS: ReadonlySet<string> = new Set()
const NOOP = () => undefined
const ITEM_SLOT = COMMAND_SLOTS.find((slot) => slot.id === '아이템') ?? null

/**
 * **상점(111) 의 커맨드 줄 그림만** — 그리기 0x167cc 가 창 종류 1 · 2(서브 · GP)일 때 0x7e418(gfx, 틱)을 부른다.
 * 111 로 들어올 때 0x7e84c(gfx, 0x6f) 가 칸 표를 0x6e · 0x6f 갈래(칸 3 · 아이콘 0xd480c [7, 8, 20] · 이름표 0xd4812
 * [100 장착 · 105 서브 · 110 GP])로 두고, 하위 메뉴 [gfx+0x15c] 는 110 진입 0x107e0 이 넣은 [this+0x98](아이템 하위 메뉴)
 * 그대로다 — 부모 칸(아이템)이 (6,245) 에 서고 커서는 110 에서 고른 칸이다. 타자편 · 투수편 같은 표.
 */
export function NariItemCommandBar({
  cursor,
}: {
  /** 110 아이템 하위 메뉴 [this+0x98] 의 커서 칸 — 0 장착 · 1 서브 · 2 GP */
  readonly cursor: number
}) {
  const slots = COMMAND_MENUS.아이템
  const labelOrigins = useFrameOrigins(assetUrl('./sprites/img_text/frames'))
  const labelWidths = Object.fromEntries(slots.map((slot) => [slot.labelFrame, labelOrigins?.[String(slot.labelFrame).padStart(3, '0')]?.width ?? 0]))
  return (
    <CommandBar
      slots={slots}
      cursor={cursor}
      bounce={0}
      slideUpdates={SETTLED_SLIDE_UPDATES}
      disabledIds={NO_IDS}
      labelWidths={labelWidths}
      parent={ITEM_SLOT}
      isSubMenu
      onHover={NOOP}
      onSelect={NOOP}
    />
  )
}

import {
  COMMAND_LABEL_HEIGHT, COMMAND_LABEL_OFFSET_Y, PARENT_SLOT_TARGET, commandLabelAlignOf, commandLabelLeftOf,
  commandSlotYAt, slidePositionAt,
} from '@/pages/management/lib/managementLayout'
import type { MenuSlot } from '@/pages/management/lib/managementLayout'
import * as styles from '@/pages/management/ui/ManagementScreen.css'

interface CommandBarProps {
  readonly slots: readonly MenuSlot[]
  readonly cursor: number
  /** 커서를 옮긴 직후 튀는 높이 (+1, −1, 0) */
  readonly bounce: number
  /** 메뉴가 열린 뒤 갱신 수 — 칸이 y170 에서 내려온다 (0x7ff8c) */
  readonly slideUpdates: number
  readonly disabledIds: ReadonlySet<string>
  readonly labelWidths: Readonly<Record<number, number>>
  /** 하위 메뉴일 때 부모 칸 — 주황 아이콘으로 (6,245) 까지 미끄러진다 */
  readonly parent: MenuSlot | null
  /**
   * 하위 메뉴 객체 [gfx+0x15c] 가 서 있는가 — 이름표 정렬(칸 2·3 왼쪽)이 이것으로 갈린다. 안 주면 `parent` 가 있으면 참.
   */
  readonly isSubMenu?: boolean
  readonly onHover: (index: number) => void
  readonly onSelect: (id: string) => void
}

const iconOf = (index: number, isSelected: boolean) =>
  isSelected ? `./sprites/management/icon_selected_${index}.png` : `./sprites/mode_icon/${String(index).padStart(3, '0')}.png`
const LABEL_GLYPH_HEIGHT = 10
/** 부모 칸이 (6,245) 면 mode_ui f60 파란 괄호(원점 −5,−9)를 dy +11 로 덧그린다 */
const BRACKET = { left: -5, top: -9 + 11 }

/**
 * 커맨드 줄 0x7e418 — 선택 칸만 주황 팔레트와 이름표. 이름표 그림은 테두리 1px 을 둘러 글자보다 1px 왼쪽 위에서 시작한다.
 * 이름표 정렬은 `commandLabelAlignOf`(하위 메뉴 칸 2·3 은 왼쪽). 모드 갈림은 부모 칸 아이콘 표 하나뿐이라(시즌 0xd47f4 ·
 * 그 밖 0xd4868) 시즌모드도 칸 표만 바꿔 이 줄을 그대로 쓴다.
 */
export function CommandBar(props: CommandBarProps) {
  const { slots, cursor, bounce, slideUpdates, disabledIds, labelWidths, parent, onHover, onSelect } = props
  const isSubMenu = props.isSubMenu ?? parent !== null
  // 칸이 하나도 없으면(0x7e84c 가 표를 비운 상태 — 시즌 0xd6 · 0xdc) 부모 칸만 그린다
  const selected = slots[cursor] as MenuSlot | undefined
  const selectedY = selected === undefined ? 0 : commandSlotYAt(selected.y, slideUpdates)
  const labelWidth = selected === undefined ? 0 : (labelWidths[selected.labelFrame] ?? 0)
  return (
    <div data-testid="command-bar">
      {parent !== null && (
        <>
          <img className={styles.layer} alt="" src={iconOf(parent.icon, true)} style={{
            left: slidePositionAt(parent.x, PARENT_SLOT_TARGET.x, slideUpdates) - 1,
            top: slidePositionAt(parent.y, PARENT_SLOT_TARGET.y, slideUpdates) - 1,
          }} />
          {/* 도착하면 괄호를 그린다 */}
          {slidePositionAt(parent.x, PARENT_SLOT_TARGET.x, slideUpdates) === PARENT_SLOT_TARGET.x && (
            <img className={styles.layer} style={{ left: PARENT_SLOT_TARGET.x + BRACKET.left, top: PARENT_SLOT_TARGET.y + BRACKET.top }} src="./sprites/mode_ui/frames/060.png" alt="" />
          )}
        </>
      )}
      {slots.map((slot, index) => (
        <button
          key={slot.id}
          type="button"
          aria-label={slot.id}
          aria-current={index === cursor}
          className={styles.commandButton}
          style={{ left: slot.x, top: commandSlotYAt(slot.y, slideUpdates) }}
          disabled={disabledIds.has(slot.id)}
          onMouseEnter={() => onHover(index)}
          onFocus={() => onHover(index)}
          onClick={() => onSelect(slot.id)}
        >
          <img className={styles.commandIcon} style={{ top: -1 + (index === cursor ? bounce : 0) }}
            src={iconOf(slot.icon, index === cursor)} alt="" />
        </button>
      ))}
      {selected !== undefined && (
        <img
          className={styles.layer}
          src={`./sprites/management/command_label_${selected.labelFrame}.png`}
          alt=""
          style={{
            left: commandLabelLeftOf(selected.x, labelWidth, commandLabelAlignOf(isSubMenu, cursor)),
            top: selectedY + COMMAND_LABEL_OFFSET_Y + Math.trunc((COMMAND_LABEL_HEIGHT - LABEL_GLYPH_HEIGHT + 1) / 2) - 1,
          }}
        />
      )}
    </div>
  )
}

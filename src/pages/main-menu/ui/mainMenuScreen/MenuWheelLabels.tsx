import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { TOP_ENTRIES, isEntryDimmed } from '@/pages/main-menu/model/mainMenu'
import {
  MENU_WHEEL_ITEM_FRAMES,
  menuWheelAngleAt,
  menuWheelLabelTopLeftOf,
  menuWheelOrderOf,
  menuWheelPointOf,
  menuWheelSlotDrawOf,
} from '@/pages/main-menu/lib/mainMenuLayout'
import type { MenuTurnDirection } from '@/pages/main-menu/lib/mainMenuLayout'
import { MenuWheelUnderlayImage } from '@/pages/main-menu/ui/MenuWheelUnderlayImage'
import { IMG_TEXT, frameSrc, pad, slotOffsetOf } from '@/pages/main-menu/ui/mainMenuScreen/menuAssets'
import * as styles from '@/pages/main-menu/ui/MainMenuScreen.css'

interface MenuWheelLabelsProps {
  readonly isWheel: boolean
  /** 바퀴 배열의 첫 칸 — 윗단은 도는 동안 돌기 전 커서, 아랫단은 처음 메뉴에서 고른 칸 */
  readonly wheelCursor: number
  readonly direction: MenuTurnDirection | null
  readonly counter: number
  /** 윗단 커서 칸 (aria-current) */
  readonly cursor: number
  readonly hasSavedGame: boolean
  readonly textOrigins: FrameOrigins | null
  readonly onStep: (offset: number) => void
}

/**
 * 윗단 바퀴: 여섯 자리에 놓인 칸 글자 (아랫단에서도 그대로 깔린다).
 * 칸 고리 0x24dd2~0x251e4 는 자리 5 → 0 차례로 칸마다 밑판(main_ui 이미지 0 · 1 · 2)을 찍고 그 위에 칸 글자를 그린다
 */
export function MenuWheelLabels({ isWheel, wheelCursor, direction, counter, cursor, hasSavedGame, textOrigins, onStep }: MenuWheelLabelsProps) {
  return menuWheelOrderOf(wheelCursor)
    .map((entryIndex, slot) => ({ entryIndex, slot }))
    .reverse()
    .map(({ entryIndex, slot }) => {
      const angle = menuWheelAngleAt(slot, direction, counter)
      const draw = menuWheelSlotDrawOf(angle)
      if (draw === null) return null
      const entry = TOP_ENTRIES[entryIndex]
      const underlay = <MenuWheelUnderlayImage key={`${entry.id}-밑판`} underlay={draw.underlay} />
      const frame = MENU_WHEEL_ITEM_FRAMES[entryIndex]
      const size = textOrigins?.[pad(frame)] ?? null
      // 접힌 칸(경우 1~4)은 글자를 안 그린다 (24f98)
      if (!draw.showsLabel || size === null) return underlay
      const topLeft = menuWheelLabelTopLeftOf(menuWheelPointOf(angle), size.width, size.height)
      return [
        underlay,
        <button
          key={entry.id}
          type="button"
          aria-label={entry.id}
          aria-current={isWheel && entryIndex === cursor}
          className={isEntryDimmed(entry, hasSavedGame) ? styles.menuRowDimmed : styles.menuRow}
          style={{ left: topLeft.x, top: topLeft.y }}
          disabled={!isWheel}
          // ⚠️ 마우스를 올리기만 해서 커서를 옮기지 않는다(onMouseEnter 없음) — 원본은 키패드뿐이다. 바퀴·릴이 돌면 멈춘 포인터 아래로
          // 다른 칸이 들어와 브라우저가 mouseenter 를 쏘므로, 포인터를 메뉴 위에 둔 채 키로 고르면 커서가 엉뚱한 칸으로 튀었다
          // (게임시작 → ↓↓ 나만의리그 → OK 가 일반모드 창 · 홈런더비 · 스페셜로 갔다).
          // 누르면 **고르기만** 한다 — 그 칸까지 ↑/↓ 를 한 칸씩 보내 원본처럼 바퀴가 돈다. 시작은 설명 판 누름(OK)이다
          onClick={() => onStep(slotOffsetOf(slot, TOP_ENTRIES.length))}
        >
          <img src={frameSrc(IMG_TEXT, frame)} alt="" />
        </button>,
      ]
    })
}

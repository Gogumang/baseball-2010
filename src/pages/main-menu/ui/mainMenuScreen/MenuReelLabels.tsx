import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { isEntryDimmed } from '@/pages/main-menu/model/mainMenu'
import type { MainMenuEntry } from '@/shared/config/original/mainMenu'
import {
  MENU_REEL_ITEM_FRAMES,
  MENU_REEL_SCROLL_STEPS,
  MENU_REEL_SHADOW_COLOR,
  MENU_REEL_SHADOW_OFFSET,
  MENU_REEL_SLOTS,
  menuReelEntryAtSlotOf,
  menuReelFrameListOf,
  menuReelSlotRowOf,
  menuReelTextTopLeftOf,
} from '@/pages/main-menu/lib/mainMenuLayout'
import type { MenuTurnDirection } from '@/pages/main-menu/lib/mainMenuLayout'
import { IMG_TEXT, frameSrc, pad, slotOffsetOf } from '@/pages/main-menu/ui/mainMenuScreen/menuAssets'
import { MenuTintedLabel } from '@/pages/main-menu/ui/mainMenuScreen/MenuTintedLabel'
import * as styles from '@/pages/main-menu/ui/MainMenuScreen.css'

interface MenuReelLabelsProps {
  /** 하위 목록 상태 번호 — 표(0xceaf2 슬롯 · 0xcea00/0xcea48 글자)를 이 번호로 색인한다 */
  readonly reelState: number
  readonly entries: readonly MainMenuEntry[]
  /** 도는 동안은 돌기 전 커서 */
  readonly shownCursor: number
  readonly direction: MenuTurnDirection | null
  readonly counter: number
  readonly hasSavedGame: boolean
  readonly textOrigins: FrameOrigins | null
  readonly onStep: (offset: number) => void
}

/** ↑(−1) 면 +, ↓(−2) 면 − 로 민다 (0x2534c) */
function reelScrollOf(direction: MenuTurnDirection | null, counter: number): number {
  if (direction === null) return 0
  return (direction === -1 ? 1 : -1) * (MENU_REEL_SCROLL_STEPS[counter] ?? 0)
}

/** 아랫단 세로 릴 — 슬롯 1~7(4 빼고)에 놓인 칸 글자 (0x2524c) */
export function MenuReelLabels({ reelState, entries, shownCursor, direction, counter, hasSavedGame, textOrigins, onStep }: MenuReelLabelsProps) {
  const reelFrames = MENU_REEL_ITEM_FRAMES[reelState] ?? []
  const reelRow = menuReelSlotRowOf(reelState)
  const reelFrameList = menuReelFrameListOf(reelFrames)
  const scroll = reelScrollOf(direction, counter)
  return MENU_REEL_SLOTS.map((slot) => {
    const entryIndex = menuReelEntryAtSlotOf(reelFrames, reelRow, shownCursor, slot)
    if (entryIndex === null) return null
    const frame = reelFrameList[entryIndex]
    const size = textOrigins?.[pad(frame)] ?? null
    if (size === null) return null
    const topLeft = menuReelTextTopLeftOf(slot, size.width, scroll)
    if (topLeft === null) return null
    const entry = entries[entryIndex]
    const src = frameSrc(IMG_TEXT, frame)
    return (
      <div key={entry.id}>
        {/* 그림자를 #212B70 으로 (+1,+1) 에 먼저 찍고 진짜 글자를 원색으로 덮는다 (0x255c8) */}
        <MenuTintedLabel
          src={src}
          left={topLeft.x + MENU_REEL_SHADOW_OFFSET.x}
          top={topLeft.y + MENU_REEL_SHADOW_OFFSET.y}
          width={size.width}
          height={size.height}
          color={MENU_REEL_SHADOW_COLOR}
        />
        <button
          type="button"
          aria-label={entry.id}
          className={isEntryDimmed(entry, hasSavedGame) ? styles.menuRowDimmed : styles.menuRow}
          style={{ left: topLeft.x, top: topLeft.y }}
          // 마우스 올리기로는 고르지 않는다 — 바퀴 칸과 같은 까닭(멈춘 포인터 아래로 릴이 돌아 들어온 칸이 커서를 빼앗는다).
          // 누르면 고르기만 한다 — 릴이 그 칸까지 한 칸씩 돈다. 보이는 윗줄(슬롯 1·2·3)이 커서 −3·−2·−1 이고 릴이 감기므로
          // 바닥 밖 칸(슬롯 5·6·7)도 윗줄을 거듭 눌러 닿는다
          onClick={() => onStep(slotOffsetOf(entryIndex - shownCursor, entries.length))}
        >
          <img src={src} alt="" />
        </button>
      </div>
    )
  })
}

import { useEffect, useRef, useState } from 'react'
import { MarkupText, RawScreen } from '@/shared/ui'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { SEASON_SUB_ITEM_COUNT, seasonSubItemsOf } from '@/widgets/season/lib/seasonSubItems'
import { seasonMoneyTextOf } from '@/widgets/season/lib/seasonText'
import { SeasonStatusPanel } from '@/pages/season/ui/SeasonStatusPanel'
import { SeasonCommandBar } from '@/pages/season/ui/SeasonCommonFrame'
import { seasonParentSlotOf } from '@/pages/season/lib/seasonCommandBar'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import {
  DESCRIPTION_BOX, HEAD_LABEL_FRAME, LEFT_TAB_BOX, NAME_BOX, RIGHT_TAB_BOX, SLOT_COLUMNS, SLOT_SIZE, VALUE_BOX, WINDOW_BOX,
  slotPositionOf,
} from '@/pages/shop/lib/shopLayout'
import * as windowStyles from '@/shared/ui/GameWindow/GameWindow.css'
import * as styles from '@/pages/shop/ui/ShopWindow.css'

const IMG_TEXT = './sprites/img_text/frames'
const ITEM_ICON = './sprites/item_icon'
const pad = (frame: number) => String(frame).padStart(3, '0')

export interface SeasonOwnedItemsScreenProps {
  readonly record: SeasonRecord
  readonly teamMorale: number
  readonly gamePoint?: number
  /** 0x5f10 — 취소(−16) → 0xcd */
  readonly onBack: () => void
}

/**
 * **시즌정보 → 아이템 (상태 0xd6)** — 보유 서브아이템 보기 (직접 떴다).
 *
 * ```
 * 0x5ee4 (들어옴)  창 종류 [win+0x1a4] = 5 · [win+0x1a8] = 1 · 0x81618(창)      ; 종류 5 는 1(서브아이템)·2 와 같은 5×2 격자
 * 0x5f10 (키)      취소(−16) → 0xcd · 그 밖 0x819ac(창, 키)                     ; 종류 1·2·5 는 격자 커서만 (0x819be 비트 0x26)
 * 0xb1b4 (그림)    상태판 0x7d34c · 커맨드 줄 0x7e418 · 아이템 창 0x8453c → 0x81dc0 · 머리띠 0x7f4ec
 * ```
 * 창 0x81dc0 의 종류 5 는 서브아이템 상점(종류 1)과 머리(img_text 105 "서브아이템" · 소지금 = SR+2 × 100 만원)가 같고,
 * 다른 점은 칸마다 **SR[0x58 + k] 가 서 있을 때만**(0x82542 `cmp r3,#0 ; bne` · `cmp r7,#1`) 아이콘을 그리고,
 * 커서 칸이 비었으면 이름·값·설명도 그리지 않는다(0x82646~0x82656). 종류 1 의 보유 표시 0xc3858 은 없다.
 * 사고팔기는 없다 — 키 0x5f10 은 0x13460(나리 상점)·0x957c(시즌 상점) 어느 쪽도 부르지 않는다.
 *
 * 커맨드 줄 0x7e418 은 칸 수 0(0x7e84c 기본 갈래)이라 부모 칸 시즌정보만 그린다. ⚠️ 근사: 0x7e765 는 안 그린다. 격자 커서 이동은 나리 상점 창(`ShopWindow`)과 같게
 * 끝에서 감긴다(원본 목록 0xca7b5 의 감김은 안 풀었다).
 */
export function SeasonOwnedItemsScreen({ record, teamMorale, gamePoint = 0, onBack }: SeasonOwnedItemsScreenProps) {
  const items = seasonSubItemsOf(record)
  const [cursor, setCursor] = useState(0)
  const latest = useRef({ onBack })
  latest.current = { onBack }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Backspace') {
        event.preventDefault()
        latest.current.onBack()
        return
      }
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1
        : event.key === 'ArrowDown' ? SLOT_COLUMNS : event.key === 'ArrowUp' ? -SLOT_COLUMNS : 0
      if (step === 0) return
      event.preventDefault()
      setCursor((previous) => (previous + step + SEASON_SUB_ITEM_COUNT) % SEASON_SUB_ITEM_COUNT)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const selected = items[cursor]
  const shown = selected !== undefined && selected.isOwned ? selected : null

  return (
    <RawScreen>
      {/* 상태판 0x7d34c 를 먼저 그리고 그 위에 다른 것이 덮인다 (원본 그리기 차례) */}
      <SkinBackdrop kind="공무늬" />
      <SeasonStatusPanel record={record} teamMorale={teamMorale} />
      {/* 커맨드 줄 0x7e418 — 이 상태는 0x7e84c 가 칸 수를 0 으로 비워 하위 메뉴 객체의 부모 칸(시즌정보)만 (6, 245) 에 남는다 */}
      <SeasonCommandBar slots={[]} cursor={0} parent={seasonParentSlotOf('시즌정보')} />
      <div role="group" aria-label="보유 아이템">
        <div className={windowStyles.window}
          style={{ left: WINDOW_BOX.x, top: WINDOW_BOX.y, width: WINDOW_BOX.width, height: WINDOW_BOX.height }} />
        <img className={styles.layer} alt="서브아이템" src={`${IMG_TEXT}/${pad(HEAD_LABEL_FRAME.서브아이템)}.png`}
          style={{ left: LEFT_TAB_BOX.x + LEFT_TAB_BOX.width / 2, top: LEFT_TAB_BOX.y + 2, transform: 'translateX(-50%)' }} />
        <div className={styles.text} data-testid="보유아이템-소지금"
          style={{ left: RIGHT_TAB_BOX.x, top: RIGHT_TAB_BOX.y + 1, width: RIGHT_TAB_BOX.width - 4, textAlign: 'right', color: ORIGINAL_COLORS.text }}>
          {seasonMoneyTextOf(record.money)}
        </div>

        {items.map((item, index) => {
          const { x, y } = slotPositionOf(index)
          return (
            <button key={item.slot} type="button" aria-label={item.isOwned ? item.name : `빈 칸 ${index}`}
              aria-current={index === cursor} className={styles.slotButton}
              style={{ left: x, top: y, width: SLOT_SIZE, height: SLOT_SIZE }}
              onMouseEnter={() => setCursor(index)} onClick={() => setCursor(index)}>
              {item.isOwned && <img alt="" src={`${ITEM_ICON}/${pad(item.iconFrame)}.png`} />}
            </button>
          )
        })}
        <svg className={windowStyles.layer} viewBox="0 0 240 320" width={240} height={320} shapeRendering="crispEdges">
          <rect x={slotPositionOf(cursor).x - 0.5} y={slotPositionOf(cursor).y - 0.5} width={SLOT_SIZE + 1} height={SLOT_SIZE + 1}
            fill="none" stroke={ORIGINAL_COLORS.text} strokeWidth={1} />
        </svg>

        <div className={styles.nameTag}
          style={{ left: NAME_BOX.x, top: NAME_BOX.y, width: NAME_BOX.width, height: NAME_BOX.height }} />
        {shown !== null && (
          <>
            <div className={styles.text} data-testid="보유아이템-이름"
              style={{ left: NAME_BOX.x, top: NAME_BOX.y + 1, width: NAME_BOX.width, textAlign: 'center', color: ORIGINAL_COLORS.text }}>
              {shown.name}
            </div>
            <div className={styles.text} data-testid="보유아이템-값"
              style={{ left: VALUE_BOX.x, top: VALUE_BOX.y + 1, width: VALUE_BOX.width - 4, textAlign: 'right', color: ORIGINAL_COLORS.highlightYellow }}>
              {seasonMoneyTextOf(shown.price / 100)}
            </div>
            <div className={styles.description} data-testid="보유아이템-설명"
              style={{ left: DESCRIPTION_BOX.x + 4, top: DESCRIPTION_BOX.y + 4, width: DESCRIPTION_BOX.width - 8, height: DESCRIPTION_BOX.height - 8 }}>
              <MarkupText raw={shown.description} />
            </div>
          </>
        )}
      </div>
      <ScreenFrame title="시즌모드" gamePoint={gamePoint} onBack={onBack} footer={5} />
    </RawScreen>
  )
}

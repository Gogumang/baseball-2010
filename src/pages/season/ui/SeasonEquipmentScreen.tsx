import { useEffect, useRef, useState } from 'react'
import { MessageBox, RawScreen } from '@/shared/ui'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { EQUIPMENT_PARTS } from '@/entities/career/model/equipment'
import { PITCHER_EQUIPMENT_PARTS } from '@/entities/pitcher-career/model/pitcherEquipment'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import {
  SEASON_EQUIPMENT_LEVEL_COUNT, SEASON_EQUIPMENT_PART_COUNT, SEASON_EQUIPMENT_TEXT,
  applySeasonEquipment, checkSeasonEquipment, seasonEquipmentNameOf, seasonEquipmentPriceOf,
} from '@/entities/season-mode/model/seasonEquipment'
import type { SeasonCardAbility } from '@/pages/season/lib/seasonPlayerDetail'
import { fillModeText, seasonMoneyTextOf } from '@/widgets/season/lib/seasonText'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import * as styles from '@/widgets/season/ui/SeasonWindow.css'

/** StrMODE[35..38] 히트·파워·수비·주루 / [40..43] 제구·구속·변화·체력 */
const BATTER_NAME_BASE = 35
const PITCHER_NAME_BASE = 40
/** ⚠️ 근사 배치 — 카드(0x7ba44 시즌 선수 갈래)와 창 0x83378 의 칸 자리는 안 풀었다 */
const CARD = { x: 15, y: 46, width: 210, height: 74 } as const
const PARTS = { x: 15, y: 124, width: 80, rowHeight: 18 } as const
const ITEMS = { x: 98, y: 124, width: 127, rowHeight: 13 } as const
const DESCRIPTION = { x: 15, y: 272, width: 210, height: 26 } as const

const isCancelKey = (key: string) => key === 'Escape' || key === 'Backspace'
const modeText = (id: number) => ORIGINAL_MODE_TEXT[id] ?? ''

export interface SeasonEquipmentScreenProps {
  readonly record: SeasonRecord
  readonly playerName: string
  /** [win+0x24c] — 0xdf 에서 고른 선수가 타자였는가 */
  readonly isBatter: boolean
  /** 팀 레코드 진짜 줄의 니블 네 칸 (+0x19 · +0x1a) */
  readonly equipment: readonly number[]
  /** 카드 네 칸 — 들어올 때 뜬 0x30 바이트 사본으로 그린다(0x5f3c). 산 뒤에도 사본은 그대로라 숫자가 안 바뀐다 */
  readonly abilities: readonly SeasonCardAbility[]
  /** 전역 해금표 app+0xc0 의 칸이 열렸나 (`seasonEquipmentHiddenIdOf`) */
  readonly isHiddenOpen: (id: number) => boolean
  readonly gamePoint?: number
  /** 0x7d90 결과 0x14 — 새 소지금(100만 원 단위)과 니블 네 칸 */
  readonly onPurchase: (purchase: { readonly money: number; readonly equipment: readonly number[] }) => void
  /** 0x957c — 부위 목록에서 취소(−16) → 0xdf */
  readonly onBack: () => void
}

/**
 * **장비 창 0xdc (창 종류 3)** — 키·가드·적용은 `entities/season-mode/model/seasonEquipment.ts` 머리 주석(직접 떴다).
 *
 * 두 층 목록: 부위([win+0x198]) 에서 확인하면 칸([win+0x19c], 0..10)으로 들어가고, 칸에서 취소하면 부위로 돌아가며 칸 커서는 0.
 * 부위에서 취소하면 선수 고르기 0xdf(탭은 이 선수 쪽 — 0x5980 이 창+0x24c 를 본다).
 *
 * ⚠️ 근사: 그림 0xb1f8 창 종류 3 갈래(아이템 창 0x8453c → 카드 0x7ba44 — 상태판·커맨드 줄은 그리지 않는다, 0xb296)의 배치, 선수 그림과 칸을 옮길 때 그림에 미리 끼워 보이기
 * (0x81a9a — 그림만 바꾸고 니블은 안 건드린다)는 안 옮겼다. 부위 이름은 나리 장비 창의 이름을 빌렸다.
 */
export function SeasonEquipmentScreen({
  record, playerName, isBatter, equipment, abilities, isHiddenOpen, gamePoint = 0, onPurchase, onBack,
}: SeasonEquipmentScreenProps) {
  // 카드 숫자는 들어올 때 사본 그대로 (0x7d90 은 팀 레코드만 고친다)
  const [cardAbilities] = useState(abilities)
  const [part, setPart] = useState(0)
  const [level, setLevel] = useState(0)
  const [isItemFocus, setItemFocus] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [question, setQuestion] = useState<{ readonly text: string } | null>(null)

  const select = () => {
    const checked = checkSeasonEquipment(record, { isBatter, equipment }, part, level, isHiddenOpen)
    if (!checked.ok) {
      const text = modeText(SEASON_EQUIPMENT_TEXT[checked.reason])
      setNotice(checked.reason === '인기도부족' ? fillModeText(text, checked.required ?? 0) : text)
      return
    }
    setQuestion({ text: fillModeText(modeText(SEASON_EQUIPMENT_TEXT.구매확인), seasonMoneyTextOf(checked.price * 10)) })
  }

  const buy = () => {
    setQuestion(null)
    onPurchase(applySeasonEquipment(record.money, { isBatter, equipment }, part, level))
    setNotice(modeText(SEASON_EQUIPMENT_TEXT.장착완료))
  }

  const latest = useRef({ isItemFocus, select, onBack, isPopup: notice !== null || question !== null })
  latest.current = { isItemFocus, select, onBack, isPopup: notice !== null || question !== null }
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const current = latest.current
      if (current.isPopup) return
      const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
      if (!current.isItemFocus) {
        if (isCancelKey(event.key)) current.onBack()
        else if (event.key === 'Enter' || event.key === '5') setItemFocus(true)
        else if (step !== 0) setPart((held) => Math.min(SEASON_EQUIPMENT_PART_COUNT - 1, Math.max(0, held + step)))
        else return
      } else if (isCancelKey(event.key)) {
        setItemFocus(false)
        setLevel(0)
      } else if (event.key === 'Enter' || event.key === '5') current.select()
      else if (step !== 0) setLevel((held) => Math.min(SEASON_EQUIPMENT_LEVEL_COUNT - 1, Math.max(0, held + step)))
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const partNames = (isBatter ? EQUIPMENT_PARTS : PITCHER_EQUIPMENT_PARTS).map((entry) => entry.name)
  const nameBase = isBatter ? BATTER_NAME_BASE : PITCHER_NAME_BASE
  const equippedName = (slot: number) => {
    const nibble = equipment[slot] ?? 0
    return nibble >= 1 ? seasonEquipmentNameOf(isBatter, slot, nibble - 1) : '-'
  }

  return (
    <RawScreen>
      <div role="group" aria-label="장비">
        <div className={styles.window} style={{ left: CARD.x, top: CARD.y, width: CARD.width, height: CARD.height }} />
        <div className={styles.title} data-testid="장비-선수" style={{ left: CARD.x, top: CARD.y + 6, width: CARD.width }}>{playerName}</div>
        {cardAbilities.map((ability, slot) => (
          <div key={slot} className={styles.row}
            style={{ left: CARD.x + 8 + (slot % 2) * 100, top: CARD.y + 28 + Math.trunc(slot / 2) * 20, width: 94, height: 18 }}>
            <span className={styles.rowLabel}>{ORIGINAL_MODE_TEXT[nameBase + slot] ?? ''}</span>
            <span className={styles.rowValue}>{ability.shown}</span>
          </div>
        ))}

        <div className={styles.window} style={{ left: PARTS.x, top: PARTS.y, width: PARTS.width, height: PARTS.rowHeight * 4 * 2 + 6 }} />
        {partNames.map((name, slot) => (
          <button key={name} type="button" aria-label={`부위 ${name}`} aria-current={slot === part}
            className={`${styles.row}${slot === part ? ` ${styles.rowSelected}` : ''}`}
            style={{ left: PARTS.x + 2, top: PARTS.y + 3 + slot * PARTS.rowHeight * 2, width: PARTS.width - 4, height: PARTS.rowHeight * 2 - 2, display: 'block' }}
            onClick={() => {
              setPart(slot)
              setLevel(0)
              setItemFocus(true)
            }}>
            <span style={{ display: 'block' }}>{name}</span>
            <span style={{ display: 'block', color: ORIGINAL_COLORS.cursorCyan }} data-testid={`장비-부위-${slot}`}>{equippedName(slot)}</span>
          </button>
        ))}

        <div className={styles.window} style={{ left: ITEMS.x, top: ITEMS.y, width: ITEMS.width, height: ITEMS.rowHeight * SEASON_EQUIPMENT_LEVEL_COUNT + 6 }} />
        {Array.from({ length: SEASON_EQUIPMENT_LEVEL_COUNT }, (_unused, slot) => {
          const isCurrent = isItemFocus && slot === level
          const isEquipped = (equipment[part] ?? 0) - 1 === slot
          return (
            <button key={slot} type="button" aria-label={seasonEquipmentNameOf(isBatter, part, slot)} aria-current={isCurrent}
              className={styles.stadiumBar}
              style={{
                left: ITEMS.x + 2, top: ITEMS.y + 3 + slot * ITEMS.rowHeight, width: ITEMS.width - 4, height: ITEMS.rowHeight,
                display: 'flex', justifyContent: 'space-between', fontSize: '10px',
                color: isCurrent ? ORIGINAL_COLORS.highlightYellow : isEquipped ? ORIGINAL_COLORS.cursorCyan : ORIGINAL_COLORS.text,
              }}
              onClick={() => {
                setItemFocus(true)
                if (isCurrent) select()
                else setLevel(slot)
              }}>
              <span className={styles.stadiumBarName}>{seasonEquipmentNameOf(isBatter, part, slot)}</span>
              <span className={styles.stadiumBarValue}>{seasonMoneyTextOf(seasonEquipmentPriceOf(isBatter, part, slot) * 10)}</span>
            </button>
          )
        })}

        {isItemFocus && (
          <div className={styles.notice} data-testid="장비-설명"
            style={{ left: DESCRIPTION.x, top: DESCRIPTION.y, width: DESCRIPTION.width, height: DESCRIPTION.height }}>
            {/* ⚠️ 설명 상자(0x83378)의 원문 줄은 안 풀었다 — 이름·값만 적는다 */}
            {`${seasonEquipmentNameOf(isBatter, part, level)}  ${seasonMoneyTextOf(seasonEquipmentPriceOf(isBatter, part, level) * 10)}`}
          </div>
        )}
      </div>
      <ScreenFrame title="시즌모드" gamePoint={gamePoint} onBack={isItemFocus ? () => setItemFocus(false) : onBack} footer={5} />

      {question !== null && (
        <MessageBox text={question.text} buttons={['예', '아니오']} onAnswer={(index) => (index === 0 ? buy() : setQuestion(null))} />
      )}
      {question === null && notice !== null && (
        <MessageBox text={notice} buttons={['OK']} onAnswer={() => setNotice(null)} />
      )}
    </RawScreen>
  )
}

import { ORIGINAL_ITEMS } from '@/shared/config/original/items'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import {
  BOARD_BONUS_TABLE, STADIUM_HIDDEN_FIRST_SLOT, STADIUM_HIDDEN_UNLOCK_IDS, STADIUM_KINDS,
  STADIUM_SLOT_COUNTS, STAND_CAPACITY_TABLE,
  isHiddenStadiumSlot, ownsStadiumItem, requiredPopularityOf, stadiumPriceOf,
} from '@/entities/season-mode/model/stadiumItems'
import type { StadiumKind } from '@/entities/season-mode/model/stadiumItems'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import {
  STADIUM_BOXES, STADIUM_KIND_ROW, STADIUM_SLOT_ROW, TEXT, stadiumSlotWindowStartOf,
} from '@/widgets/season/lib/seasonWindowLayout'
import { seasonMoneyTextOf } from '@/widgets/season/lib/seasonText'
import * as styles from '@/widgets/season/ui/SeasonWindow.css'

/**
 * 구장 아이템 이름 — StrITEM **126~132**(관중석) · **133~139**(전광판) · **140~143**(잔디) (J 4-9 · S3 9절).
 * 잔디 설명은 StrITEM[144 + 칸] 이다.
 */
const NAME_BASE: Readonly<Record<StadiumKind, number>> = { 관중석: 126, 전광판: 133, 잔디: 140 }
const GRASS_DESCRIPTION_BASE = 144
/** StrITEM[184] "인기도 제한 없음" · [185] "인기도 %d 이상" */
const NO_POPULARITY_LIMIT = 184
const POPULARITY_LIMIT_FORMAT = 185

export function stadiumItemNameOf(kind: StadiumKind, slot: number): string {
  return ORIGINAL_ITEMS[NAME_BASE[kind] + slot] ?? ''
}

/**
 * 칸 설명 — 관중석 "%d명 수용 가능" · 전광판 "관중 +%d" (J 4-9 표).
 * 두 문구는 StrITEM 에 없어(웹 데이터에도 없다) 문서 표기를 그대로 옮겨 적었다.
 * 잔디는 StrITEM[144 + 칸] 설명 문구뿐이고 **수치 효과가 없다** (S3 8절).
 */
export function stadiumEffectTextOf(kind: StadiumKind, slot: number): string {
  if (kind === '관중석') return `${(STAND_CAPACITY_TABLE[slot] ?? 0) * 1000}명 수용 가능`
  if (kind === '전광판') return `관중 +${(BOARD_BONUS_TABLE[slot] ?? 0) * 1000}`
  return (ORIGINAL_ITEMS[GRASS_DESCRIPTION_BASE + slot] ?? '').replaceAll('!N', '\n')
}

/** 필요 인기도 줄 — StrITEM[184]/[185] (설명 줄이 읽는 표가 0xd44c4 = 0xcbc34 의 사본, S3 3절) */
export function requiredPopularityTextOf(kind: StadiumKind, slot: number): string {
  const required = requiredPopularityOf(kind, slot) ?? 0
  if (required === 0) return ORIGINAL_ITEMS[NO_POPULARITY_LIMIT] ?? ''
  return (ORIGINAL_ITEMS[POPULARITY_LIMIT_FORMAT] ?? '').replace('%d', String(required))
}

export interface StadiumShopWindowProps {
  readonly record: SeasonRecord
  readonly kind: StadiumKind
  readonly slot: number
  readonly onMoveKind: (kind: StadiumKind) => void
  readonly onMoveSlot: (slot: number) => void
  readonly onSelect: (kind: StadiumKind, slot: number) => void
  /** 히든 칸이 열려 있는가 — `app[0xe0 + 종류×4 + (칸−4)]` (S3 7절) */
  readonly isHiddenOpen: (unlockId: number) => boolean
  /** 상점(0x957c) 인가, 구단관리-구장관리(0x7958) 인가 — 보이는 값이 다르다 */
  readonly mode: '상점' | '구장관리'
}

/**
 * 구장 아이템 창 `0x83378` — mode_ui **프레임 32**(P6 3절 확정: 박스 7개·색).
 *
 * 종류 3칸(관중석·전광판·잔디)과 칸 목록(관중석·전광판 7칸, 잔디 4칸)을 함께 보여 준다.
 * 키 처리 `0x957c` 도 목록 둘(`[win+0x198]` 종류 · `[win+0x19c]` 칸)을 읽으므로 짝이 맞는다.
 *
 * ⚠️ 박스 **안쪽** 글·줄 자리는 문서에 없다 — **근사**다 (`seasonWindowLayout.ts` 참고).
 */
export function StadiumShopWindow({
  record, kind, slot, onMoveKind, onMoveSlot, onSelect, isHiddenOpen, mode,
}: StadiumShopWindowProps) {
  const kindIndex = STADIUM_KINDS.indexOf(kind)
  const slotCount = STADIUM_SLOT_COUNTS[kindIndex]
  const equipped = record.stadiumEquipped[kindIndex]
  const price = stadiumPriceOf(kind, slot)

  const lockedText = (target: number): string | null => {
    if (!isHiddenStadiumSlot(kind, target)) return null
    // 히든 칸은 해금 id 로 연다 — 관중석 13·14·15 / 전광판 16·17·18 (S3 7절)
    const unlockId = STADIUM_HIDDEN_UNLOCK_IDS[kindIndex][target - STADIUM_HIDDEN_FIRST_SLOT]
    return unlockId !== undefined && isHiddenOpen(unlockId) ? null : '???'
  }

  return (
    <div role="group" aria-label={mode === '상점' ? '구장 아이템' : '구장관리'}>
      {/* 박스 6 판 */}
      <div
        className={styles.stadiumPanel}
        style={{
          left: STADIUM_BOXES.panel.x, top: STADIUM_BOXES.panel.y,
          width: STADIUM_BOXES.panel.width, height: STADIUM_BOXES.panel.height,
        }}
      />

      {/* 박스 0 수치 칸 — 지금 장착한 칸 번호 (근사) */}
      <div
        className={styles.innerBox}
        style={{
          left: STADIUM_BOXES.value.x, top: STADIUM_BOXES.value.y,
          width: STADIUM_BOXES.value.width, height: STADIUM_BOXES.value.height,
        }}
      />
      <div
        className={styles.title}
        style={{
          left: STADIUM_BOXES.value.x, top: STADIUM_BOXES.value.y + 1,
          width: STADIUM_BOXES.value.width, fontSize: `${TEXT.smallSize}px`,
        }}
      >
        {equipped + 1}
      </div>

      {/* 박스 1·2·3 머리칸 */}
      <div className={styles.title} style={{ left: STADIUM_BOXES.kindHead.x, top: STADIUM_BOXES.kindHead.y + 2, width: STADIUM_BOXES.kindHead.width }}>
        {kind}
      </div>
      <div className={styles.title} style={{ left: STADIUM_BOXES.nameHead.x, top: STADIUM_BOXES.nameHead.y + 2, width: STADIUM_BOXES.nameHead.width }}>
        {lockedText(slot) ?? stadiumItemNameOf(kind, slot)}
      </div>
      <div className={styles.title} style={{ left: STADIUM_BOXES.slotHead.x, top: STADIUM_BOXES.slotHead.y + 2, width: STADIUM_BOXES.slotHead.width }}>
        {mode === '상점' ? '가격' : '교체'}
      </div>

      {/* 종류 3칸 (근사 자리) */}
      {STADIUM_KINDS.map((name, index) => (
        <button
          key={name}
          type="button"
          className={`${styles.row}${name === kind ? ` ${styles.rowSelected}` : ''}`}
          aria-current={name === kind}
          style={{
            left: STADIUM_KIND_ROW.x + STADIUM_KIND_ROW.step * index,
            top: STADIUM_KIND_ROW.y,
            width: STADIUM_KIND_ROW.width,
            height: STADIUM_KIND_ROW.height,
            fontSize: `${TEXT.smallSize}px`,
          }}
          onClick={() => onMoveKind(name)}
        >
          <span className={styles.rowLabel}>{name}</span>
        </button>
      ))}

      {/* 칸 막대 — 관중석·전광판 7개, 잔디 4개. 11px 글자를 담으려면 줄이 13px 이라 넉 줄씩 굴린다 */}
      <div
        className={styles.stadiumSlotList}
        style={{
          left: STADIUM_SLOT_ROW.x,
          top: STADIUM_SLOT_ROW.y,
          width: STADIUM_SLOT_ROW.width,
          height: STADIUM_SLOT_ROW.step * STADIUM_SLOT_ROW.visible,
        }}
      >
      <div
        className={styles.stadiumSlotTrack}
        style={{ transform: `translateY(${-STADIUM_SLOT_ROW.step * stadiumSlotWindowStartOf(slot, slotCount)}px)` }}
      >
      {Array.from({ length: slotCount }, (_unused, index) => {
        const owned = ownsStadiumItem(record, kind, index)
        const locked = lockedText(index)
        const rowPrice = stadiumPriceOf(kind, index) ?? 0
        const value = mode === '상점'
          ? (rowPrice === 0 ? '기본' : seasonMoneyTextOf(rowPrice))
          : (owned ? '보유' : '미보유')
        return (
          <button
            key={index}
            type="button"
            className={styles.stadiumBar}
            aria-label={`${kind} ${locked ?? stadiumItemNameOf(kind, index)}`}
            aria-current={index === slot}
            style={{
              left: 0,
              top: STADIUM_SLOT_ROW.step * index,
              width: '100%',
              height: STADIUM_SLOT_ROW.height,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              // 고른 줄 노랑 · 지금 장착한 줄 하늘색 (다른 창들과 같은 표시 방법 — 근사)
              color: index === slot
                ? ORIGINAL_COLORS.highlightYellow
                : index === equipped ? ORIGINAL_COLORS.cursorCyan : ORIGINAL_COLORS.text,
            }}
            onMouseEnter={() => onMoveSlot(index)}
            onClick={() => {
              onMoveSlot(index)
              onSelect(kind, index)
            }}
          >
            {/* 이름은 칸(70px)보다 길면 말줄임 — 고른 줄의 온전한 이름은 머리칸 박스 2 가 보여 준다 */}
            <span className={styles.stadiumBarName}>{locked ?? stadiumItemNameOf(kind, index)}</span>
            <span className={styles.stadiumBarValue}>{value}</span>
          </button>
        )
      })}
      </div>
      </div>

      {/* 박스 4 설명 */}
      <div
        className={styles.notice}
        style={{
          left: STADIUM_BOXES.description.x + 2, top: STADIUM_BOXES.description.y + 2,
          width: STADIUM_BOXES.description.width - 4, height: STADIUM_BOXES.description.height - 4,
        }}
      >
        {[
          stadiumEffectTextOf(kind, slot),
          requiredPopularityTextOf(kind, slot),
          price === null || price === 0 ? '' : seasonMoneyTextOf(price),
          ownsStadiumItem(record, kind, slot) ? '보유 중' : '',
          equipped === slot ? '장착 중' : '',
        ].filter((line) => line !== '').join('\n')}
      </div>
    </div>
  )
}

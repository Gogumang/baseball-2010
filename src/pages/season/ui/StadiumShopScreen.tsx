import { useState } from 'react'
import { MessageBox, RawScreen } from '@/shared/ui'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import {
  STADIUM_KINDS, STADIUM_SLOT_COUNTS, buyStadiumItem, checkStadiumPurchase, equipStadiumItem,
  stadiumCollectorUnlocks,
} from '@/entities/season-mode/model/stadiumItems'
import type { StadiumKind, StadiumPurchaseRefusal } from '@/entities/season-mode/model/stadiumItems'
import { StadiumShopWindow, stadiumItemNameOf } from '@/widgets/season/ui/StadiumShopWindow'
import { SeasonStatusBar } from '@/widgets/season/ui/SeasonStatusBar'
import { seasonMoneyTextOf } from '@/widgets/season/lib/seasonText'
import { useSeasonCursor } from '@/widgets/season/model/useSeasonCursor'
import { STADIUM_BOXES } from '@/widgets/season/lib/seasonWindowLayout'
import * as styles from '@/widgets/season/ui/SeasonWindow.css'

/** 가드 문구 — 원본 StrMODE (S3 4절). 웹에 StrMODE 표가 없어 다른 화면들처럼 글을 그대로 적는다 */
const REFUSAL_TEXT: Readonly<Record<StadiumPurchaseRefusal, (required: number) => string>> = {
  없는칸: () => '', // 목록에 없는 칸 — 원본에는 생길 수 없다
  미오픈: () => '아직 구매할 수 없는 아이템입니다. 특별한 조건을 통해 오픈됩니다', // StrMODE[76]
  이미보유: () => '이미 가지고 있는 아이템입니다', // StrMODE[78]
  인기도부족: (required) => `인기도가 부족합니다. 필요한 인기도 : ${required}`, // StrMODE[62]
  소지금부족: () => '소지금이 부족합니다', // StrMODE[77]
}

/** StrMODE[184] — 구매 완료 (0x812c 가 띄우는 결과코드 15 팝업) */
const PURCHASED_TEXT =
  '!C구장 아이템 구매 완료!!N자동으로 적용되며!N[구단관리]-[구장관리]!N에서 교체할 수 있습니다'
/** StrMODE[185] — 교체 (0x7958) */
const EQUIPPED_TEXT = (name: string) => `[${name}] 아이템을 적용합니다`
/** StrMODE[79] — 구매 확인 (결과코드 14) */
const PURCHASE_QUESTION = (price: number) =>
  `!C!cFFFF00소지금 ${seasonMoneyTextOf(price)}!cFFFFFF이 소모됩니다!N구매하겠습니까?`

export interface StadiumShopScreenProps {
  readonly record: SeasonRecord
  /** 팀 레코드 +2 — 아래 수치 줄에만 쓴다 */
  readonly teamMorale: number
  /**
   * **상점**(구단관리 → 아이템 창 종류 4, 키 0x957c)인가,
   * **구장관리**(구단관리 하위 칸 0, 키 0x7958)인가. 기본은 상점이다.
   */
  readonly mode?: '상점' | '구장관리'
  /** 히든 칸 해금 여부 — `app[0xe0 + 종류×4 + (칸−4)]` (S3 7절). 없으면 전부 잠긴 것으로 본다 */
  readonly isHiddenOpen?: (unlockId: number) => boolean
  /** 사거나 바꾼 뒤의 레코드. 저장(0x22755)은 부르는 쪽이 한다 */
  readonly onChange: (record: SeasonRecord) => void
  /** 컬렉터 해금 id (관중석 13 · 전광판 16) 가 열렸다 — 0x81d0 */
  readonly onUnlock?: (unlockIds: readonly number[]) => void
  /** 취소(−16) — 상점은 아이템 메뉴로, 구장관리는 구단관리(0xce)로 되돌아간다 */
  readonly onBack: () => void
}

/**
 * 구장 아이템 화면 — 상점 `0x957c`(가드) + `0x7d90` 결과코드 14·15(구매·해금) ·
 * 구장관리 `0x7958`(교체). `docs/re/S3-stadium-items.md` 확정.
 *
 * 원본 버그 두 가지를 **그대로** 옮겼다:
 *   ⚠️ 사도 **인기도가 깎이지 않는다** — 인기도는 조건일 뿐이다 (S3 5-1).
 *   ⚠️ 교체(구장관리)에는 **가드가 하나도 없다** — 안 산 칸도 그대로 끼워진다 (S3 6절).
 * 그리고 **잔디는 1·2·3억을 받으면서 어떤 계산에도 들어가지 않는다** (S3 8절).
 */
export function StadiumShopScreen({
  record, teamMorale, mode = '상점', isHiddenOpen = () => false, onChange, onUnlock, onBack,
}: StadiumShopScreenProps) {
  const [kind, setKind] = useState<StadiumKind>(STADIUM_KINDS[0])
  const [notice, setNotice] = useState<string | null>(null)
  const [question, setQuestion] = useState<{ readonly kind: StadiumKind; readonly slot: number; readonly text: string } | null>(null)

  const select = (nextKind: StadiumKind, nextSlot: number) => {
    // 구장관리(0x7958)는 `rec[0x1b8 + 종류] = 선택칸` 한 줄이 전부다 — ⚠️ 가드가 없다
    if (mode === '구장관리') {
      onChange(equipStadiumItem(record, nextKind, nextSlot))
      setNotice(EQUIPPED_TEXT(stadiumItemNameOf(nextKind, nextSlot)))
      return
    }
    const checked = checkStadiumPurchase(record, record.popularity, nextKind, nextSlot, isHiddenOpen)
    if (!checked.ok) {
      const text = REFUSAL_TEXT[checked.reason](checked.required ?? 0)
      if (text !== '') setNotice(text)
      return
    }
    setQuestion({ kind: nextKind, slot: nextSlot, text: PURCHASE_QUESTION(checked.price) })
  }

  const buy = () => {
    if (question === null) return
    // 0x812c — 소지금 차감 · 보유 기록 · 그 자리에서 장착. ⚠️ 인기도는 그대로다
    const bought = buyStadiumItem(record, question.kind, question.slot)
    setQuestion(null)
    onChange(bought)
    setNotice(PURCHASED_TEXT)
    // 0x81d0 — 완료 팝업이 닫힐 때 기본 4칸을 다 모았으면 컬렉터 해금(13·16)
    const unlocked = stadiumCollectorUnlocks(bought)
    if (unlocked.length > 0) onUnlock?.(unlocked)
  }

  // 칸 커서는 원본 목록 둘 중 `[win+0x19c]`(칸) 쪽이다. 종류(`[win+0x198]`)는 눌러서 바꾼다
  // (원본이 두 목록 사이를 어떤 키로 오가는지는 안 풀렸다 — **근사**).
  const slotCount = STADIUM_SLOT_COUNTS[STADIUM_KINDS.indexOf(kind)]
  const { cursor: slot, moveTo } = useSeasonCursor({
    count: slotCount,
    onSelect: (index) => select(kind, index),
    onCancel: onBack,
    isEnabled: notice === null && question === null,
  })

  return (
    <RawScreen>
      <StadiumShopWindow
        record={record}
        kind={kind}
        slot={slot}
        mode={mode}
        isHiddenOpen={isHiddenOpen}
        onMoveKind={(next) => {
          setKind(next)
          moveTo(0)
        }}
        onMoveSlot={moveTo}
        onSelect={select}
      />
      <SeasonStatusBar record={record} teamMorale={teamMorale} />
      {/* 원본은 바닥띠(0x54d94)의 뒤로 표시가 취소 키를 대신한다 — 머리띠·바닥띠는 아직 시즌 제목이 없다 */}
      <button
        type="button"
        className={styles.backButton}
        style={{ left: STADIUM_BOXES.panel.x, top: STADIUM_BOXES.panel.y + STADIUM_BOXES.panel.height + 4 }}
        onClick={onBack}
      >
        되돌아가기
      </button>

      {question !== null && (
        <MessageBox
          text={question.text}
          buttons={['예', '아니오']}
          onAnswer={(index) => (index === 0 ? buy() : setQuestion(null))}
        />
      )}
      {question === null && notice !== null && (
        <MessageBox text={notice} buttons={['확인']} onAnswer={() => setNotice(null)} />
      )}
    </RawScreen>
  )
}

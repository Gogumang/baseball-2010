import { useEffect, useEffectEvent, useState } from 'react'
import { MessageBox, RawScreen } from '@/shared/ui'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { checkSeasonGpItem, checkSeasonSubItem } from '@/entities/season-mode/model/seasonItemShop'
import { seasonGpItemsOf, seasonSubItemsOf } from '@/widgets/season/lib/seasonSubItems'
import { SeasonStatusPanel } from '@/pages/season/ui/SeasonStatusPanel'
import { SeasonCommandBar } from '@/pages/season/ui/SeasonCommonFrame'
import { seasonParentSlotOf } from '@/pages/season/lib/seasonCommandBar'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { ShopWindow } from '@/pages/shop/ui/ShopWindow'
import type { ShopEntry } from '@/pages/shop/lib/shopEntries'

/** 100만 원 → 만원 */
const MILLION_TO_TEN_THOUSAND = 100

export interface SeasonItemShopScreenProps {
  /** 창 종류 [win+0x1a4] — 1 서브아이템 · 2 GP */
  readonly kind: 1 | 2
  readonly record: SeasonRecord
  readonly teamMorale: number
  readonly gamePoint: number
  /** 들어올 때 커서 — 0xe8 에서 돌아오면 GP 칸 3 (0x5f3c) */
  readonly initialCursor?: number
  /** 0x7d90 결과 0xc — 팝업 글(StrMODE[92]) */
  readonly onBuySubItem: (slot: number) => string
  /** 0x7d90 결과 0xd — 효과 글, 칸 3 은 null(→ 0xe8) */
  readonly onBuyGpItem: (slot: number) => string | null
  /** 0x957c 취소(−16) → 0xd0 */
  readonly onBack: () => void
}

/**
 * **아이템 상점 0xdc — 창 종류 1 서브아이템 · 2 GP** (키 0x957c · 적용 0x7d90 · 창 0x81dc0).
 * 가드·적용은 `entities/season-mode/model/seasonItemShop.ts` 머리 주석(직접 떴다).
 *
 * 확인('5'·확인 키)에서 가드에 걸리면 1버튼 팝업, 통과하면 예/아니오(결과 0xc · 0xd). "예" 만 적용한다(0x7d90 은
 * 답 [+0x21c] == 0 일 때만 들어간다). 취소는 아이템 메뉴 0xd0.
 *
 * 창은 나리 상점과 같은 창 0x81dc0 이다(`ShopWindow`). 격자는 5 열 × 2 줄 10칸(0x81618 의 vt+0x1c(5, 2, 1, 0x30))이고
 * GP 창 칸 7~9 는 아이콘 표 0xd4662 가 −1 이라 바탕만 깔린 빈 칸이다 — 커서는 서지만 이름 · 값 · 설명이 없고(칸 > 6,
 * 0x826a6 · 0x827c6 · 0x828b4) 확인해도 가드가 아무 일도 안 한다.
 */
export function SeasonItemShopScreen({
  kind,
  record,
  teamMorale,
  gamePoint,
  initialCursor = 0,
  onBuySubItem,
  onBuyGpItem,
  onBack,
}: SeasonItemShopScreenProps) {
  const [cursor, setCursor] = useState(initialCursor)
  const [notice, setNotice] = useState<string | null>(null)
  /** G부족 [65] — 예/아니오 (2, 2). 웹은 G 충전 0xfa 가 없어 두 답 모두 닫기만 한다 */
  const [lackNotice, setLackNotice] = useState<string | null>(null)
  const [question, setQuestion] = useState<{ readonly text: string; readonly slot: number } | null>(null)

  const entries = shopEntriesOf(kind, record)

  const select = (slot: number) => {
    const checked = kind === 1 ? checkSeasonSubItem(record, slot) : checkSeasonGpItem({ record, teamMorale, gamePoint }, slot)
    if (checked === null) return
    if (!checked.ok) return checked.asks === true ? setLackNotice(checked.notice) : setNotice(checked.notice)
    return setQuestion({ text: checked.question, slot })
  }

  const buy = (slot: number) => {
    setQuestion(null)
    const text = kind === 1 ? onBuySubItem(slot) : onBuyGpItem(slot)
    if (text !== null) setNotice(text)
  }

  const isPopup = isShopPopupOpen(notice, question, lackNotice)
  const latest = useEffectEvent(() => ({ isPopup, onBack }))
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (latest().isPopup) return
      if (event.key !== 'Escape' && event.key !== 'Backspace') return
      event.preventDefault()
      latest().onBack()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <RawScreen>
      {/* 상태판 0x7d34c 를 먼저 그리고 그 위에 다른 것이 덮인다 (원본 그리기 차례) */}
      <SkinBackdrop kind="공무늬" />
      <SeasonStatusPanel record={record} teamMorale={teamMorale} />
      {/* 커맨드 줄 0x7e418 — 이 상태는 0x7e84c 가 칸 수를 0 으로 비워 하위 메뉴 객체의 부모 칸(아이템)만 (6, 245) 에 남는다 */}
      <SeasonCommandBar slots={[]} cursor={0} parent={seasonParentSlotOf('아이템')} />
      <div role="group" aria-label={kind === 1 ? '서브아이템 상점' : 'GP아이템 상점'}>
        <ShopWindow
          kind={kind === 1 ? '서브' : 'GP'}
          entries={entries}
          cursor={cursor}
          onMoveCursor={setCursor}
          onSelect={select}
          money={record.money * MILLION_TO_TEN_THOUSAND}
          isKeyEnabled={!isPopup}
        />
      </div>
      <ScreenFrame title="시즌모드" gamePoint={gamePoint} onBack={onBack} footer={5} slides={false} />
      {question !== null && (
        <MessageBox text={question.text} buttons={['예', '아니오']} onAnswer={(index) => (index === 0 ? buy(question.slot) : setQuestion(null))} />
      )}
      {lackNotice !== null && <MessageBox text={lackNotice} buttons={['예', '아니오']} onAnswer={() => setLackNotice(null)} />}
      {question === null && noticeBoxOf(notice, () => setNotice(null))}
    </RawScreen>
  )
}

/** 창 칸 — 1 서브아이템(가진 것은 표시), 그 밖 GP아이템 */
function shopEntriesOf(kind: SeasonItemShopScreenProps['kind'], record: SeasonItemShopScreenProps['record']): readonly ShopEntry[] {
  return kind === 1
    ? seasonSubItemsOf(record).map((item) => ({
        id: `시즌서브:${item.slot}`,
        name: item.name,
        description: item.description,
        price: item.price,
        iconFrame: item.iconFrame,
        isOwned: item.isOwned,
        blockNotice: null,
      }))
    : seasonGpItemsOf().map((item) => ({
        id: `시즌GP:${item.slot}`,
        name: item.name,
        description: item.description,
        price: item.price,
        iconFrame: item.iconFrame,
        isOwned: false,
        blockNotice: null,
      }))
}

/** 팝업(알림 · 확인 · G부족)이 떠 있으면 창이 키를 안 받는다 */
function isShopPopupOpen(notice: string | null, question: object | null, lackNotice: string | null): boolean {
  return notice !== null || question !== null || lackNotice !== null
}

/** 알림 — 확인 팝업이 없을 때만 */
function noticeBoxOf(notice: string | null, onClose: () => void) {
  if (notice === null) return null
  return <MessageBox text={notice} buttons={['OK']} onAnswer={onClose} />
}

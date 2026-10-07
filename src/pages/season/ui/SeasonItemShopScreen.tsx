import { useEffect, useRef, useState } from 'react'
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
 * ⚠️ 근사: 창은 나리 상점 창(`ShopWindow`)을 빌렸다. GP 창은 원본이 5×2 격자 10칸(0x81618)이고 칸 7~9 는 비어 있어
 * 확인해도 아무 일이 없다 — 웹은 일곱 칸만 둔다(빈 칸 그림을 `ShopWindow` 가 못 그린다).
 */
export function SeasonItemShopScreen({
  kind, record, teamMorale, gamePoint, initialCursor = 0, onBuySubItem, onBuyGpItem, onBack,
}: SeasonItemShopScreenProps) {
  const [cursor, setCursor] = useState(initialCursor)
  const [notice, setNotice] = useState<string | null>(null)
  const [question, setQuestion] = useState<{ readonly text: string; readonly slot: number } | null>(null)

  const entries: readonly ShopEntry[] = kind === 1
    ? seasonSubItemsOf(record).map((item) => ({
      id: `시즌서브:${item.slot}`, name: item.name, description: item.description, price: item.price,
      iconFrame: item.iconFrame, isOwned: item.isOwned, blockNotice: null,
    }))
    : seasonGpItemsOf().map((item) => ({
      id: `시즌GP:${item.slot}`, name: item.name, description: item.description, price: item.price,
      iconFrame: item.iconFrame, isOwned: false, blockNotice: null,
    }))

  const select = (slot: number) => {
    const checked = kind === 1
      ? checkSeasonSubItem(record, slot)
      : checkSeasonGpItem({ record, teamMorale, gamePoint }, slot)
    if (checked === null) return
    if (!checked.ok) return setNotice(checked.notice)
    return setQuestion({ text: checked.question, slot })
  }

  const buy = (slot: number) => {
    setQuestion(null)
    const text = kind === 1 ? onBuySubItem(slot) : onBuyGpItem(slot)
    if (text !== null) setNotice(text)
  }

  const isPopup = notice !== null || question !== null
  const latest = useRef({ isPopup, onBack })
  latest.current = { isPopup, onBack }
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (latest.current.isPopup) return
      if (event.key !== 'Escape' && event.key !== 'Backspace') return
      event.preventDefault()
      latest.current.onBack()
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
      <ScreenFrame title="시즌모드" gamePoint={gamePoint} onBack={onBack} footer={5} />
      {question !== null && (
        <MessageBox text={question.text} buttons={['예', '아니오']}
          onAnswer={(index) => (index === 0 ? buy(question.slot) : setQuestion(null))} />
      )}
      {question === null && notice !== null && (
        <MessageBox text={notice} buttons={['OK']} onAnswer={() => setNotice(null)} />
      )}
    </RawScreen>
  )
}

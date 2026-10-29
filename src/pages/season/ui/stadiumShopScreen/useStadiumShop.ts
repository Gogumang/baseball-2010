import { useState } from 'react'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import {
  STADIUM_KINDS,
  buyStadiumItem,
  canEquipStadiumItem,
  checkStadiumPurchase,
  equipStadiumItem,
  stadiumCollectorUnlocks,
  stadiumPreviewOf,
} from '@/entities/season-mode/model/stadiumItems'
import type { StadiumKind } from '@/entities/season-mode/model/stadiumItems'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { useTouchScrollKeys } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { moveStadiumKind, moveStadiumSlot, stadiumItemNameOf } from '@/pages/season/lib/stadiumItemWindow'
import { scrolledEquipmentTopOf } from '@/pages/season/lib/seasonEquipmentWindow'
import { INITIAL_STADIUM_PREVIEW_SCENE, rewoundScoreboardX } from '@/pages/season/lib/stadiumPreviewScene'
import { hiddenOpenNoticeTextOf } from '@/entities/collection/model/hiddenOpenNotice'
import { EQUIPPED_TEXT, PURCHASED_TEXT, PURCHASE_QUESTION, REFUSAL_TEXT } from './stadiumTexts'
import { entrySceneOf } from './entryScene'
import type { StadiumShopScreenProps } from './stadiumShopProps'
import { useSceneHandover } from './useSceneHandover'
import { useStadiumKeys } from './useStadiumKeys'
import { useScoreboardStep } from './useScoreboardStep'

const NEVER_OPEN = () => false

/** 구장 아이템 화면의 칸 · 고르기 — 훅 차례는 옛 몸통 그대로(칸 → 틱 → 장면 넘김 → 키 → 터치 → 전광판 흘리기) */
export function useStadiumShop(props: StadiumShopScreenProps) {
  const { record, onChange, onBack } = props
  const isHiddenOpen = props.isHiddenOpen ?? NEVER_OPEN
  const isShop = props.mode !== '구장관리'
  const [kind, setKind] = useState<StadiumKind>(STADIUM_KINDS[0])
  const [slot, setSlot] = useState(0)
  const [top, setTop] = useState(0)
  const [isSlotFocus, setSlotFocus] = useState(false)
  /** 상점 미리보기에 끼운 칸 — 칸 목록이 움직였을 때만 선다(0x9cb2 [목록+0x25]), 취소면 저장값으로 */
  const [shopPreviewSlot, setShopPreviewSlot] = useState<number | null>(null)
  const [entryScene] = useState(() => entrySceneOf(isShop, props.previewScene ?? INITIAL_STADIUM_PREVIEW_SCENE, record))
  /** 구장 +0x8c — 상점 그리기 0xb1f8 만 0x77fb5(구장, 1)로 흘린다. 구장관리 0xb158 은 그대로 둔다 */
  const [scoreboardX, setScoreboardX] = useState(entryScene.scoreboardX)
  const [notice, setNotice] = useState<string | null>(null)
  /** 구매 완료 팝업(결과코드 15)이 닫힐 때 0x81d0 이 볼 레코드 — 산 그 판의 것 */
  const [purchased, setPurchased] = useState<SeasonRecord | null>(null)
  /** 0x81d0 의 0x62368 이 공용 창에 띄운 히든 오픈 글 — 떠 있는 것 하나 + 대기 하나 (0x74ef4 +0x2a4) */
  const [hiddenNotices, setHiddenNotices] = useState<readonly string[]>([])
  const [question, setQuestion] = useState<{ readonly kind: StadiumKind; readonly slot: number; readonly text: string } | null>(null)
  const tick = useUpdateCounter()
  useSceneHandover(isShop, entryScene, scoreboardX, props.onPreviewSceneChange)

  /** 구장관리(0x7958)는 `rec[0x1b8 + 종류] = 선택칸` 한 줄이 전부다 — ⚠️ 가드가 없다. B-06 고침(기본 켬): 안 산 칸은 알림 없이 안 끼운다 */
  const equip = (nextKind: StadiumKind, nextSlot: number) => {
    if (!canEquipStadiumItem(record, nextKind, nextSlot)) return
    onChange(equipStadiumItem(record, nextKind, nextSlot))
    setNotice(EQUIPPED_TEXT(stadiumItemNameOf(nextKind, nextSlot)))
  }
  const select = (nextKind: StadiumKind, nextSlot: number) => {
    if (!isShop) return equip(nextKind, nextSlot)
    const checked = checkStadiumPurchase(record, record.popularity, nextKind, nextSlot, isHiddenOpen)
    if (checked.ok) return setQuestion({ kind: nextKind, slot: nextSlot, text: PURCHASE_QUESTION(checked.price) })
    const text = REFUSAL_TEXT[checked.reason](checked.required ?? 0)
    if (text !== '') setNotice(text)
  }
  const buy = () => {
    if (question === null) return
    // 0x812c — 소지금 차감 · 보유 기록 · 그 자리에서 장착. ⚠️ 인기도는 그대로다
    const bought = buyStadiumItem(record, question.kind, question.slot)
    setQuestion(null)
    onChange(bought)
    setNotice(PURCHASED_TEXT)
    setPurchased(bought)
  }
  /**
   * 알림 닫힘. 구매 완료(결과코드 15)였으면 **0x81d0** — `0xa38c5(rec, 0)` 참이면 `0x62369(g, 13, 0)`, `0xa38c5(rec, 1)` 참이면
   * `0x62369(g, 16, 0)`. 0x62368 은 이미 열린 k(0x61f5c)면 아무것도 안 하고, 새로 열면 공용 창에 StrCOMMON[139] + [141] 을 띄운다
   * (둘째는 창이 떠 있어 대기했다가 첫 창이 닫히면 뜬다).
   */
  const closeNotice = () => {
    setNotice(null)
    if (purchased === null) return
    setPurchased(null)
    const opened = stadiumCollectorUnlocks(purchased).filter((id) => !isHiddenOpen(id))
    if (opened.length === 0) return
    props.onUnlock?.(opened)
    setHiddenNotices(opened.map(hiddenOpenNoticeTextOf).filter((text): text is string => text !== null))
  }
  const enterSlots = () => {
    setSlotFocus(true)
    setSlot(0)
    setTop(0)
  }
  const leaveSlots = () => {
    setSlotFocus(false)
    setSlot(0)
    setTop(0)
    setShopPreviewSlot(null)
    // 상점 칸 목록 취소 — 미리보기를 저장값으로 되돌린 뒤 0x77edc(구장, 1) (0x9c0a~0x9c84)
    if (isShop && isSlotFocus) setScoreboardX((held) => rewoundScoreboardX(held, stadiumPreviewOf(record).board))
  }
  const moveSlotTo = (next: number) => {
    setSlot(next)
    setTop((held) => scrolledEquipmentTopOf(held, next))
    setShopPreviewSlot(next)
    // 상점에서 전광판(종류 1) 칸을 갈아 끼우면 +0x8a = 그 칸 · 0x76ba5 · 0x77edc(구장, 1) (0x9d48~0x9d72)
    if (isShop && kind === '전광판') setScoreboardX((held) => rewoundScoreboardX(held, next))
  }

  const isPopup = notice !== null || question !== null || hiddenNotices.length > 0
  useStadiumKeys({
    isPopup,
    isSlotFocus,
    run: {
      back: onBack,
      enter: enterSlots,
      left: () => setKind((held) => moveStadiumKind(held, -1)),
      right: () => setKind((held) => moveStadiumKind(held, 1)),
      leave: leaveSlots,
      select: () => select(kind, slot),
      up: () => moveSlotTo(moveStadiumSlot(kind, slot, -1)),
      down: () => moveSlotTo(moveStadiumSlot(kind, slot, 1)),
    },
  })
  // 터치 기기 — 칸 목록(5줄만 보인다)에 들어가 있으면 ▲ · ▼ 상황 버튼(↑ · ↓ 키 사건). 보이는 줄은 눌러서 고른다
  useTouchScrollKeys(isSlotFocus && !isPopup)

  // 미리보기 — 구장관리는 초점 1 이면 늘 커서 칸(0x7b10), 상점은 칸 목록이 움직였을 때만(0x9cb2)
  const previewSlot = !isSlotFocus ? null : isShop ? shopPreviewSlot : slot
  const previewStadium = stadiumPreviewOf(record, previewSlot === null ? undefined : { kind, slot: previewSlot })
  useScoreboardStep(tick, isShop, previewStadium.board, setScoreboardX)

  const pickKind = (next: StadiumKind) => {
    if (isPopup) return
    setKind(next)
    leaveSlots()
    enterSlots()
  }
  const pickSlot = (index: number) => {
    if (isPopup) return
    if (!isSlotFocus) {
      setSlotFocus(true)
      return moveSlotTo(index)
    }
    if (index === slot) return select(kind, slot)
    moveSlotTo(index)
  }
  return {
    isShop,
    isHiddenOpen,
    kind,
    slot,
    top,
    isSlotFocus,
    tick,
    entryScene,
    scoreboardX,
    previewStadium,
    notice,
    question,
    hiddenNotices,
    buy,
    closeNotice,
    leaveSlots,
    pickKind,
    pickSlot,
    setQuestion,
    setHiddenNotices,
  }
}

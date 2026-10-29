import { useState } from 'react'
import { MessageBox, RawScreen } from '@/shared/ui'
import type { Collection } from '@/entities/collection/model/collection'
import { HALL_OF_FAME_PITCHER_SLOTS, NARI_BATTER_SLOT, NARI_PITCHER_SLOT, hallOfFameCellOf } from '@/pages/special/lib/specialLayout'
import { useListPageEntry } from '@/widgets/screen-frame/model/useListPageEntry'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import type { SkinBackdropKind } from '@/pages/special/ui/SkinBackdrops'
import type { ScreenFrameTitle } from '@/widgets/screen-frame/lib/screenFrameLayout'
import { useHallOfFameFigure } from '@/pages/special/model/useHallOfFameFigure'
import type { HallOfFameListOwner } from '@/pages/special/model/useHallOfFameFigure'
import { useGridCursorBounce } from '@/shared/lib/gridCursorBounce/gridCursorBounce'
import { hallOfFameGridOf } from '@/pages/special/lib/hallOfFameGrid'
import { moveGridCursor } from '@/pages/special/ui/specialScreen/otherSlices'
import {
  hallOfFameGridOpenShapeOf,
  hallOfFameGridViewOf,
  initialHallOfFameSlotOf,
  isHomeRunDerbyPick,
} from '@/pages/special/ui/hallOfFameScreen/hallOfFameGridView'
import { hallOfFameSlotsOf } from '@/pages/special/ui/hallOfFameScreen/hallOfFameSlots'
import { HallOfFameFrame, HallOfFamePopupBox } from '@/pages/special/ui/hallOfFameScreen/HallOfFameOverlays'
import type { HallOfFameMode, HallOfFamePopup } from '@/pages/special/ui/hallOfFameScreen/hallOfFameTypes'
import { pressHallOfFameSlot } from '@/pages/special/ui/hallOfFameScreen/hallOfFamePress'
import { answerHallOfFamePopup, chooseHallOfFameBubble } from '@/pages/special/ui/hallOfFameScreen/hallOfFameAnswers'
import { useHallOfFameKeys } from '@/pages/special/ui/hallOfFameScreen/useHallOfFameKeys'
import { HallOfFamePlayerSpot } from '@/pages/special/ui/hallOfFameScreen/HallOfFamePlayerSpot'
import { HallOfFameAbility } from '@/pages/special/ui/hallOfFameScreen/HallOfFameAbility'
import { HallOfFameGrid } from '@/pages/special/ui/hallOfFameScreen/HallOfFameGrid'
import { HallOfFameBubble } from '@/pages/special/ui/hallOfFameScreen/HallOfFameBubble'

interface HallOfFameScreenProps {
  readonly collection: Collection
  readonly mode: HallOfFameMode
  readonly onBack: () => void
  /**
   * 머리띠를 다른 제목으로 그릴 때 — 머리띠 `0x54d95(skin, 제목, 5)` 는 제목이 −1 이 아니면 G포인트(0x54a60)도 그린다.
   * 시즌 선수영입 0xe2 는 공통 앞그림 0xb810 이 머리띠 객체를 `0x7f53c(hdr, 10, 5, 0)`(0xb8c8~0xb8d6, 0xe2 는 기본 갈래)로
   * 세우고 그리기 0xa10c 끝의 `0x7f4ec(hdr)` 가 `0x54d95(skin, 10 "시즌모드", 5)` 로 그린다. 안 주면 예전 그대로.
   */
  readonly frame?: { readonly title: ScreenFrameTitle; readonly gamePoint: number }
  /**
   * 바탕 — 안 주면 모드로 정한다: 등록(나리 상태 145 — 0x16928 이 `0x5fd61(skin, 0, 0, W, H)`)은 **공무늬**,
   * 보기(하위 27 0x2dcd8) · 선수고르기(미션 하위 17 0x2dec8 · 홈런더비 하위 16 0x2df20)는 **메뉴바탕** `0x58371(skin, main_title, 0)`.
   * 시즌 선수영입 0xe2 는 공통 앞그림 0xb810 이 0xdd · 0xe0 · 0xe1 밖이라 `0x5fd61` — 그 화면은 '공무늬' 를 넘겨야 원본과 같다.
   */
  readonly backdrop?: SkinBackdropKind
  /**
   * 목록 객체를 든 장면 — 안 주면 등록은 '나리'(나리 [this+0xd8]), 그 밖은 '메뉴'([this+0x120]). 시즌 선수영입 0xe2 는 '시즌'.
   * 셋 다 같은 전역 스킨이라 몸 그림의 그린 수·머무름·자세는 앱에 하나다(`HallOfFameFigure` 머리말) — 여기서는 격자 꼴만 가른다.
   */
  readonly listOwner?: HallOfFameListOwner
}

type SlotView = ReturnType<typeof hallOfFameSlotsOf>[number]

/** 등록(나리 145)은 공무늬, 그 밖은 메뉴바탕 */
const defaultBackdropOf = (mode: HallOfFameMode): SkinBackdropKind => (mode.kind === '등록' ? '공무늬' : '메뉴바탕')
/** 목록 객체를 든 장면 — 등록은 나리, 그 밖은 메뉴 */
const defaultListOwnerOf = (mode: HallOfFameMode): HallOfFameListOwner => (mode.kind === '등록' ? '나리' : '메뉴')
/** 등록 목록의 편 — 그 밖은 null */
const editionOf = (mode: HallOfFameMode) => (mode.kind === '등록' ? mode.edition : null)
const figureLookOf = (current: SlotView) => (current.kind === '찬칸' ? current.figure : null)
const chartValuesOf = (current: SlotView) => (current.kind === '찬칸' ? current.chartValues : [])
/** 홈런더비는 늘 타자 이름 축, 그 밖은 칸 ≥ 5 면 타자 */
const isBatterChartOf = (mode: HallOfFameMode, slot: number) => isHomeRunDerbyPick(mode) || slot >= HALL_OF_FAME_PITCHER_SLOTS

/** 나리 칸(0·5)의 찬 칸이면 그 팀 로고 — 그 밖은 null */
function teamLogoOf(slot: number, current: SlotView): number | null {
  if (current.kind !== '찬칸' || current.figure === null) return null
  return slot === NARI_PITCHER_SLOT || slot === NARI_BATTER_SLOT ? current.figure.team : null
}

/**
 * 명예의 전당 목록 (공용 목록 페이지 `0x63b15` 의 k = 8 — P6 2a-3 · S9 3~4절). 스페셜(상태 27)과 엔딩 뒤 등록(나리 상태 145)이 같이 쓴다.
 *
 * 위쪽 A(58,110) 자리에 고른 칸의 선수, B(178,96) 자리에 능력치 도형, 아래쪽에 **5×3 격자 15칸**
 * (`NARI_PITCHER_SLOT` 머리말의 배치). 스페셜에서는 칸을 고르면 **말풍선**(친구에게 선물 / 슬롯에서 삭제)이 뜬다.
 *
 * 찬 칸의 **캐릭터 그림**([skin+0x290])과 **팀 로고**(캐릭터+0x30, 나리 칸 0·5)는 `HallOfFameFigure` · `TeamLogo` 가 A 자리에
 * 그린다 — 원 두 개는 빈 칸 · 잠긴 칸에만 깐다(0x6535a~).
 *
 * ⚠️ **웹에서 못 하는 것**
 *  - "친구에게 선물" 은 통신이 필요해 안내만 띄운다. "슬롯에서 삭제" 는 `deletion`(HallOfFameDeletion) 대로 돈다.
 *    슬롯 현금 구매·G 충전 페이지(🌐)도 열 수 없어 목록으로 돌아온다.
 */
export function HallOfFameScreen({ collection, mode, onBack, frame, backdrop, listOwner }: HallOfFameScreenProps) {
  const [slot, setSlot] = useState(initialHallOfFameSlotOf(mode))
  const [isBubbleOpen, setIsBubbleOpen] = useState(false)
  const [bubbleCursor, setBubbleCursor] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [popup, setPopup] = useState<HallOfFamePopup | null>(null)

  const slots = hallOfFameSlotsOf(collection, mode)
  const view = hallOfFameGridViewOf(mode)
  const current = slots[slot]
  const cell = hallOfFameCellOf(slot - view.firstSlot, view.firstRowY)
  const menuGrid = hallOfFameGridOf(mode, listOwner ?? defaultListOwnerOf(mode))
  const figure = useHallOfFameFigure({
    slot,
    isBatterSlot: slot >= HALL_OF_FAME_PITCHER_SLOTS,
    look: figureLookOf(current),
    // 홈런더비 하위 16 은 그리기 0x32dd8 이 0x669c1 을 부르지 않는다(0x11 · 0x1b 만)
    capturesImage: !isHomeRunDerbyPick(mode),
  })
  // 0x63b14 k 6·7·8 — 머리띠가 미끄러지는 동안은 본문이 없고, 본문 첫 그림에 지은 격자가 열림 애니(0x79fa8)를 다 돌 때까지
  // 키 함수(16 0x29ac8 · 17 0x29a54 · 27 0x2ac00 · 시즌 0xe2 0xe340 · 나리 145 0x1ca4c)가 [skin+0xe4] == 0 을 보고 아무것도 안 한다.
  // 부르는 곳(0x2df20 · 0x2dec8 · 0x2dcd8 · 0xa10c · 0x15d54)이 모두 넷째 인자 1 이라 [skin+0xe8] = 1 — 애니가 돈다.
  // 머리띠도 같은 틱 0 에 +0x84 를 세우므로(0x63ba0) `frame` 을 안 받은 `SpecialBands` 도 미끄러진다 — 본문 · 키는 그 다섯 그림 뒤다.
  // 나리 145(0x15d54)의 머리띠는 0x7f4ec([this+0xe0]) — 틀 0x16928 기본 갈래 0x169ea 가 0x7f53c(hdr, [this+0xcc] == 4 ? 8 : 9, 5, 0)
  // 로 세운 제목 8 "나만의리그 타자편" / 9 "투수편" · 바닥 5 · G포인트다(부르는 쪽 EndingScreen 이 `frame` 으로 넘긴다).
  const gridOpenShape = hallOfFameGridOpenShapeOf(view.rows)
  const entry = useListPageEntry({ grid: { shape: gridOpenShape, isAnimated: true } })
  const gridOpen = entry.grid
  const bounce = useGridCursorBounce()

  const pressSlot = (target: number) =>
    pressHallOfFameSlot(mode, target, {
      collection,
      slots,
      showPopup: setPopup,
      openBubble: () => {
        setBubbleCursor(0)
        setIsBubbleOpen(true)
      },
    })
  const setters = { setPopup, setNotice, closeBubble: () => setIsBubbleOpen(false) }

  /** 되돌아가기 — 등록 목록은 결과 0 → StrMODE[219] (0x1ca4c), 선수 고르기는 결과 0 (0x6286e), 스페셜은 상태 6 */
  const goBack = () => {
    // 말풍선이 열렸으면 CLR 은 말풍선만 닫는다(키 갈래와 같다) — 바닥띠 되돌아가기(터치 · 마우스)도 같은 CLR 이다
    if (isBubbleOpen) return setIsBubbleOpen(false)
    if (mode.kind === '등록') return setPopup({ kind: '나중에' })
    if (mode.kind === '선수고르기') return mode.onCancel()
    return onBack()
  }

  useHallOfFameKeys({
    isActive: notice === null && popup === null,
    keyLock: entry.keyLock,
    isBubbleOpen,
    bubble: {
      onToggle: () => setBubbleCursor((previous) => 1 - previous),
      onConfirm: () => chooseHallOfFameBubble(mode, slot, bubbleCursor, setters),
      onClose: () => setIsBubbleOpen(false),
    },
    onMove: (direction) => {
      const next = view.firstSlot + moveGridCursor(menuGrid, slot - view.firstSlot, direction)
      // 칸이 바뀐 키(커서 +0x25)면 고른 칸을 튕긴다 — 시작 0x7a005(격자, [skin+0xe8], 1, 0) 의 [격자+6] = 1 (0x651e4)
      if (next !== slot) bounce.start(direction)
      setSlot(next)
    },
    onPress: () => pressSlot(slot),
    onBack: goBack,
  })

  return (
    <RawScreen>
      <SkinBackdrop kind={backdrop ?? defaultBackdropOf(mode)} />
      {gridOpen !== null && (
        <>
          <HallOfFamePlayerSpot slot={slot} current={current} teamLogo={teamLogoOf(slot, current)} figure={figure} />
          <HallOfFameAbility slot={slot} isBatterChart={isBatterChartOf(mode, slot)} chartValues={chartValuesOf(current)} />
          <HallOfFameGrid
            slots={slots}
            view={view}
            slot={slot}
            edition={editionOf(mode)}
            shape={gridOpenShape}
            gridOpen={gridOpen}
            bounce={bounce.offset}
            onPick={(index) => {
              setSlot(index)
              pressSlot(index)
            }}
          />
        </>
      )}

      {isBubbleOpen && (
        <HallOfFameBubble cell={cell} cursor={bubbleCursor} onChoose={(index) => chooseHallOfFameBubble(mode, slot, index, setters)} />
      )}

      <HallOfFameFrame frame={frame} onBack={goBack} />

      {notice !== null && <MessageBox text={notice} buttons={['확인']} onAnswer={() => setNotice(null)} />}
      <HallOfFamePopupBox popup={popup} onAnswer={(index) => answerHallOfFamePopup(mode, popup, index, setters)} />
    </RawScreen>
  )
}

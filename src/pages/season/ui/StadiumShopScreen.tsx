import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { MessageBox, RawScreen } from '@/shared/ui'
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
import { stadiumSkyRowOf } from '@/widgets/batting-stage/lib/stageScenery'
import { stepSeasonScoreboardX } from '@/widgets/batting-stage/lib/renderScenery'
import { liveGameInningIndex } from '@/shared/lib/liveGameState/liveGameState'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { useTouchScrollKeys } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { StadiumPreviewCanvas } from '@/pages/season/ui/StadiumPreviewCanvas'
import { StadiumItemWindow } from '@/pages/season/ui/StadiumItemWindow'
import type { StadiumKind, StadiumPurchaseRefusal } from '@/entities/season-mode/model/stadiumItems'
import { moveStadiumKind, moveStadiumSlot, stadiumItemNameOf } from '@/pages/season/lib/stadiumItemWindow'
import { scrolledEquipmentTopOf } from '@/pages/season/lib/seasonEquipmentWindow'
import { INITIAL_STADIUM_PREVIEW_SCENE, rewoundScoreboardX } from '@/pages/season/lib/stadiumPreviewScene'
import type { StadiumPreviewScene } from '@/pages/season/lib/stadiumPreviewScene'
import { fillModeText, seasonMoneyTextOf } from '@/widgets/season/lib/seasonText'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import { hiddenOpenNoticeTextOf } from '@/entities/collection/model/hiddenOpenNotice'

/** 가드 문구 — 원본 StrMODE (S3 4절). 원문 표(`ORIGINAL_MODE_TEXT`)에서 읽는다 (r216) */
const REFUSAL_TEXT: Readonly<Record<StadiumPurchaseRefusal, (required: number) => string>> = {
  없는칸: () => '', // 목록에 없는 칸 — 원본에는 생길 수 없다
  미오픈: () => ORIGINAL_MODE_TEXT[76] ?? '', // StrMODE[76]
  이미보유: () => ORIGINAL_MODE_TEXT[78] ?? '', // StrMODE[78]
  인기도부족: (required) => (ORIGINAL_MODE_TEXT[62] ?? '').replace('%d', String(required)), // StrMODE[62]
  소지금부족: () => ORIGINAL_MODE_TEXT[77] ?? '', // StrMODE[77]
}

/** 전역 게임 모드 [0x1552d10] — 시즌 2 (0x783b0 의 하늘 줄 갈래) */
const SEASON_MODE = 2

/**
 * StrMODE[184] — 구매 완료 (0x812c 가 0x81ba `movs r1, #0xb8` → 0xbbef9(this, 1, 0xf, 1) 로 띄우는 결과코드 15 팝업).
 * 원문은 [구단관리]-[구장관리] 두 이름이 노랑(!cFFFF00)이다 — 웹이 마크업을 뺀 글을 손으로 적어 흰 글로 나오던 것을 원문 표로 바꿨다(r263)
 */
const PURCHASED_TEXT = ORIGINAL_MODE_TEXT[184] ?? ''
/** StrMODE[185] `!C[!cFFFF00%s!cFFFFFF]!N아이템을 적용합니다` — 교체 (0x7958 sprintf) · 이름은 노랑, 둘째 줄에 안내 */
const EQUIPPED_TEXT = (name: string) => fillModeText(ORIGINAL_MODE_TEXT[185] ?? '', name)
/** StrMODE[79] — 구매 확인 (결과코드 14, 0x9bae `movs r1, #0x4f` → 0xbbef9(this, 2, 0xe, 1)) */
const PURCHASE_QUESTION = (price: number) => fillModeText(ORIGINAL_MODE_TEXT[79] ?? '', seasonMoneyTextOf(price))

export interface StadiumShopScreenProps {
  readonly record: SeasonRecord
  /**
   * **상점**(구단관리 → 아이템 창 종류 4, 키 0x957c)인가,
   * **구장관리**(구단관리 하위 칸 0, 키 0x7958)인가. 기본은 상점이다.
   */
  readonly mode?: '상점' | '구장관리'
  /** 히든 칸 해금 여부 — `app[0xe0 + 종류×4 + (칸−4)]` (S3 7절). 없으면 전부 잠긴 것으로 본다 */
  readonly isHiddenOpen?: (unlockId: number) => boolean
  /** 사거나 바꾼 뒤의 레코드. 저장(0x22755)은 부르는 쪽이 한다 */
  readonly onChange: (record: SeasonRecord) => void
  /** 컬렉터 해금 id (관중석 13 · 전광판 16) 를 새로 열었다 — 구매 완료 팝업이 닫힐 때 0x81d0 */
  readonly onUnlock?: (unlockIds: readonly number[]) => void
  /** 취소(−16) — 상점은 아이템 메뉴로, 구장관리는 구단관리(0xce)로 되돌아간다 */
  readonly onBack: () => void
  /** 머리띠 G포인트 */
  readonly gamePoint?: number
  /**
   * 장면 구장 칸(하늘 줄 +0x10 · 하늘 칸 +0x18 · 전광판 글자 +0x8c) — 장면 0x105 가 사는 동안 남는다(`StadiumPreviewScene`).
   * 들어올 때 이 값으로 서고, 구장관리 진입은 하늘을 새로 잰다. 생략하면 막 세운 장면(모두 0)
   */
  readonly previewScene?: StadiumPreviewScene
  /** 이 화면이 바꾼 장면 구장 칸 — 구장관리는 들어올 때 하늘을, 상점은 나갈 때 전광판 글자 자리를 돌려준다 */
  readonly onPreviewSceneChange?: (scene: StadiumPreviewScene) => void
}

/** 확인 키 −5 · '5' / 취소 −16 */
const isConfirmKey = (key: string) => key === 'Enter' || key === ' ' || key === '5'
const isCancelKey = (key: string) => key === 'Escape' || key === 'Backspace'

/**
 * 구장 아이템 화면 — 상점 `0x957c`(가드) + `0x7d90` 결과코드 14·15(구매·해금) ·
 * 구장관리 `0x7958`(교체). `docs/re/S3-stadium-items.md` 확정. 창은 아이템 창 0x83378 종류 4(`StadiumItemWindow`).
 *
 * **키** (직접 떴다 — 창 키 0x819ac 의 종류 3 · 4 공용 두 층 갈래 0x81a5e~0x81cc6):
 * ```
 * 종류 목록(초점 [창+0x1a8] = 0)  취소(−16) → 상점 0xd0(0x957c 0x9bd4~0x9bec) · 구장관리 0xce(0x7958 0x7a68)
 *                                 확인(−5 · '5') · 아래(−2 · '8') → 칸 수 > 0 이면 초점 1 · 칸 커서 0 · 맨 윗줄 0 (0x81c24~0x81c74)
 *                                 그 밖 → 종류 목록 vt+0x18(3 열 × 1 줄, 키 방식 1 — '4' · '6' 은 왼 · 오른, 감는다) · 0x8146c 칸 수 다시
 * 칸 목록(초점 1)                 취소 → 초점 0 · 칸 커서 0 · 맨 윗줄 0 (0x81a6c~0x81a90) — 그 앞에 미리보기를 저장값으로 되돌린다
 *                                 (상점 0x9c0a~0x9c84 · 구장관리 0x7a8c~0x7afc)
 *                                 확인 → 상점 가드(0x9aa4~) · 구장관리 교체(0x799c~)
 *                                 그 밖 → 칸 목록 vt+0x18(1 열 × 칸 수, 감는다)
 * 미리보기 갈아 끼우기             구장관리: 창 키 뒤 초점 1 이고 취소가 아니면 늘 지금 종류의 커서 칸(0x7b10~0x7bae)
 *                                 상점: 칸 목록이 움직였을 때만([목록+0x25], 0x9ca6~0x9cb8)
 * ```
 *
 * 원본 버그 두 가지를 **그대로** 옮겼다:
 *   ⚠️ 사도 **인기도가 깎이지 않는다** — 인기도는 조건일 뿐이다 (S3 5-1).
 *   ⚠️ 교체(구장관리)에는 **가드가 하나도 없다** — 안 산 칸도 그대로 끼워진다 (S3 6절).
 * 그리고 **잔디는 1·2·3억을 받으면서 어떤 계산에도 들어가지 않는다** (S3 8절).
 */
export function StadiumShopScreen({
  record,
  mode = '상점',
  isHiddenOpen = () => false,
  onChange,
  onUnlock,
  onBack,
  gamePoint = 0,
  previewScene = INITIAL_STADIUM_PREVIEW_SCENE,
  onPreviewSceneChange,
}: StadiumShopScreenProps) {
  const isShop = mode === '상점'
  const [kind, setKind] = useState<StadiumKind>(STADIUM_KINDS[0])
  const [slot, setSlot] = useState(0)
  const [top, setTop] = useState(0)
  const [isSlotFocus, setSlotFocus] = useState(false)
  /** 상점 미리보기에 끼운 칸 — 칸 목록이 움직였을 때만 선다(0x9cb2 [목록+0x25]), 취소면 저장값으로 */
  const [shopPreviewSlot, setShopPreviewSlot] = useState<number | null>(null)
  /**
   * 들어올 때의 장면 구장 칸. 구장관리 진입 0xe4d0 은 0x783b0 으로 하늘 줄(모드 2 — SR+0xb2 mod 6)과 +0x18(마지막 경기 상태 +0x6b)
   * 을 새로 잰다. 상점 진입 0x5f3c 는 0x783b0 을 안 불러 앞서 구장관리가 둔 값(없으면 0)이고, 0x77edc(구장, 1)로 전광판 글자를
   * 저장된 전광판 칸으로 되감는다(62ee).
   */
  const [entryScene] = useState<StadiumPreviewScene>(() =>
    isShop
      ? { ...previewScene, scoreboardX: rewoundScoreboardX(previewScene.scoreboardX, stadiumPreviewOf(record).board) }
      : {
          ...previewScene,
          skyRow: stadiumSkyRowOf({ mode: SEASON_MODE, dayCounter: record.games }) ?? 0,
          skyColumn: liveGameInningIndex(),
        },
  )
  /** 구장 +0x8c — 상점 그리기 0xb1f8 만 0x77fb5(구장, 1)로 흘린다. 구장관리 0xb158 은 그대로 둔다 */
  const [scoreboardX, setScoreboardX] = useState(entryScene.scoreboardX)
  const [notice, setNotice] = useState<string | null>(null)
  /** 구매 완료 팝업(결과코드 15)이 닫힐 때 0x81d0 이 볼 레코드 — 산 그 판의 것 */
  const [purchased, setPurchased] = useState<SeasonRecord | null>(null)
  /** 0x81d0 의 0x62368 이 공용 창에 띄운 히든 오픈 글 — 떠 있는 것 하나 + 대기 하나 (0x74ef4 +0x2a4) */
  const [hiddenNotices, setHiddenNotices] = useState<readonly string[]>([])
  const [question, setQuestion] = useState<{ readonly kind: StadiumKind; readonly slot: number; readonly text: string } | null>(null)
  const tick = useUpdateCounter()
  // 구장관리 진입이 잰 하늘은 곧장 장면 칸에 남는다
  const enterScene = useEffectEvent(() => {
    if (!isShop) onPreviewSceneChange?.(entryScene)
  })
  // 나갈 때 흘린 전광판 글자 자리를 장면 칸에 돌려준다
  const leaveScene = useEffectEvent(() => {
    if (isShop) onPreviewSceneChange?.({ ...entryScene, scoreboardX })
  })
  useEffect(() => {
    enterScene()
    return () => leaveScene()
  }, [])

  const select = (nextKind: StadiumKind, nextSlot: number) => {
    // 구장관리(0x7958)는 `rec[0x1b8 + 종류] = 선택칸` 한 줄이 전부다 — ⚠️ 가드가 없다
    if (!isShop) {
      // B-06 고침(기본 켬): 안 산 칸은 끼우지 않는다 — 알림도 없이 그대로 (원본 글에 맞는 줄이 없다)
      if (!canEquipStadiumItem(record, nextKind, nextSlot)) return
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
    onUnlock?.(opened)
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
  /** 키는 그때 그 렌더의 값으로 본다 (`useEffectEvent` — 등록은 들어올 때 한 번) */
  const handleKey = useEffectEvent((event: KeyboardEvent) => {
    if (isPopup) return
    const key = event.key
    if (!isSlotFocus) {
      if (isCancelKey(key)) onBack()
      else if (isConfirmKey(key) || key === 'ArrowDown' || key === '8') enterSlots()
      else if (key === 'ArrowLeft' || key === '4') setKind((held) => moveStadiumKind(held, -1))
      else if (key === 'ArrowRight' || key === '6') setKind((held) => moveStadiumKind(held, 1))
      else return
    } else if (isCancelKey(key)) leaveSlots()
    else if (isConfirmKey(key)) select(kind, slot)
    else if (key === 'ArrowUp' || key === '2') moveSlotTo(moveStadiumSlot(kind, slot, -1))
    else if (key === 'ArrowDown' || key === '8') moveSlotTo(moveStadiumSlot(kind, slot, 1))
    else return
    event.preventDefault()
  })
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => handleKey(event)
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // 터치 기기 — 칸 목록(5줄만 보인다)에 들어가 있으면 ▲ · ▼ 상황 버튼(↑ · ↓ 키 사건). 보이는 줄은 눌러서 고른다
  useTouchScrollKeys(isSlotFocus && !isPopup)

  // 미리보기 — 구장관리는 초점 1 이면 늘 커서 칸(0x7b10), 상점은 칸 목록이 움직였을 때만(0x9cb2)
  const previewSlot = !isSlotFocus ? null : isShop ? shopPreviewSlot : slot
  const previewStadium = stadiumPreviewOf(record, previewSlot === null ? undefined : { kind, slot: previewSlot })

  // 상점 그리기 0xb1f8 — 구장을 그린 **뒤** 0x77fb5(구장, 1) 로 +0x8c 를 한 칸 흘린다(b24e). 갱신 한 번에 그리기 한 번
  const steppedTick = useRef(tick)
  const previewBoard = previewStadium.board
  const stepScoreboard = useEffectEvent((steps: number) => {
    if (isShop && steps > 0) setScoreboardX((held) => stepSeasonScoreboardX(held, previewBoard, steps))
  })
  useEffect(() => {
    const steps = tick - steppedTick.current
    steppedTick.current = tick
    stepScoreboard(steps)
  }, [tick])

  return (
    <RawScreen>
      {/* 공통 앞그림 0xb810 — 0xea · 0xdc 는 0xdd · 0xe0 · 0xe1 밖이라 공 무늬 0x5fd61(skin, 0, 0, W, H) 를 먼저 깐다 */}
      <SkinBackdrop kind="공무늬" />
      {/*
        구장 미리보기 — 0xea 그리기 0xb158 · 0xdc 그리기 0xb1f8 의 메뉴 칸 1 갈래(0xb216~0xb262) 모두 구장 [장면+0x10c] 를 (−165, −80) 에
        두고 하늘 0x77fe8 · 시즌 구장 0x77494 · 바닥 0x7725c 뒤 아이템 창 0x83378 을 그린다. 진입(0xe4d0 · 0x5f3c)이 저장값으로 세우고
        키가 지금 종류의 칸 하나만 갈아 끼운다(`stadiumPreviewOf`). 하늘 줄 · 칸과 전광판 글자 자리는 장면 구장 칸이다
        (`StadiumPreviewScene` — 상점은 구장관리가 앞서 둔 하늘을 쓰고, 0xb1f8 만 0x77fb5 로 글자를 흘린다).
      */}
      <StadiumPreviewCanvas
        state={{
          skyRow: entryScene.skyRow,
          skyColumn: entryScene.skyColumn,
          scoreboardX,
          seasonStadium: previewStadium,
        }}
      />
      <StadiumItemWindow
        record={record}
        kind={kind}
        slot={slot}
        top={top}
        isSlotFocus={isSlotFocus}
        tick={tick}
        isShop={isShop}
        isHiddenOpen={isHiddenOpen}
        onPickKind={(next) => {
          if (isPopup) return
          setKind(next)
          leaveSlots()
          enterSlots()
        }}
        onPickSlot={(index) => {
          if (isPopup) return
          if (!isSlotFocus) {
            setSlotFocus(true)
            moveSlotTo(index)
          } else if (index === slot) select(kind, slot)
          else moveSlotTo(index)
        }}
      />
      {/* 머리띠 — 공통 틀 0xb810 의 기본 갈래(제목 10 시즌모드 · 바닥 5 되돌아가기) */}
      <ScreenFrame title="시즌모드" onBack={isSlotFocus ? leaveSlots : onBack} footer={5} slides={false} gamePoint={gamePoint} />

      {question !== null && (
        <MessageBox text={question.text} buttons={['예', '아니오']} onAnswer={(index) => (index === 0 ? buy() : setQuestion(null))} />
      )}
      {question === null && notice !== null && <MessageBox text={notice} buttons={['확인']} onAnswer={closeNotice} />}
      {question === null && notice === null && hiddenNotices[0] !== undefined && (
        <MessageBox
          key={hiddenNotices.length}
          text={hiddenNotices[0]}
          buttons={['확인']}
          onAnswer={() => setHiddenNotices((shown) => shown.slice(1))}
        />
      )}
    </RawScreen>
  )
}

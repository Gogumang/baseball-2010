import { useState } from 'react'
import { RawScreen } from '@/shared/ui'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import type { ShopWindowKindName } from '@/pages/shop/lib/shopLayout'
import { INITIAL_EQUIPMENT_WINDOW } from '@/pages/shop/lib/equipmentWindowState'
import type { EquipmentWindowState } from '@/pages/shop/lib/equipmentWindowState'
import { ShopWindow } from '@/pages/shop/ui/ShopWindow'
import { ShopEquipmentBranch } from '@/pages/shop/ui/shopScreen/ShopEquipmentBranch'
import { useDetailCloseKeys } from '@/pages/shop/ui/shopScreen/useDetailCloseKeys'
import { NariItemCommandBar, SkinBackdrop } from '@/pages/shop/ui/shopScreen/otherSlices'
import { ShopPopups } from '@/pages/shop/ui/shopScreen/ShopPopups'
import type { ShopScreenViewProps } from '@/pages/shop/ui/shopScreen/shopScreenProps'

/** 110 아이템 하위 메뉴 칸 — 0 장착 · 1 서브 · 2 GP (0xd4812). 장비착용(121)은 커맨드 줄을 안 그린다 */
const ITEM_SUB_MENU_CURSOR: Readonly<Record<ShopWindowKindName, number>> = { 장착: 0, 서브: 1, GP: 2, 착용: 0, 구장: 0 }

/** 확인 · 막힘 · 알림 · 결과 창 중 하나라도 떠 있는가 */
const hasOpenPopup = (pending: object | null, blockNotice: object | null, isNoticeOpen: boolean, isDetailOpen: boolean) =>
  pending !== null || blockNotice !== null || isNoticeOpen || isDetailOpen

/**
 * 창 + 확인·막힘·결과 팝업 묶음 — 타자편·투수편이 같이 쓴다.
 * 원본도 키 처리 0x13460 · 구매 확정 0x14a74 · 창 0x81dc0 이 한 벌이고 모드로 표만 갈린다 (R12 1a).
 */
export function ShopScreenView({
  kind,
  entriesOf,
  statusPanel,
  equipment,
  questionOf,
  money,
  gamePoint,
  title,
  noticeText,
  detail = null,
  onCloseDetail,
  onPurchase,
  onBack,
}: ShopScreenViewProps) {
  const [cursor, setCursor] = useState(0)
  const [equipmentState, setEquipmentState] = useState<EquipmentWindowState>(INITIAL_EQUIPMENT_WINDOW)
  const [pending, setPending] = useState<{ readonly itemId: string; readonly question: string } | null>(null)
  /**
   * 가드에 걸린 칸의 안내 — 원본 0x13460 은 여기서 팝업만 띄우고 사지 않는다.
   * `asks` 는 G 부족 [65] 의 예/아니오 (2, 2) — 예(G 충전)는 서버 기능 제외라 두 답 모두 닫기만 한다.
   */
  const [blockNotice, setBlockNotice] = useState<{ readonly text: string; readonly asks: boolean } | null>(null)
  const [dismissedNotice, setDismissedNotice] = useState('')

  const entries = entriesOf()
  const isNoticeOpen = noticeText !== '' && noticeText !== dismissedNotice
  const isDetailOpen = detail !== null

  useDetailCloseKeys(isDetailOpen, onCloseDetail)

  const askOrPurchase = (itemId: string) => {
    // 살 수 있는 칸은 StrMODE[79]·[81]·[82] 로 한 번 묻는다
    const question = questionOf(itemId)
    if (question === null) onPurchase(itemId)
    else setPending({ itemId, question })
  }

  const select = (index: number) => {
    const entry = entries[index]
    if (entry === undefined) return
    // 서브·GP 는 막힘 문구가 entities 쪽에 그대로 있어 창이 바로 띄운다.
    if (entry.blockNotice !== null) {
      setBlockNotice({ text: entry.blockNotice, asks: entry.blockAsks === true })
      return
    }
    askOrPurchase(entry.id)
  }

  // 팝업이 하나라도 떠 있으면 창은 키를 안 받는다
  const isKeyEnabled = !hasOpenPopup(pending, blockNotice, isNoticeOpen, isDetailOpen)

  return (
    <RawScreen>
      <SkinBackdrop kind="공무늬" />
      {equipment === undefined && (
        <>
          {statusPanel}
          <NariItemCommandBar cursor={ITEM_SUB_MENU_CURSOR[kind]} />
        </>
      )}
      {equipment === undefined ? (
        <ShopWindow
          // 장비 갈래(장착 · 착용 · 구장)는 위 `equipment` 가 서서 이 창이 아니다
          kind={kind === 'GP' ? 'GP' : '서브'}
          entries={entries}
          cursor={cursor}
          onMoveCursor={setCursor}
          onSelect={select}
          money={money}
          isKeyEnabled={isKeyEnabled}
          // CLR → 110 (0x13460 13b1e) — 장비 창은 `onExit` 가 같은 일을 한다
          onCancel={onBack}
        />
      ) : (
        <ShopEquipmentBranch
          equipment={equipment}
          state={equipmentState}
          onStateChange={setEquipmentState}
          onSelectItem={askOrPurchase}
          onExit={onBack}
          money={money}
          isShop={kind === '장착'}
          isKeyEnabled={isKeyEnabled}
        />
      )}
      <ScreenFrame title={title} gamePoint={gamePoint} onBack={onBack} slides={false} />
      <ShopPopups
        pending={pending}
        blockNotice={blockNotice}
        detail={detail}
        noticeText={isNoticeOpen ? noticeText : null}
        onAnswerPending={(index) => {
          if (index === 0 && pending !== null) onPurchase(pending.itemId)
          setPending(null)
        }}
        onCloseBlockNotice={() => setBlockNotice(null)}
        onCloseDetail={() => onCloseDetail?.()}
        onDismissNotice={() => setDismissedNotice(noticeText)}
      />
    </RawScreen>
  )
}

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { MessageBox, RawScreen } from '@/shared/ui'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { EQUIPMENT_PARTS } from '@/entities/career/model/equipment'
import { purchaseQuestionOf } from '@/features/shop/model/shopSelection'
import type { ShopTab } from '@/features/shop/model/shopSelection'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { shopEntriesOf, windowKindNameOf } from '@/pages/shop/lib/shopEntries'
import type { ShopEntry } from '@/pages/shop/lib/shopEntries'
import type { ShopWindowKindName } from '@/pages/shop/lib/shopLayout'
import type { ScreenFrameTitle } from '@/widgets/screen-frame/lib/screenFrameLayout'
import { ShopWindow } from '@/pages/shop/ui/ShopWindow'
import { EquipmentWindow } from '@/pages/shop/ui/EquipmentWindow'
import { batterEquipmentRowsOf } from '@/pages/shop/lib/equipmentRows'
import type { EquipmentRow } from '@/pages/shop/lib/equipmentRows'
import type { EquipmentEdition } from '@/pages/shop/lib/equipmentWindowLayout'
import { INITIAL_EQUIPMENT_WINDOW, previewLevelOf } from '@/pages/shop/lib/equipmentWindowState'
import type { EquipmentWindowState } from '@/pages/shop/lib/equipmentWindowState'
import { BasicInfoCard } from '@/pages/management/ui/BasicInfoCard'
import { ManagementBoard } from '@/pages/management/ui/ManagementBoard'
import { NariItemCommandBar } from '@/pages/management/ui/NariItemCommandBar'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import { currentTitleOf } from '@/entities/career/model/titles'
import { DetailWindow } from '@/pages/management/ui/DetailPopup'
import type { DetailView } from '@/pages/management/lib/detailPopup'
import { batterGpDetailViewOf } from '@/pages/shop/lib/gpDetailView'
import type { GpDetailOf } from '@/features/shop/model/shopSelection'

interface ShopScreenProps {
  /** 관리 화면 [아이템] 하위 메뉴에서 고른 탭 */
  readonly initialTab: string
  readonly career: PlayerCareer
  readonly noticeText: string
  /** GP 칸 0~4·6 을 산 뒤의 상세 결과 창 재료 (`selectShopItem` 의 detail) */
  readonly gpDetail?: GpDetailOf<PlayerCareer> | null
  readonly onCloseGpDetail?: () => void
  readonly onPurchase: (itemId: string) => void
  readonly onBack: () => void
}

const TABS: readonly ShopTab[] = ['장착', '서브', 'GP', '착용']
/** 110 아이템 하위 메뉴 칸 — 0 장착 · 1 서브 · 2 GP (0xd4812). 장비착용(121)은 커맨드 줄을 안 그린다 */
const ITEM_SUB_MENU_CURSOR: Readonly<Record<ShopWindowKindName, number>> = { 장착: 0, 서브: 1, GP: 2, 착용: 0, 구장: 0 }

/**
 * 결과 알림 글 — 원문 마크업으로 온 글(StrMODE[92] 구매 완료 `!C[!cFFFF00…`)은 그대로, 마크업 없이 옮겨 둔 글은 가운데 맞춤(!C)을 붙인다
 */
function centeredNoticeOf(text: string): string {
  return text.startsWith('!C') ? text : `!C${text}`
}

/**
 * 상점·아이템 창 (0x8453c). 관리 화면 [아이템] 의 네 갈래가 모두 여기로 온다 (R12 1a):
 *   창 종류 1 서브아이템 · 2 GP아이템 → 0x81dc0 (mode_ui 프레임 33 박스 6개 + 프레임 34 격자 10칸, `ShopWindow`)
 *   창 종류 3 장비 상점(111) · 장비착용(121) → **0x83378** (mode_ui 프레임 30 — `EquipmentWindow`)
 *   — 0x8453c 는 `[창+0x1a4] == 3` 이면 0x83378, 아니면 0x81dc0 이다(0x84546). 종류 4 구장 아이템도 0x83378 이고
 *     시즌 구단관리(0xb158)가 직접 부른다 — 웹에 아직 데이터가 없어 좌표만 `shopLayout.STADIUM_BOXES` 에 있다.
 *
 * 앞그림 0x16a34 → 0x16928 이 공 무늬 바탕 0x5fd61 을 깔고(142~144 밖 — 상점도), 그리기 0x167cc:
 * 종류 3 이면 창 → 기본정보 카드 0x15e20(선수 그림 · 레이더, 정보 칸은 건너뜀) → 머리띠,
 * 그 밖이면 상태판 0x7d34c(gfx, 0) → 커맨드 줄 0x7e418(gfx, 틱) → 창 → 머리띠 (`statusPanel` · `NariItemCommandBar`).
 */
export function ShopScreen({
  initialTab, career, noticeText, gpDetail = null, onCloseGpDetail, onPurchase, onBack,
}: ShopScreenProps) {
  const tab = TABS.find((candidate) => candidate === initialTab) ?? '장착'
  const isEquipment = tab === '장착' || tab === '착용'
  return (
    <ShopScreenView
      kind={windowKindNameOf(tab)}
      entriesOf={() => (tab === '서브' || tab === 'GP' ? shopEntriesOf({ tab, career }) : [])}
      // 0x7d34c(gfx, 0) — 둘째 인자 0 이라 전 경기 표시 없음
      statusPanel={<ManagementBoard career={career} titleName={currentTitleOf(career)} hour={new Date().getHours()} />}
      equipment={isEquipment ? {
        edition: '타자',
        rowsOf: (part) => batterEquipmentRowsOf(career, part, tab === '착용'),
        // 0x15e20 의 타자 갈래 — 그림 객체를 (박스 가운데, 박스 아래 − 10) 에 그린다. 줄을 훑으면 그 장비를 끼워 보인다(0x81938)
        preview: (part, level) => (
          <BasicInfoCard career={career} showsInfoTable={false}
            figureEquipment={level === null ? undefined : {
              ...career.equipmentLevels, [EQUIPMENT_PARTS[part].ability]: level + 1,
            }} />
        ),
      } : undefined}
      questionOf={(itemId) => purchaseQuestionOf(career, itemId)}
      money={career.money}
      gamePoint={career.gamePoint}
      title="나만의리그타자편"
      noticeText={noticeText}
      detail={gpDetail === null ? null : batterGpDetailViewOf(gpDetail)}
      onCloseDetail={onCloseGpDetail}
      onPurchase={onPurchase}
      onBack={onBack}
    />
  )
}

/** 장비 창(창 종류 3) 재료 — 타자편·투수편이 표만 갈아 넣는다 */
export interface EquipmentWindowSpec {
  readonly edition: EquipmentEdition
  /** 부위 → 목록 줄 (0x8146c) */
  readonly rowsOf: (part: number) => readonly EquipmentRow[]
  /** 창 위의 기본정보 카드 0x15e20 — 입혀 볼 레벨(줄 초점의 커서 줄, 없으면 null) */
  readonly preview?: (part: number, level: number | null) => ReactNode
}

export interface ShopScreenViewProps {
  readonly kind: ShopWindowKindName
  /** 서브·GP 격자 칸 (장비 창이면 안 쓴다) */
  readonly entriesOf: () => readonly ShopEntry[]
  /** 창 종류 1 · 2 의 상태판 0x7d34c — 타자편 `ManagementBoard` · 투수편 `PitcherStatusBoard` */
  readonly statusPanel?: ReactNode
  /** 창 종류 3 — 있으면 0x81dc0 격자 대신 장비 창 0x83378 을 그린다 */
  readonly equipment?: EquipmentWindowSpec
  /** 살 수 있는 칸의 확인 문구(StrMODE[79]·[81]·[82]) — null 이면 묻지 않고 곧바로 `onPurchase` */
  readonly questionOf: (itemId: string) => string | null
  /** 소지금 (만원) */
  readonly money: number
  readonly gamePoint: number
  readonly title: ScreenFrameTitle
  readonly noticeText: string
  /**
   * GP 아이템 결과 창 (0x872a1) — 구매 확정 0x14a74 가 칸 0~4·6 에서 알림 대신 띄운다.
   * 닫기 콜백 0x1d649 는 닫기 키(−16 · −5 · '5')에 팝업만 닫는다(0x742a9) — 굴림 없이 상점(상태 111) 그대로다.
   */
  readonly detail?: DetailView | null
  readonly onCloseDetail?: () => void
  readonly onPurchase: (itemId: string) => void
  readonly onBack: () => void
}

/**
 * 창 + 확인·막힘·결과 팝업 묶음 — 타자편·투수편이 같이 쓴다.
 * 원본도 키 처리 0x13460 · 구매 확정 0x14a74 · 창 0x81dc0 이 한 벌이고 모드로 표만 갈린다 (R12 1a).
 */
export function ShopScreenView({
  kind, entriesOf, statusPanel, equipment, questionOf, money, gamePoint, title, noticeText, detail = null, onCloseDetail, onPurchase,
  onBack,
}: ShopScreenViewProps) {
  const [cursor, setCursor] = useState(0)
  const [equipmentState, setEquipmentState] = useState<EquipmentWindowState>(INITIAL_EQUIPMENT_WINDOW)
  const [pending, setPending] = useState<{ readonly itemId: string; readonly question: string } | null>(null)
  /** 가드에 걸린 칸의 안내 — 원본 0x13460 은 여기서 1버튼 팝업만 띄우고 사지 않는다 */
  const [blockNotice, setBlockNotice] = useState<string | null>(null)
  const [dismissedNotice, setDismissedNotice] = useState('')

  const entries = entriesOf()
  const equipmentRows = equipment?.rowsOf(equipmentState.part) ?? []
  const isNoticeOpen = noticeText !== '' && noticeText !== dismissedNotice
  const isDetailOpen = detail !== null

  /** 결과 창 닫기 키 — 확인·취소 (관리 화면 결과 창과 같은 처리) */
  useEffect(() => {
    if (!isDetailOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== 'Escape') return
      event.preventDefault()
      onCloseDetail?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isDetailOpen, onCloseDetail])

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
      setBlockNotice(entry.blockNotice)
      return
    }
    askOrPurchase(entry.id)
  }

  const isKeyEnabled = pending === null && blockNotice === null && !isNoticeOpen && !isDetailOpen

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
          kind={kind}
          entries={entries}
          cursor={cursor}
          onMoveCursor={setCursor}
          onSelect={select}
          money={money}
          isKeyEnabled={isKeyEnabled}
        />
      ) : (
        <>
          <EquipmentWindow
            edition={equipment.edition}
            rows={equipmentRows}
            state={equipmentState}
            onStateChange={setEquipmentState}
            // 장비는 막힘 문구가 features/shop 안에 있어 부모(`onPurchase`)가 만든다 — 규칙을 두 번 적지 않으려고
            onSelect={(row) => askOrPurchase(row.id)}
            onExit={onBack}
            money={money}
            isShop={kind === '장착'}
            isKeyEnabled={isKeyEnabled}
          />
          {equipment.preview?.(
            equipmentState.part,
            previewLevelOf(equipmentState, equipmentRows.map((row) => row.level)),
          )}
        </>
      )}
      <ScreenFrame title={title} gamePoint={gamePoint} onBack={onBack} slides={false} />
      {pending !== null && (
        <MessageBox text={pending.question} buttons={['예', '아니오']}
          onAnswer={(index) => {
            if (index === 0) onPurchase(pending.itemId)
            setPending(null)
          }} />
      )}
      {pending === null && blockNotice !== null && (
        <MessageBox text={`!C${blockNotice}`} buttons={['확인']} onAnswer={() => setBlockNotice(null)} />
      )}
      {detail !== null && (
        // 장비 구매 확정 0x14a74(0x15084) — 0x741a0(높이 0), 키 0x1d648 이 0x742a9 로 바로 치운다
        <DetailWindow rows={detail.rows} messages={detail.messages} onClose={() => onCloseDetail?.()} opensAsCommonPopup />
      )}
      {pending === null && blockNotice === null && !isDetailOpen && isNoticeOpen && (
        <MessageBox text={centeredNoticeOf(noticeText)} buttons={['확인']} onAnswer={() => setDismissedNotice(noticeText)} />
      )}
    </RawScreen>
  )
}

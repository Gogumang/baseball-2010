import type { ReactNode } from 'react'
import type { ShopEntry } from '@/pages/shop/lib/shopEntries'
import type { ShopWindowKindName } from '@/pages/shop/lib/shopLayout'
import type { EquipmentRow } from '@/pages/shop/lib/equipmentRows'
import type { EquipmentEdition } from '@/pages/shop/lib/equipmentWindowLayout'
import type { DetailView } from '@/pages/shop/ui/shopScreen/otherSlices'
import type { ScreenFrameTitle } from '@/widgets/screen-frame/lib/screenFrameLayout'

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

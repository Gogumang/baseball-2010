import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { pitcherPurchaseQuestionOf } from '@/features/shop/model/pitcherShopSelection'
import type { PitcherShopTab } from '@/features/shop/model/pitcherShopSelection'
import { pitcherShopEntriesOf } from '@/pages/shop/lib/pitcherShopEntries'
import { pitcherEquipmentRowsOf } from '@/pages/shop/lib/equipmentRows'
import { ShopScreenView } from '@/pages/shop/ui/ShopScreen'
import { pitcherGpDetailViewOf } from '@/pages/shop/lib/gpDetailView'
import type { GpDetailOf } from '@/features/shop/model/shopSelection'

interface PitcherShopScreenProps {
  /** '장착'·'서브'·'GP' = [아이템] → 110 → 상점(111, 창 종류 3·1·2) · '착용' = [선수정보] → 장비착용(121) */
  readonly tab: PitcherShopTab
  readonly career: PitcherCareer
  readonly noticeText: string
  /** GP 칸 0~4·6 을 산 뒤의 상세 결과 창 재료 — 이름표 340~343 · 최대값 `pitcherAbilityLimitsOf` */
  readonly gpDetail?: GpDetailOf<PitcherCareer> | null
  readonly onCloseGpDetail?: () => void
  readonly onPurchase: (itemId: string) => void
  readonly onBack: () => void
}

/**
 * 투수편(모드 3) 장비 상점 · 서브·GP 아이템 상점 · 장비착용 — 타자편과 **같은 창**(0x8453c → 종류 3 은 0x83378,
 * 종류 1·2 는 0x81dc0)에 투수 표만 얹는다.
 * 원본도 장면 0x106 의 상태 111(키 0x13460) · 121(키 0x17ad0) 을 두 모드가 함께 쓴다 (R9 3절 · R12).
 * 장비 창은 `0x7b970`(타자편) 이 거짓이라 mode_ui **프레임 31**(모자·공·글러브·신발 아이콘)을 쓰고,
 * 효과 줄의 능력치 이름은 img_text 340~343(제구·구속·변화·체력)이다.
 *
 * ⚠️ 미확인: 창 위의 기본정보 카드 0x15e20 투수 갈래 — 그림 객체 대신 54×75 이미지 [0x1552ae0] 를
 * (박스 0.x, 박스 0.y − 0x23) 에 0x98975 로 찍는다. 투수 카드(레이더 · 판)가 웹에 아직 없어 이 화면은 카드 없이 창만 그린다.
 */
export function PitcherShopScreen({
  tab, career, noticeText, gpDetail = null, onCloseGpDetail, onPurchase, onBack,
}: PitcherShopScreenProps) {
  return (
    <ShopScreenView
      kind={tab}
      entriesOf={() => (tab === '서브' || tab === 'GP' ? pitcherShopEntriesOf(career, tab) : [])}
      equipment={tab === '장착' || tab === '착용' ? {
        edition: '투수',
        rowsOf: (part) => pitcherEquipmentRowsOf(career, part, tab === '착용'),
      } : undefined}
      questionOf={(itemId) => pitcherPurchaseQuestionOf(career, itemId)}
      money={career.money}
      gamePoint={career.gamePoint}
      title="나만의리그투수편"
      noticeText={noticeText}
      detail={gpDetail === null ? null : pitcherGpDetailViewOf(gpDetail)}
      onCloseDetail={onCloseGpDetail}
      onPurchase={onPurchase}
      onBack={onBack}
    />
  )
}

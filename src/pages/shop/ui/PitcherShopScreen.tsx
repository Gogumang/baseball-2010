import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { pitcherPurchaseQuestionOf } from '@/features/shop/model/pitcherShopSelection'
import type { PitcherShopTab } from '@/features/shop/model/pitcherShopSelection'
import { PITCHER_PART_NAMES, pitcherShopEntriesOf } from '@/pages/shop/lib/pitcherShopEntries'
import { ShopScreenView } from '@/pages/shop/ui/ShopScreen'

interface PitcherShopScreenProps {
  /** '장착'·'서브'·'GP' = [아이템] → 110 → 상점(111, 창 종류 3·1·2) · '착용' = [선수정보] → 장비착용(121) */
  readonly tab: PitcherShopTab
  readonly career: PitcherCareer
  readonly noticeText: string
  readonly onPurchase: (itemId: string) => void
  readonly onBack: () => void
}

/**
 * 투수편(모드 3) 장비 상점 · 서브·GP 아이템 상점 · 장비착용 — 타자편과 **같은 창**(0x81dc0, 창 종류 3·1·2)에
 * 투수 표만 얹는다.
 * 원본도 장면 0x106 의 상태 111(키 0x13460) · 121(키 0x17ad0) 을 두 모드가 함께 쓴다 (R9 3절 · R12).
 *
 * ⚠️ **배치는 타자편 상점 화면 그대로(근사)** — 원본 장비 창은 목록 행이 부위인데(R12 1b-가)
 * 웹 창은 부위를 탭으로 고른다. 그 차이는 타자편 `ShopWindow` 주석과 같고 투수만의 배치는 따로 없다.
 * 창 오른쪽 캐릭터 미리보기(0x7e765)는 타자편에서도 아직 안 그린다.
 */
export function PitcherShopScreen({ tab, career, noticeText, onPurchase, onBack }: PitcherShopScreenProps) {
  return (
    <ShopScreenView
      kind={tab}
      entriesOf={(part) => pitcherShopEntriesOf(career, tab, part)}
      questionOf={(itemId) => pitcherPurchaseQuestionOf(career, itemId)}
      partNames={tab === '장착' || tab === '착용' ? PITCHER_PART_NAMES : undefined}
      money={career.money}
      gamePoint={career.gamePoint}
      title="나만의리그투수편"
      noticeText={noticeText}
      onPurchase={onPurchase}
      onBack={onBack}
    />
  )
}

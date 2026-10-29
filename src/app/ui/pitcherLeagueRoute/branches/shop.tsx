import type { ReactNode } from 'react'
import { PitcherShopScreen } from '@/pages/shop/ui/PitcherShopScreen'
import type { PitcherBranchInput } from '@/app/ui/pitcherLeagueRoute/branchInput'

export function shopBranch(input: PitcherBranchInput): ReactNode {
  const { openedHiddenIds, career, scene, shopTab, shopNotice, shopGpDetail, actions } = input
  if (scene !== '상점') return null
  // 해금표는 원본에서 전역(app+0xc0)이라 기록연감의 오픈 id 를 얹어 보여 준다 — 구매도 같은 값으로 판정한다
  const missing = openedHiddenIds.filter((id) => !career.openedHiddenIds.includes(id))
  const shopCareer = missing.length === 0 ? career : { ...career, openedHiddenIds: [...career.openedHiddenIds, ...missing] }
  return (
    <PitcherShopScreen
      key={shopTab}
      tab={shopTab}
      career={shopCareer}
      noticeText={shopNotice}
      gpDetail={shopGpDetail}
      onCloseGpDetail={actions.closeShopGpDetail}
      onPurchase={(itemId) => actions.purchase(itemId, openedHiddenIds)}
      // 111 취소 → 110 · 121 취소 → 106 — 관리 화면이 다시 열릴 때 그 하위 메뉴 그 칸에 선다(`nariReturnSubMenuOf`)
      onBack={() => actions.goto('관리')}
    />
  )
}

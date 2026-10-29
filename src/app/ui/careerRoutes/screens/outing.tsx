import type { ReactNode } from 'react'
import { ShopScreen } from '@/pages/shop/ui/ShopScreen'
import { SeasonOutingPopup } from '@/pages/season/ui/SeasonOutingPopup'
import { nariOutingPresentationOf } from '@/pages/season/lib/seasonOutingPopup'
import { portraitPaletteIndex } from '@/shared/lib/sprite/paletteSwap'
import { OutingMapScreen } from '@/pages/outing-map/ui/OutingMapScreen'
import type { CareerScreenInput, ScreenOf } from '@/app/ui/careerRoutes/careerScreenInput'

export function outingScreenOf(input: CareerScreenInput, screen: ScreenOf<'외출'>): ReactNode {
  const { session, career, actions } = input
  return (
    <OutingMapScreen
      noticeText={session.outingNotice}
      onCloseNotice={actions.closeOutingNotice}
      onRun={actions.runOutingFunction}
      // 112 취소 → 105 — 키 0x13ba4 가 S+4(행동함) = 0 으로 내린다(13bc8)
      onBack={actions.leaveOutingMap}
      // [!] 칸 [gfx+0x9c] — 112 진입 0x118e4 에 찍은 값 그대로(0x7ed6c 는 행동 여부를 안 본다)
      eventPlaceIds={session.eventPlaceIds}
      onEnter={actions.enterPlace}
      // 빈 장소(440~444) 뒤는 113 그 장소 말풍선 · 113 취소는 112 에 다시 들어선다(Q-22)
      initialOpenPlaceId={screen.openPlaceId ?? null}
      onCloseBubble={actions.reenterOutingMap}
      // 126 효과 팝업 → [확인] → 105 (입원 회복 글은 관리 화면 알림으로)
      resultText={session.outingResult?.effectText ?? null}
      onCloseResult={actions.closeOutingResult}
      presentation={
        session.outingPresentation === null ? null : (
          <SeasonOutingPopup
            place={session.outingPresentation.place}
            presentation={nariOutingPresentationOf(session.outingPresentation.place, { isSlugger: career.battingTypeIndex === 1 })}
            char0Palette={portraitPaletteIndex(career.skinIndex)}
            onFinished={actions.finishOutingPresentation}
          />
        )
      }
    />
  )
}

export function itemShopScreenOf(input: CareerScreenInput, screen: ScreenOf<'아이템'>): ReactNode {
  const { session, career, actions, backToManagement } = input
  return (
    <ShopScreen
      key={screen.tab}
      initialTab={screen.tab}
      career={career}
      noticeText={session.shopNotice}
      gpDetail={session.shopGpDetail}
      onCloseGpDetail={actions.closeShopGpDetail}
      onPurchase={actions.purchase}
      // 111 취소 → 110 · 121(장비착용) 취소 → 106 — 관리 화면이 다시 열릴 때 그 하위 메뉴 그 칸에 선다(`nariReturnSubMenuOf`)
      onBack={backToManagement}
    />
  )
}

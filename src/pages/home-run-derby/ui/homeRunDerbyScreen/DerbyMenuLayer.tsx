import * as stageScreen from '@/features/play-game/ui/stageScreen.css'
import { InGameMenu } from '@/features/play-team-game/ui/InGameMenu'
import type { InGameMenuState } from '@/features/play-team-game/model/useInGameMenuState'
import { DERBY_MODE, type MenuOverlay } from './derbyScreenProps'

/**
 * 경기 중 메뉴 — 홈런더비 행은 자동진행 자리에 **다시하기**가 온다 (표 0xcfcfc 행 1). 다시하기도 결과 창 [예]와 같이 경기 장면 0x104 를
 * 새로 세운다(0x3c9d8 → 0x27) — 타석 캔버스도 새로 띄운다(`onRestart`). [설정]은 환경설정이 있을 때만 열린다
 */
export function DerbyMenuLayer({
  menu,
  canOpenSettings,
  onQuit,
  onRestart,
  onOpenOverlay,
}: {
  readonly menu: InGameMenuState
  readonly canOpenSettings: boolean
  readonly onQuit: () => void
  readonly onRestart: () => void
  readonly onOpenOverlay: (overlay: MenuOverlay) => void
}) {
  return (
    <div className={stageScreen.menuLayer}>
      <InGameMenu
        mode={DERBY_MODE}
        cursor={menu.cursor}
        slidesIn={menu.slidesIn}
        opening={menu.opening}
        bindCloser={menu.bindCloser}
        onCursorChange={menu.setCursor}
        onContinue={menu.close}
        onQuit={onQuit}
        onRestart={() => {
          menu.close()
          onRestart()
        }}
        onOpenHelp={() => {
          menu.close()
          onOpenOverlay('조작방법')
        }}
        onOpenSettings={
          canOpenSettings
            ? () => {
                menu.close()
                onOpenOverlay('설정')
              }
            : undefined
        }
      />
    </div>
  )
}

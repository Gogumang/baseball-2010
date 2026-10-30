import * as stageScreen from '@/features/play-game/ui/stageScreen.css'
import { InGameMenu } from '@/features/play-team-game/ui/InGameMenu'
import type { InGameMenuState } from '@/features/play-team-game/model/useInGameMenuState'
import { BATTER_CAREER_MODE, type MenuOverlay } from './gameScreenProps'

interface GameMenuLayerProps {
  readonly menu: InGameMenuState
  readonly onQuit: () => void
  /** 설정 칸을 열 수 있는가 — 환경설정 값과 바꾸는 손잡이를 둘 다 받았다. 아니면 칸이 잠긴다 */
  readonly canChangeSettings: boolean
  readonly setOverlay: (overlay: MenuOverlay) => void
}

/** 경기 중 메뉴 층 — 열려 있을 때만 */
export function GameMenuLayer({ menu, onQuit, canChangeSettings, setOverlay }: GameMenuLayerProps) {
  if (!menu.isOpen) return null
  return (
    <div className={stageScreen.menuLayer}>
      <InGameMenu
        // 나만의리그 타자편은 표 0xcfcfc 의 행 2 — 자동진행·다시하기가 없는 네 칸이다
        mode={BATTER_CAREER_MODE}
        cursor={menu.cursor}
        slidesIn={menu.slidesIn}
        opening={menu.opening}
        bindCloser={menu.bindCloser}
        onCursorChange={menu.setCursor}
        onContinue={menu.close}
        onQuit={onQuit}
        onOpenHelp={() => {
          menu.close()
          setOverlay('조작방법')
        }}
        onOpenSettings={
          canChangeSettings
            ? () => {
                menu.close()
                setOverlay('설정')
              }
            : undefined
        }
      />
    </div>
  )
}

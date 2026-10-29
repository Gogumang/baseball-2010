import type { Dispatch, SetStateAction } from 'react'
import * as stageScreen from '@/features/play-game/ui/stageScreen.css'
import { InGameMenu } from '@/features/play-team-game/ui/InGameMenu'
import type { InGameMenuState } from '@/features/play-team-game/model/useInGameMenuState'
import { MISSION_BATTER_MODE } from './MissionStage'

/** 경기 중 메뉴에서 연 하위 창 — 조작방법(0x3c212) · 설정(0x3c326) */
export type MissionMenuOverlay = '조작방법' | '설정'

/** 경기 중 메뉴 0x3c02c — 미션 행은 자동진행 자리에 **다시하기**가 온다 (표 0xcfcfc 행 1) */
export function MissionMenuLayer({
  menu,
  canOpenSettings,
  onGiveUp,
  onRestart,
  setOverlay,
}: {
  readonly menu: InGameMenuState
  readonly canOpenSettings: boolean
  readonly onGiveUp: () => void
  readonly onRestart: (() => void) | undefined
  readonly setOverlay: Dispatch<SetStateAction<MissionMenuOverlay | null>>
}) {
  return (
    <div className={stageScreen.menuLayer}>
      <InGameMenu
        mode={MISSION_BATTER_MODE}
        cursor={menu.cursor}
        slidesIn={menu.slidesIn}
        opening={menu.opening}
        bindCloser={menu.bindCloser}
        onCursorChange={menu.setCursor}
        onContinue={menu.close}
        onQuit={onGiveUp}
        onRestart={onRestart}
        onOpenHelp={() => {
          menu.close()
          setOverlay('조작방법')
        }}
        onOpenSettings={
          canOpenSettings
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

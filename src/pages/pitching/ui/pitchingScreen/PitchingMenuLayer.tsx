import type { GameSettings } from '@/entities/settings/model/gameSettings'
import { PressArea } from '@/shared/ui'
import { MENU_PRESS_RECT } from '@/features/play-game/model/stagePressAreas'
import { InGameMenu } from '@/features/play-team-game/ui/InGameMenu'
import { PressLayer } from '@/pages/pitching/ui/PressLayer'
import * as styles from '@/pages/pitching/ui/PitcherGameScreen.css'
import { MISSION_PITCHER_MODE } from './missionPitching'
import type { PitchingMenu } from './usePitchingMenu'

/**
 * 소프트키 — 장면이 그리는 "*MENU" 글자 자리(0x4c8e0)의 누름 칸. 소프트키1 도 0x498d4 가 '*' 로 읽는다(498e8) — 경기 중 메뉴.
 * "#TIME" 은 없다 — '#' 교체 검사 0x38984 가 미션(모드 5 · 6)을 막는다. 메뉴는 미션 투수편 = 모드 5 — 표 0xcfcfc 행 1
 * (계속·다시하기·조작방법·설정·나가기)
 */
export function PitchingMenuLayer({
  menuState,
  settings,
  onSettingsChange,
  onGiveUp,
  onRestart,
}: {
  readonly menuState: PitchingMenu
  readonly settings: GameSettings | undefined
  readonly onSettingsChange: ((settings: GameSettings) => void) | undefined
  readonly onGiveUp: () => void
  readonly onRestart: (() => void) | undefined
}) {
  const { menu, overlay, setOverlay } = menuState
  const isMenuOpen = menu.isOpen
  return (
    <>
      {overlay !== '조작방법' && (
        <PressLayer testId="소프트키 누름 칸" isOnTop>
          <PressArea rect={MENU_PRESS_RECT} label={isMenuOpen ? '닫기' : '메뉴'} onPress={menu.pressStar} />
        </PressLayer>
      )}

      {isMenuOpen && (
        <div className={styles.popupLayer}>
          <InGameMenu
            mode={MISSION_PITCHER_MODE}
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
              settings === undefined || onSettingsChange === undefined
                ? undefined
                : () => {
                    menu.close()
                    setOverlay('설정')
                  }
            }
          />
        </div>
      )}
    </>
  )
}

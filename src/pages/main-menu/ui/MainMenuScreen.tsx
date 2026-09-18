import { useState } from 'react'
import { SelectBox } from '@/shared/ui'
import type { SelectOption } from '@/shared/ui'
import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'
import { parseGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import { NEW_GAME_CONFIRM } from '@/shared/config/original/mainMenu'
import { isEntryEnabled, MODE_ENTRIES } from '@/pages/main-menu/model/mainMenu'
import { useMainMenu } from '@/pages/main-menu/model/useMainMenu'
import { DescriptionPanel } from '@/pages/main-menu/ui/DescriptionPanel'
import * as styles from '@/pages/main-menu/ui/MainMenuScreen.css'

export type GameMode = '미션'

interface MainMenuScreenProps {
  readonly hasSavedGame: boolean
  readonly onContinue: () => void
  readonly onNewGame: () => void
  readonly onSelectMode: (mode: GameMode) => void
  readonly onBack: () => void
  /** 원작 처음 메뉴의 [도움말] (StrMAINMENU[2]) */
  readonly onHelp: () => void
  /** 원작 처음 메뉴의 [환경설정] (StrMAINMENU[3]) */
  readonly onSettings: () => void
  /** 원작 처음 메뉴의 [스페셜] (StrMAINMENU[1]) */
  readonly onSpecial: () => void
}

/** StrMAINMENU 원문의 !N 줄바꿈을 한 줄 설명으로 편다. */
function oneLineOf(raw: string): string {
  return parseGameMarkup(raw, [])
    .map((line) => line.segments.map((segment) => segment.text).join(''))
    .join(' ')
}

/**
 * 메인 메뉴. 게임 모드를 셀렉트박스(바텀시트)로 고르고 시작하기를 누른다.
 * 모드 이름·설명·순서와 새로하기 확인 문구는 StrMAINMENU 원문이다.
 */
export function MainMenuScreen({
  hasSavedGame,
  onContinue,
  onNewGame,
  onSelectMode,
  onBack,
  onHelp,
  onSettings,
  onSpecial,
}: MainMenuScreenProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const { state, dispatch } = useMainMenu(hasSavedGame, isSheetOpen, (effect) => {
    if (effect === '이어하기') onContinue()
    else if (effect === '새로하기') onNewGame()
    else if (effect === '미션') onSelectMode('미션')
    else onBack()
  })

  const options: SelectOption[] = MODE_ENTRIES.map((entry) => ({
    value: entry.id,
    label: entry.id,
    description: oneLineOf(entry.description),
    isDisabled: !isEntryEnabled(entry, hasSavedGame),
  }))
  const selected = MODE_ENTRIES.find((entry) => entry.id === state.selectedModeId)

  return (
    <RawScreen>
      <img className={styles.banner} src="./sprites/mode_back/000.png" alt="" />
      <button type="button" className={styles.backButton} onClick={() => dispatch({ type: '뒤로' })}>
        ‹ 타이틀
      </button>
      <div className={styles.topRightButtons}>
        <button type="button" className={styles.cornerButton} onClick={onSpecial}>
          스페셜
        </button>
        <button type="button" className={styles.cornerButton} onClick={onHelp}>
          도움말
        </button>
        <button type="button" className={styles.cornerButton} onClick={onSettings}>
          환경설정
        </button>
      </div>

      <div className={styles.content}>
        <SelectBox
          label="게임 모드"
          value={state.selectedModeId}
          options={options}
          onChange={(id) => dispatch({ type: '모드선택', id })}
          onOpenChange={setIsSheetOpen}
        />
        <button
          type="button"
          className={styles.startButton}
          disabled={state.isConfirmingNewGame}
          onClick={() => dispatch({ type: '시작' })}
        >
          시작하기
        </button>
      </div>

      {state.isConfirmingNewGame ? (
        <DescriptionPanel raw={NEW_GAME_CONFIRM}>
          <div className={styles.confirmKeys}>
            <button type="button" className={styles.confirmKey} onClick={() => dispatch({ type: '확인', isAccepted: true })}>
              예
            </button>
            <button type="button" className={styles.confirmKey} onClick={() => dispatch({ type: '확인', isAccepted: false })}>
              아니오
            </button>
          </div>
        </DescriptionPanel>
      ) : (
        selected !== undefined && <DescriptionPanel raw={selected.description} />
      )}
    </RawScreen>
  )
}

import { PressArea } from '@/shared/ui'
import { MENU_PRESS_RECT } from '@/features/play-game/model/stagePressAreas'

/**
 * 마우스 · 터치 길 — 투명한 누름 칸: 0xe 의 OK · 판(0x17) 건너뛰기(화면 전체) · '*' 메뉴("*MENU" 자리).
 * 결과 창(상태 0x1a)은 키 0x40a08 이 예 · 아니오만 받는다 — 경기 중 메뉴 칸을 안 둔다.
 */
export function DerbyPressAreas({
  isMenuOpen,
  isResultShown,
  sceneKeys,
  onToggleMenu,
}: {
  readonly isMenuOpen: boolean
  readonly isResultShown: boolean
  readonly sceneKeys: {
    readonly acceptsConfirm: boolean
    readonly isPlayRunning: boolean
    readonly pressConfirm: () => void
    readonly pressSkip: () => void
  }
  readonly onToggleMenu: () => void
}) {
  const { acceptsConfirm, isPlayRunning } = sceneKeys
  return (
    <>
      {!isMenuOpen && (acceptsConfirm || isPlayRunning) && (
        <PressArea label={acceptsConfirm ? '확인' : '건너뛰기'} onPress={acceptsConfirm ? sceneKeys.pressConfirm : sceneKeys.pressSkip} />
      )}
      {!isResultShown && <PressArea label={isMenuOpen ? '닫기' : '메뉴'} rect={MENU_PRESS_RECT} onPress={onToggleMenu} />}
    </>
  )
}

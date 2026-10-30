import { PressArea } from '@/shared/ui'
import { MENU_PRESS_RECT, stealPressRectOf } from '@/features/play-game/model/stagePressAreas'
import type { SceneConfirm } from '@/features/play-game/model/useSceneConfirm'
import type { StealBase } from '@/entities/fielding/model/stealStart'

interface GameStagePressAreasProps {
  readonly sceneConfirm: SceneConfirm
  readonly isMenuOpen: boolean
  readonly stealableBases: readonly StealBase[]
  readonly stealIfFlying: (base: StealBase, event?: Event) => void
  readonly onMenu: () => void
}

/**
 * 마우스 · 터치 길 — 투명한 누름 칸. 0xe 의 OK(화면 전체) · 도루(점수판 루 그림 자리) · '*' 메뉴("*MENU" 자리).
 * 웹 제목줄 · 배지(G 누계 · 이글아이)는 걷었다 — 원본 240×320 장면 한 장뿐이다. G 누계는 기록 달성 알림 0x4e35c 가
 * 판 머리에 그리고(`RecordAlertPanel`), 이글아이 남은 경기는 경기 화면에 안 그린다(상태판 0x7d34c 의 아이콘뿐, P4).
 */
export function GameStagePressAreas({ sceneConfirm, isMenuOpen, stealableBases, stealIfFlying, onMenu }: GameStagePressAreasProps) {
  return (
    <>
      {sceneConfirm.isAwaiting && !isMenuOpen && (
        // 0xe — OK 하나만 받는다 (0x532b0)
        <PressArea label="확인" onPress={sceneConfirm.confirm} isDisabled={!sceneConfirm.acceptsConfirm} />
      )}
      {!sceneConfirm.isAwaiting &&
        !isMenuOpen &&
        stealableBases.map((base) => (
          <PressArea key={base} label={`도루 ${base}루`} rect={stealPressRectOf(base)} onPress={(event) => stealIfFlying(base, event)} />
        ))}
      <PressArea label={isMenuOpen ? '닫기' : '메뉴'} rect={MENU_PRESS_RECT} onPress={onMenu} />
    </>
  )
}

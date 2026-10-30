import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherManagementMenu } from '@/pages/pitcher-league/model/usePitcherManagementMenu'
import { PitcherRepertoirePanel } from '@/pages/pitcher-league/ui/PitcherRepertoirePanel'
import { PitchTrainingScreen } from '@/pages/pitcher-league/ui/PitchTrainingScreen'
import { PitcherMagicTrainingPanel } from '@/pages/pitcher-league/ui/PitcherMagicTrainingPanel'
import { pitcherAbilityDetailViewOf } from '@/pages/pitcher-league/lib/pitcherDetailPopup'
import { DetailWindow } from './otherSlices'

interface WindowProps {
  readonly career: PitcherCareer
  readonly menu: PitcherManagementMenu
}

/** 관리 화면 0x19da4 위에 뜨는 창 0x803d4 셋 — 123 구질목록 · 108 탭 2 구질 훈련 · 108 탭 1 마구 훈련 */
export function PitcherTrainingWindows({ career, menu }: WindowProps) {
  return (
    <>
      {/* 123 창 0x803d4(상태 0x7b) — 키 0x17cec 는 창이 받는다, 취소는 106 */}
      {menu.subWindow === '구질목록' && (
        <PitcherRepertoirePanel
          career={career}
          tab={menu.pitchWindowTab}
          isKeyEnabled={menu.notice === '' && menu.question === null && menu.choice === null}
          onSelectMagic={menu.selectMagicCell}
          onSelectPitch={menu.selectPitchCell}
          onClose={menu.closeWindow}
        />
      )}

      {/* 108 탭 2 구질 훈련 창 0x803d4 — 키는 창이 받는다(0x17828 → 0x80268), 취소는 107 */}
      {menu.subWindow === '구질훈련' && <PitchTrainingScreen career={career} onTrain={menu.trainPitch} onClose={menu.closeWindow} />}
      {/* 108 탭 1 마구 창 0x803d4 — 키는 `usePitcherManagementMenu`(0x17828 → 0x80268), 취소는 107 */}
      {menu.subWindow === '마구훈련' && (
        <PitcherMagicTrainingPanel
          career={career}
          cursor={menu.magicTrainingCursor}
          onMoveCursor={menu.moveMagicTrainingCursor}
          onConfirm={menu.confirmMagicTrainingCell}
        />
      )}
    </>
  )
}

/** 능력치 상세(120) — 그림 0x1b2e4 = 기본정보 카드 → 창 0x8a0a4 → 머리띠(0x7f4ed). 표·글은 0x88fe8 */
export function PitcherAbilityDetail({ career, menu }: WindowProps) {
  if (menu.abilityDetailOffset === null) return null
  const view = pitcherAbilityDetailViewOf(career)
  return <DetailWindow rows={view.rows} messages={view.messages} scrollOffset={menu.abilityDetailOffset} onClose={menu.closeAbilityDetail} />
}

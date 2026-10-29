import { PressArea } from '@/shared/ui'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { TrainingScene } from '@/widgets/training-scene/ui/TrainingScene'
import { RestScene } from '@/widgets/training-scene/ui/RestScene'
import { nariRestPresentationOf } from '@/widgets/training-scene/lib/restPresentation'
import { TRAINING_PRESENTATION_OF } from '@/shared/config/original/trainingAnimation'
import { portraitPaletteIndex } from '@/shared/lib/sprite/paletteSwap'
import * as styles from '@/pages/management/ui/ManagementScreen.css'
import type { useManagementMenu } from '@/pages/management/model/useManagementMenu'
import { pressKey } from './pressKey'

type Menu = ReturnType<typeof useManagementMenu>

/** 125 훈련 팝업 0x848d0 — 연출이 도는 동안 */
export function TrainingLayer({ menu, career }: { readonly menu: Menu; readonly career: PlayerCareer }) {
  if (menu.playingMenuId === null) return null
  return (
    <div className={styles.trainingPopup}>
      <TrainingScene
        presentation={TRAINING_PRESENTATION_OF[menu.playingMenuId] ?? null}
        // 장타형은 동작표가 따로다 (0xd4a18·0xd4a6c — F-6). 0 만 타격형이고 그 밖은 장타형이다
        battingTypeIndex={career.battingTypeIndex}
        // 손은 넘기지 않는다 — 0x10810 이 +0x3c 에 넣은 손을 진입 0x11744 가 1 로 덮어써 안 뒤집는다(11802~1181e)
        // 훈련 팝업 캐릭터도 0x10810 이 세운 그림 객체 그대로라 장착 장비를 입고 나온다
        equipmentLevels={career.equipmentLevels}
        // 몸통 = 피부 × 15 + 팀 · 헬멧 = 팀 (기본정보 카드와 같은 0x10810 → 0x78be8·0x78c14)
        skinIndex={career.skinIndex}
        teamIndex={career.teamId}
        onFinished={menu.finishTraining}
      />
    </div>
  )
}

/** 127 그리기 0x19e08 → 0x8532c = 0x848d0(gfx, 0, 0) — 캐릭터 없는 훈련 팝업 (`RestScene`) */
export function RestLayer({ menu, career }: { readonly menu: Menu; readonly career: PlayerCareer }) {
  if (menu.restPhase !== 'playing') return null
  return (
    <RestScene
      presentation={nariRestPresentationOf({ isBatter: true, battingTypeIndex: career.battingTypeIndex })}
      char0Palette={portraitPaletteIndex(career.skinIndex)}
      onFinished={menu.finishRest}
    />
  )
}

/** 125 연출 중 화면 탭 = 확인 키 — 0x105a4 가 게이지를 끝으로 보낸다(`TrainingScene` 이 키로 받는다) */
export function TrainingSkipArea({ menu }: { readonly menu: Menu }) {
  if (menu.playingMenuId === null) return null
  return <PressArea label="훈련 연출 건너뛰기" testId="훈련연출-건너뛰기" onPress={() => pressKey('5')} />
}

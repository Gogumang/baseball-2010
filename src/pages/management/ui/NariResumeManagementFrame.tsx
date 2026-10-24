import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { currentTitleOf } from '@/entities/career/model/titles'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import { ManagementBoard } from '@/pages/management/ui/ManagementBoard'
import { CenterStage } from '@/pages/management/ui/CenterStage'
import { NariMainCommandBar } from '@/pages/management/ui/NariMainCommandBar'
import { nariStageCharactersOf } from '@/pages/management/lib/centerStage'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'

/**
 * **이어하기 길 137 앞 화면의 105 한 틀** (`resumeCoverUnderlayAt` 의 '관리', r163 직접 뜸 — 0x11910 · 0x19f0c · 0x19da4).
 * 105 진입 0x11910 은 새 시즌(S+0x1b7 = 0)을 보고 115 를 예약(11bd6)한 뒤에도 끝까지 간다 — 11c26 `0x7ff21` 로 메뉴를 막 열고
 * (칸 등장 갱신 0), 이전 상태가 1 이라 11c7e `0x8a2d9` 로 가운데 판을 오른쪽(+120)에서 미끄러뜨린다. 같은 틀의 그리기 0x19f0c 는
 * 0x19da4 그대로다:
 * ```
 * 0x7e418(gfx, [+0x2c] = 0)     커맨드 줄 — 관리 6칸, 칸 등장 0
 * 0x7d34c(gfx, 0)               상태판
 * 0x7f814(gfx, 0, 1)            가운데 판 — [+0x24] = 1 ≠ 0x72 라 그린다(미끄러짐 첫 자리)
 * 0x7f4ec                        머리띠
 * ```
 * 다음 틀은 115 라 이 그림은 한 틀만 선다(효과기 어두워짐이 위에 겹친다).
 */
export function NariResumeManagementFrame({ career, cursor }: {
  readonly career: PlayerCareer
  /** 관리 메뉴 커서 칸 (`NariMainMenuCursor`) */
  readonly cursor: number
}) {
  return (
    <>
      <SkinBackdrop kind="공무늬" />
      <NariMainCommandBar menuEnable={career} cursor={cursor} slideUpdates={0} />
      <ManagementBoard career={career} titleName={currentTitleOf(career)} />
      <CenterStage slidesIn characters={nariStageCharactersOf({
        morale: career.morale,
        isSick: career.isSick,
        isInjured: career.isInjured,
        isSlugger: career.battingTypeIndex >= 1,
        skinIndex: career.skinIndex,
      })} />
      <ScreenFrame title="나만의리그타자편" gamePoint={career.gamePoint} onBack={null} slides={false} />
    </>
  )
}

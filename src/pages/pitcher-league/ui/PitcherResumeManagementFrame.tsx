import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import { PitcherStatusBoard } from '@/pages/pitcher-league/ui/PitcherStatusBoard'
import { CenterStage } from '@/pages/management/ui/CenterStage'
import { NariMainCommandBar } from '@/pages/management/ui/NariMainCommandBar'
import { nariStageCharactersOf } from '@/pages/management/lib/centerStage'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'

/**
 * 투수편 이어하기 길 137 앞 화면의 105 한 틀 — 타자편 `NariResumeManagementFrame` 과 같은 0x11910 · 0x19da4 (커맨드 줄 칸 등장 0 ·
 * 상태판 모드 3 · 가운데 판 선수 하나 미끄러짐 첫 자리 · 머리띠 제목 9).
 */
export function PitcherResumeManagementFrame({ career, cursor }: { readonly career: PitcherCareer; readonly cursor: number }) {
  return (
    <>
      <SkinBackdrop kind="공무늬" />
      <NariMainCommandBar menuEnable={career} cursor={cursor} slideUpdates={0} />
      <PitcherStatusBoard career={career} />
      <CenterStage
        slidesIn
        characters={nariStageCharactersOf({
          morale: career.morale,
          isSick: career.isSick,
          isInjured: career.isInjured,
          isSlugger: false,
          skinIndex: career.skinIndex,
        })}
      />
      <ScreenFrame title="나만의리그투수편" gamePoint={career.gamePoint} onBack={null} slides={false} />
    </>
  )
}

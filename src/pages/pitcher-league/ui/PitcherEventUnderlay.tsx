import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import { PitcherStatusBoard } from '@/pages/pitcher-league/ui/PitcherStatusBoard'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'

/**
 * 투수편 이벤트 재생 114 의 밑그림 — 타자편 `NariEventUnderlay` 와 같은 0x8b5ac 갈래(공 무늬 · 상태판 모드 3 · 머리띠 제목 9).
 * 112 · 113 · 140 뒤 이벤트는 외출 지도 위다([gfx+0x174] ∈ {0x70, 0x71}).
 */
export function PitcherEventUnderlay({ career, isPreviousGame = false }: {
  readonly career: PitcherCareer
  /** [이벤트+0xb] — 경기 뒤 평가 내장 이벤트(0x8a6fc)일 때만 참 */
  readonly isPreviousGame?: boolean
}) {
  return (
    <>
      <SkinBackdrop kind="공무늬" />
      <PitcherStatusBoard career={career} isPreviousGame={isPreviousGame} />
      <ScreenFrame title="나만의리그투수편" gamePoint={career.gamePoint} onBack={null} footer={5} />
    </>
  )
}

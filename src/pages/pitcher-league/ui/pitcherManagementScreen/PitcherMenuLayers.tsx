import { RestScene } from '@/widgets/training-scene/ui/RestScene'
import { portraitPaletteIndex } from '@/shared/lib/sprite/paletteSwap'
import { nariRestPresentationOf } from '@/widgets/training-scene/lib/restPresentation'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherManagementMenu } from '@/pages/pitcher-league/model/usePitcherManagementMenu'
import { PitcherStatusBoard } from '@/pages/pitcher-league/ui/PitcherStatusBoard'
import { CenterStage, nariMainMenuOffIdsOf, nariStageCharactersOf, SkinBackdrop } from './otherSlices'
import type { NariMainMenuCursor } from './otherSlices'
import { PitcherCommandBar } from './PitcherCommandBar'

interface PitcherMenuLayersProps {
  readonly career: PitcherCareer
  readonly menu: PitcherManagementMenu
  readonly mainCursor: NariMainMenuCursor
  readonly slidingRef: { current: boolean }
  /** 커맨드 줄이 키를 받는가 — 하위 창 · 팝업 · 질문 · 알림 · 휴식 연출이 없을 때 */
  readonly isKeyEnabled: boolean
  readonly centerSlidesIn: boolean
}

/**
 * 105 · 106 · 107 · 110 그림 0x19da4 — 앞그림 0x16928 의 공 무늬 → 커맨드 줄 0x7e418 → 상태판 0x7d34c(모드 3) →
 * 가운데 판 0x7f814(선수 하나) → 머리띠. 하위 메뉴(106·107·110)가 열려도 화면은 그대로고 아래 줄만 바뀐다 (0x7e84c).
 */
export function PitcherMenuLayers({ career, menu, mainCursor, slidingRef, isKeyEnabled, centerSlidesIn }: PitcherMenuLayersProps) {
  return (
    <>
      <SkinBackdrop kind="공무늬" />
      <PitcherCommandBar
        menu={menu}
        mainOffIds={nariMainMenuOffIdsOf(career)}
        mainCursor={mainCursor}
        hasActed={career.hasActedThisCycle}
        slidingRef={slidingRef}
        isKeyEnabled={isKeyEnabled}
      />
      <PitcherStatusBoard career={career} />
      {/* 상태 125(훈련 연출 · 결과 창)·127(휴식 — 연출과 결과 창)은 0x19da4 가 가운데 판 0x7f814 를 뺀다(19dc0~19dd4) */}
      {/*
        가운데 판은 상태판 다음에 그린다(0x19da4: 19db6 0x7d34d → 19de6 0x7f815). 0x7f814 의 자르기는 0xbae25(0, 0, 폭, 판 아래 − 1)
        — 위쪽은 안 자르니 선수 모자가 상태판 "STAMINA" 글자를 덮는 것도 원본 그대로다 (r226, r219 pm1)
      */}
      {!menu.isTrainingState && menu.restPhase === null && (
        <CenterStage
          slidesIn={centerSlidesIn}
          characters={nariStageCharactersOf({
            morale: career.morale,
            isSick: career.isSick,
            isInjured: career.isInjured,
            isSlugger: false,
            skinIndex: career.skinIndex,
          })}
        />
      )}
      {/* 127 그리기 0x19e08 → 0x8532c = 0x848d0(gfx, 0, 0) — 캐릭터 없는 훈련 팝업. 투수편([gfx+0x20] == 3)은 늘 애니 0x62 */}
      {menu.restPhase === 'playing' && (
        <RestScene
          presentation={nariRestPresentationOf({ isBatter: false, battingTypeIndex: 0 })}
          char0Palette={portraitPaletteIndex(career.skinIndex)}
          onFinished={menu.finishRest}
        />
      )}
    </>
  )
}

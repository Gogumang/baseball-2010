import { RawScreen } from '@/shared/ui'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherManagementMenu } from '@/pages/pitcher-league/model/usePitcherManagementMenu'
import { PitcherBasicInfoPanel } from '@/pages/pitcher-league/ui/PitcherBasicInfoPanel'
import { SkinBackdrop } from './otherSlices'
import type { NariMainMenuCursor } from './otherSlices'
import { PitcherMenuLayers } from './PitcherMenuLayers'
import { PitcherOverlayWindows, PitcherScreenFrame } from './PitcherOverlayWindows'
import { PitcherAbilityDetail, PitcherTrainingWindows } from './PitcherTrainingWindows'

/**
 * 관리 화면 0x19da4 를 그대로 두고 위에 뜨는 하위 창 — 106 칸 4 [기록실] 팝업 0x80(124 로 가면 `NariRecordView` 가 덮는다) ·
 * 108 탭 2 구질 훈련 · 108 탭 1 마구 훈련(그림 0x19e44) · 123 구질목록(그림 0x19e24, 창 0x803d4 상태 0x7b). 아래 줄은 하위 메뉴 그대로다
 */
const WINDOW_OVER_MENU: ReadonlySet<string> = new Set(['기록실', '구질훈련', '마구훈련', '구질목록'])

/** 커맨드 줄이 키를 받는가 — 훈련 상태 · 위 하위 창 · 팝업 · 상세 · 질문 · 알림 · 휴식 연출 중이 아니다 */
const isBarKeyEnabledOf = (menu: PitcherManagementMenu) =>
  !menu.isTrainingState &&
  !WINDOW_OVER_MENU.has(menu.subWindow ?? '') &&
  menu.choice === null &&
  menu.detail === null &&
  menu.question === null &&
  menu.notice === '' &&
  menu.restPhase !== 'playing'

interface PitcherManagementBodyProps {
  readonly career: PitcherCareer
  readonly menu: PitcherManagementMenu
  readonly mainCursor: NariMainMenuCursor
  readonly slidingRef: { current: boolean }
  readonly centerSlidesIn: boolean | undefined
}

/** 105 · 106 · 107 · 110 · 119 · 120 · 122 · 123 · 108 · 125 · 127 · 129 화면 — 124 목록 밖의 모든 갈래 */
export function PitcherManagementBody({ career, menu, mainCursor, slidingRef, centerSlidesIn }: PitcherManagementBodyProps) {
  const isBasicInfo = menu.subWindow === '기본정보'
  return (
    <RawScreen>
      {(menu.subWindow === null || WINDOW_OVER_MENU.has(menu.subWindow)) && (
        <PitcherMenuLayers
          career={career}
          menu={menu}
          mainCursor={mainCursor}
          slidingRef={slidingRef}
          isKeyEnabled={isBarKeyEnabledOf(menu)}
          centerSlidesIn={centerSlidesIn ?? false}
        />
      )}
      {/*
        119 그림 0x166cc — 장면 틀 0x16928 의 공 무늬(0x5fd61, 상태 0x8e~0x90 밖은 다 깐다) 위에 기본정보 카드 0x15e20
        (카드 판 · 레이더 · 투수 그림 · 정보 칸 0x7c451) → 머리띠 0x54d95(제목 9 · 바닥 0x87)
      */}
      {isBasicInfo && (
        <>
          <SkinBackdrop kind="공무늬" />
          <PitcherBasicInfoPanel career={career} />
        </>
      )}
      <PitcherTrainingWindows career={career} menu={menu} />
      {isBasicInfo && <PitcherAbilityDetail career={career} menu={menu} />}
      <PitcherScreenFrame career={career} menu={menu} slidingRef={slidingRef} />
      <PitcherOverlayWindows career={career} menu={menu} mainCursor={mainCursor} />
    </RawScreen>
  )
}

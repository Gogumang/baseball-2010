import type { Screen } from '@/app/model/screen'
import { SceneHourContext, useSceneEntryHour } from '@/shared/lib/phoneClock/phoneClock'
import type { CareerRoutesProps } from '@/app/ui/careerRoutes/careerRoutesProps'
import { CareerScreens } from '@/app/ui/careerRoutes/CareerScreens'
import { YearCoverHoldLayer } from '@/pages/management/ui/NariYearCoverScreen'

export type { AceMatchStarter } from '@/app/ui/careerRoutes/careerRoutesProps'

/**
 * 경기 장면 0x104 쪽 화면 — 나리 장면 0x106 이 내려가 있다. 여기서 다른 화면으로 오면 장면이 새로 서서 상태 100 진입 0x1c154 를 지난다.
 * '경기결과' 는 경기 끝 판 0x18 · 정산 0x19 뿐이고, 116 평가('경기평가')는 정산 판을 나간 0x3f3 뒤 새로 선 나리 장면의 100 → 116 이라
 * 그 100 진입에서 시각을 잡는다(r287 — 예전엔 한 화면이라 정산부터 시각이 늦었다).
 */
const NARI_OUTSIDE_SCREENS: ReadonlySet<Screen['kind']> = new Set(['경기', '경기결과', '대회경기결과', '마선수대결'])

/**
 * 육성 모드 화면 분기 — 나리 장면의 시간대 시각(상태 100 진입 0x1c154 끝 `0x7b934(gfx, 0xb8fbd())`)을 장면에 들어설 때 잡아
 * 안쪽 화면들(경기장 띠 · 엔딩 띠 · 훈련 창 · 외출 지도 밤)에 내려 준다(`SceneHourContext`).
 */
export function CareerRoutes(props: CareerRoutesProps) {
  const hour = useSceneEntryHour(!NARI_OUTSIDE_SCREENS.has(props.screen.kind))
  return (
    <SceneHourContext.Provider value={hour}>
      <CareerScreens {...props} />
      {/* 새 시즌 0x1b768 을 부른 134 · 141 이 효과기 끝을 기다리는 아홉 틀 — 그 화면을 그대로 두고 효과기만 덮는다 */}
      {props.session.isYearCoverHeld ? <YearCoverHoldLayer onDone={props.session.actions.enterHeldYearCover} /> : null}
    </SceneHourContext.Provider>
  )
}

import { SceneHourContext, useSceneEntryHour } from '@/shared/lib/phoneClock/phoneClock'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import type { SeasonRouteProps } from '@/app/ui/seasonRoute/seasonRouteProps'
import { SeasonScreens } from '@/app/ui/seasonRoute/SeasonScreens'

/**
 * 시즌모드 라우트 — 시즌 장면 0x105 의 시간대 시각(진입 0xcb 0x4b50 끝 4c7a~4c8a `0x7b934([장면+0xc0], 0xb8fbd())`)을 장면에
 * 들어설 때 잡아 안쪽 화면에 내려 준다(`SceneHourContext`). 경기(0xe1 → 경기 장면 0x104) 동안은 시즌 장면이 내려가 있다.
 * 장면마다 그리는 화면은 `seasonRoute/` (갈래 표 `seasonBranches`)
 */
export function SeasonRoute(props: SeasonRouteProps) {
  const { scene, gameOptions } = props.session
  const hour = useSceneEntryHour(!(scene === SEASON_SCENE_STATE.경기직전 && gameOptions !== null))
  return (
    <SceneHourContext.Provider value={hour}>
      <SeasonScreens {...props} />
    </SceneHourContext.Provider>
  )
}

import { useEffect } from 'react'
import { castOfTeamRecordEquipment, stageSpritePreloadsOf } from '@/app/model/gameSpritePreload'
import { preloadSprites } from '@/shared/lib/sprite/scenePreload'
import { YearCoverHoldLayer } from '@/pages/management/ui/NariYearCoverScreen'
import { SceneHourContext, useSceneEntryHour } from '@/shared/lib/phoneClock/phoneClock'
import type { PitcherLeagueRouteProps } from '@/app/ui/pitcherLeagueRoute/pitcherLeagueRouteProps'
import { PitcherLeagueScreens } from '@/app/ui/pitcherLeagueRoute/PitcherLeagueScreens'

/**
 * 투수편 라우트 — 나리 장면 0x106 의 시간대 시각(상태 100 진입 0x1c154 끝 `0x7b934(gfx, 0xb8fbd())`)을 장면에 들어설 때 잡아
 * 안쪽 화면에 내려 준다(`SceneHourContext`). 경기(0x104) · 마선수 대결 경기 동안은 나리 장면이 내려가 있다.
 */
export function PitcherLeagueRoute(props: PitcherLeagueRouteProps) {
  const { scene, gameOptions } = props.session
  const isInNariScene = !(scene === '경기' && gameOptions !== null) && scene !== '마선수대결'
  const hour = useSceneEntryHour(isInNariScene)
  // 상대 팀 레코드의 굴린 장비 니블(나리 새 시즌 0x665e8) — 타석 교대 0x47cc8 이 상대 타자(47e80 → 0x78fd8)에 싣는다.
  // 경기 옵션이 서면 그 그림을 유휴로 받는다(안 기다린다)
  const opponentTeamId = gameOptions?.opponentTeamId
  const opponentEquipment = gameOptions?.opponentEquipment
  useEffect(() => {
    if (opponentTeamId === undefined || opponentEquipment === undefined) return
    preloadSprites(stageSpritePreloadsOf(castOfTeamRecordEquipment(opponentTeamId, opponentEquipment)), 'idle')
  }, [opponentTeamId, opponentEquipment])
  return (
    <SceneHourContext.Provider value={hour}>
      <PitcherLeagueScreens {...props} />
      {/* 새 시즌 0x1b768 을 부른 134 · 141 이 효과기 끝을 기다리는 아홉 틀 — 그 화면을 그대로 두고 효과기만 덮는다 */}
      {props.session.isYearCoverHeld ? <YearCoverHoldLayer onDone={props.session.actions.enterHeldYearCover} /> : null}
    </SceneHourContext.Provider>
  )
}

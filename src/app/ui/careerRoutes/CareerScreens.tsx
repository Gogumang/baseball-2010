import type { ReactNode } from 'react'
import type { CareerRoutesProps } from '@/app/ui/careerRoutes/careerRoutesProps'
import type { Screen } from '@/app/model/screen'
import type { CareerScreenInput, ScreenOf } from '@/app/ui/careerRoutes/careerScreenInput'
import { useCareerScreenState } from '@/app/ui/careerRoutes/useCareerScreenState'
import { managementOf, managementWithTitleOf } from '@/app/ui/careerRoutes/managementScreen'
import { cupGameResultScreenOf, gameEvaluationScreenOf, gameResultScreenOf, gameScreenOf } from '@/app/ui/careerRoutes/screens/game'
import { itemShopScreenOf, outingScreenOf } from '@/app/ui/careerRoutes/screens/outing'
import { eventScreenOf } from '@/app/ui/careerRoutes/screens/event'
import { yearCoverScreenOf } from '@/app/ui/careerRoutes/screens/yearCover'
import { matchPrepareScreenOf, nextGameStandingsScreenOf } from '@/app/ui/careerRoutes/screens/matchPrepare'
import { endingScreenOf, nationalCupScreenOf, postseasonScreenOf } from '@/app/ui/careerRoutes/screens/seasonEnd'

type CareerScreenRoute<K extends Screen['kind']> = (input: CareerScreenInput, screen: ScreenOf<K>) => ReactNode

/** 화면 종류마다 한 갈래 — 표에 없는 종류는 관리 화면(105) */
const CAREER_SCREENS: { readonly [K in Screen['kind']]?: CareerScreenRoute<K> } = {
  경기: gameScreenOf,
  경기결과: gameResultScreenOf,
  경기평가: gameEvaluationScreenOf,
  대회경기결과: cupGameResultScreenOf,
  외출: outingScreenOf,
  아이템: itemShopScreenOf,
  이벤트: eventScreenOf,
  연차표지: yearCoverScreenOf,
  다음경기순위: nextGameStandingsScreenOf,
  경기준비: matchPrepareScreenOf,
  포스트시즌: postseasonScreenOf,
  국가대항전: nationalCupScreenOf,
  엔딩: endingScreenOf,
}

function careerScreenOf(input: CareerScreenInput): ReactNode {
  const { screen } = input
  // 표의 갈래는 제 종류로 좁힌 화면을 받는다 — 열쇠가 곧 그 종류다
  const route = CAREER_SCREENS[screen.kind] as CareerScreenRoute<typeof screen.kind> | undefined
  if (route !== undefined) return route(input, screen)
  return screen.kind === '관리' ? managementWithTitleOf(input) : managementOf(input)
}

export function CareerScreens(props: CareerRoutesProps) {
  const { session, setScreen } = props
  const screenState = useCareerScreenState(props)
  return careerScreenOf({ ...props, ...screenState, actions: session.actions, backToManagement: () => setScreen({ kind: '관리' }) })
}

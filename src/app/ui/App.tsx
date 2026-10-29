import type { ReactNode } from 'react'
import type { AppProps } from '@/app/ui/app/appConstants'
import { ENTRY_SCREENS, MISSION_SCREENS } from '@/app/ui/app/appConstants'
import type { AppScope } from '@/app/ui/app/appScope'
import { useAppStores } from '@/app/ui/app/useAppStores'
import { useAppShell } from '@/app/ui/app/useAppShell'
import { useAppLateBindings } from '@/app/ui/app/useAppLateBindings'
import { useAppLeagueSessions } from '@/app/ui/app/useAppLeagueSessions'
import { useAppCareerAndMission } from '@/app/ui/app/useAppCareerAndMission'
import { useAppCollection } from '@/app/ui/app/useAppCollection'
import { useAppActions } from '@/app/ui/app/useAppActions'
import { entryRoutesOf } from '@/app/ui/app/routes/entry'
import { missionRoutesOf, seasonRouteOf } from '@/app/ui/app/routes/missionAndSeason'
import { generalModeOf } from '@/app/ui/app/routes/generalMode'
import { pitcherLeagueOf } from '@/app/ui/app/routes/pitcherLeague'
import { careerRoutesOf } from '@/app/ui/app/routes/career'

/** 지금 화면의 갈래 — 미션 · 시즌모드 · 일반모드 · 투수편 · 메뉴 장면(커리어가 없으면 여기) · 나리 타자편 */
function appScreenOf(app: AppScope): ReactNode {
  const { screen } = app
  if (MISSION_SCREENS.includes(screen.kind)) return missionRoutesOf(app)
  if (screen.kind === '시즌모드') return seasonRouteOf(app)
  if (screen.kind === '일반모드') return generalModeOf(app)
  if (screen.kind === '투수편') return pitcherLeagueOf(app)
  if (ENTRY_SCREENS.includes(screen.kind) || app.careerSession.career === null) return entryRoutesOf(app)
  return careerRoutesOf(app, app.careerSession.career)
}

/**
 * 화면 분기만 한다. 상태와 규칙은 model 의 세션 훅들이 나눠 갖고, 앱은 그 훅들을 옛 차례 그대로 세운다
 * (저장 칸 → 껍데기 → 늦게 꽂는 손잡이 → 시즌 · 투수편 · 배경음 → 타자편 · 미션 → 기록연감 → 같이 쓰는 손잡이).
 */
export function App({ bootScreen }: AppProps = {}) {
  const stores = useAppStores()
  const shell = useAppShell({ bootScreen, ...stores })
  const late = useAppLateBindings({ ...stores, ...shell })
  const league = useAppLeagueSessions({ ...stores, ...shell, ...late })
  const careerAndMission = useAppCareerAndMission({ ...stores, ...shell, ...late, ...league })
  const collection = useAppCollection({ ...stores, ...shell, ...late, ...league, ...careerAndMission })
  const actions = useAppActions({ ...stores, ...shell, ...late, ...league, ...careerAndMission, ...collection })
  return appScreenOf({ bootScreen, ...stores, ...shell, ...late, ...league, ...careerAndMission, ...collection, ...actions })
}

import { lazyScreen } from '@/shared/lib/lazyScreen/lazyScreen'

/*
 * 모드 화면은 따로 받는다(`lazyScreen` — 첫 화면 덩이를 줄인다, r224). 켤 때 길에서 `preloadLazyScreens` 가 미리 받아 두므로
 * 메뉴에서 들어갈 때는 이미 와 있다. 뒤 숫자가 받는 차례다 — 메뉴 커서가 처음 서는 [최근게임] · 나만의리그 타자편 · 일반모드가 먼저.
 */
export const CareerRoutes = lazyScreen(() => import('@/app/ui/CareerRoutes').then((module) => module.CareerRoutes), 10)
export const GeneralModeScreen = lazyScreen(() => import('@/pages/general-mode/ui/GeneralModeScreen').then((module) => module.GeneralModeScreen), 10)
export const PitcherLeagueRoute = lazyScreen(() => import('@/app/ui/PitcherLeagueRoute').then((module) => module.PitcherLeagueRoute), 30)
export const SeasonRoute = lazyScreen(() => import('@/app/ui/SeasonRoute').then((module) => module.SeasonRoute), 30)
export const MissionRoutes = lazyScreen(() => import('@/app/ui/MissionRoutes').then((module) => module.MissionRoutes), 30)
export const PitcherAceMatchRoute = lazyScreen(() => import('@/app/ui/MissionRoutes').then((module) => module.PitcherAceMatchRoute), 30)

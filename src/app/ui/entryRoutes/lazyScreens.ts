import { lazyScreen } from '@/shared/lib/lazyScreen/lazyScreen'

/*
 * 메인 메뉴에서 들어가는 화면은 따로 받는다(`lazyScreen`, r224) — 켤 때 길(로고가 끝난 뒤 타이틀 · 메인 메뉴)에서 미리 받아 둔다.
 * 켤 때 앞 화면 셋과 메인 메뉴는 앱 덩이에 그대로 둔다. 뒤 숫자가 받는 차례다(작을수록 먼저).
 */
export const HelpScreen = lazyScreen(() => import('@/pages/help/ui/HelpScreen').then((module) => module.HelpScreen), 60)
export const SettingsScreen = lazyScreen(() => import('@/pages/settings/ui/SettingsScreen').then((module) => module.SettingsScreen), 60)
export const MyLeagueTeamSelectScreen = lazyScreen(
  () => import('@/pages/create-player/ui/MyLeagueTeamSelectScreen').then((module) => module.MyLeagueTeamSelectScreen),
  20,
)
export const CreatePlayerScreen = lazyScreen(
  () => import('@/pages/create-player/ui/CreatePlayerScreen').then((module) => module.CreatePlayerScreen),
  20,
)
export const SpecialScreen = lazyScreen(() => import('@/pages/special/ui/SpecialScreen').then((module) => module.SpecialScreen), 50)
export const HallOfFameScreen = lazyScreen(() => import('@/pages/special/ui/SpecialScreen').then((module) => module.HallOfFameScreen), 40)
export const AceSelectScreen = lazyScreen(() => import('@/pages/general-mode/ui/AceSelectScreen').then((module) => module.AceSelectScreen), 50)
export const SpecialEditScreen = lazyScreen(() => import('@/pages/special-edit/ui/SpecialEditScreen').then((module) => module.SpecialEditScreen), 60)
export const HomeRunDerbyScreen = lazyScreen(
  () => import('@/pages/home-run-derby/ui/HomeRunDerbyScreen').then((module) => module.HomeRunDerbyScreen),
  40,
)

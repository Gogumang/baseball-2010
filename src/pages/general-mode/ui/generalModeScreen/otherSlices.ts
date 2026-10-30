/**
 * 일반모드 화면이 쓰는 **다른 조각** — 팀 고르기(`pages/create-player`) · 팀 경기 장면(`pages/team-game`) · 화면 밀기(`pages/management`) ·
 * 설정 창(`pages/match-settings`) · 공 무늬 바탕(`pages/special`). 조각 경계를 넘는 import 를 이 파일 한 곳에 모은다.
 */
export { TeamSelectScreen } from '@/pages/create-player/ui/TeamSelectScreen'
export { TeamGameScreen } from '@/pages/team-game/ui/TeamGameScreen'
export { XLS_ROW_MATCHUP_RECORDS } from '@/pages/team-game/lib/teamMatchupCards'
export { NariScreenPush } from '@/pages/management/ui/NariScreenPush'
export { MatchSettingsWindow } from '@/pages/match-settings'
export { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'

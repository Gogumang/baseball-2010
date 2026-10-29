/**
 * 화면 → 배경음 · 들어설 때 소리. 표와 엔딩 배경음 · 다시 틀기 판정 · 화면/투수편/시즌 메뉴 배경음 훅 · 들어설 때 소리 끊기로 나눴다
 * (`screenBgm/`). 머리 설명은 표 파일(`screenBgmTable`)에 있다.
 */
export { SCREEN_BGM } from '@/app/model/screenBgm/screenBgmTable'
export { screenBgmOf } from '@/app/model/screenBgm/screenBgmOf'
export { endingBgmOf, playEndingContinueBgm, seasonEndingBgmOf } from '@/app/model/screenBgm/endingBgm'
export {
  restartsMenuBgm,
  restartsTeamSelectBgm,
  restartsManagementBgm,
  restartsNextGameStandingsBgm,
  NARI_STATE,
  restartsManagementBgmFrom,
  carriesYearCoverBgm,
} from '@/app/model/screenBgm/bgmRestarts'
export { usePitcherLeagueBgmRestart, useScreenBgm } from '@/app/model/screenBgm/useScreenBgm'
export { pitcherLeagueBgmOf, usePitcherLeagueBgm } from '@/app/model/screenBgm/pitcherLeagueBgm'
export { seasonMenuBgmOf, seasonSceneBgmOf, useSeasonMenuBgm } from '@/app/model/screenBgm/seasonMenuBgm'
export {
  SCREEN_ENTER_SOUND,
  stopsSoundOnEnter,
  useSceneEnterStop,
  useResumeCoverStop,
  screenEnterSoundOf,
} from '@/app/model/screenBgm/sceneEnterSound'

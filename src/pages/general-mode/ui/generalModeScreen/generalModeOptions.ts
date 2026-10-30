import type { UseGeneralModeOptions } from '@/pages/general-mode/model/useGeneralMode/generalModeTypes'
import type { GeneralModeScreenProps } from './generalModeScreenProps'

/** 화면 props → 세션 훅 옵션 — 넘기지 않은 칸은 옵션에도 안 넣는다 */
export function generalModeOptionsOf(props: GeneralModeScreenProps): UseGeneralModeOptions {
  const { openedHiddenTeamIds, openedAcePitcherIds, openedAceBatterIds } = props
  return {
    random: props.random,
    isQuickStart: props.isQuickStart ?? false,
    ...(openedHiddenTeamIds === undefined ? {} : { openedHiddenTeamIds }),
    ...(openedAcePitcherIds === undefined ? {} : { openedAcePitcherIds }),
    ...(openedAceBatterIds === undefined ? {} : { openedAceBatterIds }),
    ...settingOptionsOf(props),
    // 0x30f20(22 들어옴 · 재굴림 끝) · 0x2a370(23 나감)도 0x22755 로 블록만 쓴다 — 반 이닝 저장과 같은 손잡이
    ...(props.onGameSave === undefined ? {} : { onMatchBlockWrite: props.onGameSave }),
  }
}

/** 설정 창 · 환경설정 · 마선수 레벨 */
function settingOptionsOf(props: GeneralModeScreenProps): Partial<UseGeneralModeOptions> {
  const { initialSettings, onMatchSettingsConfirm, matchSettingsSeen, gaugeSettingOn, runningModeManual, throwModeManual, aceLevels } = props
  return {
    ...(initialSettings === undefined ? {} : { initialSettings }),
    ...(onMatchSettingsConfirm === undefined ? {} : { onSettingsConfirm: onMatchSettingsConfirm }),
    ...(matchSettingsSeen === undefined ? {} : { matchSettingsSeen }),
    ...(gaugeSettingOn === undefined ? {} : { gaugeSettingOn }),
    ...(runningModeManual === undefined ? {} : { runningModeManual }),
    ...(throwModeManual === undefined ? {} : { throwModeManual }),
    // 고르기 화면 LV 와 같은 칸이 경기 속 마선수 배율·마구 횟수도 정한다 (0xb6414 · 0xaebe4)
    ...(aceLevels === undefined ? {} : { aceLevels }),
  }
}

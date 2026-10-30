import { MATCH_SETTING_KIND } from '@/features/play-team-game/model/matchSettings'
import { INNING_VALUE_COUNT, KIND_COUNT, SETTINGS_STAGE } from '@/pages/match-settings/lib/matchSettingsMenu'
import type { MatchSettingsWindowState } from '@/pages/match-settings/lib/matchSettingsMenu'
import { INNING_LABELS, INNING_LABEL_FRAMES, KIND_LABELS, KIND_LABEL_FRAMES } from '@/pages/match-settings/lib/matchSettingsText'
import { ChanceSlots } from './ChanceSlots'
import { DetailRows } from './DetailRows'
import type { SettingsDraw } from './settingsDraw'
import { SettingsListRows } from './SettingsListRows'
import { SettingsTab } from './SettingsTab'

/**
 * 창 가운데 — 종류 단계는 종류 줄, 값 단계는 꼬리 탭 + 그 종류의 값(찬스 칸 둘 · 이닝 줄 · 그 밖은 상세 줄).
 * 칸을 누르면 그 칸으로 커서를 옮긴 창으로 OK 를 누른다(`pressAt`)
 */
export function SettingsBody({
  draw,
  state,
  isDetail,
  pressAt,
}: {
  readonly draw: SettingsDraw
  readonly state: MatchSettingsWindowState
  readonly isDetail: boolean
  readonly pressAt: (moved: MatchSettingsWindowState) => void
}) {
  const { kind, value } = state.settings
  const withKind = (index: number): MatchSettingsWindowState => ({ ...state, settings: { ...state.settings, kind: index } })
  const withValue = (index: number): MatchSettingsWindowState => ({ ...state, settings: { ...state.settings, value: index } })
  if (state.stage === SETTINGS_STAGE.종류) {
    return (
      <SettingsListRows
        draw={draw}
        frames={KIND_LABEL_FRAMES.slice(0, KIND_COUNT)}
        labels={KIND_LABELS}
        selected={kind}
        moved={withKind}
        pressAt={pressAt}
      />
    )
  }
  return (
    <>
      <SettingsTab text={draw.text} kind={kind} isDetail={isDetail} />
      {kind === MATCH_SETTING_KIND.찬스 && <ChanceSlots draw={draw} value={value} onPress={(index) => pressAt(withValue(index))} />}
      {kind === MATCH_SETTING_KIND.이닝 && (
        <SettingsListRows
          draw={draw}
          frames={INNING_LABEL_FRAMES.slice(0, INNING_VALUE_COUNT)}
          labels={INNING_LABELS}
          selected={value}
          moved={withValue}
          pressAt={pressAt}
        />
      )}
      {kind !== MATCH_SETTING_KIND.찬스 && kind !== MATCH_SETTING_KIND.이닝 && <DetailRows draw={draw} state={state} pressAt={pressAt} />}
    </>
  )
}

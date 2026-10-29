import { MessageBox, RawScreen } from '@/shared/ui'
import { PANEL } from '@/pages/settings/lib/settingsLayout'
import { SettingsFrame } from '@/pages/settings/ui/settingsScreen/SettingsPanels'
import { DetailSettings } from '@/pages/settings/ui/settingsScreen/DetailSettings'
import { ModeResetPage } from '@/pages/settings/ui/settingsScreen/ModeResetPage'
import { SettingsMainBody } from '@/pages/settings/ui/settingsScreen/SettingsMainBody'
import type { SettingsScreenProps } from '@/pages/settings/ui/settingsScreen/settingsScreenProps'
import { useSettingsScreen } from '@/pages/settings/ui/settingsScreen/useSettingsScreen'
import type { SettingsScreenState } from '@/pages/settings/ui/settingsScreen/useSettingsScreen'

/** 하위 페이지 — 상세 설정(장면 상태 0x20 · 페이지 32) · 모드 초기화(0x21 · 페이지 33, 갱신 0x2c6d8 · 그리기 0x2dc00). 둘 다 팝업이 아니라 **딴 페이지**다 */
function subPageOf(props: SettingsScreenProps, state: SettingsScreenState) {
  const subPage = { mainMenu: props.mainMenu, panelHeight: Math.min(state.fold.height, PANEL.height), isPageShown: state.isPageShown }
  if (state.isDetailOpen) {
    return <DetailSettings settings={props.settings} onChange={props.onChange} {...subPage} onBack={state.returnFrom.detail} />
  }
  if (!state.isModeResetOpen || props.onResetEditedNames === undefined) return null
  return (
    <ModeResetPage
      onResetCareer={props.onResetCareer}
      {...(props.careerResetBlockOf === undefined ? {} : { careerResetBlockOf: props.careerResetBlockOf })}
      onResetEditedNames={props.onResetEditedNames}
      {...(props.onResetSeason === undefined ? {} : { onResetSeason: props.onResetSeason })}
      {...subPage}
      onBack={state.returnFrom.modeReset}
    />
  )
}

/**
 * 원작 메인 메뉴 [환경설정] — 공용 페이지 0x593c8 종류 8 (P6 5절 확정).
 *
 * 가운데 192×212 판에 줄 여섯이 25px 간격으로 놓인다:
 *   값 줄 0~2 = 사운드 · 속도 · 진동 (StrMAINMENU[63]~[65])
 *   메뉴 줄 3~5 = 상세 설정 · 모드 초기화 · 게임 데이터 관리 (…[66]~[68])
 *
 * 줄은 원본대로 보여 준다. 진동을 켜면 0x29684 처럼 100ms 흔든다(`navigator.vibrate` 가 있을 때만) — 경기 중 메뉴의
 * "설정" 도 이 화면이라 0x3cc20(같은 일)도 여기서 된다. 다만 경기 중은 **작은 판(130)에 값 줄 셋 + OK 칸**뿐이다
 * (`mainMenu` 없음 = skin+0x125, `IN_GAME_PANEL`) — 상세 설정·모드 초기화(에디트 초기화 포함)는 경기 중에 열 길이 없다.
 * 게임 데이터 관리(백업·복구)는 원본이 서버를 쓰므로 🌐 안내만 띄운다.
 * 상세 설정에는 웹이 실제로 쓰는 항목(투구 게이지)을 둔다.
 */
export function SettingsScreen(props: SettingsScreenProps) {
  const state = useSettingsScreen(props)
  const subPage = subPageOf(props, state)
  if (subPage !== null) return subPage
  return (
    <RawScreen>
      {state.isPageShown && <SettingsMainBody state={state} settings={props.settings} />}

      {/* 머리띠 되돌아가기 = CLR (0x295e2) */}
      <SettingsFrame mainMenu={props.mainMenu} onBack={state.leave} slides={!state.hasReturned} />

      {state.notice !== null && <MessageBox text={state.notice} buttons={['확인']} onAnswer={() => state.setNotice(null)} />}
    </RawScreen>
  )
}

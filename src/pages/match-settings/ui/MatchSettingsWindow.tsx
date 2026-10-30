import { useId, useState } from 'react'
import { CommonPanel, RawScreen } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { useSkinStepDrawCounter } from '@/shared/lib/skinStepCounter/skinStepCounter'
import { MATCH_SETTING_KIND, confirmedMatchSettings } from '@/features/play-team-game/model/matchSettings'
import type { MatchProgressSettings } from '@/features/play-team-game/model/matchSettings'
import { SETTINGS_STAGE, answerMatchSettingsPopup, openMatchSettings, pressMatchSettingsKey } from '@/pages/match-settings/lib/matchSettingsMenu'
import type { MatchSettingsAction, MatchSettingsKey, MatchSettingsWindowState } from '@/pages/match-settings/lib/matchSettingsMenu'
import {
  DETAIL_DESCRIPTION,
  DETAIL_WINDOW,
  IMG_TEXT_PALETTE,
  SMALL_DESCRIPTION,
  SMALL_WINDOW,
  TITLE,
  backButtonOf,
  isSettingsBlinkOn,
} from '@/pages/match-settings/lib/matchSettingsLayout'
import { IMG_TEXT } from '@/pages/match-settings/lib/matchSettingsText'
import * as styles from '@/pages/match-settings/ui/MatchSettingsWindow.css'
import { descriptionOf } from '@/pages/match-settings/lib/matchSettingsDescription'
import { Description } from './matchSettingsWindow/Description'
import { PaletteFilters } from './matchSettingsWindow/PaletteFilters'
import { POPUP_FRAMES, SLT_FRAMES } from './matchSettingsWindow/settingsAssets'
import { centeredImgTextOf, imgTextOf, type SettingsDraw } from './matchSettingsWindow/settingsDraw'
import { SettingsBody } from './matchSettingsWindow/SettingsBody'
import { SettingsPopups } from './matchSettingsWindow/SettingsPopups'
import { useSettingsKeys } from './matchSettingsWindow/useSettingsKeys'

export interface MatchSettingsWindowProps {
  /** 저장 칸에서 읽어 온 지금 설정 (모드 칸 m 은 부르는 쪽이 고른다 — 일반 0 · 시즌 1 · 대전 2) */
  readonly settings: MatchProgressSettings
  /** 확인창에서 '예' — 저장 칸(+0x12c+m …)에 되쓰고 창을 닫는다 (0x60376) */
  readonly onConfirm: (settings: MatchProgressSettings) => void
  /** CLR — 아무것도 저장하지 않고 닫는다 (+0x2ba = 0) */
  readonly onClose: () => void
}

/**
 * **경기진행 설정 창** (원본 갱신 0x5fef4 · 키 **0x5ffcc** · 그리기 **0x6042c**).
 *
 * 일반모드 경기정보(메인 메뉴 상태 22)와 시즌 경기정보(상태 0xdd)가 **같은 함수**를 부른다 — 열기 0x5fef4(skin, 모드 칸)
 * 다음은 그리기·키가 모두 skin+0x2ba~ 칸만 본다. 그래서 웹도 이 창 하나를 둘이 같이 쓴다
 * (일반모드는 '0', 시즌은 '0' 과 처음 한 번 저절로 — R13 4절, 저장 +0x11e).
 *
 * 무엇을 고르면 경기에서 누가 치는지는 `features/play-team-game/model/matchSettings.ts` 가
 * 전부 가지고 있다. 이 창은 그 `MatchProgressSettings` 를 채워 `onConfirm` 으로 넘길 뿐이다.
 * 배치는 `matchSettingsLayout.ts` 머리말(0x6042c 를 떠서 옮긴 것) 그대로다.
 *
 * 마우스: **칸을 누르면 그 칸으로 커서를 옮기고 OK 를 누른 것과 같다** (원본 키 두 번을 한 번에 —
 * 웹판 판단). 키보드는 원본 그대로 ↑↓←→ · Enter(OK) · Esc(CLR) 다.
 */
export function MatchSettingsWindow({ settings, onConfirm, onClose }: MatchSettingsWindowProps) {
  const [state, setState] = useState<MatchSettingsWindowState>(() => openMatchSettings(settings))
  const textOrigins = useFrameOrigins(IMG_TEXT)
  const sltOrigins = useFrameOrigins(SLT_FRAMES)
  const popupOrigins = useFrameOrigins(POPUP_FRAMES)
  // 그릴 때마다 [skin+0x40c] += 1 뒤 `% 8 ≤ 4` — 앱에 하나인 스킨 칸이라 앞 화면(엔트리 편집기 · 순위 판 · 명전 몸 그림)이
  // 남긴 값에서 이어 센다 (`shared/lib/skinStepCounter`, 확정 r166)
  const isBlinkOn = isSettingsBlinkOn(useSkinStepDrawCounter(useUpdateCounter()))
  const filterId = `palette-${useId().replace(/:/g, '')}`

  const apply = (action: MatchSettingsAction) => {
    if (action.kind === '유지') return setState(action.state)
    if (action.kind === '닫기') return onClose()
    // 0x603b0: 상세 비트는 종류가 상세(2)일 때만 저장 칸에 되쓴다 — 나머지는 창을 열 때의 저장 값 그대로
    onConfirm(confirmedMatchSettings(settings, action.settings))
  }
  const press = (key: MatchSettingsKey) => apply(pressMatchSettingsKey(state, key))
  /** 커서를 그 자리로 옮기고 OK — 마우스 한 번이 원본 키 두 번을 대신한다 */
  const pressAt = (moved: MatchSettingsWindowState) => apply(pressMatchSettingsKey(moved, '확인'))
  useSettingsKeys(state.popup !== null, press)

  const { kind } = state.settings
  const isKindStage = state.stage === SETTINGS_STAGE.종류
  const isDetail = !isKindStage && kind === MATCH_SETTING_KIND.상세
  const board = isDetail ? DETAIL_WINDOW : SMALL_WINDOW
  const back = backButtonOf(board)
  const text = imgTextOf(textOrigins, filterId)
  const draw: SettingsDraw = { text, centeredText: centeredImgTextOf(text, textOrigins), sltOrigins, popupOrigins, isBlinkOn }
  return (
    <div role="group" aria-label="경기진행 설정" data-stage={state.stage} data-kind={kind}>
      <PaletteFilters id={filterId} />
      {/* 공용 판 0x55e60(skin, W/2, H/2, 0xc0, h, 0, 정렬 0x22, 0, 0, 제목 탭 1, 어둡게 1) — 네 부르는 자리
          6051e · 607fa · 60b30(h 0xa0) · 60e94(h 0xd4) 를 직접 떴다(알파 · 띠 자리는 [sp+0x88] = r7 = 0, 604c8) */}
      <CommonPanel x={board.x} y={board.y} width={board.width} height={board.height} titleTab dim testId="경기설정-판" />
      {draw.centeredText(TITLE.frame, TITLE.centerX, isDetail ? TITLE.detailY : TITLE.smallY, IMG_TEXT_PALETTE.파랑)}
      <SettingsBody draw={draw} state={state} isDetail={isDetail} pressAt={pressAt} />
      <Description layout={isDetail ? DETAIL_DESCRIPTION : SMALL_DESCRIPTION} raw={descriptionOf(state)} />

      <button
        type="button"
        className={styles.backButton}
        style={{ left: back.x, top: back.y, width: back.width, height: back.height }}
        onClick={() => press('취소')}
      >
        되돌아가기
      </button>

      <SettingsPopups popup={state.popup} onAnswer={(isYes) => apply(answerMatchSettingsPopup(state, isYes))} />
    </div>
  )
}

/**
 * 경기진행 설정 창을 화면 한 장으로 띄운다.
 * 원본은 경기정보 화면 위에 덮는 창이라, 경기정보를 함께 그릴 때는 `MatchSettingsWindow` 를 직접 쓴다.
 */
export function MatchSettingsScreen(props: MatchSettingsWindowProps) {
  return (
    <RawScreen>
      <MatchSettingsWindow {...props} />
    </RawScreen>
  )
}

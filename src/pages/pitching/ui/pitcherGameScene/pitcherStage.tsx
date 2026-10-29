import type { ReactElement } from 'react'
import { MessageBox, PressArea, RawScreen } from '@/shared/ui'
import { MENU_PRESS_RECT, TIME_PRESS_RECT } from '@/features/play-game/model/stagePressAreas'
import { InGameMenu } from '@/features/play-team-game/ui/InGameMenu'
import { SceneCloudCountingSpan } from '@/widgets/batting-stage/model/useSceneCloudCountingSpan'
import { RecordAlertStageOverlay } from '@/widgets/game-scene/ui/RecordAlertPanel'
import { ManagerHookWindow } from '@/pages/pitching/ui/ManagerHookWindow'
import { PressLayer } from '@/pages/pitching/ui/PressLayer'
import * as styles from '@/pages/pitching/ui/PitcherGameScreen.css'
import { HelpScreen } from './otherSlices'
import { PITCHER_CAREER_MODE } from './pitcherGameSceneProps'
import { pitcherInputSlotsOf } from './pitcherInputs'
import { renderPitcherSideStage } from './pitcherSideScene'
import type { PitcherSceneModel } from './usePitcherSceneModel'

/** StrGAME[104] (`base/extracted/StrGAME.json` 원문 그대로) — '#' 가지 0x49968 이 0x702b5(StrGAME, 0x68) 로 꺼낸다 */
const GIVE_UP_CONFIRM_TEXT = '!C그만 던지시겠습니까?'

/** 0xe — OK 하나를 받는다 (0x532b0). 원본 화면에 글자는 없다 — 마우스 길로 판 전체를 누름 칸으로 */
function renderConfirmPress(model: PitcherSceneModel): ReactElement | false {
  const { isAwaitingConfirm, sceneConfirm } = model.confirm
  return (
    isAwaitingConfirm &&
    !model.input.isPopupOpen &&
    !model.input.asksGiveUp && (
      <PressLayer testId="확인 누름 칸">
        <PressArea label="확인" isDisabled={!sceneConfirm.acceptsConfirm} onPress={sceneConfirm.confirm} />
      </PressLayer>
    )
  )
}

/**
 * 소프트키 — 장면이 그리는 "*MENU" · "#TIME" 글자 자리(0x4c8e0 · `softKeyLabels`)의 누름 칸. '*' 는 0x498d4 가 경기 중
 * 메뉴로(소프트키1 도 '*' 로 읽는다, 498e8), '#' 는 0xe · 0xf 에서 강판 물음(0x4994a → StrGAME[104]).
 * '*' 소프트키 — 공용 키 0x498d4 가 받는 동안(경기 장면 · 조작방법 뷰어가 아닐 때)
 */
function renderSoftKeys(model: PitcherSceneModel): ReactElement | false {
  const { menu, isMenuOpen, overlay, asksGiveUp } = model.input
  const acceptsMenuKey = !model.isSceneShowing && overlay !== '조작방법' && !asksGiveUp
  return (
    acceptsMenuKey && (
      <PressLayer testId="소프트키 누름 칸" isOnTop>
        <PressArea rect={MENU_PRESS_RECT} label={isMenuOpen ? '닫기' : '메뉴'} onPress={menu.pressStar} />
        {model.acceptsGiveUpKey && <PressArea rect={TIME_PRESS_RECT} label="# 강판" onPress={model.pressGiveUp} />}
      </PressLayer>
    )
  )
}

/** 경기 중 메뉴 — 나만의리그 투수편은 표 0xcfcfc 의 행 2 — 자동진행·다시하기가 없는 네 칸이다 */
function renderInGameMenu(model: PitcherSceneModel): ReactElement | false {
  const { onQuit, settings, onSettingsChange } = model.props
  const { menu, isMenuOpen, setOverlay } = model.input
  if (!isMenuOpen) return false
  const openSettings = () => {
    menu.close()
    setOverlay('설정')
  }
  return (
    <div className={styles.popupLayer}>
      <InGameMenu
        mode={PITCHER_CAREER_MODE}
        cursor={menu.cursor}
        slidesIn={menu.slidesIn}
        opening={menu.opening}
        bindCloser={menu.bindCloser}
        onCursorChange={menu.setCursor}
        onContinue={menu.close}
        onQuit={onQuit}
        onOpenHelp={() => {
          menu.close()
          setOverlay('조작방법')
        }}
        onOpenSettings={settings === undefined || onSettingsChange === undefined ? undefined : openSettings}
      />
    </div>
  )
}

/**
 * "그만 던지시겠습니까?" — 공용 키 0x498d4 의 '#' 가지 0x4994a: 모드 3([+0x1104] == 3)이면 0x49968 에서
 * `0xbbef8(0x702b5(StrGAME, 104), 종류 2(예/아니오), 팝업 id 0x1b, 1)` 로 시스템 예/아니오 팝업을 띄운다.
 * 답은 프레임 0x52c50 의 52c62~52c90 이 읽는다 — 팝업 id 0x1b 이고 답 칸 [창+0x21c] == 0(예)이면 0xc1b48(스스로 강판).
 * 아니오는 아무 일 없이 닫힌다. 처음 커서는 첫 칸 "예"(0x749d5 없음)
 */
function renderGiveUpBox(model: PitcherSceneModel): ReactElement | false {
  const { isPopupOpen, asksGiveUp, setAsksGiveUp } = model.input
  return (
    !isPopupOpen &&
    asksGiveUp && (
      <MessageBox
        text={GIVE_UP_CONFIRM_TEXT}
        buttons={['예', '아니오']}
        onAnswer={(index) => {
          setAsksGiveUp(false)
          if (index === 0) model.props.session.actions.giveUp()
        }}
      />
    )
  )
}

/** 0x16 → 0xd → 0xe 진입 0x50674 의 감독 강판 — 연출 뒤다 */
function renderManagerHook(model: PitcherSceneModel): ReactElement | false {
  const { progress, actions } = model.props.session
  const { managerHookText } = progress
  return (
    managerHookText !== null &&
    model.confirm.isManagerHookShown && <ManagerHookWindow userEventIndex={managerHookText} onConfirm={actions.confirmManagerHook} />
  )
}

/** 조작방법 뷰어 — 닫으면(0x3ca36: 0x637d0 ≠ 0) 하위 0 으로 돌아가 일시정지 팝업 0x741a0 을 다시 띄운다 (메뉴 객체는 안 건드려 커서가 그대로다) */
function renderHelp(model: PitcherSceneModel): ReactElement | false {
  const { overlay, setOverlay, menu } = model.input
  return (
    overlay === '조작방법' && (
      <HelpScreen
        onBack={() => {
          setOverlay(null)
          menu.reopen()
        }}
      />
    )
  )
}

/**
 * 경기 장면 한 장 — 원본은 240×320 경기 장면 한 장이다 — 웹 제목줄 · 배지 · 소프트키 막대 · 아웃/루/점수 글자 · B/S 램프 · 체력 막대는 없다.
 * 마우스 길은 장면 그림 자리의 투명한 누름 칸이다
 */
export function renderPitcherStage(model: PitcherSceneModel, burstWindow: ReactElement | null): ReactElement {
  const inputSlots = pitcherInputSlotsOf(model)
  const isManagerHookShown = model.confirm.isManagerHookShown
  return (
    <div className={styles.frame}>
      <RawScreen>
        {renderPitcherSideStage(model)}
        {renderConfirmPress(model)}
        {inputSlots[0]}
        {inputSlots[1]}
        {inputSlots[2]}
        {renderSoftKeys(model)}
        {renderInGameMenu(model)}
        {renderGiveUpBox(model)}
        {burstWindow}
        {/* 돌발 제안 0x1b · 타석 위 돌발 결과 0x1d 는 원본이 구름을 센다 — 아래 루프가 '대기' 가 아니어도 (Q-08) */}
        {burstWindow !== null && <SceneCloudCountingSpan />}
        {/* 감독 대사 0x23 도 원본이 구름을 센다 (Q-08) */}
        {isManagerHookShown && <SceneCloudCountingSpan />}
        {renderManagerHook(model)}
        {/* 경기 장면 프레임 0x52c50 의 덧그림 0x4e35c (0x53066) — 그리기 표 다음 · 팝업 0x746cd 앞. 판 안이라 기둥 없이.
            돌발 창 · 감독 강판 창(상태 그리기) 위, 경기 중 메뉴 · 강판 물음 상자(팝업) 아래 */}
        <RecordAlertStageOverlay frame={model.recordAlert} isUnderMenu={model.input.isMenuOpen} />
      </RawScreen>
      {renderHelp(model)}
    </div>
  )
}

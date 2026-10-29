import type { ReactElement } from 'react'
import { RawScreen } from '@/shared/ui'
import * as stageScreen from '@/features/play-game/ui/stageScreen.css'
import { RecordAlertStageOverlay } from '@/widgets/game-scene/ui/RecordAlertPanel'
import { SceneCloudCountingSpan } from '@/widgets/batting-stage/model/useSceneCloudCountingSpan'
import { autoProgressCostOf, canAutoProgress } from '@/features/play-team-game/model/teamGameFlow'
import { InGameMenu } from '@/features/play-team-game/ui/InGameMenu'
import * as styles from '@/pages/team-game/ui/TeamGameScreen.css'
import { renderBattingScene } from './battingScene'
import { HelpScreen } from './otherSlices'
import { renderPitchingScene } from './pitchingScene'
import { renderChangeWindowClouds, renderConfirmPress, renderSoftKeys, renderStealPress, renderSubstitutionWindow } from './sceneControls'
import { substitutionOverlayOf } from './stageOverlays'
import type { TeamGameSceneModel } from './useTeamGameSceneModel'

/** 경기 중 메뉴(표 0xcfcfc 행 0: 계속·자동진행·조작방법·설정·나가기 — I-controls 4c) */
function renderInGameMenu(model: TeamGameSceneModel): ReactElement | false {
  const { options, onQuit, settings, onSettingsChange, gamePoint, onSpendGamePoint, session } = model.props
  const { menu, isMenuOpen, setOverlay } = model.sceneMenu
  if (!isMenuOpen) return false
  const openSettings = () => {
    menu.close()
    setOverlay('설정')
  }
  const autoProgress = (cost: number) => {
    onSpendGamePoint?.(cost)
    model.walkers.setMenuRelayLoaded(model.walkers.atBatLoad?.loaded ?? null)
    session.actions.autoProgress()
    menu.close()
  }
  return (
    <div className={stageScreen.menuLayer}>
      <InGameMenu
        mode={options.mode}
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
        autoProgressCost={autoProgressCostOf(options.mode)}
        canAutoProgress={canAutoProgress(session.progress)}
        gamePoint={gamePoint}
        onAutoProgress={onSpendGamePoint === undefined ? undefined : autoProgress}
      />
    </div>
  )
}

/** 조작방법 뷰어(경기 중 메뉴 하위 4) — 경기 장면 위에 얹는다 */
function renderHelp(model: TeamGameSceneModel): ReactElement | false {
  const { overlay, setOverlay, menu } = model.sceneMenu
  return (
    overlay === '조작방법' && (
      <HelpScreen
        onBack={() => {
          // 뷰어를 닫으면(0x3ca36: 0x637d0 ≠ 0) 하위 0 으로 돌아가 일시정지 팝업 0x741a0 을 다시 띄운다 — 경기 중 메뉴로,
          // 메뉴 객체는 안 건드려 커서가 그대로다
          setOverlay(null)
          menu.reopen()
        }}
      />
    )
  )
}

/**
 * 사람 차례의 타석 장면 — 공격이면 타석, 수비면(또는 판이 섰지만 0x11 끝 · 0x12 · 0x13 을 그리는 동안) 사람 수비 타석 장면.
 * 그 밖(사람 차례가 아닌 틈)은 원본이면 상태 0x21 자동진행 중계다 — 웹 진행기는 늘 `liveAutoRelay` 로 0x21 을 세워
 * `TeamAutoRelay` 가 그린다. 여기에 남는 것은 경기가 끝나 요약이 서기 전 한 그림뿐이라 아무것도 그리지 않는다
 * (예전 웹 안내 "자동 진행 중…" 은 원본에 없다)
 */
function renderHumanScene(model: TeamGameSceneModel, isPopupOpen: boolean): ReactElement | null {
  const { canBat, canPitch } = model.props.session
  const substitutionOverlay = substitutionOverlayOf(model)
  if (canBat) return renderBattingScene(model, substitutionOverlay, isPopupOpen)
  if (canPitch || model.playHold.isPitchSceneBeforePlay) return renderPitchingScene(model, substitutionOverlay, isPopupOpen)
  return null
}

/** 사람 수비 타석 장면 위 기록 달성 알림 — 타석 장면은 제 안에 얹는다 */
function renderPitchingRecordAlert(model: TeamGameSceneModel): ReactElement | false {
  const { canBat, canPitch } = model.props.session
  const isPitchingScene = (canPitch || model.playHold.isPitchSceneBeforePlay) && !canBat
  return isPitchingScene && <RecordAlertStageOverlay frame={model.recordAlert} isUnderMenu={model.sceneMenu.isMenuOpen} />
}

/**
 * 경기 장면 한 장 — 원본은 240×320 경기 장면 한 장이다 — 웹 제목줄 · 배지 · 소프트키 막대 · 아웃/루/점수 글자 · B/S 램프 · 체력 막대 ·
 * 단계 제목 · 안내 글자는 없다. HUD 는 장면의 0x4c4bc(0x373d0), 지친 투수는 투수 위 체력 그림(0x38f68)이 그린다.
 * 마우스 길은 장면 그림 자리의 투명한 누름 칸이다 — 0xe 의 OK(화면 전체) · '*' 메뉴("*MENU") · '#' 교체 · 대타("#TIME") ·
 * 도루(점수판 루 그림) · 구질 · 조준 · 게이지(투구 부품 안) · 교체 창 줄
 */
export function renderTeamGameStage(model: TeamGameSceneModel, burstWindow: ReactElement | null): ReactElement {
  /** 경기 중 메뉴 · 조작방법 뷰어 — 일시정지 팝업 0x741a0 동안 장면 틱이 멈춘다 */
  const isPopupOpen = model.sceneMenu.isMenuOpen || model.sceneMenu.overlay === '조작방법'
  return (
    <div className={styles.frame}>
      <RawScreen>
        {renderHumanScene(model, isPopupOpen)}
        {renderPitchingRecordAlert(model)}
        {renderConfirmPress(model, isPopupOpen)}
        {renderStealPress(model, isPopupOpen)}
        {renderChangeWindowClouds(model)}
        {renderSubstitutionWindow(model)}
        {renderSoftKeys(model)}
        {renderInGameMenu(model)}
        {burstWindow}
        {/* 돌발 제안 0x1b · 타석 위 돌발 결과 0x1d 는 원본이 구름을 센다 — 아래 루프가 '대기' 가 아니어도 (Q-08) */}
        {burstWindow !== null && <SceneCloudCountingSpan />}
      </RawScreen>
      {renderHelp(model)}
    </div>
  )
}

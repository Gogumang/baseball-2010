import { RawScreen } from '@/shared/ui'
import * as styles from '@/pages/pitching/ui/PitcherGameScreen.css'
import { MISSION_PITCHER_MODE, missionHudLimitsOf } from './missionPitching'
import { HelpScreen, MissionHud } from './otherSlices'
import { ConfirmPressLayer, PitchingInputsLayer } from './PitchingInputsLayer'
import { PitchingMenuLayer } from './PitchingMenuLayer'
import { PitchingStageLayer } from './PitchingStageLayer'
import { isPitchMenuShownOf, type PitchingViewModel } from './pitchingViewModel'

/** 점수판 0x373d0 꼬리 0x378f0 → 0x36cb8(모드 5) → 0x36714 — 장면 오른쪽 위 미션 판 (타자 미션과 같은 그리기, 모드 5 갈래) */
function MissionHudLayer({ model }: { readonly model: PitchingViewModel }) {
  const { run, stage } = model.props
  if (stage === undefined) return null
  return (
    <MissionHud
      mode={MISSION_PITCHER_MODE}
      mission={run.mission}
      progress={run.progress}
      limits={missionHudLimitsOf(run)}
      remainingSeconds={run.remainingSeconds}
      stripsOnStage
      allowedRuns={run.allowed.runs}
      isFrozen={model.menuState.isPopupOpen}
      isDimmed={isPitchMenuShownOf(model)}
    />
  )
}

/**
 * 경기 중 화면 — 원본은 240×320 경기 장면 한 장이다. 웹 제목줄 · 남은 시간 배지 · 소프트키 막대 · 카운트 글자는 없다(카운트는 장면 HUD
 * 0x373d0). 목표는 HUD 꼬리의 미션 판 0x36714 가 장면 오른쪽 위에 그린다(`MissionGoalPanel`). 마우스 길은 장면 그림 자리의 투명한 누름 칸이다
 */
export function PitchingPlayView({ model }: { readonly model: PitchingViewModel }) {
  const { props, menuState } = model
  return (
    <div className={styles.frame}>
      <RawScreen>
        <PitchingStageLayer model={model} />
        <MissionHudLayer model={model} />
        <ConfirmPressLayer model={model} />
        <PitchingInputsLayer model={model} />
        <PitchingMenuLayer
          menuState={menuState}
          settings={props.settings}
          onSettingsChange={props.onSettingsChange}
          onGiveUp={props.onGiveUp}
          onRestart={props.onRestart}
        />
      </RawScreen>
      {menuState.overlay === '조작방법' && (
        <HelpScreen
          onBack={() => {
            // 뷰어를 닫으면(0x3ca36: 0x637d0 ≠ 0) 하위 0 으로 돌아가 일시정지 팝업 0x741a0 을 다시 띄운다 — 경기 중 메뉴로,
            // 메뉴 객체는 안 건드려 커서가 그대로다
            menuState.setOverlay(null)
            menuState.menu.reopen()
          }}
        />
      )}
    </div>
  )
}

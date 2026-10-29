import type { ReactElement } from 'react'
import { SubstitutionSceneOverlay } from '@/features/play-game/ui/SubstitutionSceneOverlay'
import { SceneMatchupCards } from '@/widgets/matchup-cards/ui/SceneMatchupCards'
import * as styles from '@/pages/pitching/ui/PitcherGameScreen.css'
import { PitchingStageView } from './PitchingStageView'
import type { PitchingViewModel } from './pitchingViewModel'

/**
 * 교체 연출 0x16 "CHANGE"(0x4da30) — 서 있으면 그리고 다 그리면 `onSubstitutionSceneDone`. 없으면 false(장면의 자식 칸이 옛 그림과 같은 값)
 */
function substitutionOverlayOf({ run, substitutionScene, onSubstitutionSceneDone }: PitchingViewModel['props']): ReactElement | false {
  if (run.status !== '진행중' || substitutionScene === null) return false
  return (
    <SubstitutionSceneOverlay key={substitutionScene.serial} aceSlot={substitutionScene.aceSlot ?? null} onDone={() => onSubstitutionSceneDone?.()} />
  )
}

/** 상태 0xe 소개 판 0x44944 — 값이 없으면 팀 글자만. 안 서면 false */
function matchupCardsOf({ props, isAwaitingConfirm, sceneConfirm }: PitchingViewModel): ReactElement | false {
  if (!isAwaitingConfirm || !sceneConfirm.isInConfirmState) return false
  return <SceneMatchupCards {...(props.matchupCards ?? { batterHand: 0, pitcher: { isComputer: false }, batter: { isComputer: true } })} />
}

/**
 * 타석 장면 · 교체 연출 · 소개 판 — 장면 재료가 없으면 예전 패널(판만). 소개 판은 일시정지 창 아래에도 남는다 —
 * 0x52efe 가 장면 그리기를 건너뛰어 마지막 그림(소개 판 포함)이 그대로다
 */
export function PitchingStageLayer({ model }: { readonly model: PitchingViewModel }) {
  const { props, sceneConfirm, isAwaitingConfirm } = model
  const { stage } = props
  const substitutionOverlay = substitutionOverlayOf(props)
  const matchupCards = matchupCardsOf(model)
  if (stage === undefined) {
    return (
      <>
        {substitutionOverlay !== false && <div className={styles.matchupFrame}>{substitutionOverlay}</div>}
        {matchupCards !== false && <div className={styles.matchupFrame}>{matchupCards}</div>}
      </>
    )
  }
  return (
    <PitchingStageView
      run={props.run}
      atBat={props.atBat}
      stage={stage}
      sceneDEntryMark={sceneConfirm.sceneDEntryMark}
      stealDisplay={props.stealDisplay}
      isPitchSceneBusy={model.isPitchSceneBusy}
      skyRow={props.skyRow}
      settings={props.settings}
      isAwaitingConfirm={isAwaitingConfirm}
      isPopupOpen={model.menuState.isPopupOpen}
      inputOverlayRef={model.inputOverlayRef}
      sceneConfirmWait={props.sceneConfirm}
      skillPanelScene={props.skillPanelScene}
    >
      {matchupCards}
      {substitutionOverlay}
    </PitchingStageView>
  )
}

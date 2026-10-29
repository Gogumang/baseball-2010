import type { ReactElement } from 'react'
import { canSelectSlot } from '@/features/play-pitcher-game/model/pitcherPitch'
import { pitchSlotsFor } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'
import { AimCursor } from '@/pages/pitching/ui/AimCursor'
import { PitchGradeGauge } from '@/pages/pitching/ui/PitchGradeGauge'
import { PitchSlotPicker } from '@/pages/pitching/ui/PitchSlotPicker'
import { PITCHER_CAREER_MODE } from './pitcherGameSceneProps'
import { stageBatterHandOf } from './pitcherStageCast'
import { slotChoices, slotTypeNumbersOf } from './pitchSlotChoices'
import type { PitcherSceneModel } from './usePitcherSceneModel'

/** 공을 놓는다 — 이 공으로 끝난 타석 결과를 0x12 대기 틱(`resultWaitTicksOf`)에 쓰도록 던지기 전 카운트를 적는다 */
function throwWithOf(model: PitcherSceneModel) {
  const { progress, actions } = model.props.session
  const { slot, aim, setPhase, setSlot, setAim } = model.input
  const { atBatBeforeThrowRef } = model.holds
  return (gaugeCell: number, throwAim: WorldPoint | null = aim) => {
    if (slot === null) return
    atBatBeforeThrowRef.current = progress.atBat
    actions.throwPitch({ typeNumber: slot.typeNumber, ...(throwAim === null ? {} : { aim: throwAim }), gaugeCell })
    setPhase('구질')
    setSlot(null)
    setAim(null)
  }
}

/** 0xf 구질 — 그림은 장면(0x4c4bc 4c528~)이 그리고 여기는 키 · 틱 · 누름 칸만 */
function renderSlotPicker(model: PitcherSceneModel): ReactElement {
  const { progress } = model.props.session
  const { isPitchInputPaused, input } = model
  return (
    <div hidden={isPitchInputPaused}>
      <PitchSlotPicker
        choices={slotChoices(progress.magicRemaining, pitchSlotsFor(progress))}
        isPaused={isPitchInputPaused}
        // 장면 배치 — 타자 손(0xb63c0). 구질 목록 누름 칸이 투수 앵커 0xcfb18[이 값] 둘레에 선다 (`PitcherSideStage` 와 같은 값)
        stageSide={stageBatterHandOf(progress)}
        overlay={{ ref: input.inputOverlayRef, typeNumbers: slotTypeNumbersOf(pitchSlotsFor(progress)), magicRemaining: progress.magicRemaining }}
        onDecide={(chosen) => {
          const found = pitchSlotsFor(progress).find((candidate) => candidate.slot === chosen)
          if (found === undefined || !canSelectSlot(found, progress.magicRemaining)) return
          input.setSlot(found)
          input.setPhase('코스')
        }}
      />
    </div>
  )
}

/** 0x10 조준 — 그림은 장면 0x4d780 */
function renderAimCursor(model: PitcherSceneModel): ReactElement {
  const { progress, actions } = model.props.session
  const { isPitchInputPaused, input } = model
  return (
    <div hidden={isPitchInputPaused}>
      <AimCursor
        side={progress.options.stageSide ?? 1}
        isPaused={isPitchInputPaused}
        overlay={{ ref: input.inputOverlayRef, typeNumber: input.slot?.typeNumber ?? 0 }}
        onConfirm={(confirmed) => {
          // OK(0x50e9c)는 늘 0x11 로 간다(0x50ed0) — 게이지를 안 쓰는 공(게이지 끔 · 마구 0x3f500 의 `구질 != 22`)도
          // 0x11 의 틱 10 에 놓는다(0x4e060). 게이지 그림만 0x4d3f8 에서 건너뛴다
          input.setAim(confirmed)
          input.setPhase('게이지')
        }}
        // CLR(0x50ee0) — 0xf 로 돌아가 0xf 진입 0x3d954 가 다시 돈다
        onCancel={() => {
          input.setPhase('구질')
          input.setSlot(null)
          actions.returnToPitchSelection()
        }}
      />
    </div>
  )
}

/** 0x11 게이지 — 그림은 장면 0x4d2ac. 이 공이 게이지를 쓰는가 (`0x3f500` — 게이지 켬 ∧ 마구 아님). 안 써도 0x11 은 지나 틱 10 에 놓는다 */
function renderGauge(model: PitcherSceneModel): ReactElement {
  const { options, session } = model.props
  const { isPitchInputPaused, input } = model
  const { aim, slot } = input
  const throwWith = throwWithOf(model)
  const overlay = {
    ref: input.inputOverlayRef,
    aimSide: session.progress.options.stageSide ?? 1,
    gaugeSettingOn: options.gaugeSettingOn === true,
    gameMode: PITCHER_CAREER_MODE,
    // [경기+0xfc8] == 22 — 놓기 전 0x11 그림의 마구 공 파티클(Q-09)
    isMagicPitch: slot?.isMagic === true,
  }
  return (
    <div hidden={isPitchInputPaused}>
      <PitchGradeGauge
        isPaused={isPitchInputPaused}
        showsGauge={options.gaugeSettingOn === true && slot?.isMagic !== true}
        onRelease={(gaugeCell) => throwWith(gaugeCell)}
        {...(aim === null ? {} : { overlay: { ...overlay, aim } })}
      />
    </div>
  )
}

/** 구질 고르기가 서는가 — 0xe 대기 · 내 공(0x11 · 0x12) 동안은 내린다 */
const isSlotPickerShown = (model: PitcherSceneModel) =>
  model.props.session.canPitch && !model.confirm.isAwaitingConfirm && !model.wait.isPitchSceneBusy && model.input.phase === '구질'

/** 투구 입력 세 칸(구질 · 코스 · 게이지) — 장면 판의 제 자리에 따로 선다(옛 모양 그대로 — 단계가 바뀌면 앞 칸이 내리고 새 칸이 선다) */
export function pitcherInputSlotsOf(model: PitcherSceneModel): readonly [ReactElement | false, ReactElement | false, ReactElement | false] {
  const { canPitch } = model.props.session
  const { phase } = model.input
  return [
    isSlotPickerShown(model) && renderSlotPicker(model),
    canPitch && phase === '코스' && renderAimCursor(model),
    canPitch && phase === '게이지' && renderGauge(model),
  ]
}

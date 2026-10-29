import type { ReactElement } from 'react'
import { canSelectSlot, type PitchSlot } from '@/features/play-pitcher-game/model/pitcherPitch'
import { pitchSlotsFor } from '@/features/play-team-game/model/teamGameFlow'
import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'
import { teamPitcherSideStageOf } from '@/pages/team-game/lib/teamMatchupCards'
import { AimCursor, PitchGradeGauge, PitchSlotPicker } from './otherSlices'
import { slotChoices, slotTypeNumbersOf } from './pitchSlotChoices'
import type { TeamGameSceneModel } from './useTeamGameSceneModel'

/** 공을 놓는다 — 던질 때의 타석 · 판정 대기 칸을 적고 진행기에 넘긴 뒤 투구 1단계로 */
function throwWithOf(model: TeamGameSceneModel) {
  const { progress, actions } = model.props.session
  const { slot, aim, setPhase, setSlot, setAim } = model.pitchInput
  const { atBatBeforeThrowRef, isThrowPendingRef, isThrowPitchEndPendingRef } = model.throwSettle
  return (gaugeCell: number, throwAim: WorldPoint | null = aim) => {
    if (slot === null) return
    atBatBeforeThrowRef.current = progress.atBat
    isThrowPendingRef.current = true
    isThrowPitchEndPendingRef.current = true
    actions.throwPitch({ typeNumber: slot.typeNumber, ...(throwAim === null ? {} : { aim: throwAim }), gaugeCell })
    setPhase('구질')
    setSlot(null)
    setAim(null)
  }
}

/** 구질 고르기(0xf) — 칸 키 0x534d8. 못 던지는 칸(마구 0회)은 먹고 끝난다 */
function renderSlotPicker(model: TeamGameSceneModel, isPopupOpen: boolean): ReactElement {
  const { progress } = model.props.session
  const teamStage = teamPitcherSideStageOf(progress)
  return (
    <PitchSlotPicker
      choices={slotChoices(progress.magicRemaining, pitchSlotsFor(progress))}
      isPaused={isPopupOpen}
      stageSide={teamStage.batterSide ?? teamStage.batterForm & 1}
      overlay={{
        ref: model.inputOverlayRef,
        typeNumbers: slotTypeNumbersOf(pitchSlotsFor(progress)),
        magicRemaining: progress.magicRemaining,
      }}
      onDecide={(chosen) => {
        const found = pitchSlotsFor(progress).find((candidate: PitchSlot) => candidate.slot === chosen)
        if (found === undefined || !canSelectSlot(found, progress.magicRemaining)) return
        model.pitchInput.setSlot(found)
        model.pitchInput.setPhase('코스')
      }}
    />
  )
}

/** 코스 고르기(0x10) — OK 는 0x11 로, CLR 은 구질 고르기(0xf)로 */
function renderAimCursor(model: TeamGameSceneModel, isPopupOpen: boolean): ReactElement {
  const { options, session } = model.props
  const { pitchInput } = model
  return (
    <AimCursor
      side={options.stageSide ?? 1}
      isPaused={isPopupOpen}
      overlay={{ ref: model.inputOverlayRef, typeNumber: pitchInput.slot?.typeNumber ?? 0 }}
      onConfirm={(confirmed) => {
        // OK(0x50e9c)는 늘 0x11 로 간다(0x50ed0) — 게이지를 안 쓰는 공(게이지 끔 · 마구 0x3f500 의 `구질 != 22`)도
        // 0x11 의 틱 10 에 놓는다(0x4e060). 게이지 그림만 0x4d3f8 에서 건너뛴다
        pitchInput.setAim(confirmed)
        pitchInput.setPhase('게이지')
      }}
      // CLR(−16)은 구질 고르기(0xf)로 되돌린다 (0x50ee0~0x50ee6) — 0xf 진입 0x3d954 가 다시 돈다
      onCancel={() => {
        pitchInput.setPhase('구질')
        pitchInput.setSlot(null)
        session.actions.returnToPitchSelection()
      }}
    />
  )
}

/** 게이지(0x11) — 이 공이 게이지를 쓰는가 (`0x3f500` — 게이지 켬 ∧ 마구 아님). 안 써도 0x11 은 지나 틱 10 에 놓는다 */
function renderGauge(model: TeamGameSceneModel, isPopupOpen: boolean): ReactElement {
  const { options } = model.props
  const { aim, slot } = model.pitchInput
  const showsGauge = options.gaugeSettingOn === true && slot?.isMagic !== true
  const throwWith = throwWithOf(model)
  const overlay = {
    ref: model.inputOverlayRef,
    aimSide: options.stageSide ?? 1,
    gaugeSettingOn: options.gaugeSettingOn === true,
    gameMode: options.mode,
    // [경기+0xfc8] == 22 — 놓기 전 0x11 그림의 마구 공 파티클(Q-09)
    isMagicPitch: slot?.isMagic === true,
  }
  return (
    <PitchGradeGauge
      isPaused={isPopupOpen}
      showsGauge={showsGauge}
      onRelease={(gaugeCell) => throwWith(gaugeCell)}
      {...(aim === null ? {} : { overlay: { ...overlay, aim } })}
    />
  )
}

/** 구질 고르기가 서는가 — 0xe 대기 · 내 공(0x11 · 0x12) · 교체 창 0xb 동안은 내린다 */
const isSlotPickerShown = (model: TeamGameSceneModel) =>
  model.props.session.canPitch &&
  model.pitchInput.phase === '구질' &&
  !model.confirmFlow.isAwaitingConfirm &&
  !model.throwSettle.isPitchSceneBusy &&
  model.change.changeWindow === null

/**
 * 투구 입력 세 칸(구질 · 코스 · 게이지) — 그림은 장면이 그린다. 부품은 키 · 틱과 그림 자리의 투명한 누름 칸만 낸다 (교체 창 0xb 동안은
 * 내린다). 팝업(경기 중 메뉴 · 조작방법) 동안은 숨긴 채 선다 — 단계 상태와 조준점 · 게이지 틱은 그대로다.
 * 세 칸은 장면 자식의 제 자리에 따로 선다(옛 모양 그대로 — 단계가 바뀌면 앞 칸이 내리고 새 칸이 선다)
 */
export function pitchInputSlotsOf(
  model: TeamGameSceneModel,
  isPopupOpen: boolean,
): readonly [ReactElement | false, ReactElement | false, ReactElement | false] {
  const { canPitch } = model.props.session
  const { phase } = model.pitchInput
  return [
    isSlotPickerShown(model) && <div hidden={isPopupOpen}>{renderSlotPicker(model, isPopupOpen)}</div>,
    canPitch && phase === '코스' && <div hidden={isPopupOpen}>{renderAimCursor(model, isPopupOpen)}</div>,
    canPitch && phase === '게이지' && <div hidden={isPopupOpen}>{renderGauge(model, isPopupOpen)}</div>,
  ]
}

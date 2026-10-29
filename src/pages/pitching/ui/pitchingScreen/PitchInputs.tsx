import type { PitchTypeInfo } from '@/shared/config/original/pitchTypes'
import { AimCursor } from '@/pages/pitching/ui/AimCursor'
import { PitchGradeGauge } from '@/pages/pitching/ui/PitchGradeGauge'
import { PitchSlotPicker } from '@/pages/pitching/ui/PitchSlotPicker'
import { MISSION_PITCHER_MODE } from './missionPitching'
import { isBlockedMagicOf, slotChoicesOf, slotTypeNumbersOf, typeNumberOf } from './pitchSlots'
import type { PitchingViewModel } from './pitchingViewModel'

/** 장면 배치 — 타자 손(0xb63c0). 구질 목록 누름 칸이 투수 앵커 0xcfb18[이 값] 둘레에 선다 (`PitcherSideStage` 와 같은 값) */
const stageSideOf = ({ stage }: PitchingViewModel['props']) => (stage === undefined ? 1 : (stage.batterSide ?? stage.batterForm & 1))

/** 고른 구질이 마구(22)인가 */
const isMagicPitchOf = ({ props, pitchType }: PitchingViewModel) => pitchType !== null && props.isMagicType?.(pitchType) === true

/** 이 공이 게이지를 쓰는가 (`0x3f500` — 게이지 켬 ∧ 마구 아님). 안 써도 0x11 은 지나 틱 10 에 놓는다 */
const showsGaugeOf = (model: PitchingViewModel) => model.props.usesGauge && model.pitchType !== null && !isMagicPitchOf(model)

/** 0xf 구질 — 그림은 장면(0x4c4bc 4c528~)이 그리고 여기는 키 · 틱 · 누름 칸만 */
export function SlotSection({ model }: { readonly model: PitchingViewModel }) {
  const { props, setPitchType, setPhase, inputOverlayRef } = model
  const isPopupOpen = model.menuState.isPopupOpen
  const choices = slotChoicesOf(props)
  const decide = (chosen: number) => {
    const found: PitchTypeInfo | undefined = props.repertoire[choices.findIndex((choice) => choice.slot === chosen)]
    if (found === undefined || isBlockedMagicOf(props, found)) return
    setPitchType(found)
    setPhase('코스')
  }
  return (
    <div hidden={isPopupOpen}>
      <PitchSlotPicker
        choices={choices}
        isPaused={isPopupOpen}
        stageSide={stageSideOf(props)}
        {...(props.stage === undefined
          ? {}
          : { overlay: { ref: inputOverlayRef, typeNumbers: slotTypeNumbersOf(props), magicRemaining: props.magicRemaining ?? 0 } })}
        onDecide={decide}
      />
    </div>
  )
}

/** 0x10 조준 — 그림은 장면 0x4d780 */
export function AimSection({ model }: { readonly model: PitchingViewModel }) {
  const { props, pitchType, setAim, setPhase, setPitchType, inputOverlayRef } = model
  const isPopupOpen = model.menuState.isPopupOpen
  return (
    <div hidden={isPopupOpen}>
      <AimCursor
        side={props.aimSide}
        isPaused={isPopupOpen}
        {...(props.stage === undefined ? {} : { overlay: { ref: inputOverlayRef, typeNumber: typeNumberOf(props, pitchType) } })}
        {...(props.onAimTick === undefined ? {} : { onTick: props.onAimTick })}
        onConfirm={(confirmed) => {
          // OK(0x50e9c)는 늘 0x11 로 간다(0x50ed0) — 게이지를 안 쓰는 공(게이지 끔 · 마구 0x3f500 의 `구질 != 22`)도
          // 0x11 의 틱 10 에 놓는다(0x4e060). 그때 등급은 제구·체력 표로 뽑힌다 (0x4dbac)
          if (pitchType === null) return
          setAim(confirmed)
          setPhase('게이지')
        }}
        // CLR(0x50ee0) — 0xf 로 돌아가 0xf 진입 0x3d954 가 다시 돈다
        onCancel={() => {
          setPhase('구질')
          setPitchType(null)
          props.onReturnToPitchSelection?.()
        }}
      />
    </div>
  )
}

/** 0x11 게이지 — 그림은 장면 0x4d2ac. 원본에는 결과 글자가 없다 (S5 U-15) */
export function GaugeSection({ model }: { readonly model: PitchingViewModel }) {
  const { props, pitchType, aim, setPhase, setPitchType, setAim, inputOverlayRef } = model
  const isPopupOpen = model.menuState.isPopupOpen
  const showsGauge = showsGaugeOf(model)
  /** 게이지가 놓을 때(틱 10) 정한 칸 g 를 그대로 넘긴다 (0x50e08 — 못 정했으면 0) */
  const throwPitch = (gaugeCell: number) => {
    if (pitchType === null || aim === null) return
    props.onThrow(pitchType, aim, showsGauge ? gaugeCell : 0, showsGauge)
    setPhase('구질')
    setPitchType(null)
    setAim(null)
  }
  return (
    <div hidden={isPopupOpen}>
      <PitchGradeGauge
        isPaused={isPopupOpen}
        showsGauge={showsGauge}
        onRelease={throwPitch}
        {...(props.stage === undefined || aim === null
          ? {}
          : {
              overlay: {
                ref: inputOverlayRef,
                aim,
                aimSide: props.aimSide,
                gaugeSettingOn: props.usesGauge,
                gameMode: MISSION_PITCHER_MODE,
                // [경기+0xfc8] == 22 — 놓기 전 0x11 그림의 마구 공 파티클(Q-09)
                isMagicPitch: isMagicPitchOf(model),
              },
            })}
      />
    </div>
  )
}

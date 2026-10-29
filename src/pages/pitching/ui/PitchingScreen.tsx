import { useState } from 'react'
import type { PitchTypeInfo } from '@/shared/config/original/pitchTypes'
import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'
import { useSceneConfirm } from '@/features/play-game/model/useSceneConfirm'
import { useSettlementEffectLayers } from '@/widgets/batting-stage/model/useSettlementEffectLayers'
import { useSkillCheerRestore } from '@/widgets/batting-stage/model/useSkillCheerRestore'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { usePitchInputOverlayRef } from '@/pages/pitching/model/pitchInputOverlayRef'
import type { PitchPhase } from './pitchingScreen/missionPitching'
import { MissionResultView } from './pitchingScreen/MissionResultView'
import { SettingsScreen } from './pitchingScreen/otherSlices'
import { PitchingPlayView } from './pitchingScreen/PitchingPlayView'
import type { PitchingScreenProps } from './pitchingScreen/pitchingScreenProps'
import type { ResolvedPitchingProps } from './pitchingScreen/pitchingViewModel'
import { useMissionLiveInning, useMissionLiveSides } from './pitchingScreen/useMissionLiveGame'
import { usePickoffKeys } from './pitchingScreen/usePickoffKeys'
import { usePitchSceneBusy } from './pitchingScreen/usePitchSceneBusy'
import { useMenuStarKey, usePitchingMenu } from './pitchingScreen/usePitchingMenu'

export type { PitchingStageSource } from './pitchingScreen/pitchingScreenProps'

/** 기본값을 채운다 — 조준 칸 1 · 교체 연출 없음 · 도루 표시 없음 */
const resolvedPropsOf = (props: PitchingScreenProps): ResolvedPitchingProps => ({
  ...props,
  aimSide: props.aimSide ?? 1,
  substitutionScene: props.substitutionScene ?? null,
  stealDisplay: props.stealDisplay ?? null,
})

/** 경기 키를 받는 때 — 0xe(OK 대기) · 일시정지 팝업 · 공이 날거나 0x12 · 0x13 인 동안은 안 받는다 */
const acceptsSceneKeys = (isAwaitingConfirm: boolean, isPopupOpen: boolean, isPitchSceneBusy: boolean) =>
  !isAwaitingConfirm && !isPopupOpen && !isPitchSceneBusy

/**
 * **상태 0xe — 새 타석마다 사람 OK 를 기다린다** (0x39e14 → 0x532b0 — 공수·모드 갈림 없음). 결과 연출 동안은 받지 않는다.
 * 교체 연출 0x16 동안은 0xd · 0xe 가 아니다 — 연출이 끝난 뒤부터 0xd 두 그림을 센다
 */
const countsSceneConfirm = (props: ResolvedPitchingProps, isPopupOpen: boolean, isPitchSceneBusy: boolean) =>
  props.run.status === '진행중' && props.bannerText === '' && !isPopupOpen && props.substitutionScene === null && !isPitchSceneBusy

/** 경기 중 메뉴의 "설정"(0x3c326) 화면을 띄울 때의 재료 — 설정 값과 바꿈 손잡이가 다 있어야 칸이 열린다. 아니면 null */
function settingsOverlayOf({ settings, onSettingsChange }: ResolvedPitchingProps, overlay: string | null) {
  if (overlay !== '설정' || settings === undefined || onSettingsChange === undefined) return null
  return { settings, onSettingsChange }
}

/**
 * 투구 화면. 원본 경기 상태 셋을 그대로 따른다 (나리 투수편 `PitcherGameScreen` 과 같다):
 *   0xf 구질 — 칸마다 정해진 키, 틱 8 뒤 넘김 (`PitchSlotPicker`)
 *   0x10 조준 — 방향키로 흐르는 조준점, OK 확정 · CLR 은 0xf 로 (`AimCursor`). 투수 미션은 매 틱 흔들린다(0x39c5c)
 *   0x11 게이지 — OK 로 칸을 정하고 틱 10 에 놓는다 (`PitchGradeGauge`)
 *
 * 게이지가 넘겨 주는 것은 **누른 칸 g(0~9)** 하나다 — 원본에는 PERFECT/GOOD/BAD 라는
 * 글자도 판정도 없다 (S5 U-15 확정, 누름 0x50e08). 등급 t = max(g−4, 1) 은 부르는 쪽
 * (`pitcherPitch.pitchGradeOf`)이 원본 자리에서 뽑는다. 나리 투수편 `PitcherGameScreen` 과 같다.
 *
 * 기록 달성 알림 0x4e35c 는 붙이지 않는다 — 프레임 0x52c50 이 미션(모드 5·6)에서도 부르지만 지급 0xa77f0 이
 * a780a(`state[1] ∈ {5,6,7}` → 끝)에서 막아 줄도 G 누계도 늘 비어 있다(R8 1절) → 원본도 판이 안 선다.
 */
export function PitchingScreen(rawProps: PitchingScreenProps) {
  const props = resolvedPropsOf(rawProps)
  const { run, substitutionScene, skillPanelScene } = props
  // 교체 연출 0x16 진입 0x3d458 의 CPU 대타 가지 0x668cc (`SubstitutionScene.cheerRestore`)
  useSkillCheerRestore(substitutionScene, skillPanelScene)
  useMissionLiveInning(run)
  const [phase, setPhase] = useState<PitchPhase>('구질')
  const inputOverlayRef = usePitchInputOverlayRef()
  const [pitchType, setPitchType] = useState<PitchTypeInfo | null>(null)
  const [aim, setAim] = useState<WorldPoint | null>(null)
  const menuState = usePitchingMenu(props.onPopupFrozenChange)
  const { isPopupOpen } = menuState
  const isRunning = run.status === '진행중'
  const isPitchSceneBusy = usePitchSceneBusy(props.stage, isPopupOpen)
  // 결과 배경 캔버스의 난수 — 하늘 줄은 세션이 장면마다 한 번 굴린 `skyRow` 를 넘기므로 여기서 굴리지 않는다(넘기지 않은
  // 화면만 이 따로 든 난수로 굴린다 — 경기 난수에 새지 않게)
  const [backdropRandom] = useState(() => createSeededRandom(0))
  /** 정산 효과 층(비 · 파티클) — 결과 배경 타석 캔버스와 미션 결과 판이 같이 쓴다 (원본 그리기 차례 0x4a384) */
  const settlementLayers = useSettlementEffectLayers()
  useMenuStarKey(menuState, isRunning)
  const sceneConfirm = useSceneConfirm(props.sceneConfirm, countsSceneConfirm(props, isPopupOpen, isPitchSceneBusy), props.onSceneConfirm)
  const isAwaitingConfirm = sceneConfirm.isAwaiting && isRunning
  // 견제 — 구질 고르기(0xf)에서만. 끝난 미션(결과 화면)·0xe(OK 대기)는 키를 안 받는다
  const acceptsPickoff =
    props.onPickoffKey !== undefined && phase === '구질' && isRunning && acceptsSceneKeys(isAwaitingConfirm, isPopupOpen, isPitchSceneBusy)
  usePickoffKeys(acceptsPickoff, props.onPickoffKey, run.bases)
  useMissionLiveSides(run)

  if (!isRunning) {
    return (
      <MissionResultView
        run={run}
        skyRow={props.skyRow}
        random={props.random}
        backdropRandom={backdropRandom}
        settlementLayers={settlementLayers}
        resultBoard={props.resultBoard}
        onRetry={props.onRetry}
        onFinish={props.onFinish}
      />
    )
  }

  // 경기 중 메뉴의 "설정"(0x3c326). "조작방법"(0x3c212)은 경기 장면 위에 얹는다(`PitchingPlayView`)
  const settingsOverlay = settingsOverlayOf(props, menuState.overlay)
  if (settingsOverlay !== null) {
    return (
      <SettingsScreen
        settings={settingsOverlay.settings}
        onChange={settingsOverlay.onSettingsChange}
        onResetCareer={() => {}}
        onBack={() => {
          // [설정]에서 CLR(0x3cb0e)도 하위 0 · 팝업 0x741a0 을 다시 띄운다 — 경기 중 메뉴로, 커서는 그대로
          menuState.setOverlay(null)
          menuState.menu.reopen()
        }}
      />
    )
  }

  return (
    <PitchingPlayView
      model={{
        props,
        phase,
        setPhase,
        pitchType,
        setPitchType,
        aim,
        setAim,
        inputOverlayRef,
        menuState,
        sceneConfirm,
        isAwaitingConfirm,
        isPitchSceneBusy,
      }}
    />
  )
}

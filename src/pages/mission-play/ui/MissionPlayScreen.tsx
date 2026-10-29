import { useEffect, useRef, useState } from 'react'
import { pushSceneKey } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'
import { inputTimeOf } from '@/shared/lib/sceneKeyLatch/shownSceneTicks'
import { RawScreen } from '@/shared/ui'
import * as stageScreen from '@/features/play-game/ui/stageScreen.css'
import { MissionHud } from '@/pages/mission-play/ui/MissionHud'
import { useInGameMenuOpenOnHide, useInGameMenuState } from '@/features/play-team-game/model/useInGameMenuState'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import { useSceneConfirm } from '@/features/play-game/model/useSceneConfirm'
import { useSettlementEffectLayers } from '@/widgets/batting-stage/model/useSettlementEffectLayers'
import { useMarksCommonWindowShown, useMarksGameScene } from '@/shared/lib/commonWindow/commonWindow'
import type { MissionPlayScreenProps } from './missionPlay/missionPlayProps'
import { useMissionLiveGame } from './missionPlay/useMissionLiveGame'
import { useMissionPlayKeys } from './missionPlay/useMissionPlayKeys'
import { MissionStage } from './missionPlay/MissionStage'
import { MissionMenuLayer } from './missionPlay/MissionMenuLayer'
import type { MissionMenuOverlay } from './missionPlay/MissionMenuLayer'
import { MissionPressAreas, MissionResultLayer, MissionSceneOverlays } from './missionPlay/MissionPlayLayers'
import { HelpScreen, SettingsScreen } from './missionPlay/otherSlices'
import {
  canCountSceneConfirmOf,
  canOpenSettingsOf,
  isMenuOpenableOf,
  isStagePausedOf,
  isSubstitutingOf,
  missionHudLimitsOf,
} from './missionPlay/missionPlayFlags'

/** 미션 타자편 경기 장면(0x104, 모드 6) — 타석 캔버스(`MissionStage`) 위에 미션 HUD · 0xe 소개 판 · 결과 판 · 경기 중 메뉴를 얹는다 */
export function MissionPlayScreen(props: MissionPlayScreenProps) {
  const { run, isPaused, onSteal, onPopupFrozenChange } = props
  const stealableBases = props.stealableBases ?? []
  useMissionLiveGame(run)
  const menu = useInGameMenuState()
  // 경기 장면 0x104 — 생성자 0x3301c 가 [창+0x24f] = 1 (공용 창이 줄임 없이 닫힌다)
  useMarksGameScene()
  const isMenuOpen = menu.isOpen
  const [overlay, setOverlay] = useState<MissionMenuOverlay | null>(null)
  // [조작방법] · [설정] 동안도 일시정지 창이 떠 있다(0x3c212 · 0x3c326 이 대기 칸으로 다시 띄운다 — I 4c-3) — 공용 창 [0x140005c]+9
  useMarksCommonWindowShown(overlay !== null)
  usePopupFrozenNotice(isMenuOpen, overlay, onPopupFrozenChange)
  const isOver = run.status !== '진행중'
  const hudLimits = missionHudLimitsOf(run)
  /** [미션+0xbc] — 결과 판 · 정산 효과의 "이겼나" (0x4ea0c 4ef2a · 0x4a384 4a3ea) */
  const isSuccess = run.status === '성공'
  /** 정산 효과 층(비 · 파티클) — 결과 배경 타석 캔버스와 미션 결과 판이 같이 쓴다 (원본 그리기 차례 0x4a384) */
  const settlementLayers = useSettlementEffectLayers()
  // 교체 연출 0x16 동안은 0xd · 0xe 가 아니다 — 연출이 끝난 뒤부터 0xd 두 그림을 센다
  const isSubstituting = isSubstitutingOf(isOver, props)
  /**
   * **상태 0xe — 새 타석마다 사람 OK 를 기다린다** (0x39e14 → 0x532b0, 모드 갈림 없음). 0xe 그리기 0x4d9ec 가 0xd 그리기 위에
   * 얹는 소개 판 0x44944 는 `MissionSceneOverlays` 가 그린다.
   */
  const sceneConfirm = useSceneConfirm(
    props.sceneConfirm,
    canCountSceneConfirmOf(isOver, isPaused, props.bannerText, isMenuOpen, overlay, isSubstituting),
    props.onSceneConfirm,
  )
  const isAwaitingConfirm = sceneConfirm.isAwaiting && !isOver
  /** 타석 화면이 채우는 "공이 나는 동안(상태 0x11)인가" — 원본 도루 키 0x53610 은 이때만 받는다 */
  const flightProbeRef = useRef<(() => boolean) | null>(null)
  /** `event` — 누름 칸의 사건(닿은 시각이 붙어 있다 — `PressArea`). 키는 창 잡기 단계가 이미 사건 시각으로 칸을 넣었다 */
  const stealIfFlying = (base: StealBase, event?: Event) => {
    // 도루 키는 장면 키 칸에 든다 — 다음 틀의 키 0x498d4 → 0x53670 → 0x53610 이 그 틀의 상태(0x11)를 보고 출발시킨다
    pushSceneKey(
      () => {
        if (flightProbeRef.current?.() === true) onSteal(base)
      },
      'press',
      event === undefined ? undefined : inputTimeOf(event),
    )
  }
  // 단말 일시정지 0x463ac — 끝난 미션(결과 판) 밖이고 하위 창이 없으면 같은 메뉴를 연다
  useInGameMenuOpenOnHide(menu, isMenuOpenableOf(isOver, overlay))
  useMissionPlayKeys(isOver, overlay, isMenuOpen, stealableBases, onSteal, menu.pressStar, stealIfFlying)
  /** 하위 창(조작방법 0x3637d0 · 설정 0x3cb0e)을 닫으면 하위 0 으로 돌아가 일시정지 팝업 0x741a0 을 다시 띄운다 — 경기 중 메뉴로, 커서는 그대로 */
  const backToMenu = () => {
    setOverlay(null)
    menu.reopen()
  }

  // 경기 중 메뉴의 "설정"(0x3c326) 은 경기 장면 대신 선다. "조작방법"(0x3c212)은 아래에서 경기 장면 위에 얹는다
  if (overlay === '설정' && canOpenSettingsOf(props)) {
    return <SettingsScreen settings={props.settings!} onChange={props.onSettingsChange!} onResetCareer={() => {}} onBack={backToMenu} />
  }

  return (
    <>
      <RawScreen>
        {/* 타석 캔버스 — RawScreen 판 (0, 0) 에 맞춘다(`stageScreen.css`) */}
        <div className={stageScreen.canvasSlot}>
          <MissionStage
            props={props}
            hudLimits={hudLimits}
            isOver={isOver}
            isSuccess={isSuccess}
            isStagePaused={isStagePausedOf(isPaused, isOver, overlay, isAwaitingConfirm, isSubstituting)}
            shiftResetSerial={sceneConfirm.sceneDEntryMark}
            settlementLayers={settlementLayers}
            flightProbeRef={flightProbeRef}
          />
        </div>

        {/*
          미션 HUD 0x36714 — 점수판 0x373d0 끝(0x378f0 → 0x36cb8, 모드 5 · 6)에서 그린다: 오른쪽 위 판에 목표 글 한 줄 · 노란
          "지금/목표" · 타석 · 스윙 한도 띠, 시간 제한이면 왼쪽 시계. 결과(0x19) 그림 0x4a384 는 점수판을 안 그려 HUD 도 없다.
          웹 제목줄(미션 이름) · 배지(남은 초 · 타석 · 스윙)와 껍데기 목표 띠(옛 GoalBar, 지금은 지웠다)는 걷었다 — 그 값은 이 판이 그린다.
        */}
        {!isOver && (
          <MissionHud mission={run.mission} progress={run.progress} limits={hudLimits} remainingSeconds={run.remainingSeconds} stripsOnStage />
        )}
        <MissionSceneOverlays
          props={props}
          isSubstituting={isSubstituting}
          isAwaitingConfirm={isAwaitingConfirm}
          isInConfirmState={sceneConfirm.isInConfirmState}
        />
        {/* 원본 타석 화면에는 글자 안내가 없다 — 웹 전용 조작 안내(Hint) · 큰 결과 글자(BigResult)를 걷어 냈다 */}
        <MissionResultLayer props={props} isOver={isOver} isSuccess={isSuccess} settlementLayers={settlementLayers} />
        <MissionPressAreas
          isOver={isOver}
          isAwaitingConfirm={isAwaitingConfirm}
          isMenuOpen={isMenuOpen}
          sceneConfirm={sceneConfirm}
          pressStar={menu.pressStar}
          stealableBases={stealableBases}
          stealIfFlying={stealIfFlying}
        />
        {isMenuOpen && (
          <MissionMenuLayer
            menu={menu}
            canOpenSettings={canOpenSettingsOf(props)}
            onGiveUp={props.onGiveUp}
            onRestart={props.onRestart}
            setOverlay={setOverlay}
          />
        )}
      </RawScreen>
      {overlay === '조작방법' && <HelpScreen onBack={backToMenu} />}
    </>
  )
}

/** 일시정지 팝업 0x741a0(메뉴 · 그 하위 조작방법 · 설정)이 떠 있으면 0x12 상태 틱이 멈춘다 (0x52cc6) — 든 쪽에 알린다 */
function usePopupFrozenNotice(
  isMenuOpen: boolean,
  overlay: MissionMenuOverlay | null,
  onPopupFrozenChange: ((isFrozen: boolean) => void) | undefined,
) {
  const isPopupFrozen = isMenuOpen || overlay !== null
  useEffect(() => {
    onPopupFrozenChange?.(isPopupFrozen)
  }, [isPopupFrozen, onPopupFrozenChange])
}

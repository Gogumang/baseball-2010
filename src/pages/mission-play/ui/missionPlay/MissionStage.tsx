import type { MutableRefObject } from 'react'
import { BattingStage } from '@/widgets/batting-stage/ui/BattingStage'
import type { SettlementEffectLayers } from '@/widgets/batting-stage/model/stageRefs'
import { missionStageStripsOf } from '@/pages/mission-play/lib/missionHudLayout'
import type { MissionLimitState } from '@/pages/mission-play/lib/missionHudLayout'
import { settlementBackdropOffsetAt } from './otherSlices'
import type { MissionPlayScreenProps } from './missionPlayProps'
import { missionBatterPropsOf, missionMoundPropsOf, missionSceneSlotsOf, missionSettlementPropsOf, missionStageHudOf } from './missionStageProps'

/**
 * 미션 타자편 = 원본 전역 모드 **6** — 경기 중 메뉴 표 0xcfcfc 의 **행 1**(다시하기가 있는 줄).
 * 모드 5 가 XlsPITCHER_MISSION 을 올리는 투수편이다 (Q2-mission-rewards 1-0 확정).
 * 행은 "모드 5~7 → 1" 이라 5·6 어느 쪽이든 같은 칸이 나온다.
 */
export const MISSION_BATTER_MODE = 6

/** 미션 타석 캔버스 — `BattingStage` 에 미션 경기 칸(HUD 띠 · 점수판 · 결과 배경 · 정산)을 싣는다 */
export function MissionStage({
  props,
  hudLimits,
  isOver,
  isSuccess,
  isStagePaused,
  shiftResetSerial,
  settlementLayers,
  flightProbeRef,
}: {
  readonly props: MissionPlayScreenProps
  readonly hudLimits: MissionLimitState
  readonly isOver: boolean
  readonly isSuccess: boolean
  readonly isStagePaused: boolean
  readonly shiftResetSerial: number
  readonly settlementLayers: SettlementEffectLayers
  readonly flightProbeRef: MutableRefObject<(() => boolean) | null>
}) {
  const { run, random } = props
  return (
    <BattingStage
      // 미션 HUD 띠 — 점수판 0x373d0 끝이라 타석 캔버스가 원본 식으로 섞는다 (Q-03 r301, `missionStageStripsOf`)
      {...(isOver ? {} : { missionStrips: missionStageStripsOf(hudLimits, run.remainingSeconds) })}
      {...missionBatterPropsOf(props)}
      {...missionSceneSlotsOf(props)}
      {...missionMoundPropsOf(props)}
      // 판정 묶음 '미션' = 모드 6(타자 미션) — 공격(사람) +100 (0xab5c0)
      swingMode="미션"
      // 미션은 나리 타자편 저장의 선수(등록 타자 rec[0xa] 0xa0 — 비트7)가 친다. 내 선수 보너스는 모드 3·4 에서만
      // 켜지므로(sp40) 판정 값은 안 바뀐다 — 연차도 그 갈래에서만 읽혀 넘기지 않는다
      isBatterOwnPlayer
      gameMode={MISSION_BATTER_MODE}
      isEagleEyeEnabled={false}
      hud={missionStageHudOf(props)}
      // 번트 키 '7'/'8'/'9' — 원본은 미션 목표와 상관없이 받는다. 타격 키 0x535a4 는 모드를 안 보고 0x6a7 을 보내고,
      // 받는 0x51e48 은 상태 0x11 · S+4(스윙 받을 준비) · 지금 타자(0xae89c)가 마선수(0xb633c, +0xa 비트6)가 아님만 본다.
      // 미션은 나리 타자편 저장의 선수가 치므로 마선수가 아니다 → 늘 켠다
      canBunt
      // 조작방법 뷰어 동안은 일시정지 팝업이 떠 있어 경기 갱신이 멈춘다 (0x52cc6 0x754f9) · 0xe(OK 대기)에서도 공이 안 나간다 ·
      // 교체 연출 0x16 에는 갱신이 없다(R10 표 — 진입 0x3d458 · 그리기 0x4da30 뿐)
      isPaused={isStagePaused}
      // 좌우 이동 +0xfe4 는 0xd 진입 48f88 에서만 지운다 — 같은 타석의 다음 공(0xf)과 결과 연출 동안은 남는다(A-02)
      shiftResetSerial={shiftResetSerial}
      random={random}
      // 경기 상태 0x19 — 결과 그림 0x4a384 는 모드를 안 가리고 구름 0x78448 · 배경 0x40ff0(+0x17e2)만 그린다(선수 · 공 · HUD 없음).
      // 갱신 0x4b100 은 모드 5·6 이면 r7 = [미션+0xbc] — 성공한 판만 구장이 틱마다 3 씩 150 까지 가라앉는다
      isResultBackdrop={isOver}
      resultBackdropOffsetOf={(tick) => settlementBackdropOffsetAt(tick, isSuccess)}
      {...missionSettlementPropsOf(isOver, isSuccess, run, random, settlementLayers)}
      onPitchResolved={props.onPitchResolved}
      onContact={props.onContact}
      onPickoff={props.onPickoff}
      flightProbeRef={flightProbeRef}
    />
  )
}

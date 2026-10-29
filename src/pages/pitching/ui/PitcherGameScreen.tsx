import type { ReactElement } from 'react'
import { RawScreen } from '@/shared/ui'
import { useBurstObjectTicksReset } from '@/widgets/burst-mission/model/useBurstObjectTicksReset'
import { BURST_RESULT_STATE_TICK } from '@/widgets/game-scene/model/useRecordAlert'
import { RecordAlertStageOverlay } from '@/widgets/game-scene/ui/RecordAlertPanel'
import { LoadingTip } from '@/widgets/loading-tip/ui/LoadingTip'
import { usePitcherGame } from '@/pages/pitching/model/usePitcherGame'
import { GAME_LOADING_PRELOADS } from './pitcherGameScene/otherSlices'
import { renderPitcherBoard } from './pitcherGameScene/pitcherBoards'
import { renderPitcherCover, renderPitcherIntro } from './pitcherGameScene/pitcherCovers'
import { pitcherBurstWindowOf, renderPitcherDefensePlay } from './pitcherGameScene/pitcherDefensePlays'
import type { PitcherGameSceneProps, PitcherGameScreenProps } from './pitcherGameScene/pitcherGameSceneProps'
import { renderPitcherStage } from './pitcherGameScene/pitcherStage'
import { type PitcherSceneModel, usePitcherSceneModel } from './pitcherGameScene/usePitcherSceneModel'

/**
 * 나만의리그 **투수편**(원본 모드 3) 경기 화면.
 *
 * 원본 경기 장면의 사람 조작 세 단계를 그대로 따른다 (I-controls 0절 · R10 2절):
 *   0xf  구질 고르기 — (2)(4)OK(6)(8) 다섯 자리 + '0' 마구, 틱 8 뒤 넘김 (`PitchSlotPicker`)
 *   0x10 조준 — 방향키로 흐르는 조준점, OK 확정 · CLR 은 0xf 로 (`AimCursor`)
 *   0x11 게이지 — OK 한 번, 틱 10 에 놓는다 (환경설정 "투구 게이지" 가 꺼져 있으면 이 단계가 없다)
 * 그리고 0xe·0xf 에서 `#` 를 누르면 "그만 던지시겠습니까?"(StrGAME[104]) 가 뜬다.
 *
 * 경기 장면 연출(`widgets/game-scene`, 타자편·팀 경기와 같은 부품):
 *   0xc  경기 시작 인트로 — 모드 3 도 적재 상태 8 끝에서 온다(54틱, OK·'5' 건너뛰기). 효과음 61 은 `usePitcherGame`.
 *   0x18 1회초 판 — 후공이고 오늘 선발일 때만 선다(진행기 `withHalfInningBoard`). 틱 2 에 징글 13.
 *   0x1e 벤치 클리어링 — 내가 던진 사구가 20/99 에 걸리면(소리 44·OK 건너뛰기).
 *   0x18 경기 끝 결과 판 — 점수 두 개와 승·패·세 세 줄, 10틱 입력 잠금 → OK → 정산(0x19, 아래 요약 화면).
 */
/**
 * 나리 투수편 경기 화면 — 경기 장면 0x104 하나. 생성자 0x3301c 가 33100 `0xbcb49(상태, 7)` 로 모드 갈래 없이 상태 7 을 예약해
 * 로딩 판(상태 7 · 9 · 8)을 먼저 지난다. 진행 칸 끝은 0x24(모드 3 ≠ 4 — 0x39f88 39f92~39f98), 팁은 0x53dbc 의 굴림(`usePitcherGame`
 * 의 맨 앞). 판이 다 그려지면(상태 8 끝 → 인트로 0xc) 경기 화면이 선다.
 * ⚠️ 근사(시간)(남김 — 단말 몫 · 바이너리 밖): 원본 판 길이는 단말의 적재 시간 — 웹은 나리 타자편 · 미션과 같은 `LoadingTip`(칸 하나 = 한 그림)
 */
export function PitcherGameScreen(props: PitcherGameScreenProps) {
  useBurstObjectTicksReset() // 경기 장면 생성 0x48658 — 돌발 객체 [+0x224] = 0
  const session = usePitcherGame(props.options, props.random, props.settings?.isVibrationOn)
  if (session.loadingTip !== null) {
    return (
      <RawScreen>
        <LoadingTip tip={session.loadingTip} onDone={session.finishLoading} preloadRequests={GAME_LOADING_PRELOADS} />
      </RawScreen>
    )
  }
  return <PitcherGameScene {...props} session={session} />
}

/**
 * 경기 장면 — 훅은 `usePitcherSceneModel` 이 옛 차례대로 세우고, 그림은 원본 상태 차례대로 갈래를 고른다:
 * 인트로(0xc) → 수비 판(0x17) → 판 위 돌발 창(0x1c) → 중계(0x21) · 벤치 클리어링(0x1e) · 교대 판(0x18) → 설정 · 경기 끝 판 · 정산 → 경기 장면.
 * 갈래는 부품이 아니라 그림 함수다 — 판 갈래들과 판 위 창 갈래가 같은 뿌리(`useDefenseUnderBurstWindow`)여야 판 상태가 이어지고,
 * 알림을 얹는 판들(`withRecordAlert`)과 경기 장면도 같은 틀 뿌리를 나눈다.
 */
function PitcherGameScene(props: PitcherGameSceneProps): ReactElement {
  const model = usePitcherSceneModel(props)
  const { burstResultTickRef } = model
  if (!model.setup.closed.isIntroDone) return renderPitcherIntro(model)
  const burstWindow = pitcherBurstWindowOf(model)
  const defensePlay = renderPitcherDefensePlay(model)
  if (defensePlay !== null) return defensePlay
  // 상태 0x1c — 판 끝(0x528b0)에서 난 돌발 판정의 창은 방금 판의 수비 화면 위에 선다(0x46ee0 → 0x46c88 — `useDefenseUnderBurstWindow`).
  // 그 위 기록 달성 알림 0x4e35c 는 0x17 이 아니라 그린다(53064)
  const heldDefense = model.burst.defenseUnderBurst.held(
    <>
      {burstWindow}
      <RecordAlertStageOverlay frame={model.recordAlert} />
    </>,
  )
  // 0x1c(판 위 창 0x46ee0)는 상태 틱을 안 박고, 타석 위 결과 창 0x1d(0x4d1e0)만 박는다
  const pinsBurstResultTick = heldDefense === null && burstWindow !== null && model.burst.resolution !== null
  // oxlint-disable-next-line react/refs -- 상태 그리기 0x4d1e0 처럼 이 갈래를 그리는 렌더만 틱을 박는다 — 앞 갈래(인트로 · 판)로 돌아간 렌더는 옛 값을 둔다(훅으로 옮기면 그 갈래 구분이 사라진다)
  burstResultTickRef.current = pinsBurstResultTick ? BURST_RESULT_STATE_TICK : null
  if (heldDefense !== null) return heldDefense
  return renderAfterDefense(model, burstWindow)
}

/** 판 위 창 갈래 뒤 — 중계 · 벤치 클리어링 · 교대 판 → 설정 · 경기 끝 판 · 정산 → 경기 장면 */
function renderAfterDefense(model: PitcherSceneModel, burstWindow: ReactElement | null): ReactElement {
  return renderPitcherBoard(model) ?? renderPitcherCover(model) ?? renderPitcherStage(model, burstWindow)
}

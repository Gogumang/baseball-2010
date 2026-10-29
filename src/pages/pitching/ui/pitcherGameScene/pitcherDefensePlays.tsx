import type { ReactElement } from 'react'
import { BurstMissionWindow } from '@/widgets/burst-mission/ui/BurstMissionWindow'
import { isWalkPlayResult } from '@/features/defense-play/model/walkPlay'
import { DefensePlayback, runScoreBoardSourceOf } from './otherSlices'
import { stageBatterHandOf } from './pitcherStageCast'
import type { PitcherSceneModel } from './usePitcherSceneModel'

/** 띄울 돌발 창 — 결과 창(0x1d)은 닫으면 판정을 내리고, 제안 창(0x1b)은 그 행을 본 것으로 적는다 */
export function pitcherBurstWindowOf(model: PitcherSceneModel): ReactElement | null {
  const { visibleBurstLines } = model
  const { resolution, proposal } = model.burst
  const { session } = model.props
  if (visibleBurstLines === null) return null
  return (
    <BurstMissionWindow
      lines={visibleBurstLines}
      judgement={resolution?.judgement ?? null}
      row={resolution?.row ?? null}
      // 0xb63c0(지금 타자) — 타석 장면이 그리는 타자 손 (장면 배치 — 구질 목록 누름 칸이 투수 앵커 0xcfb18[이 값] 둘레에 선다)
      isBatterLeftHanded={stageBatterHandOf(session.progress) !== 0}
      onClose={resolution !== null ? session.actions.closeBurst : () => model.input.setShownProposal(proposal)}
    />
  )
}

/**
 * 내가 던진 공이 인플레이로 갔으면 **수비 화면을 먼저 보여 준다** (원본 상태 0x17).
 * 진행 중인 타구가 있으면 여기서 **실시간으로 한 틱씩** 돌린다 — 원본도 공이 멈출 때까지
 * 같은 루프를 돌며 매 갱신 눌린 키를 읽는다 (R10 · I 문서).
 *
 * ⭐ 투수편은 **사람이 수비**다 — 조작 표 0절이 "공격이면 0x5331c 주루 / 수비면 0x533c8 송구"
 * 라고 가른다. 이 칸이 차는 자리는 `startPitch` 뿐이고 그 앞에 `isPitchTurn`(내 투수가 마운드에
 * 있는 수비 반 이닝)이 있으므로, 여기 오는 타구는 **언제나** 내가 수비하는 타구다.
 * 우리 팀 공격 이닝은 아홉 칸 모두 간이 엔진이 돌려 수비 화면 자체가 뜨지 않는다.
 *
 * 다 돌면 `onDone` 이 그 결과를 경기 상태에 먹인다 — **주자 처리는 그때 처음 정해진다.**
 */
function renderBattedPlay(model: PitcherSceneModel): ReactElement | null {
  const { progress, actions } = model.props.session
  const pendingDefensePlay = progress.pendingDefensePlay
  if (pendingDefensePlay === null || model.holds.isHitSceneShowing) return null
  return model.burst.defenseUnderBurst.show((window) => (
    <DefensePlayback
      input={pendingDefensePlay}
      side="수비"
      grassPalette={model.backdrop.grassPalette}
      // 수비 장면 득점 점수판 0x41a64 — 점수판 틀 두 측 · 플레이 시작 점수 · 공격 측 st[9]
      runScoreBoard={runScoreBoardSourceOf(progress.game, model.backdrop.scoreboardSides)}
      sceneMemory={model.setup.defenseSceneRef}
      // 그림 0x43278 이 올린 실책 +0x2e — 판 끝 정산보다 먼저 얹는다
      onFieldingErrors={actions.recordFieldingErrors}
      onDone={actions.finishDefensePlay}
      burstWindow={window}
    />
  ))
}

/** 내 수비의 주자 판(도루 · 폭투 · 견제) — 송구 키(+0x160)로 던지므로 실시간으로 한 틱씩 돌린다 (`liveRunnerPlay`) */
function renderRunnerPlay(model: PitcherSceneModel): ReactElement | null {
  const { progress, actions } = model.props.session
  const pendingRunnerPlay = progress.pendingRunnerPlay
  if (pendingRunnerPlay == null || model.holds.isArrivalHolding) return null
  return model.burst.defenseUnderBurst.show((window) => (
    <DefensePlayback
      runnerPlay={pendingRunnerPlay}
      grassPalette={model.backdrop.grassPalette}
      runScoreBoard={runScoreBoardSourceOf(progress.game, model.backdrop.scoreboardSides)}
      onFieldingErrors={actions.recordFieldingErrors}
      onDone={actions.finishRunnerPlay}
      burstWindow={window}
    />
  ))
}

/** 홈런 비행처럼 조작할 것이 없는 장면만 예전대로 재생 갈래로 간다 */
function renderReplay(model: PitcherSceneModel): ReactElement | null {
  const play = model.replay.replayPlay
  if (play === null) return null
  const replayTicks = play.ticks
  const replayIsWalk = isWalkPlayResult(play)
  return model.burst.defenseUnderBurst.show((window) => (
    <DefensePlayback
      ticks={replayTicks}
      onDone={model.setup.finishPlayback}
      onFieldingErrors={model.props.session.actions.recordFieldingErrors}
      freePassPlay={replayIsWalk}
      grassPalette={model.backdrop.grassPalette}
      burstWindow={window}
    />
  ))
}

/** 수비 판(상태 0x17) — 타구 · 주자 판 · 재생 차례로 하나. 없으면 null */
export function renderPitcherDefensePlay(model: PitcherSceneModel): ReactElement | null {
  return renderBattedPlay(model) ?? renderRunnerPlay(model) ?? renderReplay(model)
}

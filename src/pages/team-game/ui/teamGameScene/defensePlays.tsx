import type { ReactElement } from 'react'
import { BurstMissionWindow } from '@/widgets/burst-mission/ui/BurstMissionWindow'
import { isWalkPlayResult } from '@/features/defense-play/model/walkPlay'
import { DefensePlayback, runScoreBoardSourceOf } from './otherSlices'
import type { TeamGameSceneModel } from './useTeamGameSceneModel'

/** 띄울 돌발 창 — 결과 창(0x1d)은 닫으면 판정을 내리고, 제안 창(0x1b)은 그 행을 본 것으로 적는다 */
export function burstWindowOf(model: TeamGameSceneModel): ReactElement | null {
  const { visibleBurstLines, matchup } = model
  const { resolution, proposal } = model.burstState
  if (visibleBurstLines === null) return null
  return (
    <BurstMissionWindow
      lines={visibleBurstLines}
      judgement={resolution?.judgement ?? null}
      row={resolution?.row ?? null}
      // 0xb63c0(지금 타자) — 타석 소개 판과 같은 값
      isBatterLeftHanded={matchup.batterHand !== 0}
      onClose={resolution !== null ? model.props.session.actions.closeBurst : () => model.change.setShownProposal(proposal?.index ?? null)}
    />
  )
}

/**
 * 사람이 조작하는 갈래가 먼저다 — 진행 중인 타구가 있으면 **실시간으로 한 틱씩** 돌린다.
 * 원본은 타구가 뜬 순간 상태 0x17 로 넘어가 공이 멈출 때까지 같은 루프를 돌며 매 갱신 키를 읽고,
 * 사람이 **공격이면 주루**(0x5331c), **수비면 송구**(0x533c8)를 잡는다 (I 0절 상태 0x17 표).
 * 팀 경기는 공수를 모두 사람이 맡으니 그 쪽이 이닝마다 갈린다 — 진행기가 붙들 때 적어 둔 값을 그대로 쓴다.
 * 다 돌면 `onDone` 이 그 결과를 경기 상태에 먹인다 — **주자 처리는 그때 처음 정해진다.**
 */
function renderBattedPlay(model: TeamGameSceneModel): ReactElement | null {
  const { session } = model.props
  const { actions, progress } = session
  const pending = session.pendingDefensePlay
  if (pending === null || model.playHold.isHitSceneShowing) return null
  return model.burstState.defenseUnderBurst.show((window) => (
    <DefensePlayback
      input={pending.input}
      side={pending.side}
      grassPalette={model.backdrop.fieldPalette}
      // 수비 장면 득점 점수판 0x41a64 — 점수판 틀 두 측 · 플레이 시작 점수 · 공격 측 st[9]
      runScoreBoard={runScoreBoardSourceOf(progress.game, model.scoreboardSides)}
      sceneMemory={model.scoped.defenseSceneRef}
      // 그림 0x43278 이 올린 실책 +0x2e — 판 끝 정산보다 먼저 얹는다
      onFieldingErrors={actions.recordFieldingErrors}
      onDone={(result) => {
        model.walkers.fieldCarryTrack.afterLivePlay(result)
        actions.finishDefensePlay(result)
      }}
      burstWindow={window}
    />
  ))
}

/**
 * 사람 수비의 주자 판(도루 · 폭투 · 견제) — 상태 0x17 동안 송구 키(0x533c8 → +0x160)로 던지므로 **실시간으로 한 틱씩** 돌린다
 * (`features/defense-play/model/liveRunnerPlay`). 다 돌면 `finishRunnerPlay` 가 결과를 먹이고 투구 흐름을 잇는다.
 */
function renderRunnerPlay(model: TeamGameSceneModel): ReactElement | null {
  const { actions, progress } = model.props.session
  const runnerPlay = progress.pendingRunnerPlay
  if (runnerPlay == null || model.playHold.isArrivalHolding) return null
  return model.burstState.defenseUnderBurst.show((window) => (
    <DefensePlayback
      runnerPlay={runnerPlay}
      grassPalette={model.backdrop.fieldPalette}
      runScoreBoard={runScoreBoardSourceOf(progress.game, model.scoreboardSides)}
      onFieldingErrors={actions.recordFieldingErrors}
      onDone={(result) => {
        model.walkers.fieldCarryTrack.afterLivePlay(result)
        actions.finishRunnerPlay(result)
      }}
      burstWindow={window}
    />
  ))
}

/**
 * 홈런 비행처럼 조작할 것이 없는 장면은 **미리 만들어 둔 틱을 재생만** 한다 (원본도 같은 0x17 이다).
 * 이게 없으면 배트에 맞은 공이 어디로 갔는지 화면에 아예 안 나온다.
 */
function renderReplay(model: TeamGameSceneModel): ReactElement | null {
  const play = model.replay.replayPlay
  if (play === null) return null
  const replayTicks = play.ticks
  const replayIsWalk = isWalkPlayResult(play)
  return model.burstState.defenseUnderBurst.show((window) => (
    <DefensePlayback
      ticks={replayTicks}
      grassPalette={model.backdrop.fieldPalette}
      onDone={model.finishPlayback}
      // 재생 판도 같은 0x17 그림이라 실책 +0x2e 가 오른다 (수비 팀은 그림의 팀 번호로 가린다)
      onFieldingErrors={model.props.session.actions.recordFieldingErrors}
      freePassPlay={replayIsWalk}
      burstWindow={window}
    />
  ))
}

/** 수비 판(상태 0x17) — 타구 · 주자 판 · 재생 차례로 하나. 없으면 null */
export function renderDefensePlay(model: TeamGameSceneModel): ReactElement | null {
  return renderBattedPlay(model) ?? renderRunnerPlay(model) ?? renderReplay(model)
}

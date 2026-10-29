import type { ComponentProps, ReactNode } from 'react'
import { gameIntroBatterHandOf } from '@/pages/game/lib/gameMatchupCards'
import { isRivalryMatch } from '@/widgets/game-scene/lib/rivalryBand'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import { sceneFieldPaletteOf } from '@/features/play-team-game/model/sceneStadium'
import { LOADING_STEPS_BATTER_CAREER, LoadingTip } from '@/widgets/loading-tip/ui/LoadingTip'
import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'
import { DefensePlayback } from '@/pages/defense/ui/DefensePlayback'
import { isWalkPlayResult } from '@/features/defense-play/model/walkPlay'
import { GameIntro } from '@/widgets/game-scene/ui/GameIntro'
import { introStadiumNameFrameOf } from '@/widgets/game-scene/lib/introLayout'
import { humanVsComputerSidesOf } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'
import { BATTER_CAREER_MODE } from '@/app/ui/gameRoute/gameRouteProps'
import type { GameRouteView } from '@/app/ui/gameRoute/useGameRouteState'

export function loadingScreenOf(view: GameRouteView, tip: NonNullable<GameRouteView['session']['loadingTip']>): ReactNode {
  const { session, stagePreloads } = view
  return (
    <RawScreen>
      <LoadingTip
        tip={tip}
        // 모드 4 — 진행 칸 끝 0x25 (0x39f88 39f94)
        steps={LOADING_STEPS_BATTER_CAREER}
        onDone={session.actions.finishLoading}
        preloadRequests={stagePreloads}
      />
    </RawScreen>
  )
}

/** 경기 시작 인트로(상태 0xc) */
export function introScreenOf(view: GameRouteView): ReactNode {
  const { session, progress, career, setIntroDone } = view
  const side0Team = progress.game.playerSide === 0 ? progress.ourTeamId : progress.opponentTeamId
  const side1Team = progress.game.playerSide === 0 ? progress.opponentTeamId : progress.ourTeamId
  return (
    <GameIntro
      // 모드 4 는 홈(측 1) 팀 이름 + "스타디움" (0x418b6 의 0xb6bdc(st, 1))
      stadiumNameFrame={introStadiumNameFrameOf(BATTER_CAREER_MODE, null, side1Team)}
      // 점수판 틀 0x41440 (0x419f4) 의 두 측 — 내 팀 PLAYER · 상대 COM (타석 교대 판과 같은 두 측)
      scoreboardSides={humanVsComputerSidesOf(progress.game.playerSide, progress.ourTeamId, progress.opponentTeamId)}
      // 배경 고르기 0x40ff0 → 모드 4 는 0x78578 — 경기 장면의 타석 구장(0x39fdc 모드 4) 그대로
      {...(session.sceneStadium == null
        ? {}
        : {
            backdrop: {
              skyRow: session.stadiumSkyRow,
              skyColumn: 0,
              stadium: session.sceneStadium.stadium,
              fieldPalette: sceneFieldPaletteOf(session.sceneStadium),
              ourTeamId: side0Team,
              opponentTeamId: side1Team,
              gameMode: BATTER_CAREER_MODE,
              // 구장 +0x60 — 인트로 진입 0x3b084 가 3b108 에서 측 0 의 1번 타자 손을 쓴다(0 우타면 거울 길)
              side: gameIntroBatterHandOf(progress, career),
            },
          })}
      // 라이벌전 띠 0x3b80c — 적재 상태 8 의 0xb8f68(두 팀) (표 0xd8a90 의 짝)
      isRivalry={isRivalryMatch(side0Team, side1Team)}
      onDone={() => setIntroDone(true)}
    />
  )
}

/** 수비 장면 득점 점수판 0x41a64 — 점수판 틀 두 측 · 플레이 시작 점수 · 공격 측 st[9] */
function runScoreBoardOf(progress: GameProgress): NonNullable<ComponentProps<typeof DefensePlayback>['runScoreBoard']> {
  return {
    sides: humanVsComputerSidesOf(progress.game.playerSide, progress.ourTeamId, progress.opponentTeamId),
    scores:
      progress.game.playerSide === 0 ? [progress.game.ourScore, progress.game.opponentScore] : [progress.game.opponentScore, progress.game.ourScore],
    battingSide: progress.game.half === '초' ? 0 : 1,
  }
}

// 사람이 주루를 잡는 갈래가 먼저다 — 진행 중인 타구가 있으면 그것을 실시간으로 돌린다
function pendingDefenseScreenOf(view: GameRouteView, pendingDefensePlay: NonNullable<GameProgress['pendingDefensePlay']>): ReactNode {
  const { session, progress, defenseSceneRef, grassPalette, defenseUnderBurst } = view
  return defenseUnderBurst.show((window) => (
    <DefensePlayback
      input={pendingDefensePlay}
      side="공격"
      // 바탕 0x35218 — 수비 구장 +0xc 줄(0x39fdc 모드 4)
      grassPalette={grassPalette}
      // 수비 장면 득점 점수판 0x41a64 — 점수판 틀 두 측 · 플레이 시작 점수 · 공격 측 st[9]
      runScoreBoard={runScoreBoardOf(progress)}
      sceneMemory={defenseSceneRef}
      // 그림 0x43278 이 올린 실책 +0x2e — 판 끝 정산보다 먼저 얹는다
      onFieldingErrors={session.actions.recordFieldingErrors}
      onDone={session.actions.finishDefensePlay}
      burstWindow={window}
    />
  ))
}

/**
 * 주자 판(도루 · 폭투 · CPU 견제) — 상태 0x17 키 0x53420 이 사람 공격이면 주루 0x5331c(0x582 진루 · 0x584 귀루 → 0xa9b04)와
 * OK 슬라이딩 0x585 를 보내므로 **실시간으로 한 틱씩** 돌린다(`features/defense-play/model/liveRunnerPlay`, 팀 경기와 같은 길).
 * 다 돌면 `finishRunnerPlay` 가 결과를 먹이고 그 공(또는 견제)의 나머지를 잇는다
 */
function runnerPlayScreenOf(view: GameRouteView, runnerPlay: NonNullable<GameProgress['pendingRunnerPlay']>): ReactNode {
  const { session, progress, grassPalette, defenseUnderBurst } = view
  return defenseUnderBurst.show((window) => (
    <DefensePlayback
      runnerPlay={runnerPlay}
      grassPalette={grassPalette}
      runScoreBoard={runScoreBoardOf(progress)}
      onFieldingErrors={session.actions.recordFieldingErrors}
      onDone={session.actions.finishRunnerPlay}
      burstWindow={window}
    />
  ))
}

/** 재생 판(홈런 비행 · 견제 · 도루 · 폭투 등) — 조작할 것이 없는 판은 `ticks` 를 그대로 튼다 */
function replayScreenOf(view: GameRouteView, play: NonNullable<GameProgress['lastDefensePlay']>): ReactNode {
  const { session, finishPlayback, grassPalette, defenseUnderBurst } = view
  const replayTicks = play.ticks
  const replayIsWalk = isWalkPlayResult(play)
  return defenseUnderBurst.show((window) => (
    <DefensePlayback
      ticks={replayTicks}
      onDone={finishPlayback}
      // 재생 판(견제 · 도루 · 폭투 등)도 같은 0x17 그림이라 실책 +0x2e 가 오른다
      onFieldingErrors={session.actions.recordFieldingErrors}
      freePassPlay={replayIsWalk}
      grassPalette={grassPalette}
      burstWindow={window}
    />
  ))
}

/** 수비 화면 갈래 — 사람 주루 타구 → 주자 판 → 재생 판 차례. 어느 것도 아니면 null */
export function defensePlayScreenOf(view: GameRouteView): ReactNode {
  const { progress, play, shownPlay, runnerPlay, isReplayReady } = view
  const pendingDefensePlay = progress.pendingDefensePlay
  if (pendingDefensePlay !== null) return pendingDefenseScreenOf(view, pendingDefensePlay)
  if (runnerPlay !== null) return runnerPlayScreenOf(view, runnerPlay)
  if (play !== null && play !== shownPlay && play.ticks.length > 0 && isReplayReady) return replayScreenOf(view, play)
  return null
}

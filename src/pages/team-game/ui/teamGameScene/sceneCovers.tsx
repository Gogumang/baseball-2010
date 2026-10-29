import type { ReactElement } from 'react'
import { isRivalryMatch } from '@/widgets/game-scene/lib/rivalryBand'
import { GameEndBoard } from '@/widgets/game-scene/ui/GameEndBoard'
import { endBoardLineScoreOf } from '@/widgets/game-scene/lib/endBoardLineScore'
import { GameIntro } from '@/widgets/game-scene/ui/GameIntro'
import { introStadiumNameFrameOf } from '@/widgets/game-scene/lib/introLayout'
import { pitchersOfRecordOf } from '@/features/play-team-game/model/teamGameFlow'
import type { TeamGameOptions, TeamGameSummary } from '@/features/play-team-game/model/teamGameFlow'
import { teamIntroBatterHandOf } from '@/pages/team-game/lib/teamMatchupCards'
import { renderSettlement } from './settlementScene'
import type { TeamGameSceneModel } from './useTeamGameSceneModel'

/** 측 0 · 측 1 팀 — 사람 팀은 `humanSide` 측에 앉는다 */
function sideTeamsOf(options: TeamGameOptions, humanSide: number): [number, number] {
  return humanSide === 0 ? [options.ourTeamId, options.opponentTeamId] : [options.opponentTeamId, options.ourTeamId]
}

/**
 * 경기 시작 인트로 — 적재(상태 8) 끝에서 모드 1~4 만 0xc 로 온다. 54틱 또는 OK 뒤 1회초 판(0x18)이나 첫 타석.
 * 효과음 61 은 진입 예약음이라 `useTeamGame` 이 경기를 세울 때 낸다.
 */
function renderIntro(model: TeamGameSceneModel): ReactElement {
  const { options, seasonStadium, session } = model.props
  const { stadiumSkyRow, sceneStadium, fieldPalette } = model.backdrop
  const [side0Team, side1Team] = sideTeamsOf(options, options.playerSide)
  return (
    <GameIntro
      // 모드 1 은 구장 번호 st+0x30, 그 밖은 홈(측 1) 팀 이름 + "스타디움" (0x418b6)
      stadiumNameFrame={introStadiumNameFrameOf(options.mode, options.stadiumId, side1Team)}
      scoreboardSides={model.scoreboardSides}
      // 배경 고르기 0x40ff0 — 타석 · 정산 배경과 같은 구장(시즌 홈경기 · 대전이면 시즌 구장)
      backdrop={{
        skyRow: stadiumSkyRow ?? 0,
        skyColumn: 0,
        stadium: sceneStadium?.stadium ?? 0,
        fieldPalette,
        ...(seasonStadium === undefined ? {} : { seasonStadium }),
        ourTeamId: side0Team,
        opponentTeamId: side1Team,
        gameMode: options.mode,
        // 구장 +0x60 — 인트로 진입 0x3b084 가 3b108 에서 1회초 첫 타자 손을 쓴다(0 우타면 거울 길)
        side: teamIntroBatterHandOf(session.progress),
      }}
      // 라이벌전 띠 0x3b80c — 적재 상태 8 의 0xb8f68(두 팀) (표 0xd8a90 의 짝)
      isRivalry={isRivalryMatch(side0Team, side1Team)}
      onDone={() => model.covers.setIntroDone(true)}
    />
  )
}

/** 경기 끝 결과 판(상태 0x18) — OK 뒤 정산(0x19) */
function renderEndBoard(model: TeamGameSceneModel, summary: TeamGameSummary): ReactElement {
  const { session, onSettlementEnter } = model.props
  const { progress } = session
  const { game } = progress
  const names = pitchersOfRecordOf(progress)
  // 측 0(선공) 점수가 왼쪽 — 사람 팀은 `playerSide` 측에 앉는다
  const ourSide = progress.game.playerSide
  return (
    <GameEndBoard
      side0Score={ourSide === 0 ? game.ourScore : game.opponentScore}
      side1Score={ourSide === 1 ? game.ourScore : game.opponentScore}
      names={[names.win, names.loss, names.save]}
      scoreboardSides={model.scoreboardSides}
      // 503d8 — 이닝별 점수판 0x41c18 (득점 0xb6a9c 가 쌓은 칸)
      lineScore={endBoardLineScoreOf(game, sideTeamsOf(model.props.options, ourSide))}
      onConfirm={() => {
        model.covers.setEndBoardClosed(true)
        // 정산 0x19 진입 — 승리 31 · 패배 32 징글 (0x4ea0c). 같은 진입이 +0x4c+모드 를 지운다(0x4f3d6)
        session.actions.enterSettlement()
        onSettlementEnter?.(summary)
      }}
    />
  )
}

/** 경기 장면을 통째로 덮는 판 — 인트로(0xc) · 경기 끝 판(0x18) · 정산(0x19). 없으면 null */
export function renderSceneCover(model: TeamGameSceneModel): ReactElement | null {
  const { summary } = model
  if (!model.covers.isIntroDone && summary === null) return renderIntro(model)
  if (summary === null) return null
  if (!model.covers.isEndBoardClosed) return renderEndBoard(model, summary)
  return renderSettlement(model, summary)
}

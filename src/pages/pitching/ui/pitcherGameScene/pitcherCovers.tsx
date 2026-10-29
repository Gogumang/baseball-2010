import type { ReactElement } from 'react'
import { isRivalryMatch } from '@/widgets/game-scene/lib/rivalryBand'
import { GameIntro } from '@/widgets/game-scene/ui/GameIntro'
import { GameEndBoard } from '@/widgets/game-scene/ui/GameEndBoard'
import { endBoardLineScoreOf } from '@/widgets/game-scene/lib/endBoardLineScore'
import { introStadiumNameFrameOf } from '@/widgets/game-scene/lib/introLayout'
import { pitchersOfRecordOf } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { pitcherIntroBatterHandOf } from '@/pages/pitching/lib/pitcherMatchupCards'
import { SettingsScreen } from './otherSlices'
import { pitcherSkyRowOf } from './pitcherBackdrop'
import { withRecordAlert } from './pitcherBoards'
import { PITCHER_CAREER_MODE } from './pitcherGameSceneProps'
import { renderPitcherSettlement } from './pitcherSettlement'
import type { PitcherSceneModel } from './usePitcherSceneModel'

/** 측 0 · 측 1 팀 — 사람 팀은 `humanSide` 측에 앉는다 */
const sideTeamsOf = (ourTeamId: number, opponentTeamId: number, humanSide: number): [number, number] =>
  humanSide === 0 ? [ourTeamId, opponentTeamId] : [opponentTeamId, ourTeamId]

/**
 * 경기 시작 인트로 — 적재(상태 8) 끝에서 모드 1~4 만 0xc 로 온다. 54틱 또는 OK 뒤 1회초 판(0x18)이나 첫 타석.
 * 진행기는 경기를 세울 때 이미 첫 사람 타석까지(등판이 없는 날은 경기 끝까지) 밀어 두었지만 인트로는 난수를 안 쓰므로
 * 차례는 같다. 등판 없이 끝난 경기도 원본은 인트로 → 0x18 → 0x21(자동) → 결과 판 순서로 지나므로 인트로부터 보인다.
 */
export function renderPitcherIntro(model: PitcherSceneModel): ReactElement {
  const { options } = model.props
  const [side0Team, side1Team] = sideTeamsOf(options.ourTeamId, options.opponentTeamId, options.playerSide)
  return (
    <GameIntro
      // 모드 3 은 홈(측 1) 팀 이름 + "스타디움" (0x418b6 의 0xb6bdc(st, 1))
      stadiumNameFrame={introStadiumNameFrameOf(PITCHER_CAREER_MODE, null, side1Team)}
      scoreboardSides={model.backdrop.scoreboardSides}
      // 배경 고르기 0x40ff0 → 모드 3 은 0x78578 — 경기 장면의 타석 구장(0x39fdc 모드 3) 그대로
      backdrop={{
        skyRow: pitcherSkyRowOf(options),
        skyColumn: 0,
        stadium: model.backdrop.sceneStadium.stadium,
        fieldPalette: model.backdrop.grassPalette,
        ourTeamId: side0Team,
        opponentTeamId: side1Team,
        gameMode: PITCHER_CAREER_MODE,
        // 구장 +0x60 — 인트로 진입 0x3b084 가 3b108 에서 측 0 의 1번 타자 손을 쓴다(0 우타면 거울 길)
        side: pitcherIntroBatterHandOf(options),
      }}
      // 라이벌전 띠 0x3b80c — 적재 상태 8 의 0xb8f68(두 팀) (표 0xd8a90 의 짝)
      isRivalry={isRivalryMatch(side0Team, side1Team)}
      onDone={() => model.setup.closed.setIntroDone(true)}
    />
  )
}

/** 경기 중 메뉴의 "설정"(0x3c326). "조작방법"(0x3c212)은 경기 장면 위에 얹는다 */
function renderSettings(model: PitcherSceneModel): ReactElement | null {
  const { settings, onSettingsChange } = model.props
  const { overlay, setOverlay, menu } = model.input
  if (overlay !== '설정' || settings === undefined || onSettingsChange === undefined) return null
  return (
    <SettingsScreen
      settings={settings}
      onChange={onSettingsChange}
      onResetCareer={() => {}}
      onBack={() => {
        // [설정]에서 CLR(0x3cb0e)도 하위 0 · 팝업 0x741a0 을 다시 띄운다 — 경기 중 메뉴로, 커서는 그대로
        setOverlay(null)
        menu.reopen()
      }}
    />
  )
}

/** 경기 끝 결과 판(상태 0x18 경기 끝 가지) — OK 뒤에 정산(0x19) 자리인 요약 화면으로 간다 */
function renderEndBoard(model: PitcherSceneModel): ReactElement {
  const { pitcherName, session } = model.props
  const { progress, actions } = session
  const names = pitchersOfRecordOf(progress, pitcherName ?? null)
  // 측 0(선공) 점수가 왼쪽 — 사람 팀은 `playerSide` 측에 앉는다
  const ourSide = progress.game.playerSide
  return withRecordAlert(
    model,
    <GameEndBoard
      side0Score={ourSide === 0 ? progress.game.ourScore : progress.game.opponentScore}
      side1Score={ourSide === 1 ? progress.game.ourScore : progress.game.opponentScore}
      names={[names.win, names.loss, names.save]}
      scoreboardSides={model.backdrop.scoreboardSides}
      // 503d8 — 이닝별 점수판 0x41c18 (득점 0xb6a9c 가 쌓은 칸)
      lineScore={endBoardLineScoreOf(progress.game, sideTeamsOf(progress.options.ourTeamId, progress.options.opponentTeamId, ourSide))}
      onConfirm={() => {
        model.setup.closed.setEndBoardClosed(true)
        actions.enterSettlement()
      }}
    />,
  )
}

/** 설정 · 경기 끝 판 · 정산 — 없으면 null */
export function renderPitcherCover(model: PitcherSceneModel): ReactElement | null {
  const settingsScreen = renderSettings(model)
  if (settingsScreen !== null) return settingsScreen
  const { summary } = model.setup
  if (summary === null) return null
  if (!model.setup.closed.isEndBoardClosed) return renderEndBoard(model)
  return renderPitcherSettlement(model, summary)
}

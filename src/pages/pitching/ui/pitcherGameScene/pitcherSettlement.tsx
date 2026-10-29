import type { ReactElement } from 'react'
import { RawScreen } from '@/shared/ui'
import { BattingStage } from '@/widgets/batting-stage/ui/BattingStage'
import { DEFAULT_PITCHER_ABILITY } from '@/entities/pitching/model/pitch'
import { MAXIMUM_GAME_POINT, STARTING_ABILITY } from '@/entities/career/model/playerCareer'
import { recordGamePointsOf } from '@/entities/game/model/gameRecords'
import type { PitcherGameSummary } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import * as styles from '@/pages/pitching/ui/PitcherGameScreen.css'
import { SettlementBoard, SettlementPressArea, settlementBackdropOffsetAt } from './otherSlices'
import { pitcherSkyRowOf } from './pitcherBackdrop'
import { withRecordAlert } from './pitcherBoards'
import { PITCHER_CAREER_MODE } from './pitcherGameSceneProps'
import type { PitcherSceneModel } from './usePitcherSceneModel'

/** 0xb69b0(st, 0/1) — 왼쪽이 측 0. 사람 팀은 `ourSide` 측에 앉는다 */
const sideScoresOf = (summary: PitcherGameSummary, ourSide: number) => ({
  side0Score: ourSide === 0 ? summary.ourScore : summary.opponentScore,
  side1Score: ourSide === 1 ? summary.ourScore : summary.opponentScore,
})

/** 정산 판의 보유 GP — 경기 전 G 에 이번 경기 G 를 더해 0~99999 (4ec5a). 안 주면 줄을 비운다 */
const heldGamePointsOf = (gamePoint: number | undefined, earned: number) =>
  gamePoint === undefined ? {} : { heldGamePoints: Math.min(MAXIMUM_GAME_POINT, Math.max(0, gamePoint + earned)) }

/**
 * 정산 그리기 0x4a384 — 구름 0x78448 과 배경 고르기 0x40ff0(장면, +0x17e2)을 먼저 그린다 (선수·공·HUD 없음, 모드를 안 가린다).
 * +0x17e2 는 갱신 0x4b100 이 사람 팀이 이긴 판만 틱마다 3 씩 150 까지 올려 구장이 가라앉는다 (`settlementBackdropOffsetAt`).
 * 모드 3 은 시즌 홈·대전이 아니라 0x78578 갈래다 — 팀경기와 같은 `BattingStage` 결과 배경을 쓴다(시즌 구장 없음).
 * 결과 배경 — 타석 캔버스는 좌우 −10px 를 두므로 10px 밀어 원본 (0, 0) 에 맞춘다(`GameResultScreen.css` 의 backdrop)
 */
function renderSettlementBackdrop(model: PitcherSceneModel, summary: PitcherGameSummary, isHumanWin: boolean): ReactElement {
  const { options, random, session } = model.props
  const { progress } = session
  return (
    <div className={styles.settlementBackdrop}>
      <BattingStage
        // 결과 배경은 선수·공을 안 그려 능력치를 읽지 않는다 — 꼴을 채우는 기본값
        batterAbility={STARTING_ABILITY}
        pitcherAbility={DEFAULT_PITCHER_ABILITY}
        swingMode="일반"
        gameMode={PITCHER_CAREER_MODE}
        isEagleEyeEnabled={false}
        hud={null}
        acePitcher={null}
        isPaused
        isResultBackdrop
        resultBackdropOffsetOf={(tick) => settlementBackdropOffsetAt(tick, isHumanWin)}
        // 하늘 줄 = 구장 +0x10 — 0x783b0 모드 3: 나리 저장 +0xb2(리그 날짜 g) mod 6, 굴림 없음. 배경 난수는 꼴만 채운다
        skyRow={pitcherSkyRowOf(options)}
        // 결과 배경 0x40ff0 → 0x78578 — 경기 장면의 타석 구장 그대로(펜스 +0x70 · 바닥 줄 +0xc)
        stadium={model.backdrop.sceneStadium.stadium}
        fieldPalette={model.backdrop.grassPalette}
        random={model.setup.backdropRandom}
        // 정산 효과 0x4ea0c(밤 승리 불꽃 · 패배 비)와 결과 그림 0x4a384 의 효과 · 파티클 틱은 경기 난수로 돈다
        settlement={{
          isWin: isHumanWin,
          ...sideScoresOf(summary, progress.game.playerSide),
          inning: progress.game.inning,
          random,
          layers: model.setup.settlementLayers,
        }}
        onPitchResolved={() => {}}
      />
    </div>
  )
}

/**
 * 정산(0x19) — 모드 3 은 5·6 이 아니라 팀경기와 같은 갈래 0x4a948(점수판 틀 · 점수 · 기본 화면/기록 판)이다.
 * 이겼나 = 0x4a350(0xb6c21(경기, 0xb6a0d) == 0 — 앞선 측이 사람 팀). 원본 경기는 동점으로 안 끝난다(0xb68fc).
 * 감독 평가·변화 글은 경기 장면 밖 나리 상태 116(진입 0x1278c)의 몫이다 — 부르는 쪽(투수편 세션)이 띄운다
 */
export function renderPitcherSettlement(model: PitcherSceneModel, summary: PitcherGameSummary): ReactElement {
  const { gamePoint, onFinish, session } = model.props
  const isHumanWin = summary.result === '승'
  // [+0x17f4] — 진입 0x4ea0c 4ebaa~4ec7c 가 기록 달성 횟수로 센 이번 경기 G (투수편 세션 `finishGame` 과 같은 식)
  const earned = recordGamePointsOf(summary.recordIds)
  return withRecordAlert(
    model,
    <RawScreen>
      {renderSettlementBackdrop(model, summary, isHumanWin)}
      <SettlementBoard
        mode={PITCHER_CAREER_MODE}
        isWin={isHumanWin}
        {...sideScoresOf(summary, session.progress.game.playerSide)}
        scoreboardSides={model.backdrop.scoreboardSides}
        recordIds={summary.recordIds}
        gamePoints={earned}
        {...heldGamePointsOf(gamePoint, earned)}
        onExit={() => onFinish(summary)}
        effectLayers={model.setup.settlementLayers}
      />
      {/* 원본에 없는 웹 [확인] 소프트키 대신 — 판 키 0x407f0 로 OK 를 보내는 투명 누름 칸 */}
      <SettlementPressArea />
    </RawScreen>,
  )
}

import type { ReactElement } from 'react'
import { RawScreen } from '@/shared/ui'
import { BattingStage } from '@/widgets/batting-stage/ui/BattingStage'
import { currentBatterAbility, currentPitcherAbility } from '@/features/play-team-game/model/teamGameFlow'
import type { TeamGameSummary } from '@/features/play-team-game/model/teamGameFlow'
import { settlementBackdropOffsetAt } from '@/pages/team-game/model/settlementBackdrop'
import { SettlementBoard } from '@/pages/team-game/ui/SettlementBoard'
import { SettlementPressArea } from '@/pages/team-game/ui/SettlementPressArea'
import * as styles from '@/pages/team-game/ui/TeamGameScreen.css'
import type { TeamGameSceneModel } from './useTeamGameSceneModel'

/** 0xb69b0(st, 0/1) — 왼쪽이 측 0. 사람 팀은 `ourSide` 측에 앉는다 */
function sideScoresOf(summary: TeamGameSummary, ourSide: number) {
  return {
    side0Score: ourSide === 0 ? summary.ourScore : summary.opponentScore,
    side1Score: ourSide === 1 ? summary.ourScore : summary.opponentScore,
  }
}

/**
 * 정산 그리기 0x4a384 — 구름 0x78448 과 배경 고르기 0x40ff0(장면, +0x17e2)을 먼저 그린다 (선수·공·HUD 없음).
 * +0x17e2 는 이긴 판만 틱마다 3 씩 150 까지 올라 구장이 가라앉는다 (`settlementBackdropOffsetAt`).
 */
function renderSettlementBackdrop(model: TeamGameSceneModel, summary: TeamGameSummary, isHumanWin: boolean): ReactElement {
  const { options, seasonStadium, random, session } = model.props
  const { progress } = session
  const { backdropRandom, stadiumSkyRow, sceneryProps, settlementLayers } = model.backdrop
  return (
    <div className={styles.settlementBackdrop}>
      <BattingStage
        batterAbility={currentBatterAbility(progress)}
        pitcherAbility={currentPitcherAbility(progress)}
        swingMode="일반"
        gameMode={options.mode}
        isEagleEyeEnabled={false}
        // 결과 뒤 배경은 HUD·선수를 안 그린다
        hud={null}
        acePitcher={null}
        // 시즌 홈경기·대전이면 배경 고르기 0x40ff0 이 시즌 구장으로 간다 — 타석과 같은 규칙
        seasonStadium={seasonStadium}
        {...sceneryProps}
        isPaused
        isResultBackdrop
        resultBackdropOffsetOf={(tick) => settlementBackdropOffsetAt(tick, isHumanWin)}
        // 하늘 줄은 경기 중 타석과 같은 구장 +0x10 (0x783b0)
        {...(stadiumSkyRow === null ? {} : { skyRow: stadiumSkyRow })}
        random={backdropRandom}
        // 정산 효과 0x4ea0c(밤 승리 불꽃 · 패배 비)와 결과 그림 0x4a384 의 효과 · 파티클 틱은 경기 난수로 돈다
        settlement={{
          isWin: isHumanWin,
          ...sideScoresOf(summary, progress.game.playerSide),
          inning: progress.game.inning,
          random,
          layers: settlementLayers,
        }}
        onPitchResolved={() => {}}
      />
    </div>
  )
}

/**
 * 정산(상태 0x19)도 원본 240×320 한 장이다 — 예전 웹 껍데기(PixelScreen 제목 띠 "경기 결과" · 소프트키 [확인])에 담으면 판이
 * 화면 위로 붙고 아래가 껍데기 바탕으로 비었다(r77 패배 결과 g14). 나리 정산(`GameResultScreen`)과 같은 RawScreen · 배경 칸이다.
 * 배경 위에 정산 판(0x4a404 진 판 덮개 · 0x4a448 띠·승패 그림 · 0x4a948 점수·기본 화면/기록 판)을 겹친다 (`SettlementBoard`).
 */
export function renderSettlement(model: TeamGameSceneModel, summary: TeamGameSummary): ReactElement {
  const { options, gamePoint, onFinish, session } = model.props
  // 정산 갱신 0x4b100 의 r7 — 사람 팀(우리)이 이겼나. 비기면 거짓
  const isHumanWin = summary.result === '승'
  return (
    <RawScreen>
      {renderSettlementBackdrop(model, summary, isHumanWin)}
      <SettlementBoard
        mode={options.mode}
        isWin={isHumanWin}
        {...sideScoresOf(summary, session.progress.game.playerSide)}
        scoreboardSides={model.scoreboardSides}
        recordIds={summary.recordIds ?? []}
        gamePoints={summary.gamePoints ?? 0}
        // [app+0x64] — 정산 진입(0x4ea0c)이 번 G 를 더한 뒤의 값. 부르는 쪽이 `onSettlementEnter` 에서 더한다
        {...(gamePoint === undefined ? {} : { heldGamePoints: gamePoint })}
        onExit={() => onFinish(summary)}
        effectLayers={model.backdrop.settlementLayers}
      />
      {/* 원본에 없는 웹 [확인] 소프트키 대신 — 판 키 0x407f0 로 OK 를 보내는 투명 누름 칸 */}
      <SettlementPressArea />
    </RawScreen>
  )
}

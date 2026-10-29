import { useState } from 'react'
import { FrameSprite } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { colorStepCoverOpacityOf } from '@/shared/lib/stepCover/stepCover'
import {
  SETTLEMENT_BAND,
  SETTLEMENT_LOSE_DIM_STEP,
  SETTLEMENT_RESULT_SPRITE,
  SETTLEMENT_SCORE,
  SETTLEMENT_TITLE_BAR,
  SETTLEMENT_VISIBLE_ROWS,
  isVersusMode,
  scrollSettlementRecords,
  settlementPanelHeightOf,
  settlementPanelLayoutOf,
  settlementRecordRowsOf,
  startSettlementScroll,
} from '@/pages/team-game/lib/settlementBoard'
import type { VersusWinReward } from '@/pages/team-game/lib/settlementBoard'
import type { SettlementKeyAction } from '@/pages/team-game/lib/settlementBoard/settlementKeys'
import * as styles from '@/pages/team-game/ui/SettlementBoard.css'
import { ScoreboardFrame } from '@/widgets/scoreboard-frame/ui/ScoreboardFrame'
import { SCOREBOARD_AT } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'
import type { ScoreboardSide } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'
import { SettlementEffectCanvas } from '@/widgets/batting-stage/ui/SettlementEffectCanvas'
import type { SettlementEffectLayers } from '@/widgets/batting-stage/model/stageRefs'
import { BasicView } from './settlementBoard/BasicView'
import { RecordPanel } from './settlementBoard/RecordPanel'
import { ScoreNumber } from './settlementBoard/ScoreNumber'
import { GAME_UI_FRAMES, IMG_TEXT_FRAMES, POPUP_FRAMES, RESULT_FRAMES } from './settlementBoard/settlementAssets'
import { useSettlementKeys } from './settlementBoard/useSettlementKeys'
import { useSettlementPanel } from './settlementBoard/useSettlementPanel'

export interface SettlementBoardProps {
  readonly mode: number
  /** 0x4a350 — 사람 팀이 이겼나 (비기면 거짓) */
  readonly isWin: boolean
  readonly side0Score: number
  readonly side1Score: number
  /** 점수판 틀 0x41440 의 두 측 — 팀(0xb6bdd)·CPU(0xb6c21) */
  readonly scoreboardSides: readonly [ScoreboardSide, ScoreboardSide]
  /** 이번 경기 기록달성 번호 (같은 번호가 여러 번이면 그 횟수) */
  readonly recordIds: readonly number[]
  /** [+0x17f4] 이번에 번 G */
  readonly gamePoints: number
  /** [app+0x64] 보유 G — 안 주면 그 줄 숫자를 비운다 */
  readonly heldGamePoints?: number
  /**
   * 대전모드(8·9) 승리 추가 보상 v — 모드 8 은 s16 [app+0x112], 9 는 s16 [app+0x138] (서버 값, 🌐 미해결).
   * 안 주면 흐르는 글을 비운다(칸은 그린다).
   */
  readonly versusWinBonus?: number
  /**
   * 대전모드(8·9) 승리 보상 종류 · 값 — 정산 틱 0x14 에 기록 판이 열려 있고 이겼으면 공용 창에 띄운다(`versusWinPopupTextOf`).
   * 서버가 채우는 전역 칸이라(🌐) 안 주면 창이 없다.
   */
  readonly versusReward?: VersusWinReward
  /** 기본 화면에서 '0' 이 아닌 키 → 메시지 0x3f3 (정산을 나간다) */
  readonly onExit: () => void
  /**
   * 정산 효과 층 — 밑의 타석 캔버스(`BattingStage` 의 `settlement.layers`)와 같은 묶음. 원본 그리기 0x4a384 차례대로
   * 비 층은 진 판 덮개(4a404) 바로 위 · 띠(4a448) 아래(효과 틱 0x4a452), 파티클 층은 판 맨 위(프레임 끝 0x6dd69)에 깐다.
   */
  readonly effectLayers?: SettlementEffectLayers
}

/**
 * **팀경기 정산 판** (그리기 0x4a384 의 그 밖 모드 갈래 · 키 0x407f0) — 좌표·흐름은 `lib/settlementBoard` 머리말.
 * 구름·구장 배경(+0x17e2)은 밑에 깔린 타석 캔버스가 그린다 — 이 판은 그 위 240×320 에 겹친다.
 * 점수판 틀 0x41440(장면, W/2 − 120, H/2 − 80) 은 `widgets/scoreboard-frame` 이 그린다.
 * G 숫자 0x54a61(둥근 판 · 동전 · "+" · 숫자)은 `widgets/screen-frame` 의 `GamePointBadge` 가 그린다.
 */
export function SettlementBoard({
  mode,
  isWin,
  side0Score,
  side1Score,
  scoreboardSides,
  recordIds,
  gamePoints,
  heldGamePoints,
  versusWinBonus,
  onExit,
  effectLayers,
  versusReward,
}: SettlementBoardProps) {
  const { isPanelOpen, isPanelOpenRef, setPanelOpen, keyLatch } = useSettlementPanel(mode, isWin, versusReward)
  const rows = settlementRecordRowsOf(recordIds)
  const [scroll, setScroll] = useState(() => startSettlementScroll(rows.length))
  const gameUiOrigins = useFrameOrigins(GAME_UI_FRAMES)
  const resultOrigins = useFrameOrigins(RESULT_FRAMES)
  const textOrigins = useFrameOrigins(IMG_TEXT_FRAMES)
  const popupOrigins = useFrameOrigins(POPUP_FRAMES)

  const actions: Readonly<Record<NonNullable<SettlementKeyAction>, () => void>> = {
    판열기: () => setPanelOpen(true),
    판닫기: () => setPanelOpen(false),
    나가기: onExit,
    위로: () => setScroll((current) => scrollSettlementRecords(current, 'up')),
    아래로: () => setScroll((current) => scrollSettlementRecords(current, 'down')),
  }
  const act = (action: SettlementKeyAction) => {
    if (action !== null) actions[action]()
  }
  useSettlementKeys(keyLatch, isPanelOpenRef, act, isPanelOpen && rows.length > SETTLEMENT_VISIBLE_ROWS)

  const hasRewardLine = isVersusMode(mode) && isWin
  const panel = settlementPanelLayoutOf(settlementPanelHeightOf(mode, isWin), rows.length, hasRewardLine)
  const visibleEnd = Math.min(scroll.top + SETTLEMENT_VISIBLE_ROWS, rows.length)
  const visibleRows = rows.slice(scroll.top, visibleEnd)

  return (
    <div className={styles.layer} data-testid="정산-판">
      {/* 4a404 진 판 — 색 덮기 검정 단계 8 */}
      {!isWin && <div className={styles.fill} style={{ background: '#000000', opacity: colorStepCoverOpacityOf(SETTLEMENT_LOSE_DIM_STEP) }} />}
      {/* 4a452 효과 틱 0x901a0 — 정산 비(종류 0)를 덮개 위 · 띠 아래에 그린다 */}
      {effectLayers !== undefined && <SettlementEffectCanvas canvasRef={effectLayers.rain} />}
      {/* 4a448 — 띠 · game_ui 프레임 8 · YOU WIN / YOU LOSE */}
      <div
        className={styles.block}
        style={{
          left: SETTLEMENT_BAND.x,
          top: SETTLEMENT_BAND.y,
          width: SETTLEMENT_BAND.width,
          height: SETTLEMENT_BAND.height,
          background: SETTLEMENT_BAND.color,
        }}
      />
      <FrameSprite
        folder={GAME_UI_FRAMES}
        frame={SETTLEMENT_TITLE_BAR.frame}
        origins={gameUiOrigins}
        x={SETTLEMENT_TITLE_BAR.centerX - (SETTLEMENT_TITLE_BAR.width >> 1)}
        y={SETTLEMENT_TITLE_BAR.y}
      />
      <FrameSprite
        folder={RESULT_FRAMES}
        frame={isWin ? SETTLEMENT_RESULT_SPRITE.winFrame : SETTLEMENT_RESULT_SPRITE.loseFrame}
        origins={resultOrigins}
        x={SETTLEMENT_RESULT_SPRITE.x}
        y={SETTLEMENT_RESULT_SPRITE.y}
      />

      {/* 4a97a 점수판 틀 0x41440(장면, W/2 − 120, H/2 − 80, 0, 0, 0) */}
      <ScoreboardFrame {...SCOREBOARD_AT.settlement} side0={scoreboardSides[0]} side1={scoreboardSides[1]} />
      {/* 4a980 점수 — num 70 + 자리, x 가 가운데 */}
      <ScoreNumber value={side0Score} centerX={SETTLEMENT_SCORE.side0.centerX} y={SETTLEMENT_SCORE.side0.y} testId="정산-점수-0" />
      <ScoreNumber value={side1Score} centerX={SETTLEMENT_SCORE.side1.centerX} y={SETTLEMENT_SCORE.side1.y} testId="정산-점수-1" />

      {isPanelOpen ? (
        <RecordPanel
          panel={panel}
          visibleRows={visibleRows}
          scroll={scroll}
          gamePoints={gamePoints}
          heldGamePoints={heldGamePoints}
          versusWinBonus={versusWinBonus}
          textOrigins={textOrigins}
          popupOrigins={popupOrigins}
        />
      ) : (
        <BasicView gamePoints={gamePoints} textOrigins={textOrigins} onOpenPanel={() => act('판열기')} />
      )}
      {/* 프레임 끝 0x6dd69 — 파티클(밤 승리 불꽃)은 판까지 다 그린 뒤 맨 위 */}
      {effectLayers !== undefined && <SettlementEffectCanvas canvasRef={effectLayers.particles} />}
    </div>
  )
}

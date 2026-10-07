import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FrameSprite } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { parseGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import { colorStepCoverOpacityOf } from '@/shared/lib/stepCover/stepCover'
import { SKIN_TICKER_CLIP_INSET, skinTickerTextXOf, useSkinTickerCounter } from '@/shared/lib/skinTicker/skinTicker'
import { RECORD_NAMES } from '@/entities/game/model/gameRecords'
import { useSceneTick } from '@/widgets/game-scene/model/useSceneTick'
import {
  NO_RECORD_TEXT, SETTLEMENT_BAND, SETTLEMENT_INFO_BAR, SETTLEMENT_INFO_POINT, SETTLEMENT_LOSE_DIM_STEP,
  SETTLEMENT_RESULT_SPRITE, SETTLEMENT_SCORE, SETTLEMENT_SCROLL_TRACK, SETTLEMENT_TITLE_BAR, SETTLEMENT_VISIBLE_ROWS,
  isVersusMode, recordCountTextOf, scrollSettlementRecords, settlementKeyActionOf, settlementPanelHeightOf,
  settlementPanelLayoutOf, settlementRecordRowsOf, startSettlementScroll, versusRewardTextOf,
} from '@/pages/team-game/lib/settlementBoard'
import * as styles from '@/pages/team-game/ui/SettlementBoard.css'
import { GamePointBadge } from '@/widgets/screen-frame/ui/GamePointBadge'
import { ScoreboardFrame } from '@/widgets/scoreboard-frame/ui/ScoreboardFrame'
import { SCOREBOARD_AT } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'
import type { ScoreboardSide } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'

const GAME_UI = './sprites/game_ui'
const GAME_UI_FRAMES = './sprites/game_ui/frames'
const RESULT_FRAMES = './sprites/result/frames'
const IMG_TEXT_FRAMES = './sprites/img_text/frames'
const POPUP_FRAMES = './sprites/popup/frames'
const SLT_FRAME = './sprites/slt_frame'
const NUM = './sprites/num'
const imageSrc = (folder: string, image: number) => `${folder}/${String(image).padStart(3, '0')}.png`

/** num 70 + 자리 숫자 — 그림 폭(70~79) */
const SCORE_DIGIT_WIDTHS = [32, 22, 29, 29, 32, 30, 30, 31, 30, 30] as const
const SCORE_DIGIT_HEIGHTS = [36, 35, 35, 36, 36, 36, 36, 34, 36, 36] as const
/** img_text 252 "GP" */
const GP_LABEL_FRAME = 252
const SCROLL_TRACK_COLOR = '#20309e'
const SCROLL_ARROW_IMAGE = 78

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
  /** 기본 화면에서 '0' 이 아닌 키 → 메시지 0x3f3 (정산을 나간다) */
  readonly onExit: () => void
}

/**
 * **팀경기 정산 판** (그리기 0x4a384 의 그 밖 모드 갈래 · 키 0x407f0) — 좌표·흐름은 `lib/settlementBoard` 머리말.
 * 구름·구장 배경(+0x17e2)은 밑에 깔린 타석 캔버스가 그린다 — 이 판은 그 위 240×320 에 겹친다.
 * 점수판 틀 0x41440(장면, W/2 − 120, H/2 − 80) 은 `widgets/scoreboard-frame` 이 그린다.
 * G 숫자 0x54a61(둥근 판 · 동전 · "+" · 숫자)은 `widgets/screen-frame` 의 `GamePointBadge` 가 그린다.
 */
export function SettlementBoard({
  mode, isWin, side0Score, side1Score, scoreboardSides, recordIds, gamePoints, heldGamePoints, versusWinBonus, onExit,
}: SettlementBoardProps) {
  const [isPanelOpen, setPanelOpen] = useState(false)
  const rows = settlementRecordRowsOf(recordIds)
  const [scroll, setScroll] = useState(() => startSettlementScroll(rows.length))
  const gameUiOrigins = useFrameOrigins(GAME_UI_FRAMES)
  const resultOrigins = useFrameOrigins(RESULT_FRAMES)
  const textOrigins = useFrameOrigins(IMG_TEXT_FRAMES)
  const popupOrigins = useFrameOrigins(POPUP_FRAMES)
  const exitRef = useRef(onExit)
  exitRef.current = onExit

  const act = (action: ReturnType<typeof settlementKeyActionOf>) => {
    if (action === '판열기') setPanelOpen(true)
    else if (action === '판닫기') setPanelOpen(false)
    else if (action === '나가기') exitRef.current()
    else if (action === '위로') setScroll((current) => scrollSettlementRecords(current, 'up'))
    else if (action === '아래로') setScroll((current) => scrollSettlementRecords(current, 'down'))
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      const action = settlementKeyActionOf(event.key, isPanelOpen)
      if (action === null) return
      event.preventDefault()
      act(action)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const hasRewardLine = isVersusMode(mode) && isWin
  const panel = settlementPanelLayoutOf(settlementPanelHeightOf(mode, isWin), rows.length, hasRewardLine)
  const visibleEnd = Math.min(scroll.top + SETTLEMENT_VISIBLE_ROWS, rows.length)
  const visibleRows = rows.slice(scroll.top, visibleEnd)

  return (
    <div className={styles.layer} data-testid="정산-판">
      {/* 4a404 진 판 — 색 덮기 검정 단계 8 */}
      {!isWin && (
        <div className={styles.fill}
          style={{ background: '#000000', opacity: colorStepCoverOpacityOf(SETTLEMENT_LOSE_DIM_STEP) }} />
      )}
      {/* 4a448 — 띠 · game_ui 프레임 8 · YOU WIN / YOU LOSE */}
      <div className={styles.block} style={{
        left: SETTLEMENT_BAND.x, top: SETTLEMENT_BAND.y, width: SETTLEMENT_BAND.width, height: SETTLEMENT_BAND.height,
        background: SETTLEMENT_BAND.color,
      }} />
      <FrameSprite folder={GAME_UI_FRAMES} frame={SETTLEMENT_TITLE_BAR.frame} origins={gameUiOrigins}
        x={SETTLEMENT_TITLE_BAR.centerX - (SETTLEMENT_TITLE_BAR.width >> 1)} y={SETTLEMENT_TITLE_BAR.y} />
      <FrameSprite folder={RESULT_FRAMES}
        frame={isWin ? SETTLEMENT_RESULT_SPRITE.winFrame : SETTLEMENT_RESULT_SPRITE.loseFrame}
        origins={resultOrigins} x={SETTLEMENT_RESULT_SPRITE.x} y={SETTLEMENT_RESULT_SPRITE.y} />

      {/* 4a97a 점수판 틀 0x41440(장면, W/2 − 120, H/2 − 80, 0, 0, 0) */}
      <ScoreboardFrame {...SCOREBOARD_AT.settlement} side0={scoreboardSides[0]} side1={scoreboardSides[1]} />
      {/* 4a980 점수 — num 70 + 자리, x 가 가운데 */}
      <ScoreNumber value={side0Score} centerX={SETTLEMENT_SCORE.side0.centerX} y={SETTLEMENT_SCORE.side0.y} testId="정산-점수-0" />
      <ScoreNumber value={side1Score} centerX={SETTLEMENT_SCORE.side1.centerX} y={SETTLEMENT_SCORE.side1.y} testId="정산-점수-1" />

      {!isPanelOpen ? (
        <>
          {/* 4af50 기본 화면 — game_ui 이미지 12 · "0:INFO" · 번 G */}
          <img className={styles.sprite} alt="" src={imageSrc(GAME_UI, SETTLEMENT_INFO_BAR.image)}
            style={{ left: SETTLEMENT_INFO_BAR.x, top: SETTLEMENT_INFO_BAR.y }} />
          <FrameSprite folder={IMG_TEXT_FRAMES} frame={SETTLEMENT_INFO_BAR.labelFrame} origins={textOrigins}
            x={SETTLEMENT_INFO_BAR.labelX} y={SETTLEMENT_INFO_BAR.labelY} />
          {/* 원본에 없는 웹 단추 — '0' 키와 같다 */}
          <button type="button" className={styles.hitArea} aria-label="0:INFO"
            style={{ left: SETTLEMENT_INFO_BAR.x, top: SETTLEMENT_INFO_BAR.y,
              width: SETTLEMENT_INFO_BAR.imageWidth, height: SETTLEMENT_INFO_BAR.imageHeight }}
            onClick={() => act('판열기')} />
          {gamePoints > 0 && (
            <GamePointBadge testId="정산-번-G" value={gamePoints} x={SETTLEMENT_INFO_POINT.x} y={SETTLEMENT_INFO_POINT.y}
              width={SETTLEMENT_INFO_POINT.width} align={SETTLEMENT_INFO_POINT.align} plus={SETTLEMENT_INFO_POINT.plus}
              plate={SETTLEMENT_INFO_POINT.plate} />
          )}
        </>
      ) : (
        <>
          <div className={styles.window} style={{
            left: panel.window.x, top: panel.window.y, width: panel.window.width, height: panel.window.height,
          }} />
          <img className={styles.sprite} alt="RESULT" src={imageSrc(GAME_UI, panel.title.image)}
            style={{ left: panel.title.x, top: panel.title.y }} />
          <div className={styles.innerBox} style={{
            left: panel.recordBox.x, top: panel.recordBox.y, width: panel.recordBox.width, height: panel.recordBox.height,
          }} />
          {panel.hasRecords ? (
            <>
              {visibleRows.map((row, offset) => {
                const y = panel.records.firstRowY + panel.records.rowStep * offset
                return (
                  <div key={row.id} data-testid={`정산-기록-${row.id}`}>
                    <span className={styles.text} style={{ left: panel.records.nameX, top: y }}>
                      {RECORD_NAMES[row.id] ?? ''}
                    </span>
                    <span className={styles.text} style={{
                      left: panel.records.countX, top: y, width: panel.records.countWidth, textAlign: 'right',
                    }}>
                      {recordCountTextOf(row.count)}
                    </span>
                  </div>
                )
              })}
              {/* 스크롤 막대 0x58c11 — 길 · ▲▼(slt_frame 이미지 78) · 흰 손잡이 */}
              <div className={styles.block} style={{
                left: panel.records.scrollBar.x, top: panel.records.scrollBar.y, width: 7,
                height: SETTLEMENT_SCROLL_TRACK + 2, background: SCROLL_TRACK_COLOR,
              }} />
              <img className={styles.sprite} alt="" src={imageSrc(SLT_FRAME, SCROLL_ARROW_IMAGE)}
                style={{ left: panel.records.scrollBar.x, top: panel.records.scrollBar.y - 4 }} />
              <img className={styles.sprite} alt="" src={imageSrc(SLT_FRAME, SCROLL_ARROW_IMAGE)}
                style={{ left: panel.records.scrollBar.x, top: panel.records.scrollBar.y + SETTLEMENT_SCROLL_TRACK + 1,
                  transform: 'scaleY(-1)' }} />
              <div className={styles.scrollThumb} style={{
                left: panel.records.scrollBar.x + 1, top: panel.records.scrollBar.y + scroll.thumb + 1,
                width: 4, height: scroll.thumbLength,
              }} />
            </>
          ) : (
            <span className={styles.text} style={{
              left: panel.emptyText.x, top: panel.emptyText.y, width: panel.emptyText.width, textAlign: 'center',
            }}>
              {NO_RECORD_TEXT}
            </span>
          )}

          <div className={styles.innerBox} style={{
            left: panel.pointBox.x, top: panel.pointBox.y, width: panel.pointBox.width, height: panel.pointBox.height,
          }} />
          {panel.pointRows.map((row, index) => {
            const value = index === 0 ? gamePoints : heldGamePoints
            return (
              <div key={row.name}>
                <FrameSprite folder={IMG_TEXT_FRAMES} frame={row.label} origins={textOrigins} x={panel.pointLabelX} y={row.labelY} />
                <FrameSprite folder={IMG_TEXT_FRAMES} frame={GP_LABEL_FRAME} origins={textOrigins} x={panel.pointGpX} y={row.labelY} />
                {value !== undefined && (
                  <GamePointBadge testId={`정산-${row.name}-G`} value={value} x={panel.pointValue.x} y={row.valueY}
                    width={panel.pointValue.width} align={panel.pointValue.align} plus={row.plus}
                    plate={panel.pointValue.plate} />
                )}
              </div>
            )
          })}

          {panel.rewardBox !== null && panel.ticker !== null && (
            <>
              <div className={styles.innerBox} style={{
                left: panel.rewardBox.x, top: panel.rewardBox.y, width: panel.rewardBox.width, height: panel.rewardBox.height,
              }} />
              {versusWinBonus !== undefined && <RewardTicker text={versusRewardTextOf(versusWinBonus)} box={panel.ticker} />}
            </>
          )}

          <FrameSprite folder={POPUP_FRAMES} frame={panel.okButton.frame} origins={popupOrigins}
            x={panel.okButton.x} y={panel.okButton.y} />
        </>
      )}
    </div>
  )
}

/** 0xba689(x, y, 0, 값, 0x46, num, 정렬 0x12) — 자간 0, x 가 가운데, 가장 큰 글자에 아래를 맞춘다(0xba628) */
function ScoreNumber({ value, centerX, y, testId }: {
  readonly value: number; readonly centerX: number; readonly y: number; readonly testId: string
}) {
  const digits = [...String(Math.max(0, Math.trunc(value)))].map(Number)
  const totalWidth = digits.reduce((sum, digit) => sum + SCORE_DIGIT_WIDTHS[digit], 0)
  const maxHeight = Math.max(...digits.map((digit) => SCORE_DIGIT_HEIGHTS[digit]))
  let x = centerX + Math.floor(-totalWidth / 2)
  return (
    <div data-testid={testId} data-value={value}>
      {digits.map((digit, index) => {
        const left = x
        x += SCORE_DIGIT_WIDTHS[digit]
        return (
          <img key={index} className={styles.sprite} alt="" src={imageSrc(NUM, SETTLEMENT_SCORE.digitBaseFrame + digit)}
            style={{ left, top: y + maxHeight - SCORE_DIGIT_HEIGHTS[digit] }} />
        )
      })}
    </div>
  )
}

/**
 * 0x4aef0 `0x5a8c8(skin, 글, W/2 − 0x51, r7 + 3, 162, 18, 1, 1, 1)` — 자르기 (x + 2, y, w − 4, h) ·
 * 글 왼쪽 = x + w − [skin+0x284] % (글폭 + w) · 그린 뒤 3 올린다 (`shared/lib/skinTicker`).
 */
function RewardTicker({ text, box }: {
  readonly text: string
  readonly box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
}) {
  const tick = useSceneTick()
  const counter = useSkinTickerCounter(tick)
  const textRef = useRef<HTMLSpanElement>(null)
  const [textWidth, setTextWidth] = useState(0)
  useLayoutEffect(() => setTextWidth(textRef.current?.offsetWidth ?? 0), [text])
  const segments = parseGameMarkup(`!cffffff${text}`).flatMap((line) => line.segments)
  const clipLeft = box.x + SKIN_TICKER_CLIP_INSET
  return (
    <div className={styles.tickerClip} data-testid="정산-흐르는-글"
      style={{ left: clipLeft, top: box.y, width: box.width - SKIN_TICKER_CLIP_INSET * 2, height: box.height }}>
      <span ref={textRef} className={styles.tickerText}
        style={{ left: skinTickerTextXOf(box.x, box.width, counter, textWidth) - clipLeft }}>
        {segments.map((segment, index) => (
          <span key={index} style={segment.color === null ? undefined : { color: segment.color }}>{segment.text}</span>
        ))}
      </span>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { FrameSprite, RawScreen, SpriteNumber } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { numberGlyphsOf } from '@/shared/lib/pixelNumber/pixelNumber'
import type { DerbyResult } from '@/entities/home-run-derby/model/derbyRun'
import {
  GAME_POINT_FOLDER, GAME_POINT_GLYPH_HEIGHT, POINT_BOX, POINT_GP_FRAME, POINT_GP_X, POINT_LABEL_X,
  POINT_ROWS, POINT_VALUE_BOX, RESULT_TITLE, RESULT_WINDOW, RETRY_BOX, RETRY_BUTTONS,
  RETRY_DEFAULT_ANSWER, RETRY_QUESTION, RETRY_TEXT, STAT_BOX, STAT_BOX_TITLE, STAT_LABEL_X,
  STAT_ROWS, STAT_UNIT_X, STAT_VALUE_BOX, STAT_VALUE_PLATE,
  gamePointGlyphsOf, statLabelTopOf, statPlateTopOf, statValueTopOf,
} from '@/pages/home-run-derby/lib/derbyResultLayout'
import * as styles from '@/pages/home-run-derby/ui/DerbyResultWindow.css'

const IMG_TEXT_FRAMES = './sprites/img_text/frames'
const GAME_UI_FRAMES = './sprites/game_ui/frames'
const POPUP_FRAMES = './sprites/popup/frames'
const RESULT_TITLE_IMAGE = `./sprites/game_ui/${String(RESULT_TITLE.image).padStart(3, '0')}.png`
const frameSrc = (folder: string, frame: number) => `${folder}/${String(frame).padStart(3, '0')}.png`

interface DerbyResultWindowProps {
  readonly result: DerbyResult
  /** 정산이 끝난 뒤의 보유 G (app+0x64) */
  readonly heldGamePoint: number
  /** 예 — 홈런더비 재시작 (전역 0x140006c = 0x27 → 메인 메뉴 하위 39 → 모드 7 다시) */
  readonly onRetry: () => void
  /** 아니오 — 메인 메뉴 (전역 0x140006c = 4) */
  readonly onExit: () => void
}

/**
 * 홈런더비 결과 화면 — 그리기 `0x45c18`, 키 `0x40a08` (R14 1·2절, **확정**).
 *
 * 176×213 가운데 창에 "RESULT" 머리, 칸 A(총 기회 / 최대 콤보 / 현재 비거리 / 최고 비거리),
 * 칸 B(획득 GP / 보유 GP), 칸 C(StrMAINMENU[53] "재도전하시겠습니까?" + 예·아니오)를 놓는다.
 * 좌표는 전부 `derbyResultLayout` 에 원본 값으로 적혀 있다.
 *
 * 창 몸통(0x55e60)·안쪽 칸(0x5eec4)의 **그림 모양**은 선 목록만 확인돼 CSS 로 근사한다 (추정) —
 * 다른 화면(`pages/settings` · `pages/record`)이 쓰는 것과 같은 근사다.
 */
export function DerbyResultWindow({ result, heldGamePoint, onRetry, onExit }: DerbyResultWindowProps) {
  const [answer, setAnswer] = useState(RETRY_DEFAULT_ANSWER)
  const textOrigins = useFrameOrigins(IMG_TEXT_FRAMES)
  const popupOrigins = useFrameOrigins(POPUP_FRAMES)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === '4') setAnswer(true)
      else if (event.key === 'ArrowRight' || event.key === '6') setAnswer(false)
      else if (event.key === 'Enter' || event.key === ' ' || event.key === '5') {
        event.preventDefault()
        // 예(5/−5 키) → 모드 7 재시작 · 아니오 → 메인 메뉴 (0x40a08)
        if (answer) onRetry()
        else onExit()
      } else if (event.key === 'Escape' || event.key === 'Backspace') {
        // 취소도 "아니오" 와 같은 길이다 (0x40a08)
        onExit()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [answer, onRetry, onExit])

  const statValues = [result.pitchCount, result.maxCombo, result.totalDistance, result.bestDistance]
  const pointValues = [result.gainedGamePoint, heldGamePoint]

  return (
    <RawScreen>
      <div
        className={styles.window}
        style={{ left: RESULT_WINDOW.x, top: RESULT_WINDOW.y, width: RESULT_WINDOW.width, height: RESULT_WINDOW.height }}
      />

      {/* game_ui 이미지 30 = "RESULT" (56×7) */}
      <img className={styles.sprite} style={{ left: RESULT_TITLE.x, top: RESULT_TITLE.y }} src={RESULT_TITLE_IMAGE} alt="RESULT" />

      {/* 칸 A — 162×84 */}
      <div className={styles.innerBox} style={{ left: STAT_BOX.x, top: STAT_BOX.y, width: STAT_BOX.width, height: STAT_BOX.height }} />
      <FrameSprite folder={IMG_TEXT_FRAMES} frame={STAT_BOX_TITLE.frame} origins={textOrigins} x={STAT_BOX_TITLE.x} y={STAT_BOX_TITLE.y} />

      {STAT_ROWS.map((row, index) => (
        <div key={row.name}>
          <FrameSprite folder={IMG_TEXT_FRAMES} frame={row.label} origins={textOrigins} x={STAT_LABEL_X} y={statLabelTopOf(index)} />
          <img
            className={styles.sprite}
            style={{ left: STAT_VALUE_PLATE.x, top: statPlateTopOf(index) }}
            src={frameSrc(GAME_UI_FRAMES, STAT_VALUE_PLATE.frame)}
            alt=""
          />
          <SpriteNumber
            glyphs={numberGlyphsOf(statValues[index])}
            right={STAT_VALUE_BOX.x + STAT_VALUE_BOX.width}
            boxTop={statValueTopOf(index)}
            boxHeight={STAT_VALUE_BOX.height}
          />
          <FrameSprite folder={IMG_TEXT_FRAMES} frame={row.unit} origins={textOrigins} x={STAT_UNIT_X} y={statValueTopOf(index)} />
        </div>
      ))}

      {/* 칸 B — 획득 GP / 보유 GP */}
      <div className={styles.innerBox} style={{ left: POINT_BOX.x, top: POINT_BOX.y, width: POINT_BOX.width, height: POINT_BOX.height }} />
      {POINT_ROWS.map((row, index) => (
        <div key={row.name}>
          <FrameSprite folder={IMG_TEXT_FRAMES} frame={row.label} origins={textOrigins} x={POINT_LABEL_X} y={row.labelY} />
          <FrameSprite folder={IMG_TEXT_FRAMES} frame={POINT_GP_FRAME} origins={textOrigins} x={POINT_GP_X} y={row.labelY} />
          <SpriteNumber
            glyphs={gamePointGlyphsOf(pointValues[index])}
            right={POINT_VALUE_BOX.x + POINT_VALUE_BOX.width}
            boxTop={row.valueY}
            boxHeight={POINT_VALUE_BOX.height}
            folder={GAME_POINT_FOLDER}
            glyphHeight={GAME_POINT_GLYPH_HEIGHT}
          />
        </div>
      ))}

      {/* 칸 C — 재도전 묻기 */}
      <div className={styles.innerBox} style={{ left: RETRY_BOX.x, top: RETRY_BOX.y, width: RETRY_BOX.width, height: RETRY_BOX.height }} />
      <div className={styles.question} style={{ left: RETRY_TEXT.x, top: RETRY_TEXT.y, width: RETRY_TEXT.width }}>
        {RETRY_QUESTION}
      </div>
      {RETRY_BUTTONS.map((button) => (
        <button
          key={button.name}
          type="button"
          className={styles.answerButton}
          style={{ left: button.x, top: button.y }}
          aria-label={button.name}
          aria-pressed={answer === button.answer}
          onClick={() => (button.answer ? onRetry() : onExit())}
          onMouseEnter={() => setAnswer(button.answer)}
        >
          <FrameSprite
            folder={POPUP_FRAMES}
            frame={answer === button.answer ? button.selectedFrame : button.frame}
            origins={popupOrigins}
            x={0}
            y={0}
          />
        </button>
      ))}

      {result.isNewRecord && <div className={styles.newRecord}>NEW RECORD!</div>}
    </RawScreen>
  )
}

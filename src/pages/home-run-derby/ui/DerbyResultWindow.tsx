import { useEffect, useRef, useState } from 'react'
import { pushSceneKey } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'
import { CommonPanel, FrameSprite, RoundBox, SpriteNumber, useImgTextPalette3 } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { numberGlyphsOf } from '@/shared/lib/pixelNumber/pixelNumber'
import type { DerbyResult } from '@/entities/home-run-derby/model/derbyRun'
import {
  POINT_BOX, POINT_GP_FRAME, POINT_GP_X, POINT_LABEL_X,
  POINT_ROWS, POINT_VALUE_BOX, RESULT_TITLE, RESULT_WINDOW, RETRY_BOX, RETRY_BUTTONS,
  RETRY_DEFAULT_ANSWER, RETRY_QUESTION, RETRY_TEXT, STAT_BOX, STAT_BOX_TITLE, STAT_LABEL_X,
  STAT_ROWS, STAT_UNIT_X, STAT_VALUE_BOX, STAT_VALUE_GLYPH_HEIGHT, STAT_VALUE_PLATE,
  statLabelTopOf, statPlateTopOf, statValueTopOf,
} from '@/pages/home-run-derby/lib/derbyResultLayout'
import * as styles from '@/pages/home-run-derby/ui/DerbyResultWindow.css'
import { GamePointBadge } from '@/widgets/screen-frame/ui/GamePointBadge'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const IMG_TEXT_FRAMES = assetUrl('./sprites/img_text/frames')
const GAME_UI_FRAMES = assetUrl('./sprites/game_ui/frames')
const POPUP_FRAMES = assetUrl('./sprites/popup/frames')
const RESULT_TITLE_IMAGE = assetUrl(`./sprites/game_ui/${String(RESULT_TITLE.image).padStart(3, '0')}.png`)
/** 둥근 칸 0x5eec5 의 공통 인자 — 둥글기 4 · 반사 길이 0x56 · 걸음 2 · 칠 #395DCE · 테두리 0(검정) (45d84~45daa · 460ec · 46238) */
const ROUND_BOX = { round: 4, shineLength: 0x56, shineStep: 2, fill: '#395DCE', edge: '#000000' } as const
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
 * 창 몸통은 공용 판 0x55e60(skin, W/2, H/2, 176, 213, 0, 0x22, 위 띠 0x10, 0, 0, 0)(45d06~45d24) 이고,
 * 안쪽 칸 셋은 0xbb28c 가 아니라 **둥근 칸 0x5eec4**(둥글기 4 · 칠 #395DCE · 테두리 검정)다 — 칸 A 만 반사 줄을 긋는다
 * (45d84~45dae `0x5eec5(skin, W/2, H/2 − 0x55, 162, 84, 4, 2, 1, 0x56, 2, 0, 0x395dce, 0, 0)`, 칸 B · C 는 반사 0).
 * 둘 다 원본 선 목록대로 `shared/ui` 의 `CommonPanel` · `RoundBox` 가 그린다.
 *
 * 신기록 표시는 없다 — 0x45c18 은 신기록 칸 st+0x3c 를 읽지 않는다. 신기록은 진입 0x4f574 의 효과음 0x1f 로만 알린다.
 *
 * 창 뒤 배경(0x45c18 첫머리의 구름 0x78448 · 구장 0x78578(구장, +0x17e2, 1))은 이 창이 아니라 **밑에 깔린 타석 캔버스**가
 * 그린다 — 화면이 `BattingStage` 를 `isResultBackdrop` 으로 두고 이 창을 그 위 240×320 판에 겹친다.
 */
export function DerbyResultWindow({ result, heldGamePoint, onRetry, onExit }: DerbyResultWindowProps) {
  const [answer, setAnswer] = useState(RETRY_DEFAULT_ANSWER)
  const textOrigins = useFrameOrigins(IMG_TEXT_FRAMES)
  const popupOrigins = useFrameOrigins(POPUP_FRAMES)
  const titlePalette = useImgTextPalette3()

  // 키 0x40a08 은 경기 장면 상태 0x1a 의 상태 키 함수(52da2~)라 받은 다음 틀에 돈다 — 장면 키 칸(`pushSceneKey`, 밑의 결과 배경
  // 타석이 올려 둔 칸)에 넣고 그 틀 머리에서 꺼낸다. 고른 답은 꺼낸 차례대로 고친다(앞 틀의 ←/→ 를 다음 틀의 OK 가 본다)
  const answerRef = useRef(answer)
  const exitRef = useRef({ onRetry, onExit })
  exitRef.current = { onRetry, onExit }
  const isDoneRef = useRef(false)
  useEffect(() => {
    const choose = (next: boolean) => {
      answerRef.current = next
      setAnswer(next)
    }
    const leave = (retry: boolean) => {
      if (isDoneRef.current) return
      isDoneRef.current = true
      if (retry) exitRef.current.onRetry()
      else exitRef.current.onExit()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === '4') pushSceneKey(() => choose(true))
      else if (event.key === 'ArrowRight' || event.key === '6') pushSceneKey(() => choose(false))
      else if (event.key === 'Enter' || event.key === ' ' || event.key === '5') {
        event.preventDefault()
        // 예(5/−5 키) → 모드 7 재시작 · 아니오 → 메인 메뉴 (0x40a08)
        pushSceneKey(() => leave(answerRef.current))
      } else if (event.key === 'Escape' || event.key === 'Backspace') {
        // 취소도 "아니오" 와 같은 길이다 (0x40a08)
        pushSceneKey(() => leave(false))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const statValues = [result.pitchCount, result.maxCombo, result.totalDistance, result.bestDistance]
  const pointValues = [result.gainedGamePoint, heldGamePoint]

  return (
    <div className={styles.layer}>
      {/* 45d24 공용 판 0x55e60(skin, W/2, H/2, 176, 213, 0, 0x22, 위 띠 0x10, 0, 0, 0) */}
      <CommonPanel x={RESULT_WINDOW.x} y={RESULT_WINDOW.y} width={RESULT_WINDOW.width} height={RESULT_WINDOW.height}
        topBand={0x10} testId="더비-결과-창" />

      {/* game_ui 이미지 30 = "RESULT" (56×7) */}
      <img className={styles.sprite} style={{ left: RESULT_TITLE.x, top: RESULT_TITLE.y }} src={RESULT_TITLE_IMAGE} alt="RESULT" />

      {/* 칸 A — 162×84 */}
      <RoundBox x={STAT_BOX.x} y={STAT_BOX.y} width={STAT_BOX.width} height={STAT_BOX.height} {...ROUND_BOX} shine testId="더비-칸-A" />
      {/* 칸 제목 "홈런더비" 는 img_text 팔레트 3 — 45db2 0x913e5(img_text, 3) → 253 → 45de8 0x913e5(img_text, 0) 뒤 줄 이름들 */}
      {titlePalette.definition}
      <FrameSprite folder={IMG_TEXT_FRAMES} frame={STAT_BOX_TITLE.frame} origins={textOrigins} x={STAT_BOX_TITLE.x} y={STAT_BOX_TITLE.y}
        style={titlePalette.style} />

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
            // 0xba51c 정렬 4 는 세로 가운데 맞춤이 없다 — 상자 높이를 글자 높이로 주어 위를 칸 y 에 붙인다
            boxHeight={STAT_VALUE_GLYPH_HEIGHT}
          />
          <FrameSprite folder={IMG_TEXT_FRAMES} frame={row.unit} origins={textOrigins} x={STAT_UNIT_X} y={statValueTopOf(index)} />
        </div>
      ))}

      {/* 칸 B — 획득 GP / 보유 GP */}
      <RoundBox x={POINT_BOX.x} y={POINT_BOX.y} width={POINT_BOX.width} height={POINT_BOX.height} {...ROUND_BOX} />
      {POINT_ROWS.map((row, index) => (
        <div key={row.name}>
          <FrameSprite folder={IMG_TEXT_FRAMES} frame={row.label} origins={textOrigins} x={POINT_LABEL_X} y={row.labelY} />
          <FrameSprite folder={IMG_TEXT_FRAMES} frame={POINT_GP_FRAME} origins={textOrigins} x={POINT_GP_X} y={row.labelY} />
          {/* G 숫자 0x54a60 — 동전 · ("+") · 숫자 (0x46174 · 0x461f2) */}
          <GamePointBadge testId={`더비-${row.name}-G`} value={pointValues[index]!} x={POINT_VALUE_BOX.x} y={row.valueY}
            width={POINT_VALUE_BOX.width} align={POINT_VALUE_BOX.align} plus={row.plus} plate={POINT_VALUE_BOX.plate} />
        </div>
      ))}

      {/* 칸 C — 재도전 묻기 */}
      <RoundBox x={RETRY_BOX.x} y={RETRY_BOX.y} width={RETRY_BOX.width} height={RETRY_BOX.height} {...ROUND_BOX} />
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

    </div>
  )
}

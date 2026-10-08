import { useEffect, useId } from 'react'
import { FrameSprite } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import * as windowStyles from '@/shared/ui/GameWindow/GameWindow.css'
import { MessageLineText } from '@/pages/management/ui/StatusValues'
import {
  EVALUATION_CHANGE_BOXES, EVALUATION_CHANGE_MODE_UI_FRAME, evaluationChangeWindowLayoutOf,
} from '@/pages/story/lib/evaluationChangeWindow'
import type { EvaluationChangeValues } from '@/pages/story/lib/evaluationChangeWindow'
import type { YearGoalWindowSource } from '@/pages/story/lib/yearGoalWindow'
import { EVENT_WINDOW_DIM_OPACITY } from '@/pages/story/lib/eventDialogue'

const MODE_UI = './sprites/mode_ui/frames'
const IMG_TEXT = './sprites/img_text/frames'
const NUM = './sprites/num'
const pad = (frame: number) => String(frame).padStart(3, '0')

/**
 * mode_ui 애니 1 · 2 (animations.json): 프레임 61/62 를 2틀 제자리 → 3틀 1px 위/아래, 되풀이.
 * 0x86c90 이 그릴 때마다 0x93d91 로 한 칸 나아간다.
 */
const ARROW_ANIMATIONS = {
  1: { frame: 61, still: 2, moved: 3, dy: -1 },
  2: { frame: 62, still: 2, moved: 3, dy: 1 },
} as const

export interface EvaluationChangeWindowProps {
  readonly values: EvaluationChangeValues
  /** 아래 표 — 0x8656c(gfx, 박스 7, 박스 5, 박스 6, 0) 가 그리는 올해의 목표 값 */
  readonly goals: YearGoalWindowSource
  /** 0x7d120 "N년 G/45경기" — 연차 SR+0xb3 + 1 · 막 치른 경기 번호(둘째 인자 1) */
  readonly year: number
  readonly game: number
  readonly onClose: () => void
}

/**
 * **경기 평가 변화 창** — 이벤트 system sub 2 (그리기 0x86c90, 배치는 `pages/story/lib/evaluationChangeWindow`).
 * 240×320 화면 좌표 그대로 이야기 덮개 위에 놓는다. 닫기는 원본 OK(−5) · '5' — 웹은 Enter · Space · '5' 와 누르기.
 * ⚠️ 공용 창 0x55e61 의 그림은 웹 공용 근사(`GameWindow.css` window)다 — 올해의 목표 창과 같다.
 * 창이 떠 있는 동안에도 0x8b5ac 가 틀마다 0x7fbc4 로 앞 say 상자를 그린다(`EvaluationEventPlayer` 가 남긴다) — 창 뒤 어둡게가 그 위를 덮는다.
 */
export function EvaluationChangeWindow({ values, goals, year, game, onClose }: EvaluationChangeWindowProps) {
  const modeUiOrigins = useFrameOrigins(MODE_UI)
  const navyFilterId = `palette3-${useId().replace(/:/g, '')}`
  const update = useUpdateCounter()
  const layout = evaluationChangeWindowLayoutOf(values, goals)
  const { window: area } = EVALUATION_CHANGE_BOXES

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ' && event.key !== '5') return
      event.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    // 뒤 어둡게 — 이벤트 장면의 창은 떠 있는 그리기마다 검정 6/16 (0x746cc, `EVENT_WINDOW_DIM_OPACITY`)
    <div className={windowStyles.overlay} data-testid="경기-평가-변화-창" role="dialog" aria-label="경기 평가 변화" onClick={onClose}
      style={{ background: `rgba(0, 0, 0, ${EVENT_WINDOW_DIM_OPACITY})` }}>
      <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden>
        <filter id={navyFilterId} colorInterpolationFilters="sRGB">
          {/* 흰 글자(R=G=B) → img_text 팔레트 3 두 색 — 올해의 목표 창과 같은 1차식 */}
          <feColorMatrix type="matrix"
            values={'1.5625 0 0 0 -1.40172  0 2.3125 0 0 -2.02623  0 0 3.625 0 -2.97794  0 0 0 1 0'} />
        </filter>
      </svg>
      <div className={windowStyles.window} style={{ left: area.x, top: area.y, width: area.width, height: area.height }} />
      <FrameSprite folder={MODE_UI} frame={EVALUATION_CHANGE_MODE_UI_FRAME} origins={modeUiOrigins} x={0} y={0} />
      <MessageLineText year={year} game={game} box={layout.messageBox} />
      {layout.texts.map((piece, index) => (
        <img key={`t${index}`} className={windowStyles.layer} src={`${IMG_TEXT}/${pad(piece.frame)}.png`} alt=""
          data-frame={piece.frame}
          style={{ left: piece.x, top: piece.y, filter: piece.palette === 3 ? `url(#${navyFilterId})` : undefined }} />
      ))}
      {layout.arrows.map((arrow, index) => {
        const animation = ARROW_ANIMATIONS[arrow.animation]
        const dy = update % (animation.still + animation.moved) < animation.still ? 0 : animation.dy
        return (
          <FrameSprite key={`a${index}`} folder={MODE_UI} frame={animation.frame} origins={modeUiOrigins} x={arrow.x} y={arrow.y + dy} />
        )
      })}
      {layout.dashes.map((dash, index) => (
        <div key={`d${index}`} className={windowStyles.layer} data-part="변화없음"
          style={{ left: dash.x, top: dash.y, width: dash.width, height: dash.height, background: '#FFFFFF' }} />
      ))}
      {layout.numbers.map((piece, index) => (
        <img key={`n${index}`} className={windowStyles.layer} src={`${NUM}/${pad(piece.frame)}.png`} alt=""
          style={{ left: piece.x, top: piece.y }} />
      ))}
    </div>
  )
}

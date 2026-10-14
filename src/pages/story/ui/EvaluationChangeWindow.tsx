import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { CommonPanel, FrameSprite } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { usePopupWindowMotion } from '@/shared/lib/commonWindow/popupWindow'
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
 * 공용 창은 `0x55e61(skin, 박스 0 x · y · w · h, 0, 정렬 0x11, 위 띠 0x10, 0, 제목 탭 1, 0)` (0x86cd0~0x86d02 직접 뜸) —
 * 정렬 0x11 은 가로·세로 옮김 비트(0x2 · 0x4 · 0x20 · 0x40)가 없어 박스 0 왼쪽 위 그대로, 제목 탭이 서서 위 띠는 안 본다.
 * 창이 떠 있는 동안에도 0x8b5ac 가 틀마다 0x7fbc4 로 앞 say 상자를 그린다(`EvaluationEventPlayer` 가 남긴다) — 창 뒤 어둡게가 그 위를 덮는다.
 * 여닫기(2026-10-14 직접 뜸 — 0x8d386~0x8d3f0 · 0x754f8): 띄운 쪽이 [창+0x290] = 0 으로 끄고 키 콜백 없이 키 표에 −5 · '5' 를 넣는다.
 * 그래서 띄운 그림은 펼침 표시([+0x214]) 때문에 글을 안 그리고(0x7479c), 다음 갱신의 첫 갈래(0x7550a~)가 펼침을 끈 뒤 그 갱신에 키 표를 본다.
 * 키가 [+0x215] 를 세우면 그다음 갱신 첫 갈래가 줄임 없이 0x742a8 · 0x75440 — 창은 키 뒤 한 갱신 더 남는다(`popupWindow` 의 `expands: false`).
 */
export function EvaluationChangeWindow({ values, goals, year, game, onClose }: EvaluationChangeWindowProps) {
  const modeUiOrigins = useFrameOrigins(MODE_UI)
  const navyFilterId = `palette3-${useId().replace(/:/g, '')}`
  const update = useUpdateCounter()
  const layout = evaluationChangeWindowLayoutOf(values, goals)
  const { window: area } = EVALUATION_CHANGE_BOXES

  // 레이아웃이 없는 환경(측정 높이 0 — 시험)에서는 `MessageBox` 처럼 여닫기 틀을 건너뛴다
  const overlayRef = useRef<HTMLDivElement>(null)
  const [hasNoLayout, setHasNoLayout] = useState(false)
  useLayoutEffect(() => {
    if ((overlayRef.current?.offsetHeight ?? 0) <= 0) setHasNoLayout(true)
  }, [])
  // 0x8d386: 0x741a1(높이 0, 그리기 0x8a361, 키 없음) 뒤 [창+0x290] = 0(0x8d39e~0x8d3a8) · 키 표 −5 · '5' → 0
  const motion = usePopupWindowMotion({ targetHeight: 0, expands: false, skipsMotion: hasNoLayout })
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const close = () => motion.close('줄임', () => onCloseRef.current())

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ' && event.key !== '5') return
      event.preventDefault()
      close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  if (motion.isClosed) return null
  // 띄운 그림은 [창+0x214] 라 0x7479c 가 그리기 콜백을 안 부른다 — 뒤 어둡게만
  const isOpening = motion.openingHeight !== null

  return (
    // 뒤 어둡게 — 이벤트 장면의 창은 떠 있는 그리기마다 검정 6/16 (0x746cc, `EVENT_WINDOW_DIM_OPACITY`)
    <div className={windowStyles.overlay} data-testid="경기-평가-변화-창" role="dialog" aria-label="경기 평가 변화" onClick={close}
      ref={overlayRef} style={{ background: `rgba(0, 0, 0, ${EVENT_WINDOW_DIM_OPACITY})` }}>
      <div style={{ visibility: isOpening ? 'hidden' : undefined }}>
      <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden>
        <filter id={navyFilterId} colorInterpolationFilters="sRGB">
          {/* 흰 글자(R=G=B) → img_text 팔레트 3 두 색 — 올해의 목표 창과 같은 1차식 */}
          <feColorMatrix type="matrix"
            values={'1.5625 0 0 0 -1.40172  0 2.3125 0 0 -2.02623  0 0 3.625 0 -2.97794  0 0 0 1 0'} />
        </filter>
      </svg>
      <CommonPanel x={area.x} y={area.y} width={area.width} height={area.height} titleTab />
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
    </div>
  )
}

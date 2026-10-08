import { useId } from 'react'
import { FrameSprite } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import * as windowStyles from '@/shared/ui/GameWindow/GameWindow.css'
import { YEAR_GOAL_BOXES, YEAR_GOAL_MODE_UI_FRAME, yearGoalWindowLayoutOf } from '@/pages/story/lib/yearGoalWindow'
import type { YearGoalWindowSource } from '@/pages/story/lib/yearGoalWindow'
import { EVENT_WINDOW_DIM_OPACITY } from '@/pages/story/lib/eventDialogue'

const MODE_UI = './sprites/mode_ui/frames'
const IMG_TEXT = './sprites/img_text/frames'
const NUM = './sprites/num'
const pad = (frame: number) => String(frame).padStart(3, '0')

/**
 * **올해의 목표 창** — 이벤트 system sub 1 (그리기 0x86fdc · 0x8656c, 배치는 `pages/story/lib/yearGoalWindow`).
 * 나리 두 편(묶음 0~2)과 시즌모드(모드 2 갈래, 묶음 3)가 같은 창을 쓴다.
 * 240×320 화면 좌표 그대로 이야기 덮개 위에 놓는다. 누르면(원본 OK · '5') 닫힌다 — 키는 재생기(`useEventPlayback`)가 받는다.
 * ⚠️ 공용 창 0x55e61 의 그림은 웹 공용 근사(`GameWindow.css` window)다 — 선 목록만 확인됐다.
 * 창이 떠 있는 동안에도 대화창 0x8b5ac 가 틀마다 0x7fbc4 로 앞 say 상자를 그린다 — 창은 그 위다(`StoryScreen` 이 상자를 남긴다).
 */
export function YearGoalWindow({ values, onClose }: { readonly values: YearGoalWindowSource; readonly onClose: () => void }) {
  const modeUiOrigins = useFrameOrigins(MODE_UI)
  const navyFilterId = `palette3-${useId().replace(/:/g, '')}`
  const layout = yearGoalWindowLayoutOf(values)
  const { window: area } = YEAR_GOAL_BOXES
  return (
    // 뒤 어둡게 — 이벤트 장면의 창은 떠 있는 그리기마다 검정 6/16 (0x746cc, `EVENT_WINDOW_DIM_OPACITY`)
    <div className={windowStyles.overlay} data-testid="올해의-목표-창" onClick={onClose}
      style={{ background: `rgba(0, 0, 0, ${EVENT_WINDOW_DIM_OPACITY})` }}>
      <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden>
        <filter id={navyFilterId} colorInterpolationFilters="sRGB">
          {/* 흰 글자(R=G=B) → img_text 팔레트 3 두 색. 255 → 41·73·165, 239 → 16·36·107 이 되는 1차식 */}
          <feColorMatrix type="matrix"
            values={'1.5625 0 0 0 -1.40172  0 2.3125 0 0 -2.02623  0 0 3.625 0 -2.97794  0 0 0 1 0'} />
        </filter>
      </svg>
      <div className={windowStyles.window} style={{ left: area.x, top: area.y, width: area.width, height: area.height }} />
      <FrameSprite folder={MODE_UI} frame={YEAR_GOAL_MODE_UI_FRAME} origins={modeUiOrigins} x={0} y={0} />
      {layout.texts.map((piece, index) => (
        <img key={`t${index}`} className={windowStyles.layer} src={`${IMG_TEXT}/${pad(piece.frame)}.png`} alt=""
          data-frame={piece.frame}
          style={{ left: piece.x, top: piece.y, filter: piece.palette === 3 ? `url(#${navyFilterId})` : undefined }} />
      ))}
      {layout.numbers.map((piece, index) => (
        <img key={`n${index}`} className={windowStyles.layer} src={`${NUM}/${pad(piece.frame)}.png`} alt=""
          style={{ left: piece.x, top: piece.y }} />
      ))}
    </div>
  )
}

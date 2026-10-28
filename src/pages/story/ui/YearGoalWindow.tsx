import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CommonPanel, FrameSprite, useImgTextPalettes } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { usePopupWindowMotion } from '@/shared/lib/commonWindow/popupWindow'
import * as windowStyles from '@/shared/ui/GameWindow/GameWindow.css'
import { YEAR_GOAL_BOXES, YEAR_GOAL_MODE_UI_FRAME, yearGoalWindowLayoutOf } from '@/pages/story/lib/yearGoalWindow'
import type { YearGoalWindowSource } from '@/pages/story/lib/yearGoalWindow'
import { EVENT_WINDOW_DIM_OPACITY } from '@/pages/story/lib/eventDialogue'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const MODE_UI = assetUrl('./sprites/mode_ui/frames')
const IMG_TEXT = assetUrl('./sprites/img_text/frames')
const NUM = assetUrl('./sprites/num')
const pad = (frame: number) => String(frame).padStart(3, '0')

/**
 * **올해의 목표 창** — 이벤트 system sub 1 (그리기 0x86fdc · 0x8656c, 배치는 `pages/story/lib/yearGoalWindow`).
 * 나리 두 편(묶음 0~2)과 시즌모드(모드 2 갈래, 묶음 3)가 같은 창을 쓴다.
 * 240×320 화면 좌표 그대로 이야기 덮개 위에 놓는다. 누르면(원본 OK · '5') 닫힌다 — 창이 키를 잡는다(재생기 `useEventPlayback` 보다 앞).
 * 여닫기(2026-10-14 직접 뜸 — 0x8d304~0x8d384 · 0x754f8): 높이 0 · 키 콜백 없이 키 표에 −5 · '5' 를 넣는다. 띄운 그림은 글을 안 그리고
 * 다음 갱신에 펼침이 끝나며(그 갱신의 키는 안 본다), OK 는 [창+0x215] 를 세워 폭 240 → 120 → 닫힘 · 0x75440 — 판이 없어(0x744c4 는
 * [+0x20e] == 0 이면 안 긋는다) 줄임은 안 보이고 글이 두 갱신 더 남는다. 다음 명령은 다 닫힌 뒤(0x8d91c).
 * 공용 창은 `0x55e61(skin, 박스 0 x · y · w · h, 0, 정렬 0x11, 위 띠 0x10, 0, 제목 탭 1, 0)` (0x8700e~0x8703a 직접 뜸) —
 * 정렬 0x11 은 가로·세로 옮김 비트(0x2 · 0x4 · 0x20 · 0x40)가 없어 박스 0 왼쪽 위 그대로, 제목 탭이 서서 위 띠는 안 본다.
 * 창이 떠 있는 동안에도 대화창 0x8b5ac 가 틀마다 0x7fbc4 로 앞 say 상자를 그린다 — 창은 그 위다(`StoryScreen` 이 상자를 남긴다).
 */
export function YearGoalWindow({ values, onClose }: { readonly values: YearGoalWindowSource; readonly onClose: () => void }) {
  const modeUiOrigins = useFrameOrigins(MODE_UI)
  // img_text 팔레트 — 제목 3 · 나머지 0. 시즌 이름표 47 "순위" 는 팔레트 3 으로 구워 둔 프레임이라 팔레트 0 자리(0x8664a)에서 흰 글자로 되돌린다
  const palettes = useImgTextPalettes()
  const layout = yearGoalWindowLayoutOf(values)
  const { window: area } = YEAR_GOAL_BOXES
  // 레이아웃이 없는 환경(측정 높이 0 — 시험)에서는 `MessageBox` 처럼 여닫기 틀을 건너뛴다
  const overlayRef = useRef<HTMLDivElement>(null)
  const [hasNoLayout, setHasNoLayout] = useState(false)
  useLayoutEffect(() => {
    if ((overlayRef.current?.offsetHeight ?? 0) <= 0) setHasNoLayout(true)
  }, [])
  // 0x8d304: 0x741a1(높이 0, 그리기 0x8a351, 키 없음) · 키 표 −5 · '5' → 0 — [창+0x290] 은 1 그대로
  const motion = usePopupWindowMotion({ targetHeight: 0, skipsMotion: hasNoLayout })
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  // 키 표 갈래(0x75670~0x756b6)는 [창+0x215] = 1 — 판이 없어 줄임은 안 보이고 글만 두 갱신 더 남는다
  const close = () => motion.close('줄임', () => onCloseRef.current())

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ' && event.key !== '5') return
      // 창이 떠 있는 동안 키는 창 것이다 — 재생기(`useEventPlayback`)가 같은 키로 또 닫지 않게 잡는 단계에서 멈춘다
      event.stopImmediatePropagation()
      event.preventDefault()
      close()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  })

  if (motion.isClosed) return null

  return (
    // 뒤 어둡게 — 이벤트 장면의 창은 떠 있는 그리기마다 검정 6/16 (0x746cc, `EVENT_WINDOW_DIM_OPACITY`)
    <div
      className={windowStyles.overlay}
      data-testid="올해의-목표-창"
      onClick={close}
      ref={overlayRef}
      style={{ background: `rgba(0, 0, 0, ${EVENT_WINDOW_DIM_OPACITY})` }}
    >
      {/* 띄운 그림은 [창+0x214] 라 그리기 콜백을 안 부른다(0x7479c) — 뒤 어둡게만 */}
      <div style={{ visibility: motion.openingHeight !== null ? 'hidden' : undefined }}>
        {palettes.definition}
        <CommonPanel x={area.x} y={area.y} width={area.width} height={area.height} titleTab />
        <FrameSprite folder={MODE_UI} frame={YEAR_GOAL_MODE_UI_FRAME} origins={modeUiOrigins} x={0} y={0} />
        {layout.texts.map((piece, index) => (
          <img
            key={`t${index}`}
            className={windowStyles.layer}
            src={`${IMG_TEXT}/${pad(piece.frame)}.png`}
            alt=""
            data-frame={piece.frame}
            style={{ left: piece.x, top: piece.y, ...palettes.styleOf(piece.frame, piece.palette) }}
          />
        ))}
        {layout.numbers.map((piece, index) => (
          <img
            key={`n${index}`}
            className={windowStyles.layer}
            src={`${NUM}/${pad(piece.frame)}.png`}
            alt=""
            style={{ left: piece.x, top: piece.y }}
          />
        ))}
      </div>
    </div>
  )
}

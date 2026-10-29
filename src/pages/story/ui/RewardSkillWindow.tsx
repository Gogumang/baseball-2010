import { useEffect, useLayoutEffect, useRef } from 'react'
import { MarkupText } from '@/shared/ui'
import { popupBoxStyleOf, usePopupWindowMotion } from '@/shared/lib/commonWindow/popupWindow'
import * as boxStyles from '@/shared/ui/MessageBox/MessageBox.css'
import { EVENT_WINDOW_DIM_OPACITY, SCREEN_HEIGHT, SCREEN_WIDTH } from '@/pages/story/lib/eventDialogue'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import { REWARD_SKILL_WINDOW } from '@/pages/story/lib/rewardSkillWindow'

const IMG_TEXT = assetUrl('./sprites/img_text/frames')

export function RewardSkillWindow({
  text,
  gained,
  onKey,
  onClose,
}: {
  readonly text: string
  readonly gained: boolean
  /** 키 0x8e054 를 받은 그 갱신 — 0x742a9(그 자리에서 치움) · [mgr+8] = 1 (다음 명령) */
  readonly onKey?: () => void
  /** 창이 치워졌다 — 키와 같은 자리(닫힘 애니 없음) */
  readonly onClose: () => void
}) {
  const motion = usePopupWindowMotion({ targetHeight: REWARD_SKILL_WINDOW.height })
  const onCloseRef = useRef(onClose)
  const onKeyRef = useRef(onKey)
  useLayoutEffect(() => {
    onCloseRef.current = onClose
    onKeyRef.current = onKey
  })

  // 0x8e054 → 0x742a9: [창+0x215] 를 켜지 않고 그 자리에서 치운다 — 펼치는 동안은 키 콜백이 불리지 않는다(0x75556)
  const close = () =>
    motion.close('바로', () => {
      onKeyRef.current?.()
      onCloseRef.current()
    })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      event.stopImmediatePropagation()
      // 0x8e054 — OK(−5 · Enter · Space) · '5' · CLR(−16 · Escape · Backspace)
      if (!['Enter', ' ', '5', 'Escape', 'Backspace'].includes(event.key)) return
      event.preventDefault()
      close()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  })

  if (motion.isClosed) return null

  const frame = gained ? REWARD_SKILL_WINDOW.gainedFrame : REWARD_SKILL_WINDOW.removedFrame
  const imageLeft = Math.trunc((SCREEN_WIDTH - (REWARD_SKILL_WINDOW.frameWidth[frame] ?? 0)) / 2)
  const boxTop = (SCREEN_HEIGHT - REWARD_SKILL_WINDOW.height) / 2
  const isOpening = motion.openingHeight !== null

  return (
    <div
      className={boxStyles.dim}
      role="dialog"
      aria-label="스킬 보상"
      data-testid="스킬-보상-창"
      style={{ background: `rgba(0, 0, 0, ${EVENT_WINDOW_DIM_OPACITY})` }}
      onClick={close}
    >
      <div className={boxStyles.box} style={{ ...popupBoxStyleOf(motion, REWARD_SKILL_WINDOW.height), padding: 0, overflow: 'hidden' }}>
        {/* 펼치는 동안에는 안을 안 그린다 (0x7479c) */}
        <div style={{ visibility: isOpening ? 'hidden' : undefined }}>
          <img
            src={`${IMG_TEXT}/${String(frame).padStart(3, '0')}.png`}
            alt=""
            data-frame={frame}
            style={{ position: 'absolute', left: imageLeft, top: REWARD_SKILL_WINDOW.imageTop - boxTop, imageRendering: 'pixelated' }}
          />
          <div
            className={boxStyles.text}
            data-part="글"
            style={{ position: 'absolute', left: 0, top: REWARD_SKILL_WINDOW.textTop - boxTop, marginLeft: 0, width: SCREEN_WIDTH }}
          >
            <MarkupText raw={text} />
          </div>
        </div>
      </div>
    </div>
  )
}

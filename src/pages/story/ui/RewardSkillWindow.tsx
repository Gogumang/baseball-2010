import { useEffect, useRef } from 'react'
import { MarkupText } from '@/shared/ui'
import { popupBoxStyleOf, usePopupWindowMotion } from '@/shared/lib/commonWindow/popupWindow'
import * as boxStyles from '@/shared/ui/MessageBox/MessageBox.css'
import { EVENT_WINDOW_DIM_OPACITY, SCREEN_HEIGHT, SCREEN_WIDTH } from '@/pages/story/lib/eventDialogue'

const IMG_TEXT = './sprites/img_text/frames'

/**
 * **스킬 보상 창** — 보상 명령의 첫 종류가 4 일 때(0x8d6bc~0x8d708) 공용 창 대신 띄운다.
 * ```
 * 0x8d6bc  0x1552af4 = 0x8beb8 글 · 0x741a1(창, 높이 0x64, 그리기 값 > 0 ? 0x8e0b1 : 0x8e0a5, 키 0x8e081, mgr)
 * 0x741a0  [창+0x20e] = 100(목표 높이) · [창+0x212] = 6(처음 그리는 높이) · [창+0x210] = W · 종류 [창+8] = 8
 * 그리기   0x87108(창, 획득 1 / 제거 0): 0x913e5(img_text 애니, 0) — 팔레트 0
 *          img_text 프레임 370(획득) / 371(제거)을 ((W − 폭)/2, (H − 100)/2 + 14) 에
 *          0xba268(0x1552af4, x 0, y H/2 − 5, 폭 W, 흰색, 0) → 0x6ef4c 글 (줄 높이 14)
 * 키       0x8e054: OK −5 · '5' · CLR −16 → 0x742a9(창) 닫기 · [mgr+8] = 1 (다음 명령)
 * ```
 * 창 판(0x746cc)은 공용 알림과 같은 띠다 — 웹은 `MessageBox` 의 판 모양을 높이 100 으로 쓴다. 뒤 어둡게는 이벤트 장면의 6/16.
 * 열림은 공용 갱신 0x75556 이 높이를 6 에서 ×2 로 키우고(6 → 12 → 24 → 48 → 96 → 100), 그동안은 키 콜백을 안 부른다.
 * **닫힘 애니가 없다** (2026-10-14 직접 뜸): 키 0x8e054 는 0x8e064~0x8e06a 에서 0x742a9 를 바로 부른다 — [창+0x215](폭 ÷2)를
 * 켜지 않고 [창+9] = 0 으로 그 자리에서 치우며 대기 칸(0x75440)도 안 띄운다. 그 갱신에 [mgr+8] = 1 이라 다음 명령이 돈다 —
 * `onKey` · `onClose` 둘 다 키를 받은 그 자리다(`popupWindow` 머리말).
 */
export const REWARD_SKILL_WINDOW = {
  height: 100,
  openStartHeight: 6,
  /** img_text 프레임 — 획득 · 제거 */
  gainedFrame: 370,
  removedFrame: 371,
  /** img_text 370 · 371 의 크기 (origins.json) */
  frameWidth: { 370: 42, 371: 41 } as Readonly<Record<number, number>>,
  imageTop: (SCREEN_HEIGHT - 100) / 2 + 14,
  textTop: SCREEN_HEIGHT / 2 - 5,
} as const

export function RewardSkillWindow({ text, gained, onKey, onClose }: {
  readonly text: string
  readonly gained: boolean
  /** 키 0x8e054 를 받은 그 갱신 — 0x742a9(그 자리에서 치움) · [mgr+8] = 1 (다음 명령) */
  readonly onKey?: () => void
  /** 창이 치워졌다 — 키와 같은 자리(닫힘 애니 없음) */
  readonly onClose: () => void
}) {
  const motion = usePopupWindowMotion({ targetHeight: REWARD_SKILL_WINDOW.height })
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const onKeyRef = useRef(onKey)
  onKeyRef.current = onKey

  // 0x8e054 → 0x742a9: [창+0x215] 를 켜지 않고 그 자리에서 치운다 — 펼치는 동안은 키 콜백이 불리지 않는다(0x75556)
  const close = () => motion.close('바로', () => {
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
    <div className={boxStyles.dim} role="dialog" aria-label="스킬 보상" data-testid="스킬-보상-창"
      style={{ background: `rgba(0, 0, 0, ${EVENT_WINDOW_DIM_OPACITY})` }} onClick={close}>
      <div className={boxStyles.box}
        style={{ ...popupBoxStyleOf(motion, REWARD_SKILL_WINDOW.height), padding: 0, overflow: 'hidden' }}>
        {/* 펼치는 동안에는 안을 안 그린다 (0x7479c) */}
        <div style={{ visibility: isOpening ? 'hidden' : undefined }}>
          <img src={`${IMG_TEXT}/${String(frame).padStart(3, '0')}.png`} alt="" data-frame={frame}
            style={{ position: 'absolute', left: imageLeft, top: REWARD_SKILL_WINDOW.imageTop - boxTop, imageRendering: 'pixelated' }} />
          <div className={boxStyles.text} data-part="글"
            style={{ position: 'absolute', left: 0, top: REWARD_SKILL_WINDOW.textTop - boxTop, marginLeft: 0, width: SCREEN_WIDTH }}>
            <MarkupText raw={text} />
          </div>
        </div>
      </div>
    </div>
  )
}

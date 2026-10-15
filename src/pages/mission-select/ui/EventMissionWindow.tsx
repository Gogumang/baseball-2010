import { useEffect, useRef } from 'react'
import { MarkupText } from '@/shared/ui'
import { popupBoxStyleOf, usePopupWindowMotion } from '@/shared/lib/commonWindow/popupWindow'
import * as boxStyles from '@/shared/ui/MessageBox/MessageBox.css'
import { POPUP_DIM_OPACITY } from '@/shared/ui/MessageBox/popupDim'
import { EVENT_MISSION_WINDOW } from '@/pages/mission-select/lib/missionSelectLayout'

const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320

/** 이벤트 미션 창의 답 — 키 0x1dcb0 이 고른 하위 상태 */
export type EventMissionAnswer = '미션실행' | '미션다운' | '취소'

/**
 * **이벤트 미션 창** — 미션 고르기 격자 칸 14 에서 OK 를 누르면 키 0x1daa4(0x1db06)가 연다.
 * ```
 * 0x1db06  칸 == 14 → 0x741a1(창, 높이 0x64, 그리기 0x1dd59, 키 0x1dcb1, this)
 * 그리기   0x1dd58: StrMAINMENU[56] 를 (W/2 − 0x58, H/2 − 0x23, 폭 0xb0)
 *          "!C!cFFFFFF미션실행"(0xcd6f0) (W/2 − 0x50, H/2 + 0x14, 폭 0x50) · "!C!cFFFFFF미션다운"(0xcd704) (W/2, H/2 + 0x14, 폭 0x50)
 *          [this+0xa0] ≠ 0 → 노란 "미션실행"(0xcd718) 을, 0 → 노란 "미션다운"(0xcd72c) 을 같은 자리에 덧그린다
 * 키       0x1dcb0: ← → '4' '6' → [this+0xa0] 뒤집기 · CLR → 닫기, 하위 0
 *          OK · '5' → 닫기, [this+0xa0] ≠ 0 ? ([미션+0xa4] ≠ 0 ? 하위 5 (칸 14 경기) : 하위 3) : 하위 2 (장면 상태 2 = 0x1e798 통신)
 *          ↑ ↓ 는 받지 않는다
 * ```
 * [this+0xa0] 은 장면 진입 0x1d9a4(0x1da06~0x1da0e)가 1(미션실행)로 두고 창은 건드리지 않는다 — 창을 다시 열어도 앞의 고름이 남는다.
 * 창 판·열림은 공용 0x741a0 창 그대로다: 높이 6 에서 ×2 로 100 까지(0x75556), 그동안은 키 콜백을 안 부른다 — 뒤집기도 안 된다.
 * **닫힘 애니가 있다** (2026-10-14 직접 뜸): 키 0x1dcb0 은 CLR(0x1dcda~0x1dce8) · 확인(0x1dd0e~0x1dd24) 모두 [창+0x215] = 1 을 쓴다 —
 * 다음 갱신부터 폭 240 → 120 → 닫힘 · 0x75440(대기 칸) (`popupWindow` 머리말). 줄이는 동안에도 키는 안 받는다.
 * 키 콜백은 하위 상태([this+0x18])를 키를 받은 그 갱신에 바꾼다(0x1dcdc · 0x1dd38) — `onKey`. 그 하위 상태를 보는 것은 장면 키
 * 함수 0x1daa4 인데(하위 3 0x1dc00 이 0x74ef5 알림 · 하위 5 가 경기), 미션 고르기 틀 0x1ea98 은 창이 떠 있는 동안(줄이는 동안 ·
 * 닫는 갱신 포함 — 0x754f9 는 늘 1) 그 키 함수를 건너뛴다(1eaac). 그래서 하위 상태는 창이 다 닫힌 **다음 갱신**에 돈다 — `onClosed`
 * 뒤 한 갱신은 부르는 쪽의 몫이다.
 * 뒤 어둡게: 미션 장면 생성자 0x1d784(0x1d786~0x1d79e)가 [창+0x24f] = 0 · [창+0x24c] = 1 이라 0x741a0 이 [창+0x24e] = 0 을
 * 옮겨 0x746cc 가 떠 있는 그리기마다 검정 단계 5 = 6/16 으로 덮는다 (`POPUP_DIM_OPACITY`).
 */
export function EventMissionWindow({ isRunSelected, onToggle, onKey, onClosed }: {
  /** [this+0xa0] ≠ 0 — 미션실행 쪽 */
  readonly isRunSelected: boolean
  readonly onToggle: () => void
  /** 키를 받은 그 갱신에 고른 하위 상태 (0x1dcdc · 0x1dd38) */
  readonly onKey: (answer: EventMissionAnswer) => void
  /** 창이 다 닫혔다 (폭 99 이하 — 0x742a8) */
  readonly onClosed: () => void
}) {
  const motion = usePopupWindowMotion({ targetHeight: EVENT_MISSION_WINDOW.height })
  const latest = useRef({ onKey, onClosed })
  latest.current = { onKey, onClosed }

  // 0x1dcb0 은 하위 상태를 쓰고 [창+0x215] = 1 — 다음 갱신부터 폭 240 → 120 → 닫힘(0x7558a~0x755d8)
  const close = (answer: EventMissionAnswer) => {
    if (!motion.close('줄임', () => latest.current.onClosed())) return
    latest.current.onKey(answer)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      event.stopImmediatePropagation()
      const isHandled = ['ArrowLeft', 'ArrowRight', '4', '6', 'Enter', ' ', '5', 'Escape', 'Backspace'].includes(event.key)
      if (isHandled) event.preventDefault()
      // 펼치는 동안 · 줄이는 동안은 키 콜백을 부르지 않는다 (0x75556 · 0x7558a) — 뒤집기도 안 된다
      if (!isHandled || !motion.acceptsKeys()) return
      if (['ArrowLeft', 'ArrowRight', '4', '6'].includes(event.key)) return onToggle()
      if (['Enter', ' ', '5'].includes(event.key)) return void close(isRunSelected ? '미션실행' : '미션다운')
      close('취소')
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  })

  if (motion.isClosed) return null

  const boxTop = (SCREEN_HEIGHT - EVENT_MISSION_WINDOW.height) / 2
  const isOpening = motion.openingHeight !== null
  const { text, run, download } = EVENT_MISSION_WINDOW

  return (
    <div className={boxStyles.dim} role="dialog" aria-label="이벤트 미션" data-testid="이벤트-미션-창"
      style={{ background: `rgba(0, 0, 0, ${POPUP_DIM_OPACITY})` }}>
      <div className={boxStyles.box}
        style={{ ...popupBoxStyleOf(motion, EVENT_MISSION_WINDOW.height), padding: 0, overflow: 'hidden' }} />
      {/* 글은 판 밖 화면 좌표로 그린다 — 0x1dd58 은 판과 상관없이 그리고, 판이 줄어도(0x744c4) 글은 안 잘린다 */}
      <div style={{ position: 'absolute', left: 0, top: boxTop, width: SCREEN_WIDTH }}>
        {/* 펼치는 동안에는 안을 안 그린다 (0x7479c) */}
        <div style={{ visibility: isOpening ? 'hidden' : undefined }}>
          <div className={boxStyles.text} data-part="글"
            style={{ position: 'absolute', left: text.x, top: text.y - boxTop, marginLeft: 0, width: text.width }}>
            <MarkupText raw={text.raw} />
          </div>
          {[run, download].map((label) => {
            const isSelected = (label === run) === isRunSelected
            return (
              <button key={label.raw} type="button" className={boxStyles.text} data-selected={isSelected}
                aria-label={label === run ? '미션실행' : '미션다운'}
                style={{
                  position: 'absolute', left: label.x, top: label.y - boxTop, marginLeft: 0, width: label.width,
                  padding: 0, border: 0, background: 'none',
                }}
                onClick={() => {
                  if (!motion.acceptsKeys()) return
                  if (isSelected) close(label === run ? '미션실행' : '미션다운')
                  else onToggle()
                }}>
                <MarkupText raw={isSelected ? label.selectedRaw : label.raw} />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

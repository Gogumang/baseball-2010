import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@/app/styles/global.css'
import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'
import { MessageBox } from '@/shared/ui/MessageBox/MessageBox'
import { SCREEN_LAYERS } from '@/shared/config/screenLayers'
import * as stageScreen from '@/features/play-game/ui/stageScreen.css'
import * as pitcherStyles from '@/pages/pitching/ui/PitcherGameScreen.css'
import { RecordAlertStageOverlay } from '@/widgets/game-scene/ui/RecordAlertPanel'
import { EMPTY_RECORD_ALERT, accrueRecordGamePoint, drawRecordAlert, fillRecordAlertSlots } from '@/widgets/game-scene/lib/recordAlert'

/**
 * **브라우저 시험 — 기록 달성 알림과 장면 창 · 팝업의 겹 차례** (Q-04 ⑥, r297 · 실제 CSS · z-index).
 *
 * 경기 프레임 0x52c50 은 상태 그리기 표 0xd05a0(돌발 창 0x1b~0x1d · 교체 창 0xb 따위 장면 창) → 53066 알림 0x4e35c → 0x746cd 팝업
 * (일시정지 창 0x741a0 · 0x74ef5 상자) 차례로 그린다. 알림은 누름을 안 받아(pointer-events 없음) `elementFromPoint` 가 못 보므로
 * 시험 동안만 알림에 누름을 켜 맨 위 요소를 본다.
 */

let hitStyle: HTMLStyleElement | null = null
beforeEach(() => {
  hitStyle = document.createElement('style')
  hitStyle.textContent = '[data-testid="기록달성-겹"], [data-testid="기록달성-겹"] * { pointer-events: auto !important; }'
  document.head.append(hitStyle)
})
afterEach(() => {
  cleanup()
  hitStyle?.remove()
})

/** 판이 다 밀려 든 그림 — 폭은 틱마다 두 배라 열 틱이면 100 에 닿는다 */
const frame = (() => {
  let state = fillRecordAlertSlots(accrueRecordGamePoint(EMPTY_RECORD_ALERT, [4]), [4])
  for (let tick = 0; tick < 10; tick += 1) state = drawRecordAlert(state, tick, false).next
  return drawRecordAlert(state, 10, false).frame
})()

/** 알림 칸 가운데의 맨 위 요소 */
function topAtAlert(): Element | null {
  const box = screen.getByTestId('기록달성-칸').getBoundingClientRect()
  return document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
}

const isAlert = (element: Element | null) => element !== null && screen.getByTestId('기록달성-겹').contains(element)

/** 판 전체를 덮는 불투명 칸 — 겹만 바꿔 쓴다 */
const Cover = ({ testId, zIndex }: { readonly testId: string; readonly zIndex?: number }) => (
  <div data-testid={testId} style={{ position: 'absolute', inset: 0, background: '#000', ...(zIndex === undefined ? {} : { zIndex }) }} />
)

describe('기록 달성 알림 겹 — 장면 창 위, 팝업 아래 (0x52c50 53066 → 0x746cd)', () => {
  it('돌발 창(장면 창 겹)이 알림보다 DOM 뒤에 와도 알림이 위다', () => {
    render(
      <RawScreen>
        <RecordAlertStageOverlay frame={frame} />
        <Cover testId="장면창" zIndex={SCREEN_LAYERS.SCENE_WINDOW} />
      </RawScreen>,
    )
    expect(isAlert(topAtAlert())).toBe(true)
  })

  it('겹이 없는 장면 창(교체 창 0xb · 감독 강판 창 0x23)도 알림 아래다', () => {
    render(
      <RawScreen>
        <RecordAlertStageOverlay frame={frame} />
        <Cover testId="교체창" />
      </RawScreen>,
    )
    expect(isAlert(topAtAlert())).toBe(true)
  })

  it('팝업 상자(MessageBox)는 알림 위다', () => {
    render(
      <RawScreen>
        <MessageBox text="그만 던지시겠습니까?" buttons={['예', '아니오']} onAnswer={() => {}} />
        <RecordAlertStageOverlay frame={frame} />
      </RawScreen>,
    )
    expect(isAlert(topAtAlert())).toBe(false)
    expect(screen.getByRole('dialog').contains(topAtAlert())).toBe(true)
  })

  it.each([
    ['타자편 · 팀경기 메뉴 층', stageScreen.menuLayer],
    ['투수편 메뉴 층', pitcherStyles.popupLayer],
  ])('경기 중 메뉴(%s)가 떠 있으면 알림이 메뉴 아래다', (_name, layerClass) => {
    render(
      <RawScreen>
        <RecordAlertStageOverlay frame={frame} isUnderMenu />
        <div className={layerClass}>
          <Cover testId="메뉴" />
        </div>
      </RawScreen>,
    )
    expect(topAtAlert()).toBe(screen.getByTestId('메뉴'))
  })

  it('메뉴가 없을 때의 겹(isUnderMenu 없음)이면 메뉴 층이 알림 아래로 깔린다 — isUnderMenu 가 필요한 까닭', () => {
    render(
      <RawScreen>
        <RecordAlertStageOverlay frame={frame} />
        <div className={stageScreen.menuLayer}>
          <Cover testId="메뉴" />
        </div>
      </RawScreen>,
    )
    expect(isAlert(topAtAlert())).toBe(true)
  })
})

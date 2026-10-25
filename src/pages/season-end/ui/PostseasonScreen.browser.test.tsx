import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { CSSProperties } from 'react'
import '@/app/styles/global.css'
import { PostseasonScreen } from '@/pages/season-end/ui/PostseasonScreen'
import type { PostseasonPopup } from '@/entities/career/model/postseasonFlow'
import { startPostseason } from '@/entities/league/model/league'

/**
 * **브라우저 시험 — 나리 포스트시즌 대진(상태 128) 위 알림 팝업이 판 가운데에 서는가** (r251 · 실제 CSS · zoom).
 *
 * 사용자 보고(아이폰 Safari): 대진 화면의 "한국시리즈 우승" 팝업이 가운데가 아니라 왼쪽으로 쏠렸다.
 * 원본 공용 창 0xbbef9 의 판 그리기 0x744c4 는 x = (W − 폭[+0x210]) >> 1 (0x744de~0x744f6) — 폭 240 이면 판 가운데다.
 * 예전 `PostseasonScreen` 은 상자를 대진 판(`RawScreen`, zoom 이 걸린 240×320) **밖** 형제로 두어, 상자가 zoom 없는
 * 바깥 칸의 왼쪽(left 0 · 폭 240 CSS px)에 섰다.
 */

afterEach(cleanup)

/** 앱 겉칸처럼 판보다 넓고 zoom 이 걸린 자리 — 판(240×320)이 배율 1.5 로 가운데에 선다 */
const SHELL_STYLE = {
  position: 'relative',
  width: '390px',
  height: '600px',
  '--zoom': '1.5',
  '--game-height': '600px',
} as CSSProperties

const POPUPS: readonly PostseasonPopup[] = [
  { kind: '한국시리즈우승' },
  { kind: '우승발표', champion: 3 },
  { kind: '정규시즌우승' },
]

async function stableRect(element: Element): Promise<DOMRect> {
  let last = ''
  await waitFor(() => {
    const now = JSON.stringify(element.getBoundingClientRect())
    const isStill = now === last && element.getBoundingClientRect().height > 20
    last = now
    expect(isStill).toBe(true)
  }, { timeout: 3000, interval: 50 })
  return element.getBoundingClientRect()
}

describe('나리 포스트시즌 대진 위 팝업 — 판 가운데 (r251)', () => {
  it.each(['타자편', '투수편'] as const)('%s: 세 팝업 모두 상자 중심이 판 중심과 같고 폭이 판 폭(240)이다', async (edition) => {
    for (const popup of POPUPS) {
      render(
        <div style={SHELL_STYLE}>
          <PostseasonScreen edition={edition} gamePoint={0} series={startPostseason([0, 1, 2, 3])} popup={popup}
            onConfirm={() => {}} onClosePopup={() => {}} />
        </div>,
      )
      const stage = document.querySelector('[data-original-screen]')
      expect(stage).not.toBeNull()
      const box = screen.getByRole('dialog', { name: '알림' }).firstElementChild
      expect(box).not.toBeNull()
      // 상자는 판 안에 있어야 한다 — 판 밖이면 zoom · 판 폭 기준을 잃는다
      expect(stage?.contains(box ?? null)).toBe(true)
      const boxRect = await stableRect(box as Element)
      const stageRect = (stage as Element).getBoundingClientRect()
      const scale = stageRect.width / 240
      const dx = (boxRect.left + boxRect.width / 2 - (stageRect.left + stageRect.width / 2)) / scale
      const dy = (boxRect.top + boxRect.height / 2 - (stageRect.top + stageRect.height / 2)) / scale
      expect(Math.abs(dx)).toBeLessThan(0.5)
      expect(Math.abs(dy)).toBeLessThan(1)
      expect(Math.round(boxRect.width / scale)).toBe(240)
      cleanup()
    }
  })
})

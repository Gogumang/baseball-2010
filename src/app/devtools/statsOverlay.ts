import Stats from 'stats.js'

/** stats.js 판 번호 — 0 FPS · 1 프레임 ms · 2 메모리 MB(크롬 계열만) */
const PANELS = [0, 1, 2] as const
const PANEL_WIDTH_PX = 80

/**
 * 화면 왼쪽 위에 FPS · 프레임 시간 · 메모리 판 셋을 나란히 띄운다.
 * 재기만 하는 루프다 — 게임 틱(`frameClock`)과 상관없이 브라우저 그림 틀마다 한 번 센다.
 */
export function showStatsOverlay(): void {
  const meters = PANELS.map((panel, index) => {
    const stats = new Stats()
    stats.showPanel(panel)
    Object.assign(stats.dom.style, { left: `${index * PANEL_WIDTH_PX}px`, pointerEvents: 'none', opacity: '0.8' })
    document.body.append(stats.dom)
    return stats
  })
  const measure = () => {
    for (const stats of meters) stats.update()
    requestAnimationFrame(measure)
  }
  requestAnimationFrame(measure)
}

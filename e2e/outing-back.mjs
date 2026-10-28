// 시연 — 나리 외출 지도에 곧바로 들어가 터치 '뒤로' 상황 버튼을 탭하면 관리(105)로 돌아오는가.
//   e2e/serve.sh && node e2e/outing-back.mjs [chromium|webkit ...]
// 기본은 chromium · webkit 둘 다, 기기는 아이폰 13 꼴(세로 · 터치). 끝나면 단계별 시간을 찍는다.
import { launch, openScene, screenState, shot, tapPage } from './lib/scene.mjs'

const browsers = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['chromium', 'webkit']
let failed = false

for (const browserName of browsers) {
  const times = {}
  let mark = Date.now()
  const lap = (name) => {
    const now = Date.now()
    times[name] = now - mark
    mark = now
  }
  const { browser, page, errors } = await launch(browserName, { device: 'iphone' })
  lap('launch')
  try {
    await openScene(page, 'nari-outing')
    lap('openScene')
    const back = page.locator('#keypad-root button[data-touch-key="Escape"]')
    await back.waitFor({ timeout: 5000 })
    const box = await back.boundingBox()
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    const top = await page.evaluate(({ x, y }) => {
      const element = document.elementFromPoint(x, y)
      return element === null ? null : (element.closest('button[data-touch-key]')?.getAttribute('aria-label') ?? element.tagName)
    }, center)
    await tapPage(page, center.x, center.y)
    await page.waitForFunction(() => window.__sceneProbe?.()?.screen === '관리', null, { timeout: 5000 })
    lap('tap→관리')
    await shot(page, `e2e/.run/outing-back-${browserName}.png`, { full: true })
    const state = await screenState(page)
    console.log(`${browserName}: OK — 버튼 가운데 맨 위 "${top}", 화면 ${state.screen}`, JSON.stringify(times), errors.length > 0 ? errors : '')
  } catch (error) {
    failed = true
    console.log(`${browserName}: FAIL — ${error.message}`, JSON.stringify(times))
    await shot(page, `e2e/.run/outing-back-${browserName}-fail.png`, { full: true }).catch(() => {})
  } finally {
    await browser.close()
  }
}
process.exit(failed ? 1 : 0)

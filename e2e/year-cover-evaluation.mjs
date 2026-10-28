// 확인 — r287 (Q-04 ③ · ⑦): 경기 결과와 116 평가가 따로 서고 평가 대사가 키 · 탭으로 넘어가는가, 국가대항전 끝에 134 대진판이 선 채
// 아홉 틀 어두워진 뒤(그동안 키는 버린다) 137 "N년차" 표지 → 105 로 가는가.
//   E2E_PORT=5410 e2e/serve.sh && E2E_PORT=5410 yarn node e2e/year-cover-evaluation.mjs [chromium|webkit ...]
// 기본은 chromium(데스크톱 · 키) · webkit(아이폰 13 · 탭) 둘 다.
import { launch, openScene, pressKey, screenRect, shot, tapPage } from './lib/scene.mjs'

const browsers = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['chromium', 'webkit']
let failed = false

const screenOf = (page) => page.evaluate(() => window.__sceneProbe?.()?.screen ?? null)

/** 대사 상자를 키(chromium) · 탭(webkit)으로 넘겨 평가 화면을 나갈 때까지 */
async function advanceEvaluation(page, browserName) {
  const rect = await screenRect(page)
  for (let i = 0; i < 40; i += 1) {
    const screen = await screenOf(page)
    if (screen !== '경기평가') return screen
    if (browserName === 'webkit') {
      // 대사 상자 · 변화 창 자리 — 화면 아래쪽 가운데
      await tapPage(page, rect.x + rect.width / 2, rect.y + rect.height * 0.85)
    } else {
      await pressKey(page, 'Enter')
    }
    await page.waitForTimeout(400)
  }
  return screenOf(page)
}

for (const browserName of browsers) {
  const device = browserName === 'webkit' ? 'iphone' : 'desktop'
  const { browser, page, errors } = await launch(browserName, { device })
  try {
    // ③ — 경기 결과(0x19) → OK → 116 평가 → 대사를 넘기면 다음 화면
    await openScene(page, 'nari-evaluation')
    if ((await screenOf(page)) !== '경기평가') throw new Error(`평가 화면이 아니다: ${await screenOf(page)}`)
    await page.waitForSelector('[data-testid="대사-상자"]', { timeout: 5000 })
    if ((await page.$('[data-testid="정산-판"]')) !== null) throw new Error('평가 화면에 정산 판이 남았다')
    await shot(page, `e2e/.run/r287-evaluation-${browserName}.png`)
    const after = await advanceEvaluation(page, browserName)
    if (after === '경기평가') throw new Error('평가 대사가 넘어가지 않는다')
    console.log(`${browserName}: ③ 평가 → ${after}`)

    // ⑦ — 대회 끝 → 134 위 효과기 아홉 틀 → 137 → 105
    await openScene(page, 'nari-cup-win', { timeout: 60000 })
    let sawHold = false
    for (let i = 0; i < 30 && !sawHold; i += 1) {
      if (browserName === 'webkit') {
        const button = page.locator('[role="dialog"] button[aria-label="확인"]').first()
        if ((await button.count()) > 0) await button.tap().catch(() => {})
      } else {
        await pressKey(page, 'Enter')
      }
      for (let k = 0; k < 6 && !sawHold; k += 1) {
        sawHold = (await page.$('[data-testid="연차표지-앞화면-효과기"]')) !== null
        if (!sawHold) await page.waitForTimeout(50)
      }
    }
    if (!sawHold) throw new Error(`앞 화면 효과기 겹이 안 섰다: ${await screenOf(page)}`)
    const holdScreen = await screenOf(page)
    if (holdScreen !== '국가대항전') throw new Error(`효과기 동안 화면 ${holdScreen}`)
    if ((await page.$('[role="dialog"]')) !== null) throw new Error('효과기 동안 팝업이 남았다')
    await shot(page, `e2e/.run/r287-cup-hold-${browserName}.png`)
    // 그동안 키는 버린다 — 대진판 확인(Enter)이 아무 일도 안 한다
    await pressKey(page, 'Enter')
    await page.waitForFunction(() => window.__sceneProbe?.()?.screen === '연차표지', null, { timeout: 5000 })
    await page.waitForTimeout(500)
    await shot(page, `e2e/.run/r287-cover-${browserName}.png`)
    // 표지 — 아무 키(탭)면 곧 105
    for (let i = 0; i < 20 && (await screenOf(page)) === '연차표지'; i += 1) {
      if (browserName === 'webkit') {
        const rect = await screenRect(page)
        await tapPage(page, rect.x + rect.width / 2, rect.y + rect.height / 2)
      } else {
        await pressKey(page, 'Enter')
      }
      await page.waitForTimeout(400)
    }
    const end = await screenOf(page)
    if (end !== '관리' && end !== '이벤트') throw new Error(`표지 뒤 화면 ${end}`)
    console.log(`${browserName}: ⑦ 134 효과기 → 137 → ${end}`, errors.length > 0 ? errors : '')
    if (errors.length > 0) failed = true
  } catch (error) {
    failed = true
    console.log(`${browserName}: FAIL — ${error.message}`)
    await shot(page, `e2e/.run/r287-${browserName}-fail.png`, { full: true }).catch(() => {})
  } finally {
    await browser.close()
  }
}
process.exit(failed ? 1 : 0)

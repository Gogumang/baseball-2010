import { defineConfig } from 'vitest/config'
import type { BrowserCommand } from 'vitest/node'
import { playwright } from '@vitest/browser-playwright'
import { devices } from 'playwright'
import viteConfig from './vite.config.ts'
import { chromiumExecutable } from './e2e/lib/browsers.mjs'

/**
 * **브라우저 모드 시험** — `yarn test:browser`. 파일은 `src/**\/*.browser.test.tsx` 만 줍는다(jsdom 시험 `yarn test` 와 따로).
 *
 * jsdom 에는 vanilla-extract CSS · z-index · zoom 이 안 실려 "창이 누름 칸 아래 깔림" · "아이폰 Safari 에서 버튼이 안 눌림" 을 못 잡는다.
 * 여기서는 앱과 같은 vite 플러그인(react · vanilla-extract)으로 진짜 CSS 를 싣고 chromium · webkit 에서 `elementFromPoint` 로 겹을 본다.
 * webkit 은 아이폰 13 꼴(390×664 · 터치 · 모바일)이다 — Safari 와 같은 엔진.
 */
const { defaultBrowserType: _ignored, viewport: iphoneViewport, ...iphone } = devices['iPhone 13']
const chromiumPath = chromiumExecutable()

/**
 * 시험 쪽에서 부르는 진짜 손가락 탭 — 시험 iframe 안 CSS 좌표(x, y)를 바깥 쪽 좌표로 옮겨 Playwright `touchscreen.tap` 을 쏜다.
 * 터치가 없는 맥락(데스크톱 chromium)이면 마우스 클릭. 돌려주는 값은 실제로 쏜 방법.
 */
const touchTap: BrowserCommand<[x: number, y: number]> = async (context, x, y) => {
  if (context.provider.name !== 'playwright') throw new Error('touchTap 은 playwright 전용')
  const page = context.page
  const frame = await context.frame()
  const element = await frame.frameElement()
  const box = await element.boundingBox()
  if (box === null) throw new Error('시험 iframe 이 안 보인다')
  const innerWidth = await frame.evaluate(() => window.innerWidth)
  const scale = box.width / innerWidth
  const pageX = box.x + x * scale
  const pageY = box.y + y * scale
  const hasTouch = await page.evaluate(() => navigator.maxTouchPoints > 0)
  if (hasTouch) {
    await page.touchscreen.tap(pageX, pageY)
    return 'touch'
  }
  await page.mouse.click(pageX, pageY)
  return 'mouse'
}

export default defineConfig({
  ...viteConfig,
  test: {
    include: ['src/**/*.browser.test.tsx'],
    setupFiles: [
      'src/shared/lib/lazyScreen/preloadForTests.ts',
      'src/shared/config/unlocks/originalUnlocksForTests.ts',
      'src/shared/config/balance/originalBalanceForTests.ts',
    ],
    browser: {
      enabled: true,
      headless: true,
      screenshotFailures: false,
      commands: { touchTap },
      instances: [
        {
          browser: 'chromium',
          name: 'chromium',
          viewport: { width: 1000, height: 800 },
          provider: playwright(chromiumPath === undefined ? {} : { launchOptions: { executablePath: chromiumPath } }),
        },
        {
          browser: 'webkit',
          name: 'webkit-iphone',
          viewport: iphoneViewport,
          provider: playwright({ contextOptions: { ...iphone, viewport: iphoneViewport } }),
        },
      ],
    },
  },
})

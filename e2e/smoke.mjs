// 장면 바로가기 스모크 — 장면 표(src/app/dev/scenes.ts)의 장면을 모두 chromium(데스크톱) · webkit(아이폰 13)에서 연다.
//
//   E2E_PORT=5430 e2e/serve.sh            # 서버 먼저
//   E2E_PORT=5430 yarn node e2e/smoke.mjs  # 모두
//   E2E_PORT=5430 yarn node e2e/smoke.mjs general-bat derby-start   # 몇 개만
//
// 장면마다 새 맥락(빈 localStorage)에서 연다. 진행기가 `ready` 를 적고 쪽 오류(pageerror)가 없으면 통과다.
// 두 브라우저는 함께 돈다. 하나라도 실패하면 끝 코드 1.
import { readFileSync } from 'node:fs'
import { DEVICES, openScene, screenState } from './lib/scene.mjs'
import { chromiumExecutable } from './lib/browsers.mjs'
import { chromium, webkit } from 'playwright'

const SCENES_FILE = new URL('../src/app/dev/scenes.ts', import.meta.url)

/** 장면 표의 이름들 — `export const SCENES` 아래 맨 앞 칸 열쇠 */
function sceneNames() {
  const source = readFileSync(SCENES_FILE, 'utf8')
  const table = source.slice(source.indexOf('export const SCENES'))
  return [...table.matchAll(/^ {2}'?([a-z][a-z0-9-]*)'?: \{/gm)].map((match) => match[1])
}

/** 공을 여러 번 보내야 닿는 장면 — 넉넉히 기다린다 */
const LONG_SCENES = new Set(['nari-burst-result', 'mission-result'])

const RUNS = [
  { browserName: 'chromium', device: 'desktop' },
  { browserName: 'webkit', device: 'iphone' },
]

async function runBrowser({ browserName, device }, names) {
  const type = browserName === 'webkit' ? webkit : chromium
  const executablePath = browserName === 'webkit' ? undefined : chromiumExecutable()
  const browser = await type.launch({ headless: true, ...(executablePath === undefined ? {} : { executablePath }) })
  const results = []
  try {
    for (const scene of names) {
      const context = await browser.newContext(DEVICES[device])
      const page = await context.newPage()
      // 웹폰트 CDN(Galmuri)은 끊는다 — 콘솔의 net::ERR_FAILED 는 이것이다(그림은 같은 서버의 원본 글꼴로 그린다)
      await page.route(/cdn\.jsdelivr\.net/, (route) => route.abort())
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      const started = Date.now()
      let error = null
      try {
        // nari-burst-result(약 45초) · mission-result(약 55초)는 씨앗 · 투구 제한까지 공을 보낸다
        await openScene(page, scene, { timeout: LONG_SCENES.has(scene) ? 240000 : 60000 })
      } catch (caught) {
        error = String(caught).slice(0, 300)
      }
      const ms = Date.now() - started
      if (error === null && errors.length > 0) error = `pageerror: ${errors[0]}`
      const state = error === null ? null : await screenState(page).catch(() => null)
      results.push({ browserName, scene, ms, error, state })
      console.log(`${error === null ? 'ok  ' : 'FAIL'} ${browserName.padEnd(8)} ${scene.padEnd(20)} ${String(ms).padStart(6)}ms${error === null ? '' : `  ${error}`}`)
      await context.close()
    }
  } finally {
    await browser.close()
  }
  return results
}

const asked = process.argv.slice(2)
const names = asked.length > 0 ? asked : sceneNames()
const started = Date.now()
const all = (await Promise.all(RUNS.map((run) => runBrowser(run, names)))).flat()
const failed = all.filter((result) => result.error !== null)
console.log(`\n${all.length - failed.length}/${all.length} 통과 · ${((Date.now() - started) / 1000).toFixed(1)}초 (장면 ${names.length}개 × 브라우저 ${RUNS.length})`)
for (const result of failed) console.log(`  실패 ${result.browserName} ${result.scene}: ${result.error} — 화면 ${JSON.stringify(result.state)}`)
process.exit(failed.length === 0 ? 0 : 1)

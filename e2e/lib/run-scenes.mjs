// 장면 × 기기 일감을 맥락 몇 개로 돌린다 — 일감마다 새 맥락(빈 localStorage)에서 장면을 열고 누름 칸을 훑는다(`checkSceneHits`).
// `e2e/quick.mjs`(전부) · `e2e/only.mjs`(골라) 가 같이 쓴다. `E2E_URL` 을 정한 뒤에 불러야 한다(scene.mjs 가 주소를 굳힌다).
import { chromium, webkit } from 'playwright'
import { DEVICES } from './scene.mjs'
import { chromiumExecutable } from './browsers.mjs'
import { checkSceneHits } from './hits-scene.mjs'
import { DEVICE_SETS } from './devices.mjs'

/**
 * `jobs`: `[{ scene, device }]` (이 차례로 꺼낸다). `concurrency`: 브라우저마다 함께 여는 맥락 수 `{ chromium, webkit }`.
 * `states`: 상태 이름 → 참(고른 상태만). `real`: 스냅샷을 안 쓰고 실제 진행 길로 연다.
 * 돌려주는 것: `{ done: [{ scene, device, ms, openMs, results, reopened }], staleSnapshots, peakContexts, browsers }`
 */
export async function runScenes({ jobs, concurrency, states, real = false, verbose = false }) {
  const browsers = {}
  const done = []
  /** 스냅샷이 낡아 실제 진행 길로 연 장면 */
  const staleSnapshots = new Set()
  let openContexts = 0
  let peakContexts = 0
  try {
    for (const browserName of new Set(jobs.map((job) => DEVICE_SETS[job.device][0]))) {
      const executablePath = browserName === 'webkit' ? undefined : chromiumExecutable()
      browsers[browserName] = await (browserName === 'webkit' ? webkit : chromium).launch({ headless: true, ...(executablePath === undefined ? {} : { executablePath }) })
    }
    /** 장면 하나를 새 맥락에서 — `query` 는 바로가기 주소에 더할 것 */
    const checkOnce = async (scene, device, query) => {
      const [browserName, deviceKind, orientation] = DEVICE_SETS[device]
      const context = await browsers[browserName].newContext(DEVICES[deviceKind])
      peakContexts = Math.max(peakContexts, ++openContexts)
      const page = await context.newPage()
      await page.route(/cdn\.jsdelivr\.net/, (route) => route.abort())
      const pageErrors = []
      page.on('pageerror', (error) => pageErrors.push(error.message))
      let checked
      try {
        checked = await checkSceneHits(page, scene, { device, orientation, query, states, verbose })
      } catch (error) {
        checked = { results: [{ device, orientation, scene, state: '기본', checked: 0, underWindow: 0, dialogs: [], failures: [], allowed: [], error: String(error.message ?? error) }], reopened: 0 }
      } finally {
        await context.close().catch(() => {})
        openContexts -= 1
      }
      return { checked, pageErrors }
    }
    const runJob = async ({ scene, device }) => {
      const jobStarted = Date.now()
      let { checked, pageErrors } = await checkOnce(scene, device, real ? 'real=1' : '')
      // 낡은 스냅샷 — 그 장면만 실제 진행 길로 다시 (느리다)
      if (!real && /스냅샷이 낡았다/.test(checked.results[0]?.error ?? '')) {
        staleSnapshots.add(scene)
        console.log(`낡은 스냅샷 ${scene} @${device} — 실제 진행 길로 다시 연다 (yarn e2e:snapshot ${scene} 으로 다시 뜰 것)`)
        ;({ checked, pageErrors } = await checkOnce(scene, device, 'real=1'))
      }
      const ms = Date.now() - jobStarted
      if (pageErrors.length > 0 && checked.results[0] !== undefined) checked.results[0].error ??= `pageerror: ${pageErrors[0].slice(0, 200)}`
      const bad = checked.results.filter((result) => result.error !== null || result.failures.length > 0)
      console.log(`${bad.length === 0 ? 'ok  ' : 'FAIL'} ${device.padEnd(18)} ${scene.padEnd(28)} 상태 ${checked.results.length} ${String(ms).padStart(6)}ms (열기 ${checked.openMs ?? '?'}ms)`)
      done.push({ scene, device, ms, openMs: checked.openMs ?? 0, results: checked.results, reopened: checked.reopened })
    }
    // 브라우저마다 따로 줄을 선다 — 맥락 수 한도가 브라우저마다라서
    await Promise.all(Object.keys(browsers).map((browserName) => {
      const queue = jobs.filter((job) => DEVICE_SETS[job.device][0] === browserName)
      return Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency[browserName] ?? 1, queue.length)) }, async () => {
        for (let job = queue.shift(); job !== undefined; job = queue.shift()) await runJob(job)
      }))
    }))
  } finally {
    for (const browser of Object.values(browsers)) await browser.close().catch(() => {})
  }
  return { done, staleSnapshots: [...staleSnapshots], peakContexts, browsers: Object.keys(browsers) }
}

// **타석 탭 타이밍 재기** (r242 — "나만의 타자에서 안타가 잘 안 되는 것 같다", 아이폰 Safari 터치).
//
//   yarn node e2e/swing-timing.mjs                       # webkit 아이폰 · chromium 아이폰, 공 40개씩
//   (경기가 끝나면 씨앗을 하나씩 올려 첫 경기를 다시 연다)
//   E2E_SWING_PITCHES=80 E2E_SWING_X=0.5 yarn node e2e/swing-timing.mjs webkit
//
// 나리 타석 장면(`nari-bat`)에서 공마다 **최적 틱**(보이는 공 그림 = N − 3 → 키 틱 F = N − 2, r209)의 가운데를 노려
// `touchscreen.tap` 한다. 탭 x 는 화면 폭의 `E2E_SWING_X`(기본 0.5 = 가운데). 쪽 안의 기록(`window.__batting`)으로
//   - pointerdown 시각 · 그 시각의 장면 틱 · 받은 틱(본 그림) · 키 틱 F − (N − 2)
//   - 판정 결과(헛스윙 · 판정없음 · 파울 · 타구)
// 를 모아 표로 낸다. 서버는 `E2E_PORT` 의 개발 서버(`e2e/serve.sh`)를 쓴다.
import { launch, openScene, toPagePoint } from './lib/scene.mjs'

const PITCHES = Number(process.env.E2E_SWING_PITCHES ?? 40)
const TAP_X = Number(process.env.E2E_SWING_X ?? 0.5)
const browsers = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['webkit', 'chromium']

/** 쪽 안: 공이 날기 시작하면 최적 그림 틱의 가운데 시각까지 기다렸다가 돌려준다 — 판정 앞이면 null */
async function waitOptimalMoment(page, lead) {
  return page.evaluate(async (leadMs) => {
    const deadline = performance.now() + 8000
    while (performance.now() < deadline) {
      const probe = window.__batting?.().probe
      if (probe !== null && probe !== undefined && probe.phase === '투구중' && probe.frameCount !== null && probe.frameCount > 0) {
        const shownTick = probe.phaseStartTick + probe.releaseTicks + probe.frameCount - 3
        const target = probe.tickStartTimeOf(shownTick) + probe.msPerTick / 2
        if (target - performance.now() < leadMs - 1) return null // 이미 지났다 — 다음 공
        while (performance.now() < target - leadMs) await new Promise((resolve) => setTimeout(resolve, 1))
        return { target, shownTick, frameCount: probe.frameCount, msPerTick: probe.msPerTick, phaseStartTick: probe.phaseStartTick }
      }
      await new Promise((resolve) => setTimeout(resolve, 2))
    }
    return null
  }, lead)
}

/** 쪽 안 pointerdown 기록 — 사건 시각(timeStamp)과 손잡이가 돈 시각 */
async function installDownLog(page) {
  await page.evaluate(() => {
    window.__downs = []
    document.addEventListener('pointerdown', (event) => window.__downs.push({ ts: event.timeStamp, now: performance.now() }), true)
  })
}

async function run(browserName) {
  const { browser, page } = await launch(browserName, { device: 'iphone' })
  await openScene(page, 'nari-bat', { timeout: 120000 })
  await installDownLog(page)
  let seed = 1
  // 원본 240×320 좌표 → 쪽 좌표 (웹킷 boundingBox 는 zoom 을 뺀 값일 수 있어 화면 판 기준 도우미를 쓴다)
  const point = await toPagePoint(page, 240 * TAP_X, 176)
  const rows = []
  let lead = 15
  const started = Date.now()
  let lastProgress = Date.now()
  let lastCount = 0
  while (rows.length < PITCHES && Date.now() - started < 15 * 60_000) {
    if (rows.length !== lastCount) {
      lastCount = rows.length
      lastProgress = Date.now()
    } else if (Date.now() - lastProgress > 20_000) {
      lastProgress = Date.now()
      const probe = await page.evaluate(() => JSON.stringify({ scene: window.__sceneProbe?.(), stage: window.__batting?.().probe ?? null }))
      console.error(`[멈춤 ${rows.length}] ${probe}`)
      if (process.env.E2E_SWING_SHOT) await page.screenshot({ path: `e2e/.run/swing-stuck-${browserName}-${rows.length}.png` })
    }
    const state = await page.evaluate(() => ({
      stage: window.__batting?.().probe ?? null,
      dialog: document.querySelector('[role="dialog"]') !== null,
      screen: window.__sceneProbe?.()?.screen ?? null,
      confirm: document.querySelector('button[aria-label="확인"]:not([disabled])') !== null,
    }))
    if (state.stage === null && state.screen === '관리') {
      // 경기가 끝나 관리로 돌아왔다 — 다른 씨앗으로 첫 경기를 다시 연다(공 · 판이 달라진다)
      seed += 1
      await openScene(page, 'nari-bat', { timeout: 120000, query: `seed=${seed}` })
      await installDownLog(page)
      continue
    }
    if (state.stage === null) {
      // 타석 밖(중계 · 결과 판 · 이벤트) — OK 로 넘긴다
      await page.keyboard.press('Enter')
      await page.waitForTimeout(250)
      continue
    }
    if (state.confirm) {
      await page.locator('button[aria-label="확인"]').first().tap()
      await page.waitForTimeout(200)
      continue
    }
    if (state.stage.phase !== '투구중') {
      // 창(돌발미션 · 알림)이 서서 공이 안 나가면 OK 로 닫는다 — 대기 중 OK 는 스윙이 아니다
      if (state.dialog) {
        await page.keyboard.press('Enter')
        await page.waitForTimeout(300)
      }
      await page.waitForTimeout(30)
      continue
    }
    const moment = await waitOptimalMoment(page, lead)
    if (moment === null) continue
    const logLength = await page.evaluate(() => window.__batting().log.length)
    const downsLength = await page.evaluate(() => window.__downs.length)
    await page.touchscreen.tap(point.x, point.y)
    // 판정 · 공 끝까지
    await page.waitForFunction(() => {
      const probe = window.__batting?.().probe
      return probe === null || probe === undefined || probe.phase !== '투구중'
    }, null, { timeout: 8000 }).catch(() => {})
    const after = await page.evaluate(([from, downFrom]) => ({
      log: window.__batting().log.slice(from),
      downs: window.__downs.slice(downFrom),
    }), [logLength, downsLength])
    const down = after.downs[0] ?? null
    const swing = after.log.find((entry) => entry.kind === '스윙') ?? null
    const judge = after.log.find((entry) => entry.kind === '판정') ?? null
    // 탭이 늦게 닿은 만큼 다음 공은 일찍 보낸다
    if (down !== null) lead = Math.max(0, Math.min(80, lead + (down.ts - moment.target) * 0.5))
    rows.push({
      downMinusTarget: down === null ? null : Math.round(down.ts - moment.target),
      handlerLag: down === null ? null : Math.round(down.now - down.ts),
      seenMinusTapTick: swing === null || down === null ? null : swing.tick - (moment.shownTick + Math.floor((down.ts - moment.target + moment.msPerTick / 2) / moment.msPerTick)),
      keyOffset: swing === null ? null : swing.keyTick - (moment.frameCount - 2),
      judgeLag: swing === null || judge === null ? null : judge.tick - swing.tick,
      result: judge?.result ?? (swing === null ? '스윙없음' : '?'),
    })
  }
  await browser.close()
  return rows
}

const count = (rows, test) => rows.filter(test).length
for (const browserName of browsers) {
  const rows = await run(browserName)
  const offsets = {}
  for (const row of rows) offsets[row.keyOffset ?? '없음'] = (offsets[row.keyOffset ?? '없음'] ?? 0) + 1
  const results = {}
  for (const row of rows) results[row.result] = (results[row.result] ?? 0) + 1
  const avg = (key) => {
    const values = rows.map((row) => row[key]).filter((value) => value !== null)
    return values.length === 0 ? null : (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)
  }
  const swung = count(rows, (row) => row.keyOffset !== null)
  const whiffs = count(rows, (row) => row.result === '헛스윙' || row.result === '판정없음')
  console.log(JSON.stringify({
    browser: browserName,
    tapX: TAP_X,
    pitches: rows.length,
    swung,
    whiffRate: swung === 0 ? null : (whiffs / swung).toFixed(3),
    keyOffsetFromOptimal: offsets,
    results,
    avgDownMinusTargetMs: avg('downMinusTarget'),
    avgHandlerLagMs: avg('handlerLag'),
    avgSeenMinusTapTick: avg('seenMinusTapTick'),
    avgJudgeLagTicks: avg('judgeLag'),
  }))
}

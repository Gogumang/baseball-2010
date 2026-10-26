// **홈런더비 단계 상승 · 난입 마투수까지 실제로 쳐서 닿기** (r261 — r226 은 조준을 안 움직여 비거리 0M 로 끝났다).
//
//   E2E_DERBY_FIXTURE=nari-ending E2E_DERBY_SEED=10 yarn node e2e/derby-stage.mjs   # 단계 1 에 닿는 판 (chromium 데스크톱 · webkit 아이폰)
//   yarn node e2e/derby-stage.mjs webkit                  # 하나만
//   E2E_DERBY_SHIFT=-9 E2E_DERBY_FIXTURE=nari-ending yarn node e2e/derby-stage.mjs chromium
//   E2E_DERBY_SWEEP=1 yarn node e2e/derby-stage.mjs chromium   # 좌우 이동마다 몇 M 나는지 훑기
//
// `derby-start`(첫 공 앞 0xe)에서 OK 로 시작해 공마다
//   - 좌우 이동 '4'/'6'(+0xfe4, ±3 · [−9, 9])을 공의 판정 오차(`probe.plateError`)에 맞추고(`E2E_DERBY_SHIFT=<수>` 면 고정) — 0xd 진입(48f88)에서만 0 으로 돌아가고 공 사이에는 남는다
//   - 최적 틱(보이는 공 그림 N − 3 → 키 틱 F = N − 2, r209 · `swing-timing.mjs`)의 가운데에 OK 를 누른다.
// 누적이 800 을 넘어 단계가 오르면(0xae3e8 → 0xd → 0xe) 그 0xe 를 찍고(난입 마투수 · 소개 판), OK 로 넘겨 마투수 공도 친다.
// 결과 창(0x1a)도 찍는다. 그림은 e2e/.run/derby-<브라우저>-<자리>.png.
// 판정 · 비거리는 쪽 안 기록(`window.__batting`)과 더비 들여다보기(`peeks.homeRunDerby.run`)로 표에 낸다.
import { launch, openScene, shot as shotScreen, toPagePoint } from './lib/scene.mjs'

const browsers = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['chromium', 'webkit']
const FIXTURE = process.env.E2E_DERBY_FIXTURE ?? undefined
const SEED = process.env.E2E_DERBY_SEED ?? '1'
/** 'auto' 면 공마다 판정 오차(`probe.plateError`)를 가장 줄이는 이동, 수면 그 값 고정 */
const SHIFT = process.env.E2E_DERBY_SHIFT ?? 'auto'
const SWEEP = process.env.E2E_DERBY_SWEEP === '1'
/** 판(0x17) 동안 키를 눌러 홈런 연출을 건너뛴다(0x519cc — 홈런 틱 뒤에만 먹는다). 씨앗 찾기를 빠르게 */
const SKIP = process.env.E2E_DERBY_SKIP === '1'
const SWEEP_SHIFTS = [-9, -6, -3, 0, 3, 6, 9]
/**
 * 맞은 공 몇 개까지 0x13(타구 공 · 그림자 — r274)과 판 0x17 필드 화면(A-01)을 찍나 — 그림: derby-<브라우저>-hit<n>-<자리>.png
 * (`hit<n>-13` 0x13 넷째 그림쯤 · `hit<n>-field` 판 0.5초 · `hit<n>-field2` 판 1.5초). 이벤트 존이 선 판은 공마다 `pitch<n>-zone`
 */
const HIT_SHOTS = Number(process.env.E2E_DERBY_HIT_SHOTS ?? '3')
const OUT = 'e2e/.run'

const derbyPeek = (page) => page.evaluate(() => window.__sceneProbe?.()?.peeks?.homeRunDerby ?? null)

/** 공이 날기 시작하면 최적 그림 틱의 가운데 시각까지 기다린다 (`swing-timing.mjs` 와 같은 셈) */
async function waitOptimalMoment(page, lead) {
  return page.evaluate(async (leadMs) => {
    const deadline = performance.now() + 15000
    while (performance.now() < deadline) {
      const probe = window.__batting?.().probe
      if (probe != null && probe.phase === '투구중' && probe.frameCount !== null && probe.frameCount > 0) {
        const shownTick = probe.phaseStartTick + probe.releaseTicks + probe.frameCount - 3
        const target = probe.tickStartTimeOf(shownTick) + probe.msPerTick / 2
        if (target - performance.now() < leadMs - 1) return null
        while (performance.now() < target - leadMs) await new Promise((resolve) => setTimeout(resolve, 1))
        return { target, shownTick, frameCount: probe.frameCount }
      }
      await new Promise((resolve) => setTimeout(resolve, 2))
    }
    return null
  }, lead)
}

/** 좌우 이동을 `shift` 로 — 왼끝(−9)까지 '4' 셋을 누른 뒤 '6' 으로 올린다. 키는 다음 틀에 처리된다 */
async function setShift(page, shift) {
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('4')
  for (let i = 0; i < (shift + 9) / 3; i += 1) await page.keyboard.press('6')
}

async function swingKey(page, point) {
  if (point === null) await page.keyboard.press('Enter')
  else await page.touchscreen.tap(point.x, point.y)
}

async function run(browserName, shiftOf) {
  const device = browserName === 'webkit' ? 'iphone' : 'desktop'
  const { browser, page, errors } = await launch(browserName, { device })
  await openScene(page, 'derby-start', { timeout: 60000, query: `seed=${SEED}`, ...(FIXTURE === undefined ? {} : { fixture: FIXTURE }) })
  // 아이폰은 판 가운데 탭(공이 나는 동안 판 전체가 스윙 — r256), 데스크톱은 OK 키
  const point = device === 'iphone' ? await toPagePoint(page, 120, 176) : null
  const rows = []
  const shots = []
  let lead = 15
  let lastStage = 0
  let pitchIndex = 0
  const started = Date.now()
  const shot = async (name) => {
    const path = `${OUT}/derby-${browserName}-${name}.png`
    await page.screenshot({ path })
    shots.push(path)
  }
  /** 원본 화면 판만 — 0x13 · 필드 화면 확인용 */
  const screenShot = async (name) => {
    const path = `${OUT}/derby-${browserName}-${name}.png`
    await shotScreen(page, path)
    shots.push(path)
  }
  let hitShots = 0
  while (Date.now() - started < 10 * 60_000) {
    const peek = await derbyPeek(page)
    if (peek === null) throw new Error('더비 화면이 아니다')
    if (peek.isResultShown) {
      await page.waitForTimeout(1500)
      await shot('result')
      break
    }
    if (peek.acceptsConfirm) {
      if (peek.run.stage > lastStage) {
        // 단계가 올라 0xd → 0xe — 난입 마투수가 서고 소개 판이 뜬 자리
        lastStage = peek.run.stage
        await page.waitForTimeout(600)
        await shot(`stage${peek.run.stage}`)
      }
      if (peek.run.isBonusGame && !shots.some((path) => path.endsWith('bonus.png'))) await shot('bonus')
      await page.keyboard.press('Enter')
      await page.waitForTimeout(300)
      continue
    }
    const probe = await page.evaluate(() => window.__batting?.().probe ?? null)
    if (SKIP && peek.isPlayRunning) {
      await page.keyboard.press('Enter')
      await page.waitForTimeout(200)
      continue
    }
    if (probe === null || probe.phase !== '투구중' || probe.plateError === null || peek.isPlayRunning) {
      await page.waitForTimeout(30)
      continue
    }
    const shift = shiftOf(pitchIndex, probe.plateError)
    await setShift(page, shift)
    const before = peek.run
    const logLength = await page.evaluate(() => window.__batting().log.length)
    const moment = await waitOptimalMoment(page, lead)
    if (moment === null) {
      await page.waitForTimeout(30)
      continue
    }
    const downAt = await page.evaluate(() => performance.now())
    await swingKey(page, point)
    lead = Math.max(0, Math.min(80, lead + (downAt - moment.target) * 0.3))
    pitchIndex += 1
    // 공 하나의 셈(판 끝 · 0x12 대기 끝)까지 — `SKIP` 이면 판 동안 키로 건너뛴다
    const capturing = hitShots < HIT_SHOTS
    let shotHit = false
    let fieldStartedAt = null
    let shotField = 0
    let shotZone = false
    for (const until = Date.now() + 30000; Date.now() < until; ) {
      const p = await derbyPeek(page)
      if (p === null || p.isResultShown || p.acceptsConfirm || p.run.remainingPitches !== before.remainingPitches) break
      if (capturing) {
        const phase = await page.evaluate(() => window.__batting?.().probe?.phase ?? null)
        if (!shotHit && phase === '타격') {
          // 0x13 — 타구 공이 날기 시작한 그림(큰 타구는 멈춤 7 그림 뒤)
          await page.waitForTimeout(250)
          await screenShot(`hit${hitShots + 1}-13`)
          shotHit = true
        }
        if (p.isPlayRunning) {
          fieldStartedAt ??= Date.now()
          const elapsed = Date.now() - fieldStartedAt
          if (shotField === 0 && elapsed > 500) {
            await screenShot(`hit${hitShots + 1}-field`)
            shotField = 1
          } else if (shotField === 1 && elapsed > 1500) {
            await screenShot(`hit${hitShots + 1}-field2`)
            shotField = 2
          }
        }
      }
      // 이벤트 존이 선 그림(0x36dfc 3726c — 결과 24~26 · 플래그 & 2 큰 뜬공이 관중석 쪽에 낮게) — 판마다 처음 한 번
      if (p.isPlayRunning && !shotZone) {
        const zone = await page.evaluate(() => document.querySelector('[data-testid="더비-이벤트존"]')?.getAttribute('data-placed') ?? null)
        if (zone === 'true') {
          await page.waitForTimeout(120)
          await screenShot(`pitch${pitchIndex}-zone`)
          // 존 보상 "200G"(trainning 애니 3 — 첫 칸 15 는 비었다)가 돈 뒤
          await page.waitForTimeout(600)
          await screenShot(`pitch${pitchIndex}-zone2`)
          shotZone = true
        }
      }
      if (SKIP && p.isPlayRunning) await page.keyboard.press('Enter')
      await page.waitForTimeout(SKIP ? 150 : capturing ? 20 : 30)
    }
    if (shotHit || fieldStartedAt !== null) hitShots += 1
    const after = await derbyPeek(page)
    const log = await page.evaluate((from) => window.__batting().log.slice(from), logLength)
    const swing = log.find((entry) => entry.kind === '스윙') ?? null
    const judge = log.find((entry) => entry.kind === '판정') ?? null
    rows.push({
      pitch: pitchIndex,
      shift,
      errorX: probe.plateError?.horizontal ?? null,
      errorY: probe.plateError?.vertical ?? null,
      stage: before.stage,
      keyOffset: swing === null ? null : swing.keyTick - (moment.frameCount - 2),
      result: judge?.result ?? (swing === null ? '스윙없음' : '?'),
      gained: after === null ? null : after.run.totalDistance - before.totalDistance,
      total: after?.run.totalDistance ?? null,
      stageAfter: after?.run.stage ?? null,
    })
    if (after !== null && after.run.stage > before.stage) await shot(`stage${after.run.stage}-play-end`)
  }
  await browser.close()
  return { rows, shots, errors }
}

if (SWEEP) {
  // 좌우 이동마다 공 몇 개씩 — 어느 자리가 가장 멀리 나는지
  for (const browserName of browsers) {
    const { rows } = await run(browserName, (index) => SWEEP_SHIFTS[index % SWEEP_SHIFTS.length])
    const byShift = {}
    for (const row of rows) {
      const cell = (byShift[row.shift] ??= { pitches: 0, gained: 0, results: {} })
      cell.pitches += 1
      cell.gained += row.gained ?? 0
      cell.results[row.result] = (cell.results[row.result] ?? 0) + 1
    }
    console.log(JSON.stringify({ browser: browserName, byShift }, null, 1))
  }
} else {
  let failed = false
  for (const browserName of browsers) {
    const { rows, shots, errors } = await run(browserName, (_index, error) => {
      if (SHIFT !== 'auto') return Number(SHIFT)
      // 오차 + 이동 이 0 에 가깝게 — 이동은 3 칸 · [−9, 9]
      const best = Math.round(-(error?.horizontal ?? 0) / 3) * 3
      return Math.max(-9, Math.min(9, best))
    })
    console.table(rows)
    const reached = Math.max(0, ...rows.map((row) => row.stageAfter ?? 0))
    console.log(JSON.stringify({ browser: browserName, reachedStage: reached, shots, pageErrors: errors }))
    if (reached < 1 || errors.length > 0) failed = true
  }
  process.exitCode = failed ? 1 : 0
}

// 나리 투수편을 실제 브라우저로 길게 플레이한다 — A-06(r303) 투수편 실화면 긴 판 검증.
//
//   E2E_PORT=5731 e2e/serve.sh e2e                                     # 배포 꼴 빌드 서버(개발 서버는 소스를 고치면 쪽이 다시 뜬다)
//   E2E_PORT=5731 yarn node e2e/pitcher-season-play.mjs                 # chromium 데스크톱 · pitcher-management(1년차 첫날)부터
//   E2E_PORT=5731 E2E_BROWSER=webkit E2E_DEVICE=iphone E2E_SCENE=pitcher-postseason yarn node e2e/pitcher-season-play.mjs
//
// 정책: 관리 화면은 [다음경기] → [경기시작] 단추를 실제로 누르고(탭/클릭), 경기는 Enter 만 되풀이한다(구질 · 코스 · 게이지 OK).
// `E2E_FULL_EVERY` 번째 경기마다 끝까지 던지고, 나머지는 `E2E_GIVE_UP` 번 누른 뒤 '#' 강판 → 예로 넘긴다(빨리 감기). 그 밖 창 ·
// 이벤트는 Enter(오래 그대로면 Escape 도).
//
// 구간(`E2E_SEGMENT_MS`, 기본 8분)마다 브라우저를 닫고 그때의 localStorage 를 `e2e/.run/pitcher-season-<기기>.json` 에 떠
// 새 브라우저에 깔고 이어하기로 다시 들어간다(저장 왕복 · 이어하기를 실화면으로 밟는다). 경기 중에 끊긴 저장은 이어하기가 관리가
// 아닌 자리(다음경기순위 · 포스트시즌)로 가므로 바로가기의 '관리' 기다림이 실패해도 그대로 간다.
// 로그는 `e2e/.run/pitcher-season-<기기>.log`. 쪽 오류 · 90초 넘게 그대로인 화면이 있으면 끝 코드 1.
import { appendFileSync, mkdirSync, rmSync } from 'node:fs'
import { BASE_URL, launch, openScene, pressKey, shot, tapPage } from './lib/scene.mjs'

const BROWSER = process.env.E2E_BROWSER ?? 'chromium'
const DEVICE = process.env.E2E_DEVICE ?? 'desktop'
const SEGMENTS = Number(process.env.E2E_SEGMENTS ?? 8)
const SEGMENT_MS = Number(process.env.E2E_SEGMENT_MS ?? 480e3)
const FULL_EVERY = Number(process.env.E2E_FULL_EVERY ?? 4)
const GIVE_UP = Number(process.env.E2E_GIVE_UP ?? 40)
/** 이 연차 · 경기 수에 닿으면 멈춘다 (기본 2년차 3경기 — 한 시즌과 연말 사슬을 넘긴 자리) */
const STOP_SEASON = Number(process.env.E2E_STOP_SEASON ?? 2)
const STOP_GAMES = Number(process.env.E2E_STOP_GAMES ?? 3)
const TAG = `${BROWSER}-${DEVICE}`
const LOG = `e2e/.run/pitcher-season-${TAG}.log`

mkdirSync('e2e/.run', { recursive: true })
rmSync(LOG, { force: true })
const started = Date.now()
const log = (message) => {
  const line = `${((Date.now() - started) / 1000).toFixed(0)}s ${message}`
  appendFileSync(LOG, `${line}\n`)
  console.log(line)
}

let failures = 0
let saved = null
let lastCareer = ''
let gameNo = 0
let isDone = false

for (let segment = 1; segment <= SEGMENTS && !isDone; segment++) {
  log(`=== 구간 ${segment}`)
  const { browser, page } = await launch(BROWSER, { device: DEVICE })
  if (saved === null) {
    await openScene(page, process.env.E2E_SCENE ?? 'pitcher-management', process.env.E2E_FIXTURE ? { fixture: process.env.E2E_FIXTURE } : {})
  } else {
    await page.goto(BASE_URL)
    await page.evaluate((items) => {
      for (const key of Object.keys(localStorage)) if (key.startsWith('compus-baseball/')) localStorage.removeItem(key)
      for (const [key, value] of Object.entries(items)) localStorage.setItem(key, value)
    }, saved)
    await openScene(page, 'pitcher-management', { fixture: 'none' }).catch((error) =>
      log(`관리 기다림 실패 — 이어 감: ${String(error).slice(0, 100)}`),
    )
    const where = await page.evaluate(() => {
      const probe = window.__sceneProbe?.()
      return `${probe?.screen} ${probe?.pitcherScene}`
    })
    log(`저장에서 이어 감 — ${where}`)
  }
  // 첫 goto 를 곧바로 떠나며 끊긴 그림 요청(웹킷 "access control checks")은 세지 않는다 — 들어선 뒤부터 본다
  page.on('pageerror', (error) => {
    failures++
    log(`pageerror ${error.message}`)
  })

  async function pressButton(name) {
    const found = await page.evaluate((label) => {
      for (const old of document.querySelectorAll('[data-pitcher-play]')) old.removeAttribute('data-pitcher-play')
      const target = [...document.querySelectorAll('button, [role="button"]')].find(
        (element) => !element.matches(':disabled') && (element.getAttribute('aria-label') === label || element.textContent?.trim() === label),
      )
      target?.setAttribute('data-pitcher-play', '')
      return target !== undefined
    }, name)
    if (!found) return false
    const box = await page.locator('[data-pitcher-play]').first().boundingBox()
    if (box === null) return false
    await tapPage(page, box.x + box.width / 2, box.y + box.height / 2)
    return true
  }
  const careerLine = () =>
    page.evaluate(() => {
      const stored = JSON.parse(localStorage.getItem('compus-baseball/pitcher-league') ?? 'null')
      const career = stored?.state ?? stored
      return career === null
        ? null
        : { season: career.season, games: career.gamesPlayed, isPostseason: career.postseason != null, stamina: career.stamina }
    })

  const segmentStart = Date.now()
  let last = ''
  let sameSince = Date.now()
  let polls = 0
  let gamePresses = 0
  while (true) {
    const probe = await page.evaluate(() => window.__sceneProbe?.())
    const hasDialog = await page.evaluate(() => document.querySelector('[role="dialog"]') !== null)
    const isOver = Date.now() - segmentStart > SEGMENT_MS
    // 구간 끝은 관리 화면에서 — 경기 중이면 4분 더 기다린다(그래도 안 서면 경기 중 저장으로 넘긴다)
    if (isOver && ((probe?.pitcherScene === '관리' && !hasDialog) || Date.now() - segmentStart > SEGMENT_MS + 240e3)) break
    const game = probe?.peeks?.pitcherGame
    const key = `${probe?.screen} ${probe?.pitcherScene}${game === undefined ? '' : ' (경기 중)'}`
    if (key !== last) {
      log(`화면 ${key}`)
      last = key
      sameSince = Date.now()
    }
    const career = await careerLine().catch(() => null)
    const line = career === null ? '-' : `${career.season}년차 g${career.games}${career.isPostseason ? '(PS)' : ''} 체력 ${career.stamina}`
    if (line !== lastCareer) {
      log(`저장 ${line}`)
      lastCareer = line
    }
    if (
      career !== null &&
      probe?.pitcherScene === '관리' &&
      (career.season > STOP_SEASON || (career.season === STOP_SEASON && career.games >= STOP_GAMES))
    ) {
      isDone = true
      break
    }
    polls++
    const sameMs = Date.now() - sameSince
    if (game === undefined && sameMs > 90000 && polls % 40 === 0) {
      failures++
      await shot(page, `e2e/.run/pitcher-season-${TAG}-stuck.png`)
      log(`그대로 ${(sameMs / 1000).toFixed(0)}초 — ${key} · 받는 키 ${probe?.offers}`)
    }
    if (game !== undefined) {
      if (gamePresses === 0) gameNo++
      gamePresses++
      const isFull = FULL_EVERY > 0 && gameNo % FULL_EVERY === 1
      if (!isFull && gamePresses > GIVE_UP && game.acceptsGiveUpKey) {
        log(`강판 '#' (경기 ${gameNo})`)
        await pressKey(page, '#', { gap: 500 })
        await pressKey(page, 'Enter', { gap: 500 })
        gamePresses = -1e9
        continue
      }
      await pressKey(page, 'Enter', { gap: 150 })
      continue
    }
    gamePresses = 0
    if (probe?.screen === '투수편' && probe?.pitcherScene === '관리' && !hasDialog && sameMs < 20000 && (await pressButton('다음경기'))) {
      await page.waitForTimeout(600)
      if (!(await pressButton('경기시작'))) await pressKey(page, 'Enter')
      await page.waitForTimeout(600)
      continue
    }
    await pressKey(page, sameMs > 30000 && polls % 5 === 0 ? 'Escape' : 'Enter')
    await page.waitForTimeout(200)
  }
  saved = await page.evaluate(() =>
    Object.fromEntries(
      Object.keys(localStorage)
        .filter((key) => key.startsWith('compus-baseball/'))
        .map((key) => [key, localStorage.getItem(key)]),
    ),
  )
  await shot(page, `e2e/.run/pitcher-season-${TAG}-end.png`)
  await browser.close()
}
log(`끝 — ${lastCareer} · ${isDone ? '목표에 닿음' : '구간을 다 씀'} · 문제 ${failures}`)
process.exit(failures === 0 && isDone ? 0 : 1)

// 시즌모드 한 해를 실제로 플레이해 정규시즌 뒤 저장을 뜬다 — 픽스처 season-postseason · season-cup 을 이렇게 떴다(r227).
//
//   E2E_PORT=5471 e2e/serve.sh e2e                 # 배포 꼴 빌드 서버 — 개발 서버는 소스를 고치면 쪽이 다시 떠 플레이가 날아간다
//   E2E_PORT=5471 yarn node e2e/season-play.mjs     # 약 13분 (chromium · 경기 45개)
//
// season-management 장면(season-y1)에서 시작해, 경기는 첫 사람 타석에서 경기 중 메뉴 [자동진행] 예 · 중계 속도 최대,
// 관리 메뉴 0xc9 는 [다음경기] 단추, 그 밖 창 · 이벤트는 Enter(오래 그대로면 Escape 도). 45경기 뒤에는 화면이 바뀔 때마다
// 저장을 `e2e/.run/post-<차례>-<상태>.json` 으로 뜨고 phase · 국가대항전 칸을 로그(`e2e/.run/season-play.log`)에 적는다.
// 골라 `note` 를 달아 `e2e/fixtures/` 로 옮긴다.
import { appendFileSync, mkdirSync } from 'node:fs'
import { dumpFixture, launch, openScene, pressKey, shot, tapPage } from './lib/scene.mjs'

const LOG = 'e2e/.run/season-play.log'
const SEASON_GAMES = 45
const MAX_DUMPS = Number(process.env.MAX_DUMPS ?? 12)
const LIMIT_MS = Number(process.env.LIMIT_MS ?? 3600e3)
/** 시즌 상태 번호 (`SEASON_SCENE_STATE`) */
const STATE = { 관리메뉴: 0xc9, 관중수입: 0xe9 }

mkdirSync('e2e/.run', { recursive: true })
const started = Date.now()
const log = (message) => {
  const line = `${((Date.now() - started) / 1000).toFixed(0)}s ${message}`
  appendFileSync(LOG, `${line}\n`)
  console.log(line)
}

const { browser, page } = await launch('chromium')
page.on('pageerror', (error) => log(`pageerror ${error.message}`))
await openScene(page, 'season-management')

/** aria-label 이나 글이 그 이름인 단추를 실제로 누른다 */
async function pressButton(name) {
  const found = await page.evaluate((label) => {
    for (const old of document.querySelectorAll('[data-season-play]')) old.removeAttribute('data-season-play')
    const target = [...document.querySelectorAll('button, [role="button"]')]
      .find((element) => !element.matches(':disabled') && (element.getAttribute('aria-label') === label || element.textContent?.trim() === label))
    target?.setAttribute('data-season-play', '')
    return target !== undefined
  }, name)
  if (!found) return false
  const box = await page.locator('[data-season-play]').first().boundingBox()
  if (box === null) return false
  await tapPage(page, box.x + box.width / 2, box.y + box.height / 2)
  return true
}

let last = ''
let sameSince = Date.now()
let polls = 0
let games = 0
let dumps = 0
let isSpeedSet = false
while (Date.now() - started < LIMIT_MS && dumps < MAX_DUMPS) {
  const probe = await page.evaluate(() => window.__sceneProbe?.())
  const game = probe?.peeks?.teamGame
  const scene = probe?.seasonScene
  const key = `${probe?.screen} ${scene?.toString(16)} ${game === undefined ? '' : JSON.stringify(game)}`
  if (key !== last) {
    log(key)
    last = key
    sameSince = Date.now()
    if (probe?.screen === '시즌모드' && scene === STATE.관중수입) games++
    if (games >= SEASON_GAMES && game === undefined) {
      await page.waitForTimeout(300)
      const name = `post-${dumps++}-${scene?.toString(16)}`
      await dumpFixture(page, `e2e/.run/${name}.json`, { note: name })
      await shot(page, `e2e/.run/${name}.png`)
      const record = await page.evaluate(() => JSON.parse(localStorage.getItem('compus-baseball/season') ?? 'null')?.state?.record)
      log(`저장 ${name} — phase ${record?.phase} · 국가대항전 ${record?.nationalCup}`)
    }
  }
  polls++
  const sameMs = Date.now() - sameSince
  if (sameMs > 12000 && polls % 30 === 0) {
    await shot(page, 'e2e/.run/season-play-stuck.png')
    log(`${(sameMs / 1000).toFixed(0)}초째 그대로`)
  }
  if (game !== undefined) {
    if (game.isAutoRelay) {
      if (!isSpeedSet) await pressKey(page, 'ArrowRight', { times: 4 })
      isSpeedSet = true
      await page.waitForTimeout(700)
      continue
    }
    if ((game.canBat || game.canPitch) && game.acceptsChangeKey) {
      // 경기 중 메뉴 '*' → [자동진행](둘째 칸) → 질문 상자 [예]
      await pressKey(page, '*')
      await page.waitForTimeout(400)
      await pressKey(page, 'ArrowDown')
      await pressKey(page, 'Enter')
      await page.waitForTimeout(400)
      await pressKey(page, 'Enter')
      await page.waitForTimeout(600)
      continue
    }
  }
  const hasDialog = await page.evaluate(() => document.querySelector('[role="dialog"]') !== null)
  if (probe?.screen === '시즌모드' && scene === STATE.관리메뉴 && !hasDialog && sameMs < 15000 && (await pressButton('다음경기'))) {
    await page.waitForTimeout(800)
    continue
  }
  await pressKey(page, sameMs > 25000 && polls % 5 === 0 ? 'Escape' : 'Enter')
  await page.waitForTimeout(250)
}
log(`끝 — 경기 ${games} · 저장 ${dumps}`)
await browser.close()

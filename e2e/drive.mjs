// 브라우저 하나를 띄워 두고 명령을 받는 작은 서버 — 화면을 여러 번 들여다볼 때 브라우저를 매번 새로 띄우지 않는다.
//   node e2e/drive.mjs &            (포트 E2E_DRIVE_PORT, 기본 5411 · pid 는 e2e/.run/drive.pid)
//   e2e/d.sh '[{"launch":"webkit","device":"iphone"},{"scene":"nari-outing"},{"shot":"a"}]'
// 명령(배열 차례대로):
//   {"launch":"chromium|webkit","device":"desktop|iphone|iphone-land"}  {"scene":"<장면>","fixture":"<픽스처>"}
//   {"goto":"?scene=…"}  {"keys":["Enter",300,"ArrowDown"],"gap":250}  {"press":"Enter","until":"관리","max":30,"gap":700}
//   {"type":"글자"}  {"tap":[x,y]}(원본 좌표)  {"top":[x,y]}  {"eval":"자바스크립트 식"}  {"wait":ms}
//   {"shot":"이름","full":true}(e2e/.run/이름.png)  {"dump":"e2e/fixtures/x.json","note":"…"}
// 명령 뒤에는 지금 화면 요약(state) · 쪽 오류(errors)를 돌려준다.
import http from 'node:http'
import { mkdirSync, writeFileSync } from 'node:fs'
import { BASE_URL, dumpFixture, launch, openScene, pressKey, screenState, shot, tap, topElementAt } from './lib/scene.mjs'

const PORT = Number(process.env.E2E_DRIVE_PORT ?? 5411)
let session = null
const consoleErrors = []

async function run(command) {
  if (command.launch) {
    if (session !== null) await session.browser.close()
    session = await launch(command.launch, { device: command.device ?? 'desktop' })
    session.page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    return 'launched'
  }
  if (session === null) session = await launch('chromium')
  const { page } = session
  if (command.scene) return openScene(page, command.scene, { fixture: command.fixture })
  if (command.goto !== undefined) {
    await page.goto(BASE_URL + command.goto)
    await page.waitForTimeout(command.wait ?? 1500)
    return 'ok'
  }
  if (command.keys) {
    for (const key of command.keys) {
      if (typeof key === 'number') await page.waitForTimeout(key)
      else await pressKey(page, key, { gap: command.gap ?? 250 })
    }
  }
  if (command.press) {
    for (let count = 0; count < (command.max ?? 30); count++) {
      const state = await screenState(page)
      if (command.until !== undefined && [state?.screen, state?.pitcherScene, state?.seasonScene].includes(command.until)) break
      await pressKey(page, command.press, { gap: command.gap ?? 500 })
    }
  }
  if (command.type) await page.keyboard.type(command.type, { delay: 50 })
  if (command.tap) await tap(page, command.tap[0], command.tap[1])
  if (command.wait) await page.waitForTimeout(command.wait)
  if (command.top) return topElementAt(page, command.top[0], command.top[1])
  if (command.eval) return page.evaluate(command.eval)
  if (command.dump) return dumpFixture(page, command.dump, { note: command.note ?? '' })
  const result = { state: await screenState(page), errors: session.errors.splice(0), console: consoleErrors.splice(0) }
  if (command.shot) {
    await shot(page, `e2e/.run/${command.shot}.png`, { full: command.full === true })
    result.shot = `e2e/.run/${command.shot}.png`
  }
  return result
}

// 끌 때(kill <pid>) 브라우저도 닫는다 — Playwright 가 SIGTERM 을 잡아 두면 프로세스가 안 끝난다
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    void (session === null ? Promise.resolve() : session.browser.close()).finally(() => process.exit(0))
  })
}

mkdirSync('e2e/.run', { recursive: true })
writeFileSync('e2e/.run/drive.pid', String(process.pid))
http
  .createServer(async (request, response) => {
    let body = ''
    for await (const chunk of request) body += chunk
    try {
      const out = []
      for (const command of JSON.parse(body)) out.push(await run(command))
      response.end(`${JSON.stringify(out)}\n`)
    } catch (error) {
      response.end(`ERR ${error.message}\n`)
    }
  })
  .listen(PORT, '127.0.0.1', () => console.log(`drive ready pid=${process.pid} port=${PORT}`))

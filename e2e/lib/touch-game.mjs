// `e2e/touch-in-game.mjs` 의 도우미 — 장면 알림(`__sceneProbe`) 읽기 · 기다리기 · 손가락 탭.
import { tap, tapPage } from './scene.mjs'

/** 게임에 간 키 사건(터치 버튼이 쏜 keydown 포함)과 손가락 사건을 적는다 */
export async function installKeyLog(page) {
  await page.evaluate(() => {
    window.__touchLog = { keys: [], pointers: 0 }
    window.addEventListener('keydown', (event) => window.__touchLog.keys.push(event.key), true)
    document.addEventListener('pointerdown', () => (window.__touchLog.pointers += 1), true)
  })
}

export function probe(page) {
  return page.evaluate(() => window.__sceneProbe?.() ?? null)
}

export function peekOf(state) {
  return state?.peeks?.teamGame ?? state?.peeks?.pitcherGame ?? null
}

export async function waitFor(page, what, test, timeout = 15000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await test()) return
    await page.waitForTimeout(100)
  }
  throw new Error(`${what} 기다림이 안 끝났다 — ${JSON.stringify(await probe(page))}`)
}

/** 원본 좌표 누름 칸(PressArea — style 이 원본 240×320 좌표다)을 손가락으로 탭 */
export async function tapPressArea(page, label) {
  const rect = await page.evaluate((name) => {
    const button = [...document.querySelectorAll('button')].find((element) => element.getAttribute('aria-label') === name)
    if (button === undefined) return null
    const { left, top, width, height } = button.style
    return { x: parseFloat(left) + parseFloat(width) / 2, y: parseFloat(top) + parseFloat(height) / 2 }
  }, label)
  if (rect === null) throw new Error(`누름 칸 '${label}' 이 없다`)
  await tap(page, rect.x, rect.y)
}

/** 터치 버튼(`#keypad-root`, 확대 밖)을 손가락으로 탭 */
export async function tapTouchButton(page, label) {
  const box = await page.locator(`#keypad-root button[aria-label="${label}"]`).first().boundingBox({ timeout: 5000 })
  if (box === null) throw new Error(`터치 버튼 '${label}' 이 없다`)
  await tapPage(page, box.x + box.width / 2, box.y + box.height / 2)
}

/** 쪽 안: 공이 손을 떠났다 — 투구중이고 놓는 틱(`phaseStartTick + releaseTicks`)을 지났다 */
export function isBallReleased() {
  const stage = window.__batting?.().probe
  if (stage?.phase !== '투구중' || stage.frameCount === null || stage.frameCount <= 0) return false
  return stage.tickNow > stage.phaseStartTick + stage.releaseTicks + 1
}

// 장면 하나의 누름 칸 검사 — 기본 상태 + 연 상태(`ACTIONS`)마다 `scanHits`. `e2e/hits.mjs`(기기마다 장면 차례로) 와
// `e2e/quick.mjs` · `e2e/only.mjs`(장면 × 기기를 맥락 몇 개로 함께) 가 같이 쓴다.
import { openScene, pressKey, tapPage } from './scene.mjs'
import { isAllowed, layoutPrint, scanHits, waitLayoutStable } from './hits.mjs'
import { ACTIONS, SCENE_EXPECT } from './catalog.mjs'

/** 연 상태 표 · 기본 상태 표지는 도메인 파일(`e2e/areas/<도메인>.mjs`)에 있다 — 걸음 꼴은 `e2e/areas/menu.mjs` 머리말 */
export { ACTIONS, SCENE_EXPECT }

function markTarget(name) {
  for (const old of document.querySelectorAll('[data-hits-target]')) old.removeAttribute('data-hits-target')
  const target = [...document.querySelectorAll('button, [role="button"], [role="option"], [role="menuitem"]')].find(
    (element) => !element.matches(':disabled') && (element.getAttribute('aria-label') === name || element.textContent?.trim() === name),
  )
  if (target === undefined) return false
  target.setAttribute('data-hits-target', '')
  return true
}

export async function runSteps(page, steps) {
  for (const step of steps) {
    if (/^w\d+$/.test(step)) {
      await page.waitForTimeout(Number(step.slice(1)))
    } else if (step.startsWith('@')) {
      // aria-label 이나 글이 그 이름인 누를 수 있는 것 — 표를 달아 Playwright 로 자리를 잰다(웹킷 zoom 좌표도 맞게)
      const name = step.slice(1)
      await page.waitForFunction(markTarget, name, { timeout: 5000 })
      const box = await page.locator('[data-hits-target]').first().boundingBox()
      if (box === null) throw new Error(`누를 자리가 안 보인다: ${step}`)
      await tapPage(page, box.x + box.width / 2, box.y + box.height / 2)
      await page.waitForTimeout(150)
    } else {
      await pressKey(page, step)
    }
  }
}

export async function hasLabel(page, label) {
  return page.evaluate(
    (name) =>
      [...document.querySelectorAll('[aria-label], button, [role="dialog"]')].some(
        (element) => element.getAttribute('aria-label') === name || element.textContent?.trim() === name,
      ),
    label,
  )
}

/**
 * 장면 `scene` 을 `page` 에서 열고 기본 상태 · 연 상태마다 누름 칸을 훑는다. 돌려주는 `results` 한 줄이 상태 하나다
 * (`failures` — 허용 목록에 없는 겹침, `error` — 장면 · 동작 실패). 동작 뒤 자리가 기본과 다르면 다음 동작 전에 장면을 다시 연다.
 * `open` 을 주면 장면 열기를 그것으로 한다(기본: `openScene` 240초 한도). `query` 는 바로가기 주소에 더할 것(예: `real=1` — 경기 중간
 * 스냅샷 대신 실제로 진행해 연다). `states` 를 주면(상태 이름 → 참) 그 상태만 훑는다 — 기본 상태 이름은 '기본'.
 */
export async function checkSceneHits(page, scene, { device, orientation, verbose = false, open: openOnce, query = '', states } = {}) {
  const wanted = (name) => states === undefined || states(name)
  const results = []
  let reopened = 0
  const record = (state, report, error) => {
    const rows = report?.covered ?? []
    results.push({
      device,
      orientation,
      scene,
      state,
      checked: report?.checked ?? 0,
      underWindow: report?.underWindow.length ?? 0,
      dialogs: report?.dialogs ?? [],
      failures: rows.filter((row) => !isAllowed(scene, row)),
      allowed: rows.filter((row) => isAllowed(scene, row)).map((row) => ({ ...row, why: isAllowed(scene, row).why })),
      error: error ?? null,
    })
  }
  const open = async () => {
    if (openOnce === undefined) await openScene(page, scene, { timeout: 240000, query })
    else await openOnce()
    await waitLayoutStable(page)
    const expected = SCENE_EXPECT[scene]
    if (expected !== undefined && !(await hasLabel(page, expected))) {
      await page.waitForTimeout(1000)
      await waitLayoutStable(page)
      if (!(await hasLabel(page, expected))) throw new Error(`장면에 "${expected}" 가 안 섰다`)
    }
  }
  const started = Date.now()
  let openMs = 0
  try {
    await open()
    openMs = Date.now() - started
  } catch (error) {
    record('기본', null, String(error.message ?? error))
    return { results, reopened, openMs: Date.now() - started }
  }
  if (wanted('기본')) record('기본', await scanHits(page))
  const base = await layoutPrint(page)
  const actions = (ACTIONS[scene] ?? []).filter((action) => wanted(action.name))
  for (const [index, action] of actions.entries()) {
    try {
      await runSteps(page, action.steps)
      await waitLayoutStable(page)
      if (action.expect !== undefined && !(await hasLabel(page, action.expect))) {
        throw new Error(`연 뒤 "${action.expect}" 가 안 섰다`)
      }
      record(action.name, await scanHits(page))
      await runSteps(page, action.undo ?? [])
      await waitLayoutStable(page)
    } catch (error) {
      record(action.name, null, String(error.message ?? error))
    }
    if (index < actions.length - 1 && (await layoutPrint(page)) !== base) {
      reopened++
      if (verbose) console.log(`  ${device} ${scene} · ${action.name} 뒤 다시 연다`)
      // 다시 열 때는 늘 바로가기로 — 맨 처음 열기(`open`)가 다른 길(예: 맥락 재사용)이어도 같은 자리로 돌아온다
      await openScene(page, scene, { timeout: 240000, query })
      await waitLayoutStable(page)
    }
  }
  return { results, reopened, openMs }
}

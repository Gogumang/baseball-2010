// **누름 칸 맞음 검사** — 장면마다 누를 수 있는 요소(button · PressArea · [role=button] · 터치 상황 버튼)의 가운데 · 네 모서리 안쪽 점이
// 정말 그 요소에 닿는가(`elementFromPoint`). 창 · 상자를 연 상태(메뉴 '*' · 교체 '#' · 질문 상자 · 외출 말풍선)도 훑는다.
//
//   yarn e2e:hits                      # 장면 전부 × 기기 넷(chromium 가로 · chromium 세로 · webkit 아이폰 세로 · 가로)
//   yarn e2e:hits general-bat derby-start          # 장면만 골라
//   E2E_HITS_DEVICES=webkit-iphone yarn e2e:hits   # 기기만 골라 (쉼표)
//   E2E_HITS_JOBS=1 yarn e2e:hits                  # 기기를 몇 개씩 같이 돌릴지 (기본 4)
//
// 서버가 안 떠 있으면 `e2e/serve.sh` 로 띄우고 끝나면 끈다. 결과 JSON 은 `e2e/.run/hits-report.json`.
// 실패(허용 목록에 없는 겹침 · 장면/동작 실패)가 있으면 끝 코드 1.
//
// r195 · r203 · r207 · r212 — 화면에 보이는 단추 · 창 위를 다른 누름 칸(꺼진 칸 포함)이 덮어 클릭 · 탭이 엉뚱한 곳에 먹혔다.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { launch, openScene, pressKey, tapPage } from './lib/scene.mjs'
import { isAllowed, layoutPrint, scanHits, waitLayoutStable } from './lib/hits.mjs'

/** 기기 꼴 — 이름: [브라우저, scene.mjs 의 DEVICES 이름, 방향] */
const DEVICE_SETS = {
  'chromium-desktop': ['chromium', 'desktop', '가로'],
  'chromium-iphone': ['chromium', 'iphone', '세로'],
  'webkit-iphone': ['webkit', 'iphone', '세로'],
  'webkit-iphone-land': ['webkit', 'iphone-land', '가로'],
}

/**
 * 장면마다 연 상태로 만드는 동작. `steps`: 키 이름 · `@이름`(aria-label 이 그 이름인 요소 가운데를 탭/클릭) · `w밀리초`.
 * `expect`: 연 뒤 서 있어야 할 것(aria-label) — 안 서면 동작 실패로 친다(검사가 헛돌지 않게). `undo`: 기본 상태로 되돌리는 걸음 —
 * 돌린 뒤 자리 지문이 기본과 다르면 다음 동작 전에 장면을 다시 연다.
 */
const ACTIONS = {
  'main-menu': [
    { name: '게임시작 목록', steps: ['Enter'], expect: '나만의리그', undo: ['Escape'] },
  ],
  'nari-management': [
    { name: '휴식 알림 상자', steps: ['@휴식'], expect: '알림', undo: ['Escape'] },
    { name: '트레이닝 → 히트 질문 상자', steps: ['@트레이닝', '@히트'], expect: '예', undo: ['Escape', 'w200', 'Escape'] },
    { name: '선수정보 → 칭호 창', steps: ['@선수정보', 'Enter', 'w300', '@* 칭호'], expect: '칭호', undo: ['Escape', 'w200', 'Escape', 'w200', 'Escape'] },
    { name: '다음경기 기록실 창', steps: ['@다음경기'], expect: '기록실', undo: ['Escape'] },
  ],
  'pitcher-management': [
    { name: '휴식 알림 상자', steps: ['@휴식'], expect: '알림', undo: ['Escape'] },
    // r203 — 구질훈련 창 칸이 예 · 아니오를 덮었다
    { name: '트레이닝 → 변화 질문 상자', steps: ['@트레이닝', '@변화'], expect: '예', undo: ['Escape', 'w200', 'Escape'] },
    // r207 — 칭호 창
    { name: '선수정보 → 칭호 창', steps: ['@선수정보', 'Enter', 'w300', '@* 칭호'], expect: '칭호', undo: ['Escape', 'w200', 'Escape', 'w200', 'Escape'] },
    { name: '다음경기 기록실 창', steps: ['@다음경기'], expect: '기록실', undo: ['Escape'] },
  ],
  'season-management': [
    { name: '다음경기 순위표', steps: ['@다음경기'], expect: '되돌아가기 칸', undo: ['Escape'] },
  ],
  'nari-outing': [
    { name: '번화가 말풍선', steps: ['@번화가'], expect: '들어가기', undo: ['Escape'] },
    { name: '병원 말풍선', steps: ['@병원'], expect: '들어가기', undo: ['Escape'] },
    { name: '학교 말풍선', steps: ['@학교'], expect: '들어가기', undo: ['Escape'] },
  ],
  'season-outing': [
    // 시즌 외출은 건물을 누르면 말풍선 대신 알림 상자(0xd1 — 오늘 외출 막힘 따위)
    { name: '번화가 알림 상자', steps: ['@번화가'], expect: '알림', undo: ['Escape'] },
  ],
  'general-bat': [
    { name: "경기 중 메뉴 '*'", steps: ['@메뉴'], expect: '계속하기', undo: ['@닫기'] },
    { name: '메뉴 → 자동진행 질문 상자', steps: ['@메뉴', 'w300', 'ArrowDown', 'Enter'], expect: '예', undo: ['Escape', 'w300', 'Escape'] },
    { name: "대타 창 '#'", steps: ['@# 대타'], expect: '# 취소', undo: ['@# 취소'] },
  ],
  'general-pitch': [
    { name: "경기 중 메뉴 '*'", steps: ['@메뉴'], expect: '계속하기', undo: ['@닫기'] },
    { name: "투수 교체 창 '#'", steps: ['@# 교체'], expect: '# 취소', undo: ['@# 취소'] },
  ],
  'derby-start': [
    { name: "경기 중 메뉴 '*'", steps: ['@메뉴'], expect: '계속하기', undo: ['@닫기'] },
  ],
  'general-relay': [
    // CLR 중단 질문 StrGAME[6] — [아니오]면 중계가 그대로 이어진다
    { name: '자동진행 중단 질문 상자', steps: ['@CLR 중단'], expect: '예', undo: ['@아니오'] },
  ],
  'pitcher-pitch': [
    { name: "경기 중 메뉴 '*'", steps: ['@메뉴'], expect: '계속하기', undo: ['@닫기'] },
    // 모드 3 의 '#' 는 교체 창이 아니라 강판 물음 StrGAME[104]
    { name: "강판 물음 '#'", steps: ['@# 강판'], expect: '예', undo: ['@아니오'] },
  ],
  'mission-bat': [
    { name: "경기 중 메뉴 '*'", steps: ['@메뉴'], expect: '계속하기', undo: ['@닫기'] },
  ],
  'mission-pitch': [
    { name: "경기 중 메뉴 '*'", steps: ['@메뉴'], expect: '계속하기', undo: ['@닫기'] },
  ],
  // r236 — soak 픽스처 장면(시즌 엔딩 · 나리 포스트시즌 · 국가대항전 · 엔딩 · 명예의 전당)
  'season-ending': [
    // 엔딩 0xf5 의 키 0x6b3c — 저장의 보너스 칸(SR+0x7b)이 서 있어 팝업 없이 관리 메뉴 0xc9 로 (시즌모드는 등록 질문이 없다)
    { name: '엔딩 키 → 관리 메뉴', steps: ['Enter', 'w1500'], expect: '다음경기' },
  ],
  'nari-postseason': [
    // 128 진입 팝업(0xbbef9)을 닫으면 대진판 [다음] 이 선다
    { name: '진입 팝업 닫기 → 대진판', steps: ['@OK', 'w600'], expect: '다음' },
  ],
  'pitcher-postseason': [
    { name: '진입 팝업 닫기 → 대진판', steps: ['@OK', 'w600'], expect: '다음' },
  ],
  'nari-cup': [
    // 134 진입 팝업 — 히든 팀 열림(StrCOMMON[138]) 다음에 칭호 8 "국가 대표" 창
    { name: '히든 팀 팝업 닫기 → 칭호 창', steps: ['@확인', 'w700'], expect: '칭호' },
  ],
  'nari-cup-result': [
    // 대회가 끝난 대진판 확인(0x19fdc) → 결과 팝업 0x25
    { name: '대진판 확인 → 결과 팝업', steps: ['Enter', 'w700'], expect: '알림' },
  ],
  'pitcher-cup': [
    { name: '히든 팀 팝업 닫기 → 대진판', steps: ['@확인', 'w700'], expect: '국가대항전 대진' },
  ],
  'pitcher-cup-result': [
    // 대회가 끝난 대진판 확인(0x19fdc) → 결과 팝업 0x25 (탈락이면 보상 없이 [확인] 이 대회를 끝낸다)
    { name: '대진판 확인 → 결과 팝업', steps: ['Enter', 'w700'], expect: '알림' },
  ],
  'nari-ending': [
    // 키 0x1220c — 단계 1 의 키가 제작진으로, 제작진의 키가 보너스 팝업 0x2b
    { name: '엔딩 키 → 제작진 → 보너스 팝업', steps: ['Enter', 'w2500', 'Enter', 'w800'], expect: 'OK' },
  ],
  'pitcher-ending': [
    { name: '엔딩 키 → 제작진 → 보너스 팝업', steps: ['Enter', 'w2500', 'Enter', 'w800'], expect: 'OK' },
  ],
  'nari-hall-of-fame': [
    // 등록 질문 0x2d [예] → 상태 145 명예의 전당 등록 목록
    { name: '등록 질문 예 → 등록 목록', steps: ['@예', 'w800'], expect: '1번 슬롯' },
  ],
  'pitcher-hall-of-fame': [
    { name: '등록 질문 예 → 등록 목록', steps: ['@예', 'w800'], expect: '1번 슬롯' },
  ],
}

/** 기본 상태에서 서 있어야 할 것 — 안 서면 자리가 멈춘 뒤 한 번 더 본다 */
const SCENE_EXPECT = {
  'nari-burst-result': '돌발미션',
}

const SCENE_NAMES = [
  'title', 'main-menu', 'nari-new', 'pitcher-new', 'season-new', 'nari-management', 'nari-outing', 'pitcher-management',
  'season-management', 'season-outing', 'general-quick', 'general-bat', 'general-pitch', 'general-defense', 'derby-pick', 'derby-start',
  'nari-burst-result', 'pitcher-pitch', 'pitcher-defense', 'general-relay', 'mission-bat', 'mission-pitch', 'mission-result', 'season-postseason', 'season-cup',
  'season-ending', 'nari-postseason', 'nari-cup', 'nari-cup-result', 'nari-ending', 'nari-hall-of-fame', 'pitcher-postseason', 'pitcher-cup', 'pitcher-cup-result',
  'pitcher-ending', 'pitcher-hall-of-fame',
]

const argScenes = process.argv.slice(2)
const scenes = argScenes.length > 0 ? argScenes : SCENE_NAMES
const deviceNames = (process.env.E2E_HITS_DEVICES ?? Object.keys(DEVICE_SETS).join(',')).split(',').filter(Boolean)
const jobs = Number(process.env.E2E_HITS_JOBS ?? 4)

/** 서버 — 떠 있으면 그대로, 아니면 띄우고 끝에 끈다 */
function ensureServer() {
  try {
    execFileSync('e2e/serve.sh', ['status'], { stdio: 'ignore' })
    return false
  } catch {
    execFileSync('e2e/serve.sh', [], { stdio: 'inherit' })
    return true
  }
}

function markTarget(name) {
  for (const old of document.querySelectorAll('[data-hits-target]')) old.removeAttribute('data-hits-target')
  const target = [...document.querySelectorAll('button, [role="button"], [role="option"], [role="menuitem"]')]
    .find((element) => !element.matches(':disabled') && (element.getAttribute('aria-label') === name || element.textContent?.trim() === name))
  if (target === undefined) return false
  target.setAttribute('data-hits-target', '')
  return true
}

async function runSteps(page, steps) {
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

async function hasLabel(page, label) {
  return page.evaluate((name) => [...document.querySelectorAll('[aria-label], button, [role="dialog"]')]
    .some((element) => element.getAttribute('aria-label') === name || element.textContent?.trim() === name), label)
}

async function runDevice(deviceName) {
  const [browserName, device, orientation] = DEVICE_SETS[deviceName] ?? []
  if (browserName === undefined) throw new Error(`기기가 없다: ${deviceName} (있는 것: ${Object.keys(DEVICE_SETS).join(', ')})`)
  const started = Date.now()
  const session = await launch(browserName, { device })
  const results = []
  let reopened = 0
  const record = (scene, state, report, error) => {
    const rows = report?.covered ?? []
    results.push({
      device: deviceName,
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
  try {
    for (const scene of scenes) {
      const sceneStarted = Date.now()
      const open = async () => {
        await openScene(session.page, scene, { timeout: 240000 })
        await waitLayoutStable(session.page)
        const expected = SCENE_EXPECT[scene]
        if (expected !== undefined && !(await hasLabel(session.page, expected))) {
          await session.page.waitForTimeout(1000)
          await waitLayoutStable(session.page)
          if (!(await hasLabel(session.page, expected))) throw new Error(`장면에 "${expected}" 가 안 섰다`)
        }
      }
      try {
        await open()
      } catch (error) {
        record(scene, '기본', null, String(error.message ?? error))
        continue
      }
      record(scene, '기본', await scanHits(session.page))
      const base = await layoutPrint(session.page)
      const actions = ACTIONS[scene] ?? []
      for (const [index, action] of actions.entries()) {
        try {
          await runSteps(session.page, action.steps)
          await waitLayoutStable(session.page)
          if (action.expect !== undefined && !(await hasLabel(session.page, action.expect))) {
            throw new Error(`연 뒤 "${action.expect}" 가 안 섰다`)
          }
          record(scene, action.name, await scanHits(session.page))
          await runSteps(session.page, action.undo ?? [])
          await waitLayoutStable(session.page)
        } catch (error) {
          record(scene, action.name, null, String(error.message ?? error))
        }
        if (index < actions.length - 1 && (await layoutPrint(session.page)) !== base) {
          reopened++
          if (process.env.E2E_HITS_VERBOSE) console.log(`  ${deviceName} ${scene} · ${action.name} 뒤 다시 연다`)
          await open()
        }
      }
      console.log(`  ${deviceName} ${scene} ${Date.now() - sceneStarted}ms`)
    }
  } finally {
    await session.browser.close()
  }
  return { deviceName, results, reopened, ms: Date.now() - started, errors: session.errors }
}

async function main() {
  const started = Date.now()
  mkdirSync('e2e/.run', { recursive: true })
  const startedServer = ensureServer()
  const runs = []
  try {
    const queue = [...deviceNames]
    const workers = Array.from({ length: Math.max(1, Math.min(jobs, queue.length)) }, async () => {
      for (let name = queue.shift(); name !== undefined; name = queue.shift()) runs.push(await runDevice(name))
    })
    await Promise.all(workers)
  } finally {
    if (startedServer) execFileSync('e2e/serve.sh', ['stop'], { stdio: 'inherit' })
  }

  const results = runs.flatMap((run) => run.results)
  const failures = results.filter((result) => result.failures.length > 0 || result.error !== null)
  const allowed = results.flatMap((result) => result.allowed.map((row) => ({ ...row, device: result.device, scene: result.scene, state: result.state })))
  writeFileSync('e2e/.run/hits-report.json', `${JSON.stringify({ results, ms: Date.now() - started }, null, 2)}\n`)

  console.log('\n기기별')
  for (const run of runs) {
    const own = run.results
    console.log(`  ${run.deviceName}: 상태 ${own.length} · 요소 ${own.reduce((sum, r) => sum + r.checked, 0)} · 창 아래 ${own.reduce((sum, r) => sum + r.underWindow, 0)} · 다시 연 장면 ${run.reopened} · ${(run.ms / 1000).toFixed(1)}s`)
  }
  const allowedByWhy = new Map()
  for (const row of allowed) {
    const entry = allowedByWhy.get(row.why) ?? { count: 0, pairs: new Set() }
    entry.count++
    entry.pairs.add(`${row.scene}: ${row.label.replace(/^button /, '')} ← ${row.by.replace(/^button /, '')}`)
    allowedByWhy.set(row.why, entry)
  }
  console.log(`\n허용된 겹침 ${allowed.length}건`)
  for (const [why, { count, pairs }] of allowedByWhy) console.log(`  ${count}× ${why}\n     ${[...pairs].join(' · ')}`)
  if (failures.length === 0) {
    console.log(`\n겹침 없음 — ${results.length} 상태 · ${((Date.now() - started) / 1000).toFixed(1)}s`)
    return 0
  }
  console.log(`\n실패 ${failures.length} 상태`)
  for (const result of failures) {
    if (result.error !== null) console.log(`  ✗ [${result.device}] ${result.scene} · ${result.state}: ${result.error}`)
    for (const row of result.failures) {
      console.log(`  ✗ [${result.device}] ${result.scene} · ${result.state}: ${row.label} (z ${row.z}) ← ${row.by} (z ${row.byZ}${row.byDisabled ? ' · 꺼짐' : ''}) 점 ${row.points.join('·')}`)
    }
  }
  console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`)
  return 1
}

process.exit(await main())

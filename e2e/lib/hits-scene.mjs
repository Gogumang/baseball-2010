// 장면 하나의 누름 칸 검사 — 기본 상태 + 연 상태(`ACTIONS`)마다 `scanHits`. `e2e/hits.mjs`(기기마다 장면 차례로) 와
// `e2e/quick.mjs`(장면 × 기기를 맥락 여러 개로 함께) 가 같이 쓴다.
import { openScene, pressKey, tapPage } from './scene.mjs'
import { isAllowed, layoutPrint, scanHits, waitLayoutStable } from './hits.mjs'

/**
 * 장면마다 연 상태로 만드는 동작. `steps`: 키 이름 · `@이름`(aria-label 이 그 이름인 요소 가운데를 탭/클릭) · `w밀리초`.
 * `expect`: 연 뒤 서 있어야 할 것(aria-label) — 안 서면 동작 실패로 친다(검사가 헛돌지 않게). `undo`: 기본 상태로 되돌리는 걸음 —
 * 돌린 뒤 자리 지문이 기본과 다르면 다음 동작 전에 장면을 다시 연다.
 */
export const ACTIONS = {
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
  // r254 — 사람 팀 포스트시즌 시리즈 · 한국시리즈 우승 팝업 · 국가대항전 한국 우승
  'nari-postseason-game': [
    { name: "경기 중 메뉴 '*'", steps: ['@메뉴'], expect: '계속하기', undo: ['@닫기'] },
  ],
  'pitcher-postseason-game': [
    { name: "경기 중 메뉴 '*'", steps: ['@메뉴'], expect: '계속하기', undo: ['@닫기'] },
    { name: "강판 물음 '#'", steps: ['@# 강판'], expect: '예', undo: ['@아니오'] },
  ],
  'nari-postseason-next': [
    // 키 0x13da0 — 다음 라운드 대진에 내 팀이 있어 142 경기 준비
    { name: '대진판 다음 → 다음 라운드 142 경기 준비', steps: ['@다음', 'w1500'], expect: '경기 시작' },
  ],
  'pitcher-postseason-next': [
    { name: '대진판 다음 → 다음 라운드 142 경기 준비', steps: ['@다음', 'w1500'], expect: '경기 시작' },
  ],
  'nari-postseason-champion': [
    // 팝업 7 StrMODE[137] 닫힘 — 우승 팀이 내 팀이라 팝업 8 StrMODE[190] (0x15984)
    { name: '우승 팀 발표 OK → 한국시리즈 우승 팝업', steps: ['@OK', 'w700'], expect: '알림' },
  ],
  'pitcher-postseason-champion': [
    { name: '우승 팀 발표 OK → 한국시리즈 우승 팝업', steps: ['@OK', 'w700'], expect: '알림' },
  ],
}

/** 기본 상태에서 서 있어야 할 것 — 안 서면 자리가 멈춘 뒤 한 번 더 본다 */
export const SCENE_EXPECT = {
  'nari-burst-result': '돌발미션',
}


function markTarget(name) {
  for (const old of document.querySelectorAll('[data-hits-target]')) old.removeAttribute('data-hits-target')
  const target = [...document.querySelectorAll('button, [role="button"], [role="option"], [role="menuitem"]')]
    .find((element) => !element.matches(':disabled') && (element.getAttribute('aria-label') === name || element.textContent?.trim() === name))
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
  return page.evaluate((name) => [...document.querySelectorAll('[aria-label], button, [role="dialog"]')]
    .some((element) => element.getAttribute('aria-label') === name || element.textContent?.trim() === name), label)
}


/**
 * 장면 `scene` 을 `page` 에서 열고 기본 상태 · 연 상태마다 누름 칸을 훑는다. 돌려주는 `results` 한 줄이 상태 하나다
 * (`failures` — 허용 목록에 없는 겹침, `error` — 장면 · 동작 실패). 동작 뒤 자리가 기본과 다르면 다음 동작 전에 장면을 다시 연다.
 * `open` 을 주면 장면 열기를 그것으로 한다(기본: `openScene` 240초 한도).
 */
export async function checkSceneHits(page, scene, { device, orientation, verbose = false, open: openOnce } = {}) {
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
    if (openOnce === undefined) await openScene(page, scene, { timeout: 240000 })
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
  record('기본', await scanHits(page))
  const base = await layoutPrint(page)
  const actions = ACTIONS[scene] ?? []
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
      await openScene(page, scene, { timeout: 240000 })
      await waitLayoutStable(page)
    }
  }
  return { results, reopened, openMs }
}

// 회귀 — 나리 외출을 실제로 다녀온 뒤(외출 진입 이벤트 → 지도 → [!] 장소 이벤트 · 외식 → 105) 흑백 외출 칸을 **터치**해도 지도에
// 들어가지 않는가 (r341, 사용자 보고 "외출 갔다가 비활성화 되었는데 들어가져").
//   E2E_PORT=3841 e2e/serve.sh && E2E_PORT=3841 node e2e/outing-gray-tap.mjs [nari|pitcher ...]
// 기기는 webkit 아이폰 13 꼴(세로 · 터치 — 아이폰 Safari 엔진). 105 로 돌아온 그 틀(칸 펼침 중) · 펼친 뒤 두 때에 칸을 탭하고,
// 방향키 →·← 가 흑백 칸을 건너뛰는지(vt+8 0x6c445)와 확인 키가 지도로 안 가는지도 본다.
// 원본: 메뉴 객체(0x6c219, vtable 0xd2ea0)의 이동 vt+8 0x6c445 가 켬 표 0 칸을 건너뛰어 커서가 서지 못한다 — 고를 길이 없다.
// r332(b15c7797) 전 배포판은 칸 누름이 켬 표를 안 보고 곧장 골랐다(그것이 보고된 증상).
import { launch, openScene, shot, tapPage } from './lib/scene.mjs'

const sides = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['nari', 'pitcher']
/** 장소와 말풍선 칸 — [!] 병원 '들어가기'(장소 이벤트) · 번화가 '외식'(외출 기능 → 효과 팝업) */
const ROUTES = [
  { place: '병원', cell: 0 },
  { place: '번화가', cell: 1 },
]
let failed = false

for (const side of sides) {
  for (const route of ROUTES) {
    const label = `${side} ${route.place}${route.cell}`
    const { browser, page } = await launch('webkit', { device: 'iphone' })
    try {
      await runRoute(page, side, route)
      console.log(`${label}: OK`)
    } catch (error) {
      failed = true
      console.log(`${label}: FAIL — ${error.message}`)
      await shot(page, `e2e/.run/outing-gray-tap-${side}-${route.place}-fail.png`, { full: true }).catch(() => {})
    } finally {
      await browser.close()
    }
  }
}
process.exit(failed ? 1 : 0)

async function runRoute(page, side, { place, cell }) {
  const scene = side === 'nari' ? 'nari-management' : 'pitcher-management'
  await openScene(page, scene)
  // 첫 해 10경기 전 외출 잠금(0x11c2c)을 풀고 사기를 낮춘 저장으로 다시 연다 — 외식(사기 최고 막힘) · 외출 칸이 켜지게
  await page.evaluate(() => {
    const careerKey = 'compus-baseball/career'
    const batter = JSON.parse(localStorage.getItem(careerKey) ?? 'null')
    if (batter?.career !== undefined) {
      batter.career.gamesPlayed = 10
      batter.career.morale = 40
      localStorage.setItem(careerKey, JSON.stringify(batter))
    }
    const pitcherKey = 'compus-baseball/pitcher-league'
    const pitcher = JSON.parse(localStorage.getItem(pitcherKey) ?? 'null')
    if (pitcher !== null) {
      pitcher.gamesPlayed = 10
      pitcher.morale = 40
      localStorage.setItem(pitcherKey, JSON.stringify(pitcher))
    }
  })
  // 10경기가 된 저장이라 105 진입에 이벤트가 끼어 진행기의 '관리' 기다림이 끝나지 않을 수 있다 — 그 이벤트는 아래에서 넘긴다
  await openScene(page, scene, { fixture: 'none' }).catch((error) => {
    if (!/기다림이 안 끝났다/.test(error.message)) throw error
  })
  const labels = () => page.evaluate(() => [...document.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') ?? b.textContent))
  const isManagement = (ls) => ls.includes('다음경기') && !ls.includes('대사 넘기기')
  const tapButton = async (name) => {
    const button = page.locator(`button[aria-label="${name}"]`).filter({ visible: true }).first()
    const box = await button.boundingBox({ timeout: 3000 }).catch(() => null)
    if (box === null) return false
    await tapPage(page, box.x + box.width / 2, box.y + box.height / 2)
    return true
  }
  /** 이벤트 대사 · 확인 팝업을 터치로 넘기며 `until` 까지 */
  const advance = async (until, what) => {
    for (let step = 0; step < 300; step++) {
      const ls = await labels()
      if (until(ls)) return ls
      if (ls.includes('OK')) await tapButton('OK')
      else if (ls.includes('확인')) await tapButton('확인')
      else if (ls.includes('대사 넘기기')) await tapButton('대사 넘기기')
      await page.waitForTimeout(150)
    }
    throw new Error(`${what} 에 닿지 못했다 — ${(await labels()).join(',')}`)
  }
  // 바로가기가 남긴 경기 앞 이벤트(첫 해 10경기 등)는 키로 넘긴다 — 시험 대상이 아니다
  for (let step = 0; step < 80 && !isManagement(await labels()); step++) {
    await page.keyboard.press('Enter')
    await page.waitForTimeout(250)
  }
  await page.waitForTimeout(1500)
  const grayNow = () => page.evaluate(() => [...document.querySelectorAll('[data-testid^="흑백-"]')].map((e) => e.dataset.testid.slice(3)))
  if ((await grayNow()).includes('외출')) throw new Error('외출 전부터 외출 칸이 흑백이다')

  await tapButton('외출')
  await advance((ls) => ls.includes(place) && !ls.includes('대사 넘기기'), '외출 지도')
  // 지도가 막 선 틀은 누름을 안 받을 수 있다 — 말풍선(들어가기)이 뜰 때까지 다시 누른다
  for (let attempt = 0; attempt < 5 && !(await labels()).includes('들어가기'); attempt++) {
    // 투수편은 외출 진입 이벤트가 둘 이어질 수 있다 — 사이 한 틀에 지도 칸이 보여도 다음 이벤트가 선다
    await advance((ls) => ls.includes(place) && !ls.includes('대사 넘기기'), '외출 지도')
    await page.waitForTimeout(800)
    await tapButton(place)
    await page.waitForTimeout(700)
  }
  if (!(await labels()).includes('들어가기')) throw new Error(`${place} 말풍선이 안 뜬다`)
  // 말풍선 칸 고르기는 키로(↓ · 확인) — 칸 터치는 이 시험 대상이 아니다
  for (let index = 0; index < cell; index++) {
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(150)
  }
  await page.keyboard.press('Enter')
  await page.waitForTimeout(400)
  await advance(isManagement, '105 관리')

  const gray = await grayNow()
  if (!['트레이닝', '휴식', '외출'].every((id) => gray.includes(id))) throw new Error(`행동함인데 흑백이 아니다: ${gray.join(',')}`)
  // 돌아온 그 틀(칸 펼침 중 — A-50) 탭
  await tapButton('외출')
  await page.waitForTimeout(300)
  if (!isManagement(await labels())) throw new Error('펼침 중 흑백 외출 칸 탭이 105 를 떠났다')
  // 다 펼친 뒤 탭
  await page.waitForTimeout(1200)
  await tapButton('외출')
  await page.waitForTimeout(1000)
  if (!isManagement(await labels())) throw new Error('흑백 외출 칸 탭이 105 를 떠났다')
  // 키 — 커서는 흑백 칸에 서지 못하고(→ 다섯 번에 한 바퀴), 확인은 커서 칸(켜진 칸)만 고른다
  const cursorNow = () => page.evaluate(() => document.querySelector('button[aria-current="true"]')?.getAttribute('aria-label') ?? null)
  const visited = []
  for (let step = 0; step < 6; step++) {
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(200)
    visited.push(await cursorNow())
  }
  if (visited.some((id) => gray.includes(id))) throw new Error(`커서가 흑백 칸에 섰다: ${visited.join(',')}`)
  await shot(page, `e2e/.run/outing-gray-tap-${side}-${place}.png`, { full: true })
}

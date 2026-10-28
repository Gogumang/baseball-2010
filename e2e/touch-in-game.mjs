// 회귀 — **경기 중 실제 터치가 게임에 들어가는가** (r356, 사용자 보고 "아이폰 사파리에서 경기 중 터치가 안 먹힌다").
//
//   E2E_PORT=5561 e2e/serve.sh e2e && E2E_PORT=5561 node e2e/touch-in-game.mjs [webkit-iphone,webkit-iphone-land] [장면 …]
//
// 키보드는 쓰지 않는다 — 모든 입력이 `page.touchscreen.tap`(손가락)이다. 장면마다 화면이 알리는 자리(`window.__sceneProbe` ·
// `window.__batting`)가 탭 뒤에 바뀌었는지로 본다.
//   - 타석(나리 · 일반): 화면 탭으로 타석 OK(0xe 대기 풀림) → 공이 날 때 판 탭이 스윙(`__batting` 기록) → 터치 버튼 '번트' 탭이 키 '8'
//     → 다음 공이 날 때 터치 버튼 '스윙' 탭이 키 '5' 로 스윙(10-29)
//   - 구질 고르기(일반 · 투수편): 원본 그림 위 누름 칸(PressArea) 탭으로 구질이 골라져 고르기 판이 닫힌다
//   - 타구 수비: 터치 버튼 '1루 송구' 탭이 키 '6' 으로 게임에 간다(상황 버튼이 바뀐다)
// ⚠️ 데스크톱 웹킷은 iOS 의 사건 추적 영역(r208)을 흉내 내지 않는다 — 여기서 통과해도 실제 아이폰과 다를 수 있다.
import { DEVICE_SETS, deviceList } from './lib/devices.mjs'
import { launch, openScene, shot, tap } from './lib/scene.mjs'
import { installKeyLog, isBallReleased, peekOf, probe, tapPressArea, tapTouchButton, waitFor } from './lib/touch-game.mjs'

const args = process.argv.slice(2)
const devices =
  args[0]?.includes('-') && DEVICE_SETS[args[0].split(',')[0]] !== undefined ? deviceList(args.shift()) : ['webkit-iphone', 'webkit-iphone-land']
const CHECKS = {
  'nari-bat': checkBatting,
  'general-bat': checkBatting,
  'general-pitch': checkPitchPick,
  'pitcher-pitch': checkPitchPick,
  'general-defense': checkDefenseButton,
}
const scenes = args.length > 0 ? args : Object.keys(CHECKS)
const rows = []

for (const deviceName of devices) {
  const [browserName, device] = DEVICE_SETS[deviceName]
  for (const scene of scenes) {
    const { browser, page, errors } = await launch(browserName, { device })
    const started = Date.now()
    try {
      await openScene(page, scene, { timeout: 120000 })
      await installKeyLog(page)
      const detail = await CHECKS[scene](page)
      if (errors.length > 0) throw new Error(`쪽 오류: ${errors.join(' | ')}`)
      rows.push({ deviceName, scene, ok: true, detail, seconds: (Date.now() - started) / 1000 })
    } catch (error) {
      rows.push({ deviceName, scene, ok: false, detail: error.message, seconds: (Date.now() - started) / 1000 })
      await shot(page, `e2e/.run/touch-in-game-${deviceName}-${scene}-fail.png`, { full: true }).catch(() => {})
    } finally {
      await browser.close()
    }
    const row = rows.at(-1)
    console.log(`${row.ok ? 'OK  ' : 'FAIL'} ${deviceName} ${scene} (${row.seconds.toFixed(1)}초) — ${row.detail}`)
  }
}
process.exit(rows.every((row) => row.ok) ? 0 : 1)

async function checkBatting(page) {
  const offersOf = async () => (await probe(page))?.offers ?? []
  const isWaitingOk = async () => peekOf(await probe(page))?.isAwaitingConfirm === true
  // 1) 타석 OK — 화면 가운데 탭(누름 칸 '확인'). 나리 타석은 대기 표시가 없어 번트 버튼이 뜨는 것으로 본다
  if ((await offersOf()).some((offer) => offer.startsWith('8:'))) throw new Error('탭 전부터 번트 버튼이 떠 있다')
  await tap(page, 120, 160)
  await waitFor(
    page,
    '화면 탭 → 타석 OK(번트 버튼)',
    async () => !(await isWaitingOk()) && (await offersOf()).some((offer) => offer.startsWith('8:')),
  )
  // 2) 공이 놓인 뒤(와인드업 중 스윙은 원본도 안 받는다) 판 탭 = 스윙
  const before = await page.evaluate(() => window.__batting().log.length)
  await waitFor(page, '공이 날기', () => page.evaluate(isBallReleased), 20000)
  await tap(page, 120, 176)
  await waitFor(
    page,
    '판 탭 → 스윙',
    () =>
      page.evaluate(
        (from) =>
          window
            .__batting()
            .log.slice(from)
            .some((entry) => entry.kind === '스윙'),
        before,
      ),
    8000,
  )
  // 3) 터치 버튼 — 다음 타석 대기가 서면 번트 버튼 탭이 키 '8' 로 간다(누르고 떼기)
  await waitFor(page, '번트 버튼', async () => (await offersOf()).some((offer) => offer.startsWith('8:')) || (await isWaitingOk()), 20000)
  if (await isWaitingOk()) await tap(page, 120, 160)
  await waitFor(page, '번트 버튼', async () => (await offersOf()).some((offer) => offer.startsWith('8:')), 20000)
  await tapTouchButton(page, '번트')
  await waitFor(page, "번트 버튼 → 키 '8'", () => page.evaluate(() => window.__touchLog.keys.includes('8')), 3000)
  await checkSwingButton(page, isWaitingOk)
  return '화면 탭 OK · 판 탭 스윙 · 번트 버튼 키 8 · 스윙 버튼 키 5 스윙'
}

/** 4) 터치 버튼 '스윙'(10-29 — 아이폰에서 판 탭이 안 먹을 때의 길) — 다음 공이 날 때 탭하면 키 '5' 가 스윙이 된다 */
async function checkSwingButton(page, isWaitingOk) {
  const offersOf = async () => (await probe(page))?.offers ?? []
  // 지금 공이 끝나고(번트 버튼 탭이 그 공에 섰을 수 있다) 새 공이 놓이기를 기다린다. 타석이 끝나 OK 를 기다리면 화면 탭으로 넘긴다
  await waitFor(page, '새 공 기다림', async () => !(await page.evaluate(isBallReleased)), 20000)
  await waitFor(
    page,
    '스윙 버튼 · 새 공',
    async () => {
      if (await isWaitingOk()) await tap(page, 120, 160)
      return (await offersOf()).includes('5:스윙') && (await page.evaluate(isBallReleased))
    },
    30000,
  )
  const before = await page.evaluate(() => window.__batting().log.length)
  await tapTouchButton(page, '스윙')
  await waitFor(page, "스윙 버튼 → 키 '5'", () => page.evaluate(() => window.__touchLog.keys.includes('5')), 3000)
  await waitFor(
    page,
    '스윙 버튼 → 스윙',
    () =>
      page.evaluate(
        (from) =>
          window
            .__batting()
            .log.slice(from)
            .some((entry) => entry.kind === '스윙'),
        before,
      ),
    8000,
  )
}

async function checkPitchPick(page) {
  if (peekOf(await probe(page))?.isPitchSlotPickerShown !== true) throw new Error('구질 고르기 판이 아니다')
  const label = await page.evaluate(() =>
    [...document.querySelectorAll('button')].map((b) => b.getAttribute('aria-label')).find((name) => name?.startsWith('2 ')),
  )
  if (label === undefined) throw new Error("구질 칸 '2 …' 이 없다")
  await tapPressArea(page, label)
  await waitFor(page, `구질 칸 '${label}' 탭 → 고르기 판 닫힘`, async () => peekOf(await probe(page))?.isPitchSlotPickerShown === false, 5000)
  return `구질 칸 '${label}' 탭으로 고름`
}

async function checkDefenseButton(page) {
  const before = (await probe(page))?.offers ?? []
  if (!before.includes('6:1루 송구')) throw new Error(`송구 버튼이 없다: ${before.join(',')}`)
  await tapTouchButton(page, '1루 송구')
  await waitFor(page, "1루 송구 버튼 → 키 '6'", () => page.evaluate(() => window.__touchLog.keys.includes('6')), 3000)
  await waitFor(page, '송구 뒤 상황 버튼이 바뀜', async () => JSON.stringify((await probe(page))?.offers ?? []) !== JSON.stringify(before), 8000)
  return `1루 송구 버튼 → 키 6 · 상황 버튼 ${before.length} → ${((await probe(page))?.offers ?? []).length}`
}

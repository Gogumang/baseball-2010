// **팝업 상자가 판 가운데에 서는가** (r254) — 실제 앱 장면에서 알림 상자(`MessageBox`, role dialog '알림')의 중심을 원본 판
// (`[data-original-screen]`) 중심과 견준다. 원본 공용 창 0xbbef9 의 판 그리기 0x744c4 는 x = (W − 폭) >> 1 — 판 가운데다.
// r251 이 나리 포스트시즌 대진 위 팝업(우승 팀 발표 StrMODE[137] · 한국시리즈 우승 StrMODE[190])을 판 안으로 옮겼고, 이 스크립트가
// 그것을 장면으로 띄워 잰다. 좌표는 Playwright `boundingBox`(화면 좌표 — 웹킷 zoom 도 옮겨 준다)로 잰다.
//
//   E2E_PORT=5670 node e2e/popup-center.mjs                      # 아래 장면 × 기기 셋
//   E2E_PORT=5670 node e2e/popup-center.mjs nari-korean-series   # 장면만 골라
//
// 스크린샷은 `e2e/.run/popup-<장면>-<기기>.png`(쪽 전체). 중심이 판 중심에서 원본 1px 넘게 벗어나거나 폭이 240 이 아니면 끝 코드 1.
import { mkdirSync } from 'node:fs'
import { launch, openScene } from './lib/scene.mjs'

const SCENES = [
  'nari-postseason-champion',
  'nari-korean-series',
  'pitcher-postseason-champion',
  'pitcher-korean-series',
  'nari-cup-win',
  'pitcher-cup-win',
]

const DEVICES = [
  ['chromium', 'desktop'],
  ['webkit', 'iphone'],
  ['webkit', 'iphone-land'],
]

const RUN_DIR = new URL('./.run/', import.meta.url)
mkdirSync(RUN_DIR, { recursive: true })

const asked = process.argv.slice(2)
const scenes = asked.length > 0 ? asked : SCENES
const rows = []
for (const [browserName, device] of DEVICES) {
  const session = await launch(browserName, { device })
  try {
    for (const scene of scenes) {
      let row = { scene, device: `${browserName}-${device}` }
      try {
        await openScene(session.page, scene, { timeout: 60000 })
        const stage = await session.page.locator('[data-original-screen]').first().boundingBox()
        const dialog = session.page.locator('[role="dialog"][aria-label="알림"]').last()
        const box = await dialog.locator(':scope > *').first().boundingBox()
        if (stage === null || box === null) throw new Error('판 또는 상자가 없다')
        const scale = stage.width / 240
        const dx = (box.x + box.width / 2 - (stage.x + stage.width / 2)) / scale
        const dy = (box.y + box.height / 2 - (stage.y + stage.height / 2)) / scale
        const text = (await dialog.innerText()).replace(/\s+/g, ' ').trim().slice(0, 40)
        const path = new URL(`popup-${scene}-${browserName}-${device}.png`, RUN_DIR).pathname
        await session.page.screenshot({ path })
        row = {
          ...row,
          dx: Number(dx.toFixed(2)),
          dy: Number(dy.toFixed(2)),
          width: Number((box.width / scale).toFixed(1)),
          scale: Number(scale.toFixed(3)),
          text,
        }
        row.ok = Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && Math.abs(row.width - 240) <= 1
      } catch (error) {
        row = { ...row, ok: false, error: String(error).slice(0, 200) }
      }
      rows.push(row)
      console.log(
        `${row.ok ? 'ok  ' : 'FAIL'} ${row.device.padEnd(20)} ${scene.padEnd(28)} ${row.error ?? `dx ${row.dx} · dy ${row.dy} · 폭 ${row.width} · 배율 ${row.scale} · "${row.text}"`}`,
      )
    }
  } finally {
    await session.browser.close()
  }
}
const failed = rows.filter((row) => !row.ok)
console.log(`\n${rows.length - failed.length}/${rows.length} 가운데`)
process.exit(failed.length === 0 ? 0 : 1)

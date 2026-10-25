// 브라우저 실행 파일 찾기 — e2e 도우미(scene.mjs)와 브라우저 모드 시험 설정(vitest.browser.config.ts)이 같이 쓴다.
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'

/**
 * 크로미움 실행 파일 — 이 playwright 판의 기본 판이 캐시에 없으면 캐시에서 가장 새 headless shell 을 쓴다
 * (`PW_CHROMIUM_PATH` 로 정할 수도 있다). 웹킷은 기본 판(`npx playwright install webkit`).
 */
export function chromiumExecutable() {
  if (process.env.PW_CHROMIUM_PATH) return process.env.PW_CHROMIUM_PATH
  try {
    if (existsSync(chromium.executablePath())) return undefined
  } catch {
    // 판을 모르면 아래에서 찾는다
  }
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH ?? join(homedir(), 'Library/Caches/ms-playwright')
  if (!existsSync(cache)) return undefined
  const shells = readdirSync(cache)
    .filter((name) => name.startsWith('chromium_headless_shell-'))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
  for (const shell of shells) {
    for (const sub of ['chrome-headless-shell-mac-arm64', 'chrome-headless-shell-mac-x64', 'chrome-headless-shell-linux64']) {
      const path = join(cache, shell, sub, 'chrome-headless-shell')
      if (existsSync(path)) return path
    }
  }
  return undefined
}


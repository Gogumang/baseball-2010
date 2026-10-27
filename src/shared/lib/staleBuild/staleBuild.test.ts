// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  installStaleBuildReload,
  isSameBuild,
  noteBlockingLoadFailure,
  noteSafePoint,
  resetStaleBuildForTests,
} from '@/shared/lib/staleBuild/staleBuild'

const ENTRY = './assets/index-AAAA.js'
const OLD_HTML = `<script type="module" crossorigin src="${ENTRY}"></script>`
const NEW_HTML = '<script type="module" crossorigin src="./assets/index-BBBB.js"></script>'

let clock = 0
let reloads = 0
let html = OLD_HTML
let fetches = 0
let failFetch = false

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

function setUp() {
  resetStaleBuildForTests({
    reload: () => { reloads += 1 },
    now: () => clock,
    entrySrc: ENTRY,
    fetchDocument: () => {
      fetches += 1
      return failFetch ? Promise.reject(new Error('offline')) : Promise.resolve(html)
    },
  })
}

beforeEach(() => {
  clock = 1_000_000
  reloads = 0
  html = OLD_HTML
  fetches = 0
  failFetch = false
  window.sessionStorage.clear()
  setUp()
})
afterEach(() => resetStaleBuildForTests())

describe('staleBuild — 새 배포 뒤 열려 있던 탭', () => {
  it('문서에 지금 판의 첫 스크립트 · 자산 폴더가 다 있어야 같은 판이다', () => {
    expect(isSameBuild(OLD_HTML, ENTRY, './')).toBe(true)
    expect(isSameBuild(NEW_HTML, ENTRY, './')).toBe(false)
    expect(isSameBuild(`${OLD_HTML}<link href="./v/aaa/font/x.woff2">`, ENTRY, './v/aaa/')).toBe(true)
    expect(isSameBuild(`${OLD_HTML}<link href="./v/bbb/font/x.woff2">`, ENTRY, './v/aaa/')).toBe(false)
  })

  it('경기 · 관리 중에는 새 배포를 알아도 다시 부르지 않고, 메인 메뉴에 들어설 때 부른다', async () => {
    noteSafePoint(false)
    html = NEW_HTML
    window.dispatchEvent(new Event('vite:preloadError'))
    await flush()
    expect(fetches).toBe(1)
    expect(reloads).toBe(0)
    noteSafePoint(true)
    expect(reloads).toBe(1)
  })

  it('preloadError 가 와도 문서가 같은 판이면(망이 잠깐 끊김) 다시 부르지 않는다', async () => {
    window.dispatchEvent(new Event('vite:preloadError'))
    await flush()
    expect(fetches).toBe(1)
    expect(reloads).toBe(0)
  })

  it('문서를 못 받으면(망 없음) 다시 부르지 않는다 — 브라우저 오류 쪽을 띄우지 않는다', async () => {
    failFetch = true
    html = NEW_HTML
    window.dispatchEvent(new Event('vite:preloadError'))
    await flush()
    expect(reloads).toBe(0)
  })

  it('안전한 화면에 들어서면 1분에 한 번 새 배포를 확인하고, 새 판이면 그 자리에서 부른다', async () => {
    noteSafePoint(true)
    await flush()
    expect(fetches).toBe(1)
    noteSafePoint(false)
    noteSafePoint(true)
    await flush()
    expect(fetches).toBe(1)
    clock += 60_000
    html = NEW_HTML
    noteSafePoint(false)
    noteSafePoint(true)
    await flush()
    expect(fetches).toBe(2)
    expect(reloads).toBe(1)
  })

  it('화면에 꼭 필요한 덩이를 못 받았으면 새 판으로 확인되는 대로 경기 중이어도 부른다', async () => {
    noteSafePoint(false)
    html = NEW_HTML
    noteBlockingLoadFailure()
    await flush()
    expect(reloads).toBe(1)
  })

  it('다시 부른 지 30초 안에는 또 부르지 않는다 (되풀이 막기)', async () => {
    html = NEW_HTML
    window.dispatchEvent(new Event('vite:preloadError'))
    await flush()
    expect(reloads).toBe(1)
    setUp()
    clock += 10_000
    window.dispatchEvent(new Event('vite:preloadError'))
    await flush()
    expect(reloads).toBe(1)
    setUp()
    clock += 30_000
    window.dispatchEvent(new Event('vite:preloadError'))
    await flush()
    expect(reloads).toBe(2)
  })
})

// 귀는 한 번만 단다 (모듈 상태는 시험마다 `resetStaleBuildForTests` 로 되돌린다)
installStaleBuildReload(window, { checkDocument: false })

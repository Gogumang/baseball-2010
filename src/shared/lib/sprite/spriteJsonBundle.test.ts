import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildSpriteJsonBundle } from '../../../../tools/viteSpriteJsonBundle'
import { loadSpriteJson, resetSpriteCacheForTest } from '@/shared/lib/sprite/spriteCache'
import { fetchSpriteJson, setSpriteJsonBundleForTests, spriteJsonBundleKey, type SpriteJsonBundleFile } from '@/shared/lib/sprite/spriteJsonBundle'

const ROOT = 'public/sprites'
const BUNDLE_URL = './sprites/sprite-json.bundle.json'

function jsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return jsonFiles(path)
    return name.endsWith('.json') ? [path] : []
  })
}

/** 묶음 주소는 묶음을, 나머지는 공용 폴더의 낱개 파일을 내주는 가짜 fetch */
function fakeServer(bundleText: string | null) {
  return vi.fn(async (url: string) => {
    if (url === BUNDLE_URL) {
      return bundleText === null
        ? { ok: false, status: 404, json: async () => null }
        : { ok: true, status: 200, json: async () => JSON.parse(bundleText) as unknown }
    }
    const key = spriteJsonBundleKey(url)
    try {
      const text = readFileSync(join(ROOT, key ?? url), 'utf8')
      return { ok: true, status: 200, json: async () => JSON.parse(text) as unknown }
    } catch {
      return { ok: false, status: 404, json: async () => null }
    }
  })
}

afterEach(() => {
  setSpriteJsonBundleForTests(null)
  resetSpriteCacheForTest()
  vi.unstubAllGlobals()
})

describe('스프라이트 JSON 묶음 (r311 A5)', () => {
  const bundleText = buildSpriteJsonBundle(ROOT)
  const bundle = JSON.parse(bundleText) as SpriteJsonBundleFile

  it('public/sprites 의 JSON 을 모두 글 그대로 담는다 — 값이 낱개 파일과 같다', () => {
    const files = jsonFiles(ROOT)
    expect(files.length).toBeGreaterThanOrEqual(265)
    expect(Object.keys(bundle.files).sort()).toEqual(files.map((path) => path.slice(ROOT.length + 1)).sort())
    for (const path of files) {
      const text = readFileSync(path, 'utf8')
      const key = path.slice(ROOT.length + 1)
      expect(bundle.files[key]).toBe(text)
      expect(JSON.parse(bundle.files[key])).toEqual(JSON.parse(text))
    }
  })

  it('같은 입력이면 같은 바이트', () => {
    expect(buildSpriteJsonBundle(ROOT)).toBe(bundleText)
  })

  it('주소 → 열쇠: 스프라이트 JSON 만', () => {
    expect(spriteJsonBundleKey('./sprites/pitcher/frames/origins.json')).toBe('pitcher/frames/origins.json')
    expect(spriteJsonBundleKey('sprites/ptcimg/particles.json')).toBe('ptcimg/particles.json')
    expect(spriteJsonBundleKey('./sprites/pitcher/frames/003.png')).toBeNull()
    expect(spriteJsonBundleKey('./o.json')).toBeNull()
  })

  it('묶음을 한 번 받아 모든 JSON 을 꺼낸다 — 낱개로 받은 것과 깊이 같고, 부를 때마다 새 객체다', async () => {
    const keys = Object.keys(bundle.files)
    setSpriteJsonBundleForTests(null)
    vi.stubGlobal('fetch', fakeServer(bundleText))
    const single = await Promise.all(keys.map((key) => fetchSpriteJson(`./sprites/${key}`)))

    setSpriteJsonBundleForTests(BUNDLE_URL)
    const fetchMock = fakeServer(bundleText)
    vi.stubGlobal('fetch', fetchMock)
    const bundled = await Promise.all(keys.map((key) => fetchSpriteJson(`./sprites/${key}`)))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(bundled).toEqual(single)
    const again = await fetchSpriteJson(`./sprites/${keys[0]}`)
    expect(again).toEqual(bundled[0])
    expect(again).not.toBe(bundled[0])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('묶음에 없는 주소 · 묶음을 못 받으면 낱개 파일 — 없는 파일은 예전처럼 거부', async () => {
    setSpriteJsonBundleForTests(BUNDLE_URL)
    const fetchMock = fakeServer(JSON.stringify({ version: 1, files: {} }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchSpriteJson('./sprites/pitcher/frames/origins.json')).resolves.toEqual(
      JSON.parse(readFileSync(join(ROOT, 'pitcher/frames/origins.json'), 'utf8')),
    )
    await expect(fetchSpriteJson('./sprites/none/origins.json')).rejects.toThrow('(404)')

    setSpriteJsonBundleForTests(BUNDLE_URL)
    vi.stubGlobal('fetch', fakeServer(null))
    await expect(fetchSpriteJson('./sprites/pitcher/frames/origins.json')).resolves.toEqual(
      JSON.parse(readFileSync(join(ROOT, 'pitcher/frames/origins.json'), 'utf8')),
    )
  })

  it('공용 캐시(loadSpriteJson)도 묶음을 거쳐 같은 값', async () => {
    setSpriteJsonBundleForTests(BUNDLE_URL)
    const fetchMock = fakeServer(bundleText)
    vi.stubGlobal('fetch', fetchMock)
    const [origins, animations] = await Promise.all([
      loadSpriteJson('./sprites/pitcher/frames/origins.json'),
      loadSpriteJson('./sprites/pitcher/frames/animations.json'),
    ])
    expect(origins).toEqual(JSON.parse(readFileSync(join(ROOT, 'pitcher/frames/origins.json'), 'utf8')))
    expect(animations).toEqual(JSON.parse(readFileSync(join(ROOT, 'pitcher/frames/animations.json'), 'utf8')))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

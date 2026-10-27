import { afterEach, describe, expect, it, vi } from 'vitest'
import { assetUrl, ASSET_ROOT } from '@/shared/lib/assetUrl/assetUrl'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('assetUrl — 정적 자산 주소 앞부분', () => {
  it('개발 · 시험에서는 받은 글자 그대로다 (예전 주소와 한 글자도 다르지 않다)', () => {
    expect(ASSET_ROOT).toBe('./')
    expect(assetUrl('./sprites/num/001.png')).toBe('./sprites/num/001.png')
    expect(assetUrl('sounds')).toBe('sounds')
    expect(assetUrl('./font/synGak9_11.png')).toBe('./font/synGak9_11.png')
  })

  it('빌드(앞부분 `./v/<해시>/`)에서는 `./` · `/` · 맨 경로 모두 버전 폴더 아래가 된다', async () => {
    vi.stubGlobal('__ASSET_ROOT__', './v/0123456789/')
    const built = await import('@/shared/lib/assetUrl/assetUrl')
    expect(built.ASSET_ROOT).toBe('./v/0123456789/')
    expect(built.assetUrl('./sprites/num/001.png')).toBe('./v/0123456789/sprites/num/001.png')
    expect(built.assetUrl('/sprites/num/001.png')).toBe('./v/0123456789/sprites/num/001.png')
    expect(built.assetUrl('sounds')).toBe('./v/0123456789/sounds')
  })

  it('빌드에서도 스프라이트 JSON 묶음 열쇠를 찾는다', async () => {
    vi.stubGlobal('__ASSET_ROOT__', './v/0123456789/')
    const bundle = await import('@/shared/lib/sprite/spriteJsonBundle')
    expect(bundle.SPRITE_JSON_BUNDLE_URL).toBe('./v/0123456789/sprites/sprite-json.bundle.json')
    expect(bundle.spriteJsonBundleKey('./v/0123456789/sprites/pitcher/origins.json')).toBe('pitcher/origins.json')
    expect(bundle.spriteJsonBundleKey('./v/0123456789/sprites/pitcher/frames/001.png')).toBeNull()
  })
})

describe('자산 주소는 모두 assetUrl 을 거친다', () => {
  it('시험 아닌 코드에 assetUrl 밖의 `./sprites` · `./sounds` · `./font` 글자가 없다 (빌드에서 버전 폴더를 빠뜨리면 404)', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs')
    const { join } = await import('node:path')
    const root = new URL('../../../', import.meta.url).pathname
    const files = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) return files(path)
      return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.css.ts') ? [path] : []
    })
    const leftovers: string[] = []
    for (const path of files(root)) {
      if (path.endsWith('shared/lib/assetUrl/assetUrl.ts')) continue
      readFileSync(path, 'utf8').split('\n').forEach((line, index) => {
        if (/^\s*(\*|\/\/|\/\*)/.test(line)) return
        const bare = line.replace(/assetUrl\((['"`])(\.\/)?(sprites|sounds|font)/g, '')
        if (/(['"`])\.?\/?(sprites|sounds|font)(['"`/])/.test(bare) && !/includes\('sprites\/'\)/.test(bare)) {
          leftovers.push(`${path.slice(root.length)}:${index + 1}: ${line.trim()}`)
        }
      })
    }
    expect(leftovers).toEqual([])
  })
})

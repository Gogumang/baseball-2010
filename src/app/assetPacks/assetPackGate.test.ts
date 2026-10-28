import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { missingPacks, parseAssetPackManifest, runAssetPackGate, versionOfCacheName } from '@/app/assetPacks/assetPackGate'
import { buildPack, isPackedAsset } from '../../../tools/viteAssetPacks'

describe('parseAssetPackManifest', () => {
  it('판 · 묶음 목록을 읽는다', () => {
    expect(parseAssetPackManifest({ version: 'ab12', packs: [{ file: '0-ff.bin', bytes: 10, raw: 20 }] })).toEqual({
      version: 'ab12',
      packs: [{ file: '0-ff.bin', bytes: 10, raw: 20 }],
    })
  })

  it('꼴이 틀리면 null — 묶음 이름에 경로가 섞이면 안 된다', () => {
    expect(parseAssetPackManifest(null)).toBeNull()
    expect(parseAssetPackManifest({ version: 'XYZ', packs: [] })).toBeNull()
    expect(parseAssetPackManifest({ version: 'ab', packs: [{ file: '../x.bin', bytes: 1, raw: 1 }] })).toBeNull()
    expect(parseAssetPackManifest({ version: 'ab', packs: [{ file: 'x.bin', bytes: '1', raw: 1 }] })).toBeNull()
  })
})

describe('versionOfCacheName · missingPacks', () => {
  it('우리 캐시 이름에서만 판을 읽는다', () => {
    expect(versionOfCacheName('asset-packs-ab12')).toBe('ab12')
    expect(versionOfCacheName('other')).toBeNull()
  })

  it('캐시에 없는 묶음만', () => {
    const manifest = {
      version: 'a',
      packs: [
        { file: '0.bin', bytes: 1, raw: 1 },
        { file: '1.bin', bytes: 1, raw: 1 },
      ],
    }
    expect(missingPacks(manifest, ['0.bin']).map((pack) => pack.file)).toEqual(['1.bin'])
  })
})

describe('runAssetPackGate', () => {
  it('시험에서는 건너뛴다', async () => {
    await expect(runAssetPackGate({ isShortcut: false })).resolves.toBe('skipped')
  })
})

describe('묶음 꼴 (tools/viteAssetPacks)', () => {
  it('머리 길이 · 머리 JSON · 바이트 그대로 — 워커가 자리로 잘라 낸 바이트가 원래 파일과 같다', () => {
    const a = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])
    const b = Buffer.from('console.log(1)')
    const { raw, gz } = buildPack([
      ['sprites/a/001.png', a],
      ['assets/x.js', b],
    ])
    expect(gunzipSync(gz).equals(raw)).toBe(true)
    const headLength = raw.readUInt32LE(0)
    const head = JSON.parse(raw.subarray(4, 4 + headLength).toString('utf8')) as { entries: [string, number, number][] }
    const data = raw.subarray(4 + headLength)
    expect(head.entries).toEqual([
      ['sprites/a/001.png', 0, a.length],
      ['assets/x.js', a.length, b.length],
    ])
    for (const [path, offset, length] of head.entries) {
      expect(data.subarray(offset, offset + length).equals(path.endsWith('.png') ? a : b)).toBe(true)
    }
  })

  it('묶는 것 — index.html · 낱개 스프라이트 JSON · 소스맵 · 묶음 자신은 뺀다', () => {
    expect(isPackedAsset('sprites/num/001.png')).toBe(true)
    expect(isPackedAsset('v/abc/sprites/num/001.png')).toBe(true)
    expect(isPackedAsset('assets/App-1.js')).toBe(true)
    expect(isPackedAsset('sounds/1.mp3')).toBe(true)
    expect(isPackedAsset('sprites/sprite-json.bundle.json')).toBe(true)
    expect(isPackedAsset('sprites/num/origins.json')).toBe(false)
    expect(isPackedAsset('index.html')).toBe(false)
    expect(isPackedAsset('assets/App-1.js.map')).toBe(false)
    expect(isPackedAsset('asset-packs/0-a.bin')).toBe(false)
    expect(isPackedAsset('asset-sw.js')).toBe(false)
  })
})

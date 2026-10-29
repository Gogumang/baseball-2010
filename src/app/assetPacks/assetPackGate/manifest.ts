export const ASSET_PACK_MANIFEST = './asset-packs/manifest.json'

export const ASSET_PACK_SERVICE_WORKER = './asset-sw.js'

export const ASSET_PACK_CACHE_PREFIX = 'asset-packs-'

/** 다 넣은 묶음 이름 목록 — 워커가 이것만 본다 */
export const ASSET_PACK_STORED = './asset-packs/stored.json'

export interface AssetPackEntry {
  readonly file: string
  /** 받는(gzip) 크기 */
  readonly bytes: number
  /** 푼 크기 */
  readonly raw: number
}

export interface AssetPackManifest {
  readonly version: string
  readonly packs: readonly AssetPackEntry[]
}

export type AssetPackGateResult = 'downloaded' | 'cached' | 'offline' | 'partial' | 'failed' | 'skipped' | 'unsupported'

/** 묶음 한 줄의 꼴 검사 — 묶음 이름에 경로가 섞이면 안 된다. 틀리면 null */
function parseAssetPackEntry(pack: unknown): AssetPackEntry | null {
  if (pack === null || typeof pack !== 'object') return null
  const { file, bytes, raw } = pack as { file?: unknown; bytes?: unknown; raw?: unknown }
  if (typeof file !== 'string' || !/^[\w.-]+\.bin$/.test(file) || typeof bytes !== 'number' || typeof raw !== 'number') return null
  return { file, bytes, raw }
}

/** 목록 꼴 검사 — 틀리면 null */
export function parseAssetPackManifest(value: unknown): AssetPackManifest | null {
  if (value === null || typeof value !== 'object') return null
  const { version, packs } = value as { version?: unknown; packs?: unknown }
  if (typeof version !== 'string' || !/^[0-9a-f]+$/.test(version) || !Array.isArray(packs)) return null
  const parsed: AssetPackEntry[] = []
  for (const pack of packs) {
    const entry = parseAssetPackEntry(pack)
    if (entry === null) return null
    parsed.push(entry)
  }
  return { version, packs: parsed }
}

/** 판 캐시 이름에서 판 — 우리 캐시가 아니면 null */
export function versionOfCacheName(name: string): string | null {
  return name.startsWith(ASSET_PACK_CACHE_PREFIX) ? name.slice(ASSET_PACK_CACHE_PREFIX.length) : null
}

/** 아직 캐시에 없는 묶음 */
export function missingPacks(manifest: AssetPackManifest, stored: readonly string[]): AssetPackEntry[] {
  return manifest.packs.filter((pack) => !stored.includes(pack.file))
}

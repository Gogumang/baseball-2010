/**
 * vite 플러그인 — **자산 묶음** `asset-packs/` (r322).
 *
 * 빌드 산출물의 자산(JS · CSS 덩이, 스프라이트 PNG, 스프라이트 JSON 묶음, 소리, 글꼴)을 gzip 한 묶음 파일 몇 개로 내보낸다.
 * 앱은 첫 진입에 진행 막대 화면을 띄우고 이 묶음을 한꺼번에 받아 Cache Storage 에 넣는다. 그 뒤로는 서비스 워커
 * (`tools/assetPackServiceWorker.js` → 산출물 `asset-sw.js`)가 낱개 주소 요청에 묶음에서 잘라 그 파일 바이트 그대로 답한다.
 * 읽는 쪽은 `src/app/assetPacks/assetPackGate.ts` 다.
 *
 * - **바이트 그대로**: 묶음 안 각 파일은 산출물 파일 바이트를 그대로 이어 붙인 것이다. 디코드는 지금처럼 쓰는 때 낱개로 한다.
 * - **꼴**: `[u32 LE 머리 길이][머리 JSON {"entries":[[경로, 자리, 길이], …]}][바이트 …]` 전체를 gzip(9). 경로는 산출물 뿌리
 *   기준(`sprites/num/001.png` · `assets/App-….js` · 버전 경로면 `v/<해시>/sprites/…`), 자리는 머리 뒤 바이트 시작 기준.
 *   Vercel 은 `application/octet-stream` 을 압축하지 않을 수 있어 빌드가 직접 gzip 하고 앱이 `DecompressionStream` 으로 푼다.
 * - **목록**: `asset-packs/manifest.json` — `{ version, packs: [{ file, bytes(받는 크기), raw(푼 크기) }] }`. `version` 은 묶음 바이트의
 *   sha256 앞 12자리, 묶음 이름에도 해시가 들어간다(같은 이름 = 같은 바이트).
 * - **빼는 것**: `index.html`(서비스 워커가 망 먼저 · 오프라인일 때만 캐시), 소스맵, 낱개 스프라이트 JSON(묶음 JSON 이 덮는다 — 묶음에
 *   없는 주소는 지금처럼 낱개로 받는다).
 * - 빌드 산출물을 다 쓴 뒤(`closeBundle`, 맨 끝) 산출물 폴더를 훑는다 — 공용 폴더를 어디로 옮기든(r318 버전 경로) 그 자리 그대로 묶는다.
 * 개발 서버에는 손대지 않는다(묶음 · 워커가 없으면 앱은 지금처럼 낱개로 받는다).
 */
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import type { Plugin } from 'vite'

export const ASSET_PACK_DIR = 'asset-packs'
export const ASSET_PACK_SERVICE_WORKER = 'asset-sw.js'
/** 묶음 하나의 푼 크기 상한 — 받기 실패 때 다시 받는 단위 · 진행 막대 칸 */
const PACK_RAW_LIMIT = 2 * 1024 * 1024

const INCLUDED = /\.(png|js|css|mp3|woff2|ttf|otf)$/

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

/** 묶을 파일인가 — 산출물 뿌리 기준 경로 */
export function isPackedAsset(path: string): boolean {
  if (path.startsWith(`${ASSET_PACK_DIR}/`) || path === ASSET_PACK_SERVICE_WORKER) return false
  if (path.endsWith('sprite-json.bundle.json')) return true
  return INCLUDED.test(path)
}

/** 묶음 차례 — 코드 · 글꼴 · JSON · 소리를 앞에, 그림을 뒤에(경로 차례) */
function rank(path: string): number {
  if (/\.(js|css)$/.test(path)) return 0
  if (/\.(woff2|ttf|otf|json)$/.test(path)) return 1
  if (path.endsWith('.mp3')) return 2
  return 3
}

export interface BuiltPack {
  readonly file: string
  readonly bytes: number
  readonly raw: number
  readonly body: Buffer
}

/** 묶음 하나 — 머리 + 바이트를 gzip */
export function buildPack(entries: readonly (readonly [string, Buffer])[]): { raw: Buffer; gz: Buffer } {
  let offset = 0
  const header = entries.map(([path, bytes]) => {
    const entry = [path, offset, bytes.length] as const
    offset += bytes.length
    return entry
  })
  const head = Buffer.from(JSON.stringify({ entries: header }), 'utf8')
  const length = Buffer.alloc(4)
  length.writeUInt32LE(head.length, 0)
  const raw = Buffer.concat([length, head, ...entries.map(([, bytes]) => bytes)])
  return { raw, gz: gzipSync(raw, { level: 9 }) }
}

/** 산출물 폴더를 묶는다 — 묶음 파일 · 목록을 쓰고 목록을 돌려준다 */
export function writeAssetPacks(outDir: string): { version: string; packs: BuiltPack[] } {
  const paths = files(outDir)
    .map((path) => relative(outDir, path).split(sep).join('/'))
    .filter(isPackedAsset)
    .sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0))
  const groups: (readonly [string, Buffer])[][] = [[]]
  let size = 0
  for (const path of paths) {
    const bytes = readFileSync(join(outDir, path))
    const group = groups[groups.length - 1]
    if (group.length > 0 && (size + bytes.length > PACK_RAW_LIMIT || rank(path) !== rank(group[0][0]))) {
      groups.push([])
      size = 0
    }
    groups[groups.length - 1].push([path, bytes])
    size += bytes.length
  }
  const all = createHash('sha256')
  const built = groups
    .filter((group) => group.length > 0)
    .map((group, index) => {
      const { raw, gz } = buildPack(group)
      const hash = createHash('sha256').update(gz).digest('hex').slice(0, 10)
      all.update(gz)
      return { file: `${index}-${hash}.bin`, bytes: gz.length, raw: raw.length, body: gz }
    })
  const version = all.digest('hex').slice(0, 12)
  mkdirSync(join(outDir, ASSET_PACK_DIR), { recursive: true })
  for (const pack of built) writeFileSync(join(outDir, ASSET_PACK_DIR, pack.file), pack.body)
  writeFileSync(
    join(outDir, ASSET_PACK_DIR, 'manifest.json'),
    JSON.stringify({ version, packs: built.map(({ file, bytes, raw }) => ({ file, bytes, raw })) }),
  )
  return { version, packs: built }
}

export function assetPacks(): Plugin {
  let outDir = ''
  return {
    name: 'asset-packs',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle: {
      order: 'post',
      sequential: true,
      handler() {
        const { version, packs } = writeAssetPacks(outDir)
        copyFileSync(join(dirname(fileURLToPath(import.meta.url)), 'assetPackServiceWorker.js'), join(outDir, ASSET_PACK_SERVICE_WORKER))
        const megabytes = (bytes: number) => (bytes / 1024 / 1024).toFixed(2)
        const raw = packs.reduce((sum, pack) => sum + pack.raw, 0)
        const sent = packs.reduce((sum, pack) => sum + pack.bytes, 0)
        console.log(`asset-packs ${version}: 묶음 ${packs.length}개 · ${megabytes(raw)}MB → gzip ${megabytes(sent)}MB`)
      },
    },
  }
}

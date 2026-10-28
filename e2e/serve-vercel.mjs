// **Vercel 흉내 정적 서버** — 빌드 산출물을 `vercel.json` 의 `headers` 그대로 붙여 내준다(r318, OPTIMIZATION-2026-10-27 A2).
// 다시 방문(304 왕복이 없어지는지)을 로컬에서 잴 때 쓴다. 실제 Vercel 과 같게:
//  - 기본 `Cache-Control: public, max-age=0, must-revalidate` (Vercel 정적 파일 기본값), `vercel.json` 의 `source` 가 맞으면 그 머리로 덮는다
//  - `ETag` · `If-None-Match` → 304
//  - 글(js · css · json · html · svg · txt)은 `Accept-Encoding` 에 gzip 이 있으면 gzip 으로 보낸다(Vercel 은 br 도 준다 — 크기만 조금 다르다)
//  - `/` 는 `index.html`, 없는 파일은 404
//
//   yarn node e2e/serve-vercel.mjs <산출물 폴더> <포트> [vercel.json | none]
//   none 이면 `vercel.json` 없이(모든 파일이 기본 머리 — r318 전 배포와 같은 꼴) 내준다.
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

const [dirArg, portArg, configArg] = process.argv.slice(2)
if (dirArg === undefined || portArg === undefined) throw new Error('usage: serve-vercel.mjs <dist> <port> [vercel.json|none]')
const ROOT = resolve(dirArg)
const PORT = Number(portArg)
const CONFIG = configArg ?? new URL('../vercel.json', import.meta.url).pathname

const DEFAULT_CACHE = 'public, max-age=0, must-revalidate'
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
}
const COMPRESSIBLE = /^(text\/|application\/json|image\/svg)/

/** `vercel.json` 의 `source`(path-to-regexp 꼴 중 `(.*)` · 글자만 쓴다) → 정규식 */
function sourcePattern(source) {
  const escaped = source
    .split('(.*)')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('(.*)')
  return new RegExp(`^${escaped}$`)
}

const rules =
  configArg === 'none'
    ? []
    : (JSON.parse(readFileSync(CONFIG, 'utf8')).headers ?? []).map((rule) => ({ pattern: sourcePattern(rule.source), headers: rule.headers }))

const cache = new Map()
function fileOf(path) {
  const known = cache.get(path)
  if (known !== undefined) return known
  let body
  try {
    if (!statSync(path).isFile()) return null
    body = readFileSync(path)
  } catch {
    return null
  }
  const type = TYPES[extname(path)] ?? 'application/octet-stream'
  const entry = {
    body,
    type,
    etag: `"${createHash('sha1').update(body).digest('hex')}"`,
    gzip: COMPRESSIBLE.test(type) && body.length > 1024 ? gzipSync(body) : null,
  }
  cache.set(path, entry)
  return entry
}

createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost')
  const pathname = decodeURIComponent(url.pathname)
  const filePath = normalize(join(ROOT, pathname.endsWith('/') ? `${pathname}index.html` : pathname))
  const file = filePath.startsWith(ROOT) ? fileOf(filePath) : null
  const headers = { 'Cache-Control': DEFAULT_CACHE }
  for (const rule of rules) {
    if (!rule.pattern.test(pathname)) continue
    for (const { key, value } of rule.headers) headers[key] = value
  }
  if (file === null) {
    response.writeHead(404, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('not found')
    return
  }
  headers['Content-Type'] = file.type
  headers.ETag = file.etag
  headers.Vary = 'Accept-Encoding'
  if (request.headers['if-none-match'] === file.etag) {
    response.writeHead(304, headers)
    response.end()
    return
  }
  const useGzip = file.gzip !== null && /\bgzip\b/.test(request.headers['accept-encoding'] ?? '')
  if (useGzip) headers['Content-Encoding'] = 'gzip'
  const body = useGzip ? file.gzip : file.body
  headers['Content-Length'] = String(body.length)
  response.writeHead(200, headers)
  response.end(request.method === 'HEAD' ? undefined : body)
}).listen(PORT, '127.0.0.1', () => console.log(`serve-vercel ${ROOT} → http://127.0.0.1:${PORT}/ (${configArg === 'none' ? '기본 머리만' : CONFIG})`))

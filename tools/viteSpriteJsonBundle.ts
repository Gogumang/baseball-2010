/**
 * vite 플러그인 — **스프라이트 JSON 묶음** `sprites/sprite-json.bundle.json` 을 만든다 (r311, OPTIMIZATION-2026-10-27 A5).
 *
 * `public/sprites/**\/*.json` 을 모두 읽어 `{ version: 1, files: { "<sprites/ 아래 경로>": "<파일 글 그대로>" } }` 로 묶는다.
 * 읽는 쪽은 `src/shared/lib/sprite/spriteJsonBundle.ts` 다.
 *  - 개발 서버: 요청이 올 때마다 새로 만든다(공용 폴더 JSON 을 고치면 바로 따라온다). 하위 경로로 열어도 되게 끝 경로로 고른다.
 *  - 빌드: 산출물 `sprites/sprite-json.bundle.json` 으로 쓴다. 낱개 JSON 도 공용 폴더 복사로 그대로 남는다(묶음에 없는 주소 대비).
 * 열쇠는 경로 차례로 정렬해 같은 입력이면 같은 바이트가 나온다.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import type { Plugin } from 'vite'

export const SPRITE_JSON_BUNDLE_PATH = 'sprites/sprite-json.bundle.json'

function jsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return jsonFiles(path)
    return name.endsWith('.json') ? [path] : []
  })
}

/** 묶음 글 — `spritesDir` 는 `public/sprites` */
export function buildSpriteJsonBundle(spritesDir: string): string {
  const files: Record<string, string> = {}
  for (const path of jsonFiles(spritesDir).sort()) {
    const key = relative(spritesDir, path).split(sep).join('/')
    if (`sprites/${key}` === SPRITE_JSON_BUNDLE_PATH) continue
    files[key] = readFileSync(path, 'utf8')
  }
  return JSON.stringify({ version: 1, files })
}

export function spriteJsonBundle(): Plugin {
  let spritesDir = ''
  return {
    name: 'sprite-json-bundle',
    configResolved(config) {
      spritesDir = join(config.publicDir, 'sprites')
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = (request.url ?? '').split('?')[0]
        if (!path.endsWith(`/${SPRITE_JSON_BUNDLE_PATH}`)) return next()
        response.setHeader('Content-Type', 'application/json')
        response.setHeader('Cache-Control', 'no-cache')
        response.end(buildSpriteJsonBundle(spritesDir))
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: SPRITE_JSON_BUNDLE_PATH, source: buildSpriteJsonBundle(spritesDir) })
    },
  }
}

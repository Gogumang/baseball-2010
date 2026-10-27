/**
 * vite 플러그인 — **정적 자산 버전 경로** (r318, OPTIMIZATION-2026-10-27 A2).
 *
 * 빌드 산출물에서 `public/`(그림 `sprites/` · 소리 `sounds/` · 글꼴 `font/`)을 `v/<내용 해시>/` 아래로 내보낸다.
 * 그래서 호스트(`vercel.json`)가 `assets/*` 처럼 `v/*` 도 1년 · immutable 로 캐시할 수 있다 — 다시 방문할 때 304 왕복이 없다.
 *
 *  - **해시**: `public/` 전체 파일의 (경로, 바이트)를 sha256 으로 — 앞 10자리. 자산이 하나라도 바뀌면 경로가 바뀌어 전부 새로 받고,
 *    코드만 바뀐 배포는 경로가 그대로라 캐시가 산다. 같은 입력이면 같은 해시다(경로 차례로 정렬).
 *  - **코드 쪽 주소**: 코드는 모든 자산 주소를 `src/shared/lib/assetUrl` 의 `assetUrl()` 로 만든다. 이 플러그인은 빌드 때만
 *    `__ASSET_ROOT__` 를 `'./v/<해시>/'` 로 박는다. 개발 서버 · vitest 는 손대지 않는다(주소가 예전 `./sprites/…` 그대로).
 *  - **옮기기, 두 벌 아님**: vite 의 공용 폴더 복사(`build.copyPublicDir`)를 끄고, 산출물을 쓴 뒤 `public/` 을 `v/<해시>/` 로 한 번만
 *    복사한다 — 산출물에 `sprites/` 와 `v/<해시>/sprites/` 가 같이 남지 않는다.
 *  - **HTML · CSS 의 공용 주소**: `/font/synGak9.woff2`(글꼴 미리 받기 · `@font-face`)는 vite `renderBuiltUrl` 로 `v/<해시>/font/…` 가
 *    된다(CSS 이름의 해시에 들어간다). 산출물 HTML · CSS 에 버전 없는 공용 주소가 남아 있으면 빌드를 멈춘다.
 */
import { createHash } from 'node:crypto'
import { cpSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import type { Plugin } from 'vite'

/** 산출물에서 자산이 놓이는 폴더 꼴 — `v/<해시>/` */
export const VERSIONED_ASSET_DIR = 'v'

/** `public/` 아래 맨 윗 폴더들 — HTML · CSS 의 공용 주소를 고칠 때 본다 */
const PUBLIC_TOP = ['sprites', 'sounds', 'font']

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

/**
 * 산출물 꼴 번호 — 해시에 함께 넣는다. `public/` 은 그대로인데 버전 폴더 안 생성물의 꼴이 바뀌면(예: 스프라이트 JSON 묶음
 * `sprite-json.bundle.json` 의 꼴) 이 값을 올려 경로를 바꾼다 — 같은 경로에 다른 바이트가 놓이면 오래 캐시된 옛 것을 쓴다.
 */
const ASSET_LAYOUT_VERSION = '1'

const hashes = new Map<string, string>()

/** `public/` 내용 해시 앞 10자리 — 같은 폴더는 한 번만 센다 */
export function publicAssetsHash(publicDir: string): string {
  const key = resolve(publicDir)
  const known = hashes.get(key)
  if (known !== undefined) return known
  const hash = createHash('sha256').update(`layout ${ASSET_LAYOUT_VERSION}\0`)
  for (const path of files(key).sort()) {
    const name = relative(key, path).split(sep).join('/')
    // 맥 Finder 찌꺼기는 셈에서 뺀다(산출물에도 의미 없다)
    if (name.endsWith('.DS_Store')) continue
    hash.update(name).update('\0').update(readFileSync(path)).update('\0')
  }
  const value = hash.digest('hex').slice(0, 10)
  hashes.set(key, value)
  return value
}

/** 산출물 안 자산 폴더 — `v/<해시>/` (끝 `/` 포함) */
export function versionedAssetDir(publicDir: string): string {
  return `${VERSIONED_ASSET_DIR}/${publicAssetsHash(publicDir)}/`
}

/** `"./font/` · `(../font/` · `"/font/` 처럼 따옴표 · 괄호 · `=` 뒤의 버전 없는 공용 주소 (빌드 끝 검사) */
const UNVERSIONED = new RegExp(`(["'(=\\s])(\\.{0,2}/)(${PUBLIC_TOP.join('|')})/`, 'g')

export function versionedAssets(): Plugin {
  let publicDir = ''
  let outDir = ''
  let isBuild = false
  return {
    name: 'versioned-assets',
    config(config, env) {
      if (env.command !== 'build') return
      // 자산 해시를 코드에 박는다 — `assetUrl()` 이 이 앞부분을 붙인다
      const root = resolve(config.root ?? process.cwd())
      const dir = versionedAssetDir(resolve(root, typeof config.publicDir === 'string' ? config.publicDir : 'public'))
      return {
        define: { __ASSET_ROOT__: JSON.stringify(`./${dir}`) },
        build: { copyPublicDir: false },
        experimental: {
          // HTML · CSS 의 공용 주소(`/font/synGak9.woff2` — 글꼴 미리 받기 · `@font-face`)도 버전 폴더로. CSS 는 `assets/` 에 놓이므로
          // `../` 를 붙인다. 이 자리에서 바꿔야 CSS 파일 이름의 해시에 새 주소가 들어간다(뒤에서 글을 고치면 이름이 그대로라
          // 오래 캐시된 옛 CSS 가 옛 주소를 청한다)
          renderBuiltUrl(filename: string, { type, hostType }: { type: 'asset' | 'public'; hostType: 'js' | 'css' | 'html' }) {
            if (type !== 'public') return undefined
            if (hostType === 'css') return `../${dir}${filename}`
            if (hostType === 'html') return `./${dir}${filename}`
            return undefined
          },
        },
      }
    },
    configResolved(config) {
      isBuild = config.command === 'build'
      publicDir = config.publicDir
      outDir = resolve(config.root, config.build.outDir)
    },
    writeBundle(_options, bundle) {
      if (!isBuild) return
      const dir = versionedAssetDir(publicDir)
      // 버전 없는 공용 주소가 남았으면 배포 뒤 404 다 — 빌드를 멈춘다
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || !/\.(css|html)$/.test(file.fileName)) continue
        const text = typeof file.source === 'string' ? file.source : new TextDecoder().decode(file.source)
        const left = [...text.matchAll(UNVERSIONED)].map((match) => match[0])
        if (left.length > 0) throw new Error(`버전 없는 공용 주소가 남았다 (${file.fileName}): ${left.slice(0, 3).join(' · ')}`)
      }
      // 공용 폴더를 버전 폴더로 한 번만 옮겨 낸다 (vite 의 공용 폴더 복사는 껐다)
      cpSync(publicDir, join(outDir, dir), {
        recursive: true,
        filter: (source) => !source.endsWith('.DS_Store'),
      })
    },
  }
}

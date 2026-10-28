import { ASSET_ROOT } from '@/shared/lib/assetUrl/assetUrl'
import { ignoreErrors, tryOr } from '@/shared/lib/safe/tryOr'

/**
 * **새 배포 뒤 열려 있던 탭 다시 불러오기** (웹 전용 — 원본에 없다, r318 · OPTIMIZATION-2026-10-27 A2).
 *
 * 호스트(Vercel Hobby)는 새 배포를 올리면 옛 배포의 파일을 같은 주소로 내주지 않는다. 그래서 배포 전에 연 탭이
 *  - 아직 안 받은 코드 조각(`import()` — 이벤트 본문 · 못 받은 화면 덩이)을 청하면 404 가 나고(vite 가 `vite:preloadError` 를 쏜다),
 *  - 아직 안 받은 그림 · 소리를 청하면 옛 버전 폴더(`v/<옛 해시>/`)라 404 가 난다(자산이 바뀐 배포일 때).
 *
 * **다시 불러오는 때 — 저장된 자리에서만.** 진행 중인 경기 · 관리는 원본처럼 저장 시점에만 저장된다. 아무 때나 다시 불러오면 마지막
 * 저장 뒤의 진행이 날아간다. 그래서 "날아갈 것이 없는 화면"(켤 때 길 · 타이틀 · 메인 메뉴 — {@link noteSafePoint})에서만 다시 부른다.
 *  - 메인 메뉴에는 모드를 나가며 저장을 마친 뒤에야 온다(나리 · 투수편 · 시즌 관리 취소, 일반모드 경기 중 나가기도 모드 저장에 남는다).
 *    다시 불러오면 이용안내 → 타이틀 → 메인 메뉴로 서고, 이어하기가 그 저장 자리로 데려간다.
 *  - `vite:preloadError` 가 오면 곧바로 문서(`./`)를 새로 받아 정말 새 배포인지 본다(망이 잠깐 끊긴 것이면 예전처럼 부른 쪽이 다시
 *    받는다 — 망이 없는데 다시 부르면 브라우저 오류 쪽이 뜬다). 새 배포면 그때 안전한 화면이면 곧바로, 아니면 다음에 안전한 화면에
 *    들어설 때 다시 부른다.
 *  - 안전한 화면에 들어서거나(마지막 확인 뒤 1분 넘게 지났을 때) 탭이 다시 보일 때, 문서(`./`)를 새로 받아 지금 판의 첫 스크립트 ·
 *    자산 폴더가 그대로인지 본다. 다르면 새 배포다 — 그 자리(안전한 화면)에서 다시 부른다. 경기 · 관리에 들어가기 **전에** 새 판으로
 *    바꿔 두므로 경기 중에 옛 덩이 · 그림이 404 를 맞을 일이 거의 없다.
 *  - 화면을 그리는 데 꼭 필요한 덩이(`lazyScreen`)를 못 받았으면 그 화면은 서지 못한다 — 그때는 새 배포로 확인되는 대로 저장 자리와
 *    상관없이 곧바로 다시 부른다({@link noteBlockingLoadFailure}).
 *  - 문서 확인 판이 아니면(개발 서버) 새 배포인지 알 길이 없으므로 다시 부르지 않는다.
 *  - 다시 부른 지 30초 안이면 또 부르지 않는다(되풀이 막기 — 세션 저장소).
 *
 * 개발 서버 · vitest 에서는 문서 확인을 안 한다(배포 판이 없다). 받는 바이트 · 화면 · 난수에는 손대지 않는다.
 */

/** 마지막 확인 뒤 이만큼 지나야 문서를 다시 받아 본다 */
const CHECK_INTERVAL_MS = 60_000
/** 다시 부른 뒤 이 안에는 또 부르지 않는다 */
const RELOAD_GUARD_MS = 30_000
const RELOAD_GUARD_KEY = 'compus-baseball/stale-reload'

interface StaleBuildState {
  isStale: boolean
  /** 화면에 꼭 필요한 덩이를 못 받아 화면이 서지 못했다 — 새 배포로 확인되면 안전한 화면이 아니어도 다시 부른다 */
  isBlocked: boolean
  /** 지금 화면이 다시 불러도 날아갈 것이 없는 화면인가 — 켤 때는 그렇다(이용안내) */
  isSafe: boolean
  lastCheck: number
  isChecking: boolean
  /** 이 문서를 연 판의 첫 스크립트 주소(`./assets/index-….js`) — 배포 빌드에서만 */
  entrySrc: string | null
  reload: () => void
  now: () => number
  fetchDocument: (() => Promise<string>) | null
}

const state: StaleBuildState = {
  isStale: false,
  isBlocked: false,
  isSafe: true,
  lastCheck: 0,
  isChecking: false,
  entrySrc: null,
  reload: () => window.location.reload(),
  now: () => Date.now(),
  fetchDocument: null,
}

function recentlyReloaded(): boolean {
  return tryOr(() => {
    const at = Number(window.sessionStorage.getItem(RELOAD_GUARD_KEY))
    return Number.isFinite(at) && at > 0 && state.now() - at < RELOAD_GUARD_MS
  }, false)
}

function reloadOnce(): void {
  if (recentlyReloaded()) return
  // 저장소가 막혀도 다시 부른다
  ignoreErrors(() => window.sessionStorage.setItem(RELOAD_GUARD_KEY, String(state.now())))
  state.reload()
}

/** 받은 문서가 지금 판과 같은가 — 첫 스크립트 주소와 자산 폴더(`./v/<해시>/`)가 둘 다 들어 있어야 같다 */
export function isSameBuild(html: string, entrySrc: string, assetRoot: string): boolean {
  return html.includes(entrySrc) && (assetRoot === './' || html.includes(assetRoot))
}

function reloadIfAllowed(): void {
  if (state.isStale && (state.isSafe || state.isBlocked)) reloadOnce()
}

/** 문서를 새로 받아 새 배포인지 본다. `force` 가 아니면 1분에 한 번 */
function checkForNewBuild(force = false): void {
  if (state.fetchDocument === null || state.entrySrc === null || state.isChecking) return
  if (!force && state.now() - state.lastCheck < CHECK_INTERVAL_MS) return
  state.isChecking = true
  state.lastCheck = state.now()
  const entrySrc = state.entrySrc
  state.fetchDocument().then(
    (html) => {
      state.isChecking = false
      if (isSameBuild(html, entrySrc, ASSET_ROOT)) return
      state.isStale = true
      reloadIfAllowed()
    },
    () => {
      // 망이 끊겼으면 다음 기회에
      state.isChecking = false
    },
  )
}

/**
 * 낡은 판 귀를 단다 — `main.tsx` 가 켤 때 한 번. `vite:preloadError` 를 받고, 배포 빌드면 문서 확인을 켠다.
 * 오류 자체는 막지 않는다(부른 쪽의 예전 실패 길 — 다시 받기 · 빈 화면 — 이 그대로 돈다).
 */
export function installStaleBuildReload(target: Window, options: { readonly checkDocument: boolean }): void {
  target.addEventListener('vite:preloadError', () => checkForNewBuild(true))
  if (!options.checkDocument) return
  const entry = target.document.querySelector('script[type="module"][src]')
  state.entrySrc = entry?.getAttribute('src') ?? null
  state.lastCheck = state.now()
  state.fetchDocument = () =>
    fetch('./', { cache: 'no-cache' }).then((response) => {
      if (!response.ok) throw new Error(`문서를 받지 못했습니다 (${response.status})`)
      return response.text()
    })
  target.document.addEventListener('visibilitychange', () => {
    if (target.document.visibilityState === 'visible' && state.isSafe) checkForNewBuild()
  })
}

/**
 * 지금 화면이 "다시 불러도 날아갈 것이 없는" 화면인지 알린다 — 앱이 화면이 바뀔 때마다.
 * 안전한 화면에 들어서면 낡은 판일 때 곧바로 다시 부르고, 아니면 (1분에 한 번) 새 배포가 있는지 본다.
 */
export function noteSafePoint(isSafe: boolean): void {
  state.isSafe = isSafe
  if (!isSafe) return
  if (state.isStale) reloadIfAllowed()
  else checkForNewBuild()
}

/**
 * 화면에 꼭 필요한 덩이를 못 받았다 — 그 화면은 어차피 서지 못하므로, 새 배포로 확인되면(이미 확인됐거나 확인 중인 것이 끝나면)
 * 저장 자리와 상관없이 곧바로 다시 부른다.
 */
export function noteBlockingLoadFailure(): void {
  state.isBlocked = true
  if (state.isStale) reloadIfAllowed()
  else checkForNewBuild(true)
}

/** 시험 전용 — 상태를 처음으로 돌리고 다시 부르기 · 시계 · 문서 받기를 바꾼다 */
export function resetStaleBuildForTests(overrides: Partial<Pick<StaleBuildState, 'reload' | 'now' | 'fetchDocument' | 'entrySrc'>> = {}): void {
  Object.assign(state, {
    isStale: false,
    isBlocked: false,
    isSafe: true,
    lastCheck: 0,
    isChecking: false,
    entrySrc: null,
    reload: () => window.location.reload(),
    now: () => Date.now(),
    fetchDocument: null,
    ...overrides,
  })
}

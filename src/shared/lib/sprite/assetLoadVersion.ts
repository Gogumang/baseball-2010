/**
 * **그림 재료가 늦게 도착한 횟수** — 캔버스 그리기 재료(스프라이트 PNG · origins/animations/palette/boxes json · 칠한 그림 · 글꼴)는
 * 비동기로 받아 두고 도착 전에는 빈 칸으로 그린다. 그리기 루프가 그림 입력이 바뀐 틀에서만 다시 그리므로(`createDrawMemo`)
 * 재료가 도착했다는 것도 입력으로 센다 — 도착할 때마다 하나씩 오른다.
 */
let version = 0
let isWatchingFonts = false

/** 지금까지 도착한 재료 수 — 값이 바뀌었으면 같은 입력이라도 다시 그려야 한다 */
export function assetLoadVersion(): number {
  watchFonts()
  return version
}

/** 재료 하나가 도착했다(캐시에 실렸다) */
export function noteAssetLoaded(): void {
  version += 1
}

/** 캔버스 글(`fillText`)의 글꼴이 늦게 실리면 같은 입력이라도 모양이 달라진다 */
function watchFonts(): void {
  if (isWatchingFonts) return
  isWatchingFonts = true
  try {
    const fonts = typeof document === 'undefined' ? undefined : document.fonts
    fonts?.addEventListener?.('loadingdone', noteAssetLoaded)
  } catch {
    // 글꼴 목록이 없는 자리(시험 등)는 그냥 둔다
  }
}

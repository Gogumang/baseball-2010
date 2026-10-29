import { assetLoadCount } from '@/shared/lib/sprite/assetLoadVersion'
import { type FrameLayerListing, frameLayerUrl, frameLayersUrl, hasFrameLayers } from '@/shared/lib/sprite/frameLayers'
import { spriteJsonCacheEpoch, spriteJsonNow } from '@/shared/lib/sprite/spriteCache'
import { recoloredSprite } from '@/widgets/batting-stage/lib/spriteLoader/recoloredSprite'
import { frameOrigins, spritePalettes } from '@/widgets/batting-stage/lib/spriteLoader/spriteJson'

/**
 * 프레임 한 장의 칠하기를 미리 건다 — 그리기 전에 칠해 두면 처음 그리는 그림에 구운 벌이 비치지 않는다.
 * 원점 · `palette.json` 이 아직 안 왔으면 걸지 못해 false(다음에 다시 부른다). 칠하기를 걸었거나 칠할 것이 없으면 true.
 *
 * 2026-10-25 플레이 점검(r177): 타자 스윙 프레임은 처음 스윙하는 틱에 처음 칠하기를 걸어서, 칠이 끝날 때까지(맞은 뒤 멈춤 틱 동안)
 * 몸통 · 헬멧이 구운 벌(파란 헬멧)로 그려졌다 — 원본은 팔레트를 적재 때 갈아 끼우므로 그런 깜박임이 없다.
 */
export function warmRecoloredFrame(folder: string, index: number, paletteIndex: number): boolean {
  // 같이 청한다 — 원점이 올 때까지 팔레트 받기를 미루지 않는다.
  // 0x67 겹이 있는 폴더(하늘 조명)는 `drawFrameAt` 이 겹 그림을 칠해 그리므로 겹 목록도 받아 그 겹까지 건다
  const origins = frameOrigins(folder)
  const palettes = spritePalettes(folder)
  const listing = frameLayerListingOf(folder)
  if (origins === null) return false
  const key = String(index).padStart(3, '0')
  if (origins[key] === undefined) return true
  if (palettes === null || listing === null) return false
  recoloredSprite(folder, `${folder}/${key}.png`, paletteIndex)
  for (const entry of listing?.[key] ?? []) recoloredSprite(folder, frameLayerUrl(folder, entry), paletteIndex)
  return true
}

/** 0x67 겹 목록 — 겹이 있는 폴더만 청한다(아직이면 null). 겹이 없는 폴더는 undefined */
function frameLayerListingOf(folder: string): FrameLayerListing | null | undefined {
  return hasFrameLayers(folder) ? spriteJsonNow<FrameLayerListing>(frameLayersUrl(folder)) : undefined
}

/** 미리 칠할 프레임 하나 — 벌이 null 이면 구운 그림이라 칠할 것이 없다 */
export interface RecolorFrame {
  readonly folder: string
  readonly frame: number
  readonly paletteIndex: number | null
}

/** 칠하기를 다 걸어 둔 묶음 열쇠 */
const warmedFrameSets = new Set<string>()

/** 못 다 건 묶음 열쇠 → 그때의 (재료 도착 수 | JSON 캐시 비운 수) */
const pendingFrameSets = new Map<string, string>()

/**
 * 한 그림 객체가 그릴 수 있는 프레임 전부의 칠하기를 미리 건다 (`warmRecoloredFrame`) — 원본은 팔레트를 적재 때 갈아 끼우므로
 * 어느 자세든 처음부터 제 색이다. 웹은 칠하기가 비동기라 처음 그리는 자세에 구운 벌이 한 박자 비치던 것을 막는다.
 * `key` 는 그 묶음(그림 · 벌)을 가린다 — 원점 · 팔레트가 다 와서 다 걸면 같은 열쇠는 다시 안 본다(목록도 안 만든다).
 * 다 걸었으면(이번에 또는 예전에) true — 아직 원점 · 팔레트를 기다리면 false 라 다시 불러야 한다.
 */
export function warmRecoloredFrames(key: string, framesOf: () => readonly RecolorFrame[]): boolean {
  if (warmedFrameSets.has(key)) return true
  // 못 다 건 묶음은 그 뒤로 재료(JSON)가 하나도 안 왔으면 다시 봐도 똑같이 못 건다 — 원점 · 팔레트 · 겹 목록은 도착할 때만
  // 바뀌고(`noteAssetLoaded`), 이미 건 칠하기 · 시작한 받기는 다시 불러도 아무 일이 없다. 그림이 끝내 안 오는 자리(시험 DOM 시험)에서
  // 틀마다 목록 · 주소를 다시 만들던 몫을 던다 (r330, OPTIMIZATION B1). 캐시를 비우면(시험) 받기를 다시 시작해야 하므로 그 횟수도 본다
  const stamp = `${assetLoadCount()}|${spriteJsonCacheEpoch()}`
  if (pendingFrameSets.get(key) === stamp) return false
  let isAllWarmed = true
  for (const { folder, frame, paletteIndex } of framesOf()) {
    if (paletteIndex !== null && !warmRecoloredFrame(folder, frame, paletteIndex)) isAllWarmed = false
  }
  if (isAllWarmed) {
    warmedFrameSets.add(key)
    pendingFrameSets.delete(key)
  } else {
    // 도착은 늘 비동기(받기 `then`)라 이번에 보는 동안에는 값이 안 바뀐다
    pendingFrameSets.set(key, stamp)
  }
  return isAllWarmed
}

/** 시험 전용 — 다 건 묶음 기억을 비운다 */
export function resetWarmedRecolorsForTest(): void {
  warmedFrameSets.clear()
  pendingFrameSets.clear()
}

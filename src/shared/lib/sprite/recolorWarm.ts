import { useEffect } from 'react'
import { useSpriteJson } from '@/shared/lib/sprite/useSpriteJson'
import { loadSpriteJson } from '@/shared/lib/sprite/spriteCache'
import { paletteUrl, type SpritePalettes } from '@/shared/lib/sprite/palettePixels'
import { recoloredSpriteUrl } from '@/shared/lib/sprite/recolorPaint'

// ── 미리 칠하기 ─────────────────────────────────────────────────────────────
// 원본은 팔레트를 그림 적재 때 갈아 끼우므로 어느 프레임이든 처음부터 제 색이다. 웹은 칠하기가 비동기라
// 처음 그리는 프레임에 칠하기를 걸면 칠이 끝날 때까지 구운 벌이 한 박자 비친다(r177 첫 스윙의 파란 헬멧).
// 애니 · 자세가 넘어갈 프레임을 미리 칠해 두면 바뀌는 그 그림부터 `readyRecoloredSpriteUrl` 이 칠한 그림을 낸다.

/** 칠하기를 미리 걸 그림 한 장 — 벌이 null 이면 구운 그림이라 칠할 것이 없다 */
export interface RecolorRequest {
  readonly url: string
  readonly paletteIndex: number | null
}

/** 폴더의 프레임들(`<폴더>/NNN.png`)을 한 벌로 */
export function recolorRequestsOf(folder: string, frames: Iterable<number>, paletteIndex: number | null): RecolorRequest[] {
  if (paletteIndex === null) return []
  return [...new Set(frames)].map((frame) => ({ url: `${folder}/${String(frame).padStart(3, '0')}.png`, paletteIndex }))
}

/**
 * 그림들의 칠하기를 미리 건다 — 기다리지 않는다. 팔레트(`palette.json`)를 받아 `recoloredSpriteUrl` 을 부르므로
 * 같은 (그림, 벌) 은 한 번만 칠한다. 실패는 조용히 넘긴다(그리는 쪽이 구운 그림을 쓴다).
 */
export function warmRecoloredSprites(requests: readonly RecolorRequest[]): void {
  for (const { url, paletteIndex } of requests) {
    if (paletteIndex === null) continue
    loadSpriteJson<SpritePalettes>(paletteUrl(url))
      .then((palettes) => recoloredSpriteUrl(url, palettes, paletteIndex))
      .catch(() => {})
  }
}

const REQUEST_SEPARATOR = '\n'

/** 요청 목록 ↔ 열쇠 — 렌더마다 새로 만든 목록이어도 내용이 같으면 다시 걸지 않는다 */
function recolorRequestsKeyOf(requests: readonly RecolorRequest[]): string {
  return requests
    .filter((request) => request.paletteIndex !== null)
    .map((request) => `${request.paletteIndex}#${request.url}`)
    .join(REQUEST_SEPARATOR)
}

function recolorRequestsOfKey(key: string): RecolorRequest[] {
  if (key === '') return []
  return key.split(REQUEST_SEPARATOR).map((line) => {
    const cut = line.indexOf('#')
    return { url: line.slice(cut + 1), paletteIndex: Number(line.slice(0, cut)) }
  })
}

/** 화면이 그릴 수 있는 그림들을 미리 칠한다 (`warmRecoloredSprites`). 목록 내용이 바뀔 때만 다시 건다 */
export function useWarmRecoloredSprites(requests: readonly RecolorRequest[]): void {
  const key = recolorRequestsKeyOf(requests)
  useEffect(() => {
    warmRecoloredSprites(recolorRequestsOfKey(key))
  }, [key])
}

/**
 * 폴더의 프레임 **전부**(`origins.json` 의 칸)를 벌마다 미리 칠한다 — 매 틱 동작이 바뀌는 수비수 · 주자(defender)처럼
 * 어느 칸을 그릴지 미리 가리기 어려운 그림용. 원점이 아직이면 온 뒤에 건다.
 */
export function useWarmRecoloredFolder(folder: string, paletteIndices: readonly (number | null)[]): void {
  const origins = useSpriteJson<Readonly<Record<string, unknown>>>(`${folder}/origins.json`)
  const frames = origins === null ? [] : Object.keys(origins).map(Number).filter(Number.isInteger)
  useWarmRecoloredSprites([...new Set(paletteIndices)].flatMap((paletteIndex) => recolorRequestsOf(folder, frames, paletteIndex)))
}

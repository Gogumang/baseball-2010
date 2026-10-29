import { noteAssetLoaded } from '@/shared/lib/sprite/assetLoadVersion'
import { recoloredSpriteUrl } from '@/shared/lib/sprite/paletteSwap'
import { FIELD_BACKGROUND, FIELD_FOLDER } from '@/widgets/batting-stage/lib/spriteLoader/spriteFolders'
import { sprite, spritePalettes } from '@/widgets/batting-stage/lib/spriteLoader/spriteJson'

// ── 대체 팔레트(.mpl) 갈아 끼우기 ───────────────────────────────────────────
// <img> 쪽은 `shared/lib/sprite/paletteSwap` 의 훅이 맡지만 캔버스에는 훅을 쓸 수 없어
// 원점·애니 표와 같은 공용 JSON 캐시(비동기로 받아 두고 도착하면 다음 프레임부터)를 쓴다.

/**
 * 칠해 둔 그림. **키는 그림 URL + 팔레트 번호**다 — URL 만으로 키를 잡으면
 * 팔레트를 바꿔도 먼저 칠한 그림이 계속 나온다 (`tools/apply_mpl.py` 머리 주석의 함정).
 * 값이 null 이면 아직 칠하는 중이라 구운 그림을 그대로 내보낸다 (화면이 비지 않게).
 */
const painted = new Map<string, HTMLImageElement | null>()

export function recoloredSprite(folder: string, url: string, paletteIndex: number): HTMLImageElement | null {
  const key = `${url}#${paletteIndex}`
  const done = painted.get(key)
  if (done !== undefined) return done ?? sprite(url)

  const palettes = spritePalettes(folder)
  // palette.json 이 아직 안 왔으면 캐시에 못 박지 않고 구운 그림을 쓴다 — 다음 프레임에 다시 본다.
  if (palettes === null) return sprite(url)
  if (paletteIndex === palettes.baked) return sprite(url)

  painted.set(key, null)
  void recoloredSpriteUrl(url, palettes, paletteIndex)
    .then((dataUrl) => (dataUrl === url ? null : loadSprite(dataUrl)))
    .then((image) => {
      if (image !== null) {
        painted.set(key, image)
        noteAssetLoaded()
      }
    })
    .catch(() => {})
  return sprite(url)
}

function loadSprite(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = url
  })
}

/**
 * 바닥(그라운드) 그림. `paletteIndex` 는 `stadium/attack.mpl` 의 줄이고 **null 이면 구운 그림**
 * (= PZX 안 기본 팔레트) 그대로다. 시즌 구장 잔디가 이 줄을 고른다 (`0x786c8`, S3 6절).
 */
export function fieldBackground(paletteIndex: number | null): HTMLImageElement | null {
  return paletteIndex === null ? sprite(FIELD_BACKGROUND) : recoloredSprite(FIELD_FOLDER, FIELD_BACKGROUND, paletteIndex)
}

/**
 * 바닥(attack/000) 잔디 벌의 칠하기를 미리 건다 — 원본 바닥 0x7725c 는 구장 객체 적재 때 `stadium/attack.mpl` 줄(+0xc)을 갈아 끼워
 * 첫 그림부터 제 색이다. 타석이 서기 전(경기 화면 · 로딩 판)에 걸어 두면 `fieldBackground` 가 첫 그림부터 칠한 그림을 낸다.
 * `palette.json` 이 아직이면 false(다시 부른다). 칠할 것이 없거나 걸었으면 true
 */
export function warmFieldBackground(paletteIndex: number | null): boolean {
  if (paletteIndex === null) return true
  if (spritePalettes(FIELD_FOLDER) === null) return false
  recoloredSprite(FIELD_FOLDER, FIELD_BACKGROUND, paletteIndex)
  return true
}

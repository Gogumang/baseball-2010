/**
 * 팀·피부에 따라 선수 그림 색을 갈아 끼운다 (원본 `.mpl` 대체 팔레트, C-create-palette.md C-1).
 *
 * 원본은 8비트 인덱스 그림이라 팔레트만 바꿔 끼우면 같은 그림이 15팀 × 3피부로 나온다
 * (binary.mod 0x78ab0 몸통·헬멧 · 0x793b0 투수 · 0x48658 수비수 · 0x63a7e 이벤트 초상화).
 * 웹판은 PNG 를 구워 두므로 두 가지 중 하나를 골라야 했다:
 *
 *   벌마다 굽기   batter_* · pitcher 45벌 + helmet · defender 15벌 = 12,315장 50MB — **버렸다**
 *   런타임 교체   구운 PNG 한 벌 + 팔레트 표 + 팔레트 번호 지도 = 3MB — **이쪽**
 *
 * `tools/apply_mpl.py` 가 폴더마다 두 가지를 내 둔다:
 *   `<폴더>/palette.json`            벌 전체와 구워진 벌 번호
 *   `<폴더>/[frames/]index/NNN.png`  픽셀마다 팔레트 번호 (빨강 = 번호, 알파 0 = 손대지 말 것)
 *
 * 번호 지도가 꼭 있어야 하는 이유: 구운 PNG 는 색이 납작해져 번호를 잃는데, 기본 팔레트에
 * **같은 색이 두 번호에 들어 있고 벌마다 갈라지는** 자리가 있다 (pitcher #005142 = 번호 10·25,
 * 45벌 중 42벌에서 서로 다른 색). 색만 보고 바꾸면 그 자리가 틀린다.
 */
import { useEffect, useState } from 'react'
import { useSpriteJson } from '@/shared/lib/sprite/useSpriteJson'

/** `tools/apply_mpl.py` 가 낸 `<폴더>/palette.json`. */
export interface SpritePalettes {
  /** 원본 파일 이름 (예: `bat/batter_balancer.mpl`) */
  readonly mpl: string
  /** 벌 고르는 법을 적어 둔 말 (사람이 읽는 용도) */
  readonly select: string
  /** 구워 둔 PNG 가 이미 쓰는 벌 번호. 없으면 null */
  readonly baked: number | null
  /** PZX 안 기본 팔레트 (`#rrggbb`) */
  readonly colors: readonly string[]
  /** 벌 × 색 (`#rrggbb`) */
  readonly palettes: readonly (readonly string[])[]
}

/** 팀 수 15 — 팔레트 45벌 = 피부 3 × 팀 15 (C-1). */
export const TEAM_COUNT = 15

/**
 * 몸통(batter_balancer·batter_sluger·pitcher) 팔레트 번호 = **피부 × 15 + 팀** (0x78be8).
 * 헬멧·수비수는 피부가 없어 팀 번호만 쓴다.
 */
export function outfitPaletteIndex(skinIndex: number, teamIndex: number): number {
  return skinIndex * TEAM_COUNT + teamIndex
}

/**
 * 이벤트 초상화(event_char_0) 팔레트 번호 (0x63a7e): 피부 1 → 0 · 2 → 1 · 0 → 쓰지 않는다
 * (PZX 안 기본 팔레트가 이미 황인이다). 2번 벌은 주인공이 아닌 인물 8·9 전용이다 (0x63a50).
 */
export const PORTRAIT_OTHER_PEOPLE_PALETTE = 2

export function portraitPaletteIndex(skinIndex: number): number | null {
  return skinIndex === 1 ? 0 : skinIndex === 2 ? 1 : null
}

/** `#rrggbb` → [r, g, b]. 모양이 틀리면 검정으로 둔다. */
export function parseHexColor(text: string): readonly [number, number, number] {
  if (text.length !== 7 || text[0] !== '#') return [0, 0, 0]
  const value = Number.parseInt(text.slice(1), 16)
  if (Number.isNaN(value)) return [0, 0, 0]
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
}

/**
 * 구운 그림(color)을 번호 지도(index)와 팔레트로 다시 칠한다. 캔버스 없이 도는 순수 함수다.
 *
 * 번호 지도의 알파가 0 인 자리는 반투명·채우기 효과로 색이 섞인 자리라 번호가 뜻을 잃는다 —
 * 구운 색을 그대로 둔다 (**근사다**: defender 그림자, event_char_0 잔상이 피부색을 안 따라간다).
 */
export function recolorPixels(
  color: Uint8ClampedArray,
  index: Uint8ClampedArray,
  palette: readonly string[],
): Uint8ClampedArray {
  const table = palette.map(parseHexColor)
  const output = new Uint8ClampedArray(color)
  for (let at = 0; at < output.length; at += 4) {
    if (index[at + 3] === 0) continue
    const replacement = table[index[at]]
    if (replacement === undefined) continue
    output[at] = replacement[0]
    output[at + 1] = replacement[1]
    output[at + 2] = replacement[2]
  }
  return output
}

/** `./sprites/pitcher/frames/003.png` → `./sprites/pitcher/frames/index/003.png` */
export function indexMapUrl(spriteUrl: string): string {
  const cut = spriteUrl.lastIndexOf('/')
  return cut < 0 ? spriteUrl : `${spriteUrl.slice(0, cut)}/index${spriteUrl.slice(cut)}`
}

/** `./sprites/pitcher/frames/003.png` → `./sprites/pitcher/palette.json` */
export function paletteUrl(spriteUrl: string): string {
  const parts = spriteUrl.split('/')
  const cut = parts.lastIndexOf('frames')
  return `${(cut < 0 ? parts.slice(0, -1) : parts.slice(0, cut)).join('/')}/palette.json`
}

// ── 브라우저에서 실제로 칠하기 ──────────────────────────────────────────────

const recolored = new Map<string, Promise<string>>()

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`그림을 불러오지 못했습니다: ${url}`))
    image.src = url
  })
}

async function paint(spriteUrl: string, palette: readonly string[]): Promise<string> {
  const [sprite, indexMap] = await Promise.all([loadImage(spriteUrl), loadImage(indexMapUrl(spriteUrl))])
  const canvas = document.createElement('canvas')
  canvas.width = sprite.width
  canvas.height = sprite.height
  const context = canvas.getContext('2d')
  if (context === null) return spriteUrl

  context.drawImage(sprite, 0, 0)
  const colors = context.getImageData(0, 0, canvas.width, canvas.height)
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.drawImage(indexMap, 0, 0)
  const indices = context.getImageData(0, 0, canvas.width, canvas.height)

  colors.data.set(recolorPixels(colors.data, indices.data, palette))
  context.putImageData(colors, 0, 0)
  return canvas.toDataURL('image/png')
}

/**
 * 팔레트를 갈아 끼운 그림의 URL. 같은 (그림, 벌) 은 한 번만 칠한다.
 * `paletteIndex` 가 null 이거나 벌이 없으면 구운 그림을 그대로 쓴다.
 */
export function recoloredSpriteUrl(
  spriteUrl: string,
  palettes: SpritePalettes | null,
  paletteIndex: number | null,
): Promise<string> {
  if (palettes === null || paletteIndex === null) return Promise.resolve(spriteUrl)
  if (paletteIndex === palettes.baked) return Promise.resolve(spriteUrl)
  const palette = palettes.palettes[paletteIndex]
  if (palette === undefined) return Promise.resolve(spriteUrl)

  const key = `${spriteUrl}#${paletteIndex}`
  const cached = recolored.get(key)
  if (cached !== undefined) return cached
  // 실패를 캐시에 남기면 일시적 오류가 영영 고착된다.
  const request = paint(spriteUrl, palette).catch(() => spriteUrl)
  recolored.set(key, request)
  return request
}

/** 폴더의 `palette.json`. 아직 오지 않았거나 실패하면 null. */
export function useSpritePalettes(folder: string): SpritePalettes | null {
  return useSpriteJson<SpritePalettes>(`${folder}/palette.json`)
}

/** 팔레트를 갈아 끼운 그림. 칠하기 전에는 구운 그림을 그대로 내보내 화면이 비지 않는다. */
export function useRecoloredSprite(spriteUrl: string, paletteIndex: number | null): string {
  const palettes = useSpritePalettes(paletteUrl(spriteUrl).replace(/\/palette\.json$/, ''))
  const [url, setUrl] = useState(spriteUrl)

  useEffect(() => {
    let isActive = true
    setUrl(spriteUrl)
    recoloredSpriteUrl(spriteUrl, palettes, paletteIndex).then((painted) => {
      if (isActive) setUrl(painted)
    })
    return () => {
      isActive = false
    }
  }, [spriteUrl, palettes, paletteIndex])

  return url
}

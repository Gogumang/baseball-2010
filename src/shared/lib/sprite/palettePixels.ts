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

/** 피부 1 · 2 의 초상화 벌 — 피부 0 은 기본 팔레트 그대로 */
const PORTRAIT_PALETTE_OF_SKIN: Readonly<Record<number, number>> = { 1: 0, 2: 1 }

export function portraitPaletteIndex(skinIndex: number): number | null {
  return PORTRAIT_PALETTE_OF_SKIN[skinIndex] ?? null
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
 * 번호 지도의 알파가 0 인 자리는 채우기 효과 자리나 반투명 파트가 **아래 파트와** 섞인 자리라 번호가
 * 뜻을 잃는다 — 구운 색을 그대로 둔다 (**근사다**). 반투명 파트가 아래 없이 놓인 자리(하늘 조명 ·
 * defender 그림자 · event_char_0 볼터치)는 번호가 있다: 원본도 반투명 그리기 0x97769 · 0x973c5 에서
 * 그 그림의 (갈아 끼운) 팔레트[번호] 로 색을 얻는다 (r134, 그리기 0xc9f98 · 표 0xda988).
 * 알파는 구운 그림 것을 그대로 두고 RGB 만 바꾼다.
 */
export function recolorPixels(color: Uint8ClampedArray, index: Uint8ClampedArray, palette: readonly string[]): Uint8ClampedArray {
  const table = paletteTableOf(palette)
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

const paletteTables = new WeakMap<readonly string[], readonly (readonly [number, number, number])[]>()

/** 벌의 `#rrggbb` 를 [r, g, b] 표로 — 같은 벌(배열)은 한 번만 푼다 */
function paletteTableOf(palette: readonly string[]): readonly (readonly [number, number, number])[] {
  const cached = paletteTables.get(palette)
  if (cached !== undefined) return cached
  const table = palette.map(parseHexColor)
  paletteTables.set(palette, table)
  return table
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

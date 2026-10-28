import { Fragment, useId } from 'react'
import type { CSSProperties, ReactElement } from 'react'

/**
 * **img_text 팔레트 3** — `0x913e4(애니, 3)` 으로 고르는 ui/img_text.mpl 넷째 팔레트(파일 0x2b: 수 3 · RGB565 0xf81f · 0x2a54 · 0x112d).
 * 기본 팔레트(0x16: 0xf81f · 0xffff · 0xef7d)의 흰 #FFFFFF → **#2949A5**, #EFEFEF → **#10246B** 로 바뀐다.
 * 웹 img_text 그림은 기본 팔레트(흰 글자)로 구웠으므로 두 색을 잇는 1차식 색 행렬로 칠한다 (R=G=B 인 글자에만 맞다).
 */
const PALETTE3_MATRIX = '1.5625 0 0 0 -1.40172  0 2.3125 0 0 -2.02623  0 0 3.625 0 -2.97794  0 0 0 1 0'

/** 팔레트 3 필터 — `<svg>` 정의와 그림에 줄 `style` 을 함께 돌려준다 */
export function useImgTextPalette3(): { readonly definition: ReactElement; readonly style: CSSProperties } {
  const id = `img-text-palette3-${useId().replace(/:/g, '')}`
  const definition = (
    <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden>
      <filter id={id} colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values={PALETTE3_MATRIX} />
      </filter>
    </svg>
  )
  return { definition, style: { filter: `url(#${id})` } }
}

/** img_text 팔레트 번호 — `0x913e4([0x1552ae8], n)` 의 n (ui/img_text.mpl 다섯 벌) */
export type ImgTextPaletteIndex = 0 | 1 | 2 | 3 | 4

/**
 * ui/img_text.mpl 다섯 벌의 두 글자 색 (`public/sprites/img_text/palette.json` — 0번 색 #FF00FF 는 투명이라 뺐다).
 * 0 흰 · 1 노랑 · 2 빨강 · 3 짙은 파랑 · 4 회색.
 */
const IMG_TEXT_PALETTE_COLORS: readonly (readonly [string, string])[] = [
  ['#ffffff', '#efefef'],
  ['#ffe352', '#ffb229'],
  ['#f75110', '#e71818'],
  ['#2949a5', '#10246b'],
  ['#7b797b', '#525152'],
]

/**
 * `tools/apply_mpl.py` 가 **팔레트 0 이 아닌 색으로 미리 구워 둔** img_text 프레임 (그 밖은 모두 팔레트 0 흰 글자).
 * 47~51 은 경기정보 줄 딱지(0x64fd6 · 0x65002 팔레트 3), 157 · 158 은 목록 딱지(0x6576c · 0x657ba 팔레트 4) 색이다.
 * 원본은 같은 프레임을 다른 팔레트로도 찍는다 — 47 "순위" 는 구단정보 이름표(0x7c620 · 0x7c656 팔레트 0)와
 * 시즌 올해의 목표 이름표(0x8664a 팔레트 0), 49 "선발" 은 타석 대결 판 보직 글(0x44bf0 팔레트 0).
 * 그런 곳은 `useImgTextPalettes().styleOf(프레임, 팔레트)` 로 바꿔 칠한다.
 */
export const IMG_TEXT_BAKED_PALETTE: Readonly<Record<number, ImgTextPaletteIndex>> = {
  47: 3,
  48: 3,
  49: 3,
  50: 3,
  51: 3,
  157: 4,
  158: 4,
}

/** 프레임이 구워진 팔레트 */
export const bakedImgTextPaletteOf = (frame: number): ImgTextPaletteIndex => IMG_TEXT_BAKED_PALETTE[frame] ?? 0

const channelsOf = (hex: string): readonly number[] => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255)
const round5 = (value: number) => Math.round(value * 100000) / 100000

/**
 * 팔레트 `from` 으로 구운 글자를 팔레트 `to` 색으로 바꾸는 `feColorMatrix` 값 — 두 글자 색을 채널마다 1차식으로 잇는다
 * (from 첫 색 → to 첫 색, 둘째 색 → 둘째 색). img_text 글자는 이 두 색뿐이라 정확하다.
 */
export function imgTextPaletteMatrix(from: ImgTextPaletteIndex, to: ImgTextPaletteIndex): string {
  const [fromFirst, fromSecond] = IMG_TEXT_PALETTE_COLORS[from].map(channelsOf)
  const [toFirst, toSecond] = IMG_TEXT_PALETTE_COLORS[to].map(channelsOf)
  const rows = [0, 1, 2].map((channel) => {
    const slope = (toFirst[channel] - toSecond[channel]) / (fromFirst[channel] - fromSecond[channel])
    const offset = toFirst[channel] - slope * fromFirst[channel]
    return [0, 1, 2]
      .map((column) => (column === channel ? round5(slope) : 0))
      .concat([0, round5(offset)])
      .join(' ')
  })
  return [...rows, '0 0 0 1 0'].join('  ')
}

const SOURCE_PALETTES: readonly ImgTextPaletteIndex[] = [0, 3, 4]
const TARGET_PALETTES: readonly ImgTextPaletteIndex[] = [0, 1, 2, 3, 4]

/**
 * **img_text 팔레트 고르기** — 원본 `0x913e4(img_text, n)` 을 웹에서 흉내 낸다.
 * `styleOf(프레임, n)` 은 그 프레임이 구워진 팔레트(`bakedImgTextPaletteOf`)에서 n 으로 바꾸는 필터를 준다(같으면 `undefined`).
 * `definition` 을 한 번 그려 두어야 필터가 선다.
 */
export function useImgTextPalettes(): {
  readonly definition: ReactElement
  readonly styleOf: (frame: number, palette: ImgTextPaletteIndex) => CSSProperties | undefined
} {
  const base = `img-text-palette-${useId().replace(/:/g, '')}`
  const idOf = (from: ImgTextPaletteIndex, to: ImgTextPaletteIndex) => `${base}-${from}-${to}`
  const definition = (
    <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden>
      {SOURCE_PALETTES.map((from) => (
        <Fragment key={from}>
          {TARGET_PALETTES.filter((to) => to !== from).map((to) => (
            <filter key={to} id={idOf(from, to)} colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix" values={imgTextPaletteMatrix(from, to)} />
            </filter>
          ))}
        </Fragment>
      ))}
    </svg>
  )
  const styleOf = (frame: number, palette: ImgTextPaletteIndex): CSSProperties | undefined => {
    const from = bakedImgTextPaletteOf(frame)
    return from === palette ? undefined : { filter: `url(#${idOf(from, palette)})` }
  }
  return { definition, styleOf }
}

import { useId } from 'react'
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

/**
 * **img_text 팔레트 4** — `0x913e4(애니, 4)` (#7B797B · #525152). 흰 글자 그림(R=G=B)을 두 색으로 잇는 1차식
 * (`features/play-team-game/ui/InGameMenu` 의 "MENU" 머리와 같은 행렬).
 */
const PALETTE4_MATRIX = '2.5625 0 0 0 -2.08015  0 2.5 0 0 -2.02549  0 0 2.5625 0 -2.08015  0 0 0 1 0'

/** 팔레트 4 필터 — `<svg>` 정의와 그림에 줄 `style` 을 함께 돌려준다 */
export function useImgTextPalette4(): { readonly definition: ReactElement; readonly style: CSSProperties } {
  const id = `img-text-palette4-${useId().replace(/:/g, '')}`
  const definition = (
    <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden>
      <filter id={id} colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values={PALETTE4_MATRIX} />
      </filter>
    </svg>
  )
  return { definition, style: { filter: `url(#${id})` } }
}

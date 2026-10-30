import * as styles from '@/pages/match-settings/ui/MatchSettingsWindow.css'

/**
 * img_text 팔레트(img_text.mpl) — 흰 글자 그림(#FFFFFF · #EFEFEF)을 1차식으로 바꿔 칠한다
 * (`widgets/scoreboard-frame` 의 팔레트 4 와 같은 방법). 255 → 첫 색 · 239 → 둘째 색.
 */
export function PaletteFilters({ id }: { readonly id: string }) {
  return (
    <svg className={styles.hiddenSvg} aria-hidden>
      {/* 팔레트 1 — #FFE352 · #FFB229 */}
      <filter id={`${id}-p1`} colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="0 0 0 0 1  0 3.0625 0 0 -2.172304  0 0 2.5625 0 -2.240931  0 0 0 1 0" />
      </filter>
      {/* 팔레트 3 — #2949A5 · #10246B */}
      <filter id={`${id}-p3`} colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="1.5625 0 0 0 -1.401716  0 2.3125 0 0 -2.026225  0 0 3.625 0 -2.977941  0 0 0 1 0" />
      </filter>
      {/* 팔레트 4 — #7B797B · #525152 */}
      <filter id={`${id}-p4`} colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="2.5625 0 0 0 -2.08015  0 2.5 0 0 -2.02549  0 0 2.5625 0 -2.08015  0 0 0 1 0" />
      </filter>
    </svg>
  )
}

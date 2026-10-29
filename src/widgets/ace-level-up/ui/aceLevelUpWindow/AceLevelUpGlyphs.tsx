import type { AceLevelUpGlyph } from '@/widgets/ace-level-up/lib/aceLevelUpLayout'
import * as styles from '@/widgets/ace-level-up/ui/AceLevelUpWindow.css'
import { IMG_TEXT, NUM, pad } from '@/widgets/ace-level-up/ui/aceLevelUpWindow/aceLevelUpAssets'

/** num 숫자 그림 — `aceLevelUpNumberOf` 가 놓은 자리 그대로 */
export function NumberGlyphImages({ glyphs, keyPrefix }: { readonly glyphs: readonly AceLevelUpGlyph[]; readonly keyPrefix: string }) {
  return (
    <>
      {glyphs.map((glyph, index) => (
        <img
          key={`${keyPrefix}-${index}`}
          className={styles.layer}
          alt=""
          src={`${NUM}/${pad(glyph.image)}.png`}
          style={{ left: glyph.x, top: glyph.y }}
        />
      ))}
    </>
  )
}

/** img_text 글 한 장을 (left, top) 에 */
export function ImgTextLine({ frame, left, top }: { readonly frame: number; readonly left: number; readonly top: number }) {
  return <img className={styles.layer} alt="" src={`${IMG_TEXT}/${pad(frame)}.png`} style={{ left, top }} />
}

import { SpriteNumber } from '@/shared/ui'
import { HELP_PAGER_GLYPH_HEIGHT, HELP_VIEWER, helpPagerOf } from '@/pages/help/lib/helpLayout'
import * as styles from '@/pages/help/ui/HelpScreen.css'
import { NUM, SLT_FRAME, imageSrc } from './helpScreenAssets'

/** 쪽 화살 하나 — 웹판은 누를 수도 있다. 오른쪽은 좌우 뒤집기 */
function PageArrow({ isNext, isShown, onPress }: { readonly isNext: boolean; readonly isShown: boolean; readonly onPress: () => void }) {
  const { pageArrow } = HELP_VIEWER
  return (
    <button
      type="button"
      className={styles.backButton}
      aria-label={isNext ? '다음 쪽' : '이전 쪽'}
      style={isNext ? { left: pageArrow.rightX, top: pageArrow.y, transform: 'scaleX(-1)' } : { left: pageArrow.leftX, top: pageArrow.y }}
      onClick={onPress}
    >
      <img src={imageSrc(SLT_FRAME, pageArrow.image)} alt="" style={{ opacity: isShown ? 1 : 0 }} />
    </button>
  )
}

/**
 * 쪽 번호 — num.pzx 숫자 0x585ac 두 자리 + 사이 "/" 이미지 0x65 (0x59102~0x59192), 그리고 쪽 화살 slt_frame 이미지 20 —
 * 장 고르기면 늘, 쪽 보기면 깜빡인다 (0x59196~0x59204)
 */
export function HelpPager({
  page,
  pageCount,
  showsArrows,
  onMovePage,
}: {
  readonly page: number
  readonly pageCount: number
  readonly showsArrows: boolean
  readonly onMovePage: (step: number) => void
}) {
  const pager = helpPagerOf(page, pageCount)
  return (
    <>
      <div role="img" aria-label={`${page + 1}/${pageCount}`}>
        <SpriteNumber glyphs={pager.page.glyphs} right={pager.page.right} boxTop={pager.y} boxHeight={HELP_PAGER_GLYPH_HEIGHT} folder={NUM} />
        <img className={styles.sprite} alt="" src={imageSrc(NUM, pager.slash.image)} style={{ left: pager.slash.x, top: pager.slash.y }} />
        <SpriteNumber glyphs={pager.count.glyphs} right={pager.count.right} boxTop={pager.y} boxHeight={HELP_PAGER_GLYPH_HEIGHT} folder={NUM} />
      </div>
      <PageArrow isNext={false} isShown={showsArrows} onPress={() => onMovePage(-1)} />
      <PageArrow isNext isShown={showsArrows} onPress={() => onMovePage(1)} />
    </>
  )
}

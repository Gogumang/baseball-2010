import { SpriteNumber } from '@/shared/ui'
import { moneyGlyphsOf, numberGlyphsOf } from '@/shared/lib/pixelNumber/pixelNumber'
import { parseGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import { DESCRIPTION_BOX, INNER, LABEL_HEIGHT, NAME_BOX, VALUE_BOX, VALUE_DIGIT_RIGHT_INSET, centeredTopOf } from '@/pages/shop/lib/shopLayout'
import type { ItemGridWindowKind } from '@/pages/shop/lib/shopLayout'
import type { ShopEntry } from '@/pages/shop/lib/shopEntries'
import * as styles from '@/pages/shop/ui/ShopWindow.css'

/** 커서 칸의 이름 딱지(박스 3) · 값(박스 5) · 설명(박스 4) — 빈 칸이면 이름 · 값 · 설명 없음 */
export function ShopSelectedText({ kind, selected }: { readonly kind: ItemGridWindowKind; readonly selected: ShopEntry | undefined }) {
  const name = selected?.name ?? ''
  return (
    <>
      {/* 박스 3 이름 딱지 — 검정 그림자 뒤 흰 글 가운데 (0x8225e) */}
      <div className={styles.nameTag} style={{ left: NAME_BOX.x, top: NAME_BOX.y, width: NAME_BOX.width, height: NAME_BOX.height }} />
      <div
        className={styles.nameShadow}
        style={{
          left: NAME_BOX.x + INNER.nameTextLeft + INNER.nameShadow,
          top: centeredTopOf(NAME_BOX, LABEL_HEIGHT) + INNER.nameShadow,
          width: NAME_BOX.width - INNER.nameTextLeft * 2,
        }}
      >
        {name}
      </div>
      <div
        className={styles.nameText}
        data-testid="shop-name"
        style={{
          left: NAME_BOX.x + INNER.nameTextLeft,
          top: centeredTopOf(NAME_BOX, LABEL_HEIGHT),
          width: NAME_BOX.width - INNER.nameTextLeft * 2,
        }}
      >
        {name}
      </div>

      {/* 박스 5 값 칸 — 서브는 만원(억 표기), GP 는 그냥 숫자. 글색 노랑 */}
      {selected !== undefined && (
        <SpriteNumber
          glyphs={kind === 'GP' ? numberGlyphsOf(selected.price) : moneyGlyphsOf(selected.price)}
          right={VALUE_BOX.x + VALUE_BOX.width - VALUE_DIGIT_RIGHT_INSET}
          boxTop={VALUE_BOX.y}
          boxHeight={VALUE_BOX.height}
        />
      )}

      <ShopDescription text={selected?.description ?? ''} />
    </>
  )
}

/** 박스 4 설명 — 왼쪽 위 정렬 (0x802dd + 조건 문구) */
function ShopDescription({ text }: { readonly text: string }) {
  const descriptionLines = parseGameMarkup(text)
  return (
    <div
      className={styles.description}
      data-testid="shop-description"
      style={{
        left: DESCRIPTION_BOX.x + INNER.descriptionPadding,
        top: DESCRIPTION_BOX.y + INNER.descriptionPadding,
        width: DESCRIPTION_BOX.width - INNER.descriptionPadding * 2,
        height: DESCRIPTION_BOX.height - INNER.descriptionPadding * 2,
        lineHeight: `${INNER.descriptionLineHeight}px`,
      }}
    >
      {descriptionLines.map((line, lineIndex) => (
        <p key={lineIndex} className={styles.descriptionLine} style={line.isCentered ? { textAlign: 'center' } : undefined}>
          {line.segments.map((segment, segmentIndex) => (
            <span key={segmentIndex} style={segment.color === null ? undefined : { color: segment.color }}>
              {segment.text}
            </span>
          ))}
          {line.segments.length === 0 && ' '}
        </p>
      ))}
    </div>
  )
}

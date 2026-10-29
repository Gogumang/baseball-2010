import { FrameSprite } from '@/shared/ui'
import { TITLE_NAMES } from '@/entities/career/model/titles'
import { NAME_ROW, NICKNAME_SCROLLBAR, NICKNAME_TAB_LABEL, PAGE_TITLE } from '@/pages/record/lib/recordAnnalsLayout'
import { NICKNAME_PAGE_FIRST_NAMES, NICKNAME_PAGE_TITLE_FRAMES, NICKNAME_SCROLL_TRACK, NICKNAME_VISIBLE_ROWS } from '@/pages/record/lib/annalsGrid'
import type { NicknameScroll } from '@/pages/record/lib/annalsGrid'
import * as styles from '@/pages/record/ui/RecordAnnals.css'
import { IMG_TEXT, SLT_FRAME, SLT_FRAMES, imageSrc, nameWidthOf } from '@/pages/record/ui/recordAnnals/annalsAssets'
import type { Origins } from '@/pages/record/ui/recordAnnals/annalsAssets'
import { isNicknameOwned } from '@/pages/record/ui/recordAnnals/nicknameOwnership'

/**
 * 탭 3 닉네임 (0x2f4ee~0x2f920) — 쪽 제목 · 164×18 이름 줄 8개 · 스크롤 막대.
 * ```
 * 노란 네모 slt_frame 이미지 38 (34, 78) · 쪽 제목 img_text 표 0xced88[쪽] (42, 76) · "닉네임" img_text 279 (44 + 제목폭, 76)
 * 0x58c10 → 보이는 칸 [윗줄, min(윗줄 + 8, 개수)) + 스크롤 막대 (203, 94)
 * 칸 i (k = i − 윗줄): 프레임 12 (33, 89 + 19k) · 번호 i + 1 (48, 93 + 19k)
 *                     얻었으면 이름 StrNICKNAME[첫 번호 + i] (70, 93 + 19k) — 못 얻었으면 이름 자리를 비운다
 * ```
 * 줄 커서는 그리지 않는다 (탭 3 은 0x7a571 을 안 부른다).
 */
export function NameRows({
  frames,
  textFrames,
  page,
  scroll,
  owned,
}: {
  readonly frames: Origins
  readonly textFrames: Origins
  readonly page: number
  readonly scroll: NicknameScroll
  readonly owned: readonly string[]
}) {
  const end = Math.min(scroll.top + NICKNAME_VISIBLE_ROWS, scroll.total)
  const indices = Array.from({ length: Math.max(0, end - scroll.top) }, (_, offset) => scroll.top + offset)
  const titleFrame = NICKNAME_PAGE_TITLE_FRAMES[page] ?? NICKNAME_PAGE_TITLE_FRAMES[0]
  const { x: barX, y: barY } = NICKNAME_SCROLLBAR
  return (
    <>
      <img
        className={styles.sprite}
        alt=""
        src={imageSrc(SLT_FRAME, PAGE_TITLE.bulletImage)}
        style={{ left: PAGE_TITLE.bulletX, top: PAGE_TITLE.bulletY }}
      />
      <FrameSprite folder={IMG_TEXT} frame={titleFrame} origins={textFrames} x={PAGE_TITLE.x} y={PAGE_TITLE.y} />
      <FrameSprite
        folder={IMG_TEXT}
        frame={NICKNAME_TAB_LABEL.frame}
        origins={textFrames}
        x={PAGE_TITLE.x + nameWidthOf(textFrames, titleFrame) + NICKNAME_TAB_LABEL.gap}
        y={PAGE_TITLE.y}
      />
      {indices.map((index, offset) => {
        const y = NAME_ROW.firstY + NAME_ROW.step * offset
        const name = TITLE_NAMES[(NICKNAME_PAGE_FIRST_NAMES[page] ?? 0) + index] ?? ''
        return (
          <div key={index} data-testid={`닉네임-줄-${index}`}>
            <FrameSprite folder={SLT_FRAMES} frame={NAME_ROW.frame} origins={frames} x={NAME_ROW.x} y={y} />
            <div className={styles.rowText} style={{ left: NAME_ROW.numberX, top: y + 4 }}>
              {index + 1}
            </div>
            {isNicknameOwned(page, index, owned) && (
              <div className={styles.rowText} style={{ left: NAME_ROW.nameX, top: y + 4, width: 110 }}>
                {name}
              </div>
            )}
          </div>
        )
      })}
      {/* 스크롤 막대 0x58c10 — 길 · ▲▼ · 흰 막대 */}
      <div
        className={styles.scrollTrack}
        data-testid="닉네임-스크롤"
        style={{
          left: barX,
          top: barY,
          width: NICKNAME_SCROLLBAR.width,
          height: NICKNAME_SCROLL_TRACK + 2,
          background: NICKNAME_SCROLLBAR.trackColor,
        }}
      />
      <img
        className={styles.sprite}
        alt=""
        src={imageSrc(SLT_FRAME, NICKNAME_SCROLLBAR.arrowImage)}
        style={{ left: barX, top: barY + NICKNAME_SCROLLBAR.arrowDy }}
      />
      <img
        className={styles.sprite}
        alt=""
        src={imageSrc(SLT_FRAME, NICKNAME_SCROLLBAR.arrowImage)}
        style={{ left: barX, top: barY + NICKNAME_SCROLL_TRACK + 1, transform: 'scaleY(-1)' }}
      />
      <div
        className={styles.scrollThumb}
        data-testid="닉네임-스크롤-막대"
        style={{ left: barX + 1, top: barY + scroll.thumb + 1, width: NICKNAME_SCROLLBAR.thumbWidth, height: scroll.thumbLength }}
      />
    </>
  )
}

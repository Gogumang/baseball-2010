import { TEAMS } from '@/shared/config/original/teams'
import { ANCHOR_A, ANCHOR_B, LOCKED_CIRCLES, LOCKED_NAME, NAME_BAR, TAG } from '@/pages/create-player/lib/teamSelectLayout'
import * as styles from '@/pages/create-player/ui/TeamSelectScreen.css'
import { BIG_LOGO_HALF, IMG_TEXT, SLT_IMAGE, frameSrc, imageSrc } from './teamSelectAssets'

/** A·B 딱지 — A 는 흰 막대(이미지 116), B 는 파란 막대(이미지 117)로 서로 다르다 */
export function TeamTags() {
  return [
    { anchor: ANCHOR_A, bar: TAG.aBarImage, barDy: TAG.aDy, textDy: TAG.aTextDy, frame: TAG.aTextFrame },
    { anchor: ANCHOR_B, bar: TAG.bBarImage, barDy: TAG.bDy, textDy: TAG.bTextDy, frame: TAG.bTextFrame },
  ].map(({ anchor, bar, barDy, textDy, frame }) => (
    <span key={frame}>
      <img className={styles.layer} alt="" src={imageSrc(SLT_IMAGE, bar)} style={{ left: anchor.x + TAG.dx, top: anchor.y + barDy }} />
      <img
        className={styles.layer}
        alt=""
        src={frameSrc(IMG_TEXT, frame)}
        style={{ left: anchor.x + TAG.dx, top: anchor.y + textDy, width: TAG.barWidth, objectFit: 'none' }}
      />
    </span>
  ))
}

/** A — 열린 팀은 로고, 잠긴 히든 팀은 파란 원 두 개. 그 아래 이름 막대(slt_frame **이미지** 9, 82×15) + 이름 — 잠긴 팀은 ??? 다 */
export function TeamAnchorA({ cursor, isOpen }: { readonly cursor: number; readonly isOpen: boolean }) {
  const team = TEAMS[cursor] ?? TEAMS[0]
  return (
    <>
      {isOpen ? (
        <img
          className={styles.layer}
          alt={team.name}
          src={team.logoUrl}
          style={{ left: ANCHOR_A.x - BIG_LOGO_HALF.width, top: ANCHOR_A.y - BIG_LOGO_HALF.height }}
        />
      ) : (
        LOCKED_CIRCLES.map((circle) => (
          <span
            key={circle.diameter}
            className={styles.lockedCircle}
            style={{
              left: ANCHOR_A.x - circle.diameter / 2,
              top: ANCHOR_A.y - circle.diameter / 2,
              width: circle.diameter,
              height: circle.diameter,
              background: circle.color,
            }}
          />
        ))
      )}
      <img
        className={styles.layer}
        alt=""
        src={imageSrc(SLT_IMAGE, NAME_BAR.image)}
        style={{ left: ANCHOR_A.x + NAME_BAR.dx, top: ANCHOR_A.y + NAME_BAR.dy }}
      />
      <span className={styles.centeredText} style={{ left: ANCHOR_A.x + NAME_BAR.dx, top: ANCHOR_A.y + 42, width: NAME_BAR.width }}>
        {isOpen ? team.name : LOCKED_NAME}
      </span>
    </>
  )
}

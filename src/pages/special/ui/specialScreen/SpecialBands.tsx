import { FOOTER, HEADBAND, SCREEN } from '@/pages/special/lib/specialLayout'
import * as styles from '@/pages/special/ui/SpecialScreen.css'
import { FRAME_SLIDE_END, frameSlideOf } from '@/widgets/screen-frame/lib/frameSlide'
import { footerBottomOf, headerTopOf } from '@/widgets/screen-frame/lib/screenFrameLayout'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { GAME_FRAME, imageSrc } from '@/pages/special/ui/specialScreen/specialAssets'

/**
 * 머리띠·바닥띠 0x54d95(skin, 0, 5) — 제목 "2010프로야구" + 바닥 되돌아가기 (P6 1-1). G포인트를 받지 않은 화면(시험 · 머리띠를
 * 안 넘긴 부르는 쪽)이 `ScreenFrame` 대신 쓴다.
 *
 * `slides` 면 0x54d95 가 그릴 때마다 +0x86 을 두 배로 해(0x54dfe~0x54e08) 머리띠는 위에서 · 바닥띠는 아래에서 미끄러져 들어온다
 * — `ScreenFrame` 과 같은 `frameSlideOf` · `headerTopOf` · `footerBottomOf` 로 다 내려온 자리(머리 −8 · 바닥 320)에서 민다.
 * 공용 목록 0x63b14 를 부르는 명예의 전당(스페셜 27 · 나리 145 0x15d54 = 0x63b15(…, 6, 1, [this+0x2c], −1))은 틱 0 에
 * +0x84 = 1 · +0x86 = 1 을 세워(0x63ba0~0x63bb4) 미끄러지고, 스페셜 목록 6 은 세우지 않아(ScreenFrame `slides` 머리말) 안 미끄러진다.
 */
export function SpecialBands({ onBack, slides = false }: { readonly onBack: () => void; readonly slides?: boolean }) {
  const updates = useUpdateCounter(slides)
  const slide = slides ? frameSlideOf(updates) : FRAME_SLIDE_END
  const dyTop = headerTopOf(slide) - headerTopOf(FRAME_SLIDE_END)
  const dyBottom = footerBottomOf(slide) - footerBottomOf(FRAME_SLIDE_END)
  return (
    <>
      <svg
        className={styles.sprite}
        style={{ left: 0, top: 0 }}
        viewBox={`0 0 ${SCREEN.width} ${SCREEN.height}`}
        width={SCREEN.width}
        height={SCREEN.height}
        shapeRendering="crispEdges"
      >
        <rect x={0} y={HEADBAND.band.y + dyTop} width={SCREEN.width} height={HEADBAND.band.height} fill={HEADBAND.band.color} />
        <rect x={0} y={HEADBAND.line.y + dyTop} width={SCREEN.width} height={HEADBAND.line.height} fill={HEADBAND.line.color} />
        <rect x={0} y={FOOTER.band.y + dyBottom} width={SCREEN.width} height={FOOTER.band.height} fill={FOOTER.band.color} />
        <rect x={0} y={FOOTER.line.y + dyBottom} width={SCREEN.width} height={1} fill={FOOTER.line.color} />
      </svg>
      {HEADBAND.tileXs.map((x) => (
        <img
          key={x}
          className={styles.sprite}
          alt=""
          src={imageSrc(GAME_FRAME, HEADBAND.tileImage)}
          style={{ left: x, top: HEADBAND.tileY + dyTop }}
        />
      ))}
      <img
        className={styles.sprite}
        alt=""
        src={imageSrc(GAME_FRAME, HEADBAND.cornerImage)}
        style={{ left: HEADBAND.cornerX, top: HEADBAND.tileY + dyTop }}
      />
      <img
        className={styles.sprite}
        alt=""
        data-testid="스페셜-머리띠-제목"
        src={imageSrc(GAME_FRAME, HEADBAND.title.image)}
        style={{ left: HEADBAND.title.x, top: HEADBAND.title.y + dyTop }}
      />
      {FOOTER.tileXs.map((x) => (
        <img
          key={x}
          className={styles.sprite}
          alt=""
          src={imageSrc(GAME_FRAME, FOOTER.tileImage)}
          style={{ left: x, top: FOOTER.tileY + dyBottom }}
        />
      ))}
      <img
        className={styles.sprite}
        alt=""
        src={imageSrc(GAME_FRAME, FOOTER.cornerImage)}
        style={{ left: FOOTER.cornerX, top: FOOTER.tileY + dyBottom }}
      />
      <button
        type="button"
        className={styles.backButton}
        aria-label="되돌아가기"
        style={{ left: FOOTER.backIcon.x, top: FOOTER.backIcon.y + dyBottom }}
        onClick={onBack}
      >
        <img src={imageSrc(GAME_FRAME, FOOTER.backIcon.image)} alt="" />
      </button>
    </>
  )
}

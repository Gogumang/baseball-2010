import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { FRAME_SLIDE_END, frameSlideOf } from '@/widgets/screen-frame/lib/frameSlide'
import {
  BACK_ICON_X, FOOTER_BITS, FOOTER_CENTER_MARKS, FOOTER_CENTER_X, FOOTER_CORNER_X, FOOTER_LEFT_MARKS, FOOTER_LEFT_X,
  FOOTER_TILE_XS, FRAME_COLORS, HEADER_CORNER_X, HEADER_GAME_POINT, HEADER_TILE_XS, TITLE_IMAGES,
  footerBottomOf, footerMarkTopOf, headerTopOf, isGameSettingsMarkShown,
} from '@/widgets/screen-frame/lib/screenFrameLayout'
import type { ScreenFrameTitle } from '@/widgets/screen-frame/lib/screenFrameLayout'
import { GamePointBadge } from '@/widgets/screen-frame/ui/GamePointBadge'
import * as styles from '@/widgets/screen-frame/ui/ScreenFrame.css'

const frameImage = (index: number) => `./sprites/game_frame/${String(index).padStart(3, '0')}.png`
const markImage = (frame: number) => `./sprites/game_frame/frames/${String(frame).padStart(3, '0')}.png`

interface ScreenFrameProps {
  readonly title: ScreenFrameTitle
  readonly gamePoint: number
  /**
   * 뒤로 표시(바닥비트 0x4, 0x55220 `lsrs r3, r0, #2; tst`)를 누르면 부른다 — 휴대폰 취소 키 대신.
   * **null 이면 뒤로 표시를 안 그린다** — 바닥 1 처럼 0x4 가 없는 값. 0x54d95 는 비트 0 을 아예 안 본다
   * (0x55220~0x554f4 가 보는 비트는 1~9 뿐) — 곧 바닥 1 = 띠·오른쪽 탭만 있고 표시는 하나도 없다.
   */
  readonly onBack: (() => void) | null
  /**
   * 바닥비트 (0x54d95 의 셋째 인자, `FOOTER_BITS`). 안 주면 예전처럼 onBack 이 null 이면 1, 아니면 5(되돌아가기만).
   * 되돌아가기 표시는 비트 0x4 가 있을 때만 그리고, onBack 이 있으면 누를 수 있다.
   */
  readonly footer?: number
  /**
   * 머리띠·바닥띠가 미끄러져 들어오는가 ([skin+0x84]). 하위 상태 들어옴이 [+0x84] 를 안 세우면(예: 기록연감 0x2407c 는
   * 0 으로 둔다) 앞 화면에서 다 내려온 그대로다 — false 면 처음부터 다 내려온 자리에 그린다.
   */
  readonly slides?: boolean
}

/**
 * 머리띠(제목·G포인트)와 바닥띠. 바닥띠(띠·선·오른쪽 탭 0x55110~0x5521c)는 바닥비트와 상관없이 늘 그리고,
 * 뒤로 표시(y = B−6−13+3, 0x55226)는 바닥비트 0x4 일 때만, 그 밖 표시(재선택·타자·투수·닉네임 왼쪽 ·
 * 상세정보·경기설정·목표·레벨업 가운데)는 비트마다 game_frame 프레임으로 그린다(`FOOTER_BITS`, 0x552b6~0x554f4).
 */
export function ScreenFrame({ title, gamePoint, onBack, footer = onBack === null ? 1 : 5, slides = true }: ScreenFrameProps) {
  const updates = useUpdateCounter()
  const slide = slides ? frameSlideOf(updates) : FRAME_SLIDE_END
  const top = headerTopOf(slide)
  const bottom = footerBottomOf(slide)

  return (
    <>
      <svg className={styles.layer} viewBox="0 0 240 320" width={240} height={320} shapeRendering="crispEdges">
        <rect x={0} y={top} width={240} height={14} fill={FRAME_COLORS.headerBand} />
        <rect x={0} y={top + 14} width={240} height={2} fill={FRAME_COLORS.headerLine} />
        <rect x={0} y={bottom - 5} width={240} height={5} fill={FRAME_COLORS.footerBand} />
        <rect x={0} y={bottom - 5} width={240} height={1} fill={FRAME_COLORS.footerLine} />
      </svg>
      {HEADER_TILE_XS.map((x) => <img key={x} className={styles.layer} style={{ left: x, top: top + 11 }} src={frameImage(0)} alt="" />)}
      <img className={styles.layer} style={{ left: HEADER_CORNER_X, top: top + 11 }} src={frameImage(1)} alt="" />
      {TITLE_IMAGES[title].map((part) => (
        <img key={part.image} className={styles.layer} style={{ left: part.x, top: top + part.dy }} src={frameImage(part.image)} alt="" />
      ))}
      {/* G포인트 0x54a60 — 둥근 판 (x+9, y+1, 60, 13) · 동전 (x, y−1) · 숫자 오른끝 x + 0x41 + 2 */}
      <GamePointBadge testId="머리띠-G" value={gamePoint} x={HEADER_GAME_POINT.x} y={top + HEADER_GAME_POINT.dy}
        width={HEADER_GAME_POINT.width} align={HEADER_GAME_POINT.align} plus={HEADER_GAME_POINT.plus}
        plate={HEADER_GAME_POINT.plate} />
      {FOOTER_TILE_XS.map((x) => <img key={x} className={styles.layer} style={{ left: x, top: bottom - 20 }} src={frameImage(20)} alt="" />)}
      <img className={styles.layer} style={{ left: FOOTER_CORNER_X, top: bottom - 20 }} src={frameImage(19)} alt="" />
      {(footer & FOOTER_BITS.back) !== 0 && (onBack === null
        ? <img className={styles.layer} style={{ left: BACK_ICON_X, top: bottom - 16 }} src={frameImage(21)} alt="" />
        : (
          <button type="button" aria-label="되돌아가기" className={styles.backButton} style={{ left: BACK_ICON_X, top: bottom - 16 }} onClick={onBack}>
            <img src={frameImage(21)} alt="" />
          </button>
        ))}
      {FOOTER_LEFT_MARKS.map(([bit, frame]) => (footer & bit) !== 0 && (
        <img key={frame} className={styles.layer} data-footer-mark={frame} style={{ left: FOOTER_LEFT_X, top: footerMarkTopOf(bottom) }} src={markImage(frame)} alt="" />
      ))}
      {FOOTER_CENTER_MARKS.map(([bit, frame]) => (footer & bit) !== 0
        // "0경기설정" 은 [skin+0x410] 카운터로 깜박인다 — 웹은 화면 갱신 수로 센다 (시작 위상 미확인)
        && (bit !== FOOTER_BITS.gameSettings || isGameSettingsMarkShown(updates)) && (
        <img key={frame} className={styles.layer} data-footer-mark={frame} style={{ left: FOOTER_CENTER_X, top: footerMarkTopOf(bottom) }} src={markImage(frame)} alt="" />
      ))}
    </>
  )
}

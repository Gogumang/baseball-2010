import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { frameSlideOf } from '@/widgets/screen-frame/lib/frameSlide'
import {
  BACK_ICON_X, FOOTER_CORNER_X, FOOTER_TILE_XS, FRAME_COLORS, GAME_POINT_DIGITS_RIGHT, GAME_POINT_LEFT,
  HEADER_CORNER_X, HEADER_TILE_XS, TITLE_IMAGES, footerBottomOf, gamePointDigitWidthOf, headerTopOf,
} from '@/widgets/screen-frame/lib/screenFrameLayout'
import type { ScreenFrameTitle } from '@/widgets/screen-frame/lib/screenFrameLayout'
import * as styles from '@/widgets/screen-frame/ui/ScreenFrame.css'
import { ORIGINAL_COLORS } from '@/shared/config/design'

const frameImage = (index: number) => `./sprites/game_frame/${String(index).padStart(3, '0')}.png`
const pointImage = (index: number) => `./sprites/gpoint/${String(index).padStart(3, '0')}.png`
const GAME_POINT_COIN = 11

interface ScreenFrameProps {
  readonly title: ScreenFrameTitle
  readonly gamePoint: number
  /**
   * 뒤로 표시(바닥비트 0x4, 0x55220 `lsrs r3, r0, #2; tst`)를 누르면 부른다 — 휴대폰 취소 키 대신.
   * **null 이면 뒤로 표시를 안 그린다** — 바닥 1 처럼 0x4 가 없는 값. 0x54d95 는 비트 0 을 아예 안 본다
   * (0x55220~0x554f4 가 보는 비트는 1~9 뿐) — 곧 바닥 1 = 띠·오른쪽 탭만 있고 표시는 하나도 없다.
   */
  readonly onBack: (() => void) | null
}

/**
 * 머리띠(제목·G포인트)와 바닥띠. 바닥띠(띠·선·오른쪽 탭 0x55110~0x5521c)는 바닥비트와 상관없이 늘 그리고,
 * 뒤로 표시(y = B−6−13+3, 0x55226)는 바닥비트 0x4 일 때만 그린다.
 */
export function ScreenFrame({ title, gamePoint, onBack }: ScreenFrameProps) {
  const slide = frameSlideOf(useUpdateCounter())
  const top = headerTopOf(slide)
  const bottom = footerBottomOf(slide)
  const digits = [...String(gamePoint)]
  let digitX = GAME_POINT_DIGITS_RIGHT - digits.reduce((total, digit) => total + gamePointDigitWidthOf(digit) + 1, 0)

  return (
    <>
      <svg className={styles.layer} viewBox="0 0 240 320" width={240} height={320} shapeRendering="crispEdges">
        <rect x={0} y={top} width={240} height={14} fill={FRAME_COLORS.headerBand} />
        <rect x={0} y={top + 14} width={240} height={2} fill={FRAME_COLORS.headerLine} />
        <rect x={0} y={bottom - 5} width={240} height={5} fill={FRAME_COLORS.footerBand} />
        <rect x={0} y={bottom - 5} width={240} height={1} fill={FRAME_COLORS.footerLine} />
        {/* G포인트 알약 (0x54a60) — (x0+9, y0+1, 60, 13) */}
        <rect x={GAME_POINT_LEFT + 9} y={top + 19} width={60} height={13} rx={6} fill={FRAME_COLORS.pill} stroke={ORIGINAL_COLORS.black} />
      </svg>
      {HEADER_TILE_XS.map((x) => <img key={x} className={styles.layer} style={{ left: x, top: top + 11 }} src={frameImage(0)} alt="" />)}
      <img className={styles.layer} style={{ left: HEADER_CORNER_X, top: top + 11 }} src={frameImage(1)} alt="" />
      {TITLE_IMAGES[title].map((part) => (
        <img key={part.image} className={styles.layer} style={{ left: part.x, top: top + part.dy }} src={frameImage(part.image)} alt="" />
      ))}
      <img className={styles.layer} style={{ left: GAME_POINT_LEFT, top: top + 17 }} src={pointImage(GAME_POINT_COIN)} alt="" />
      {digits.map((digit, index) => {
        const left = digitX
        digitX += gamePointDigitWidthOf(digit) + 1
        return <img key={index} className={styles.layer} style={{ left, top: top + 22 }} src={pointImage(Number(digit))} alt="" />
      })}
      {FOOTER_TILE_XS.map((x) => <img key={x} className={styles.layer} style={{ left: x, top: bottom - 20 }} src={frameImage(20)} alt="" />)}
      <img className={styles.layer} style={{ left: FOOTER_CORNER_X, top: bottom - 20 }} src={frameImage(19)} alt="" />
      {onBack !== null && (
        <button type="button" aria-label="되돌아가기" className={styles.backButton} style={{ left: BACK_ICON_X, top: bottom - 16 }} onClick={onBack}>
          <img src={frameImage(21)} alt="" />
        </button>
      )}
    </>
  )
}

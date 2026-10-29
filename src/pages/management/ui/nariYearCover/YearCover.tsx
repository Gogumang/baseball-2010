import { useImgTextPalettes } from '@/shared/ui/ImgTextPalette/ImgTextPalette'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { YEAR_COVER_CLIP, YEAR_COVER_LABEL, YEAR_COVER_ORIGIN, YEAR_COVER_SCALE, yearCoverDigitsOf } from '@/pages/management/lib/nariYearCover'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const IMG_TEXT_FRAMES = assetUrl('./sprites/img_text/frames')
const NUM_IMAGES = assetUrl('./sprites/num')

/** 그리기 0x1cc4c — 검정 · 자르기 (0, 154, 240, 22) 안에 "년차"(img_text 398 팔레트 1) · 굴러가는 연차 숫자, 모두 두 배 */
export function YearCover({ yearIndex, counter }: { readonly yearIndex: number; readonly counter: number }) {
  const palettes = useImgTextPalettes()
  const origins = useFrameOrigins(IMG_TEXT_FRAMES)
  const labelKey = String(YEAR_COVER_LABEL.frame).padStart(3, '0')
  const labelOrigin = origins?.[labelKey]
  const clip = YEAR_COVER_CLIP
  const scaled = { transform: `scale(${YEAR_COVER_SCALE})`, transformOrigin: '0 0', imageRendering: 'pixelated' } as const
  return (
    <div data-part="year-cover" data-counter={counter} style={{ position: 'absolute', inset: 0, background: '#000000', pointerEvents: 'none' }}>
      {palettes.definition}
      <div style={{ position: 'absolute', left: clip.x, top: clip.y, width: clip.width, height: clip.height, overflow: 'hidden' }}>
        {labelOrigin !== undefined && (
          // 프레임 그리기 0x944b4 효과 0x10 · b 2 — 파트 자리 X + dx·2
          <img
            src={`${IMG_TEXT_FRAMES}/${labelKey}.png`}
            alt="년차"
            style={{
              position: 'absolute',
              left: YEAR_COVER_ORIGIN.x + labelOrigin.x * YEAR_COVER_SCALE - clip.x,
              top: YEAR_COVER_ORIGIN.y + labelOrigin.y * YEAR_COVER_SCALE - clip.y,
              ...scaled,
              ...palettes.styleOf(YEAR_COVER_LABEL.frame, YEAR_COVER_LABEL.palette),
            }}
          />
        )}
        {yearCoverDigitsOf(yearIndex, counter).map((digit, index) => (
          <img
            key={index}
            src={`${NUM_IMAGES}/${String(digit.image).padStart(3, '0')}.png`}
            alt=""
            data-digit={digit.image - 0x14}
            style={{ position: 'absolute', left: digit.x - clip.x, top: digit.y - clip.y, ...scaled }}
          />
        ))}
      </div>
    </div>
  )
}

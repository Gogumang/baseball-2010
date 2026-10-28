import { FrameSprite, PressArea, SpriteNumber } from '@/shared/ui'
import { PixelText } from '@/shared/ui/PixelText/PixelText'
import { FONT_SPACING, LINE_HEIGHT, measurePixelTextWidth } from '@/shared/lib/font/layout'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { moneyGlyphsOf } from '@/shared/lib/pixelNumber/pixelNumber'
import { STADIUM_KINDS } from '@/entities/season-mode/model/stadiumItems'
import type { StadiumKind } from '@/entities/season-mode/model/stadiumItems'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import {
  centeredOffsetOf,
  descriptionBoxRectsOf,
  isBlinkOn,
  partSeparatorRectsOf,
  scrollThumbRectsOf,
  tabPanelRectsOf,
  windowRowOf,
} from '@/pages/season/lib/seasonEquipmentWindow'
import type { WindowBox, WindowRect } from '@/pages/season/lib/seasonEquipmentWindow'
import {
  STADIUM_COLORS,
  STADIUM_WINDOW,
  stadiumItemDescriptionOf,
  stadiumKindBoxOf,
  stadiumPriceTenThousandsOf,
  stadiumRowLookOf,
  stadiumRowNameOf,
  stadiumSlotCountOf,
} from '@/pages/season/lib/stadiumItemWindow'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const MODE_UI = assetUrl('./sprites/mode_ui/frames')
const IMG_TEXT = assetUrl('./sprites/img_text/frames')
const imageOf = (folder: string, frame: number) => `${folder}/${String(frame).padStart(3, '0')}.png`
const pixel = { position: 'absolute', pointerEvents: 'none' } as const
/** 글상자 0x6ecd0 의 앱 전역 글꼴 줄 — 11 + 줄간 3 */
const TEXT_LINE = LINE_HEIGHT + FONT_SPACING.app.lineGap

export interface StadiumItemWindowProps {
  readonly record: SeasonRecord
  /** 종류 목록 [창+0x198] 의 커서 */
  readonly kind: StadiumKind
  /** 칸 목록 [창+0x19c] 의 커서 · 맨 윗줄 */
  readonly slot: number
  readonly top: number
  /** 초점 [창+0x1a8] — 칸 목록에 있나 */
  readonly isSlotFocus: boolean
  /** 창 틱 (깜빡임 % 10) */
  readonly tick: number
  /** 상점(0xdc)인가 — 산 칸 글색 · 막대는 상점만 (83828 [gfx+0x174] == 0xdc) */
  readonly isShop: boolean
  readonly isHiddenOpen: (unlockId: number) => boolean
  /** 종류 아이콘 자리를 눌렀다 (웹 마우스 — 투명 누름 칸) */
  readonly onPickKind: (kind: StadiumKind) => void
  /** 칸 줄을 눌렀다 (웹 마우스 — 투명 누름 칸) */
  readonly onPickSlot: (slot: number) => void
}

function Rects({ rects, testId }: { readonly rects: readonly WindowRect[]; readonly testId?: string }) {
  return (
    <svg viewBox="0 0 240 320" shapeRendering="crispEdges" data-testid={testId} style={{ ...pixel, left: 0, top: 0, width: 240, height: 320 }}>
      {rects.map((rect, index) => (
        <rect key={index} x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill={rect.color} />
      ))}
    </svg>
  )
}

/** 0xba411(박스, 글, 정렬 0x22) → 0xba2e4 — 가로 (w − 글폭) asr 1 · 세로 d > 0 이면 ceil(d/2) (d = h − 11) */
function CenteredText({ text, box, color }: { readonly text: string; readonly box: WindowBox; readonly color: string }) {
  const d = box.height - LINE_HEIGHT
  const dy = d > 0 ? (d >> 1) + (d % 2) : d >> 1
  return <PixelText style={{ ...pixel, left: box.x + ((box.width - measurePixelTextWidth(text)) >> 1), top: box.y + dy, color }}>{text}</PixelText>
}

/**
 * **구장 아이템 창** — 아이템 창 0x83378 의 종류 4 (`lib/stadiumItemWindow` 머리말, 직접 떴다).
 * 시즌 0xdc 상점(그리기 0xb1f8 의 메뉴 칸 1 갈래)과 0xea 구장관리(0xb158)가 같이 쓴다.
 */
export function StadiumItemWindow({
  record,
  kind,
  slot,
  top,
  isSlotFocus,
  tick,
  isShop,
  isHiddenOpen,
  onPickKind,
  onPickSlot,
}: StadiumItemWindowProps) {
  const uiOrigins = useFrameOrigins(MODE_UI)
  const textOrigins = useFrameOrigins(IMG_TEXT)
  const { labels, values, items, description } = STADIUM_WINDOW
  const valueRight = values.x + values.width - STADIUM_WINDOW.valueInset
  const slotCount = stadiumSlotCountOf(kind)
  const visible = Array.from({ length: STADIUM_WINDOW.visibleRows }, (_unused, row) => top + row).filter((index) => index < slotCount)
  const marker = stadiumKindBoxOf(kind)
  const markerOrigin = uiOrigins?.[String(STADIUM_WINDOW.partMarkerFrame).padStart(3, '0')]
  const descriptionText = isSlotFocus ? stadiumItemDescriptionOf(kind, slot, isHiddenOpen) : null

  return (
    <div
      role="group"
      aria-label={isShop ? '구장 아이템' : '구장관리'}
      data-testid="구장-창"
      data-kind={kind}
      data-focus={isSlotFocus ? '칸' : '종류'}
    >
      <Rects
        rects={[...tabPanelRectsOf(STADIUM_WINDOW.panel, true), ...partSeparatorRectsOf(), ...descriptionBoxRectsOf(description)]}
        testId="구장-판"
      />
      <FrameSprite folder={MODE_UI} frame={STADIUM_WINDOW.frame} origins={uiOrigins} x={0} y={0} />
      {STADIUM_WINDOW.labelFrames.map((frame, row) => {
        const size = textOrigins?.[String(frame).padStart(3, '0')]
        const box = windowRowOf(labels, row)
        return size === undefined ? null : (
          <img
            key={frame}
            alt=""
            src={imageOf(IMG_TEXT, frame)}
            style={{
              ...pixel,
              left: box.x + box.width - size.width - STADIUM_WINDOW.valueInset,
              top: box.y + centeredOffsetOf(box.height, size.height),
            }}
          />
        )
      })}
      {/* 박스 2 줄 0 — 소지금 0x63331(SR+2 × 100 만원, 0x24, ox −2) */}
      <div data-testid="구장-소지금" aria-label={String(record.money * 100)}>
        <SpriteNumber glyphs={moneyGlyphsOf(record.money * 100)} right={valueRight} boxTop={values.y} boxHeight={values.height} />
      </div>
      {/* 종류 표시 mode_ui 51 — 종류 목록에 있을 때는 틱 % 10 == 0 에 꺼진다 (0x83740) */}
      {(isSlotFocus || isBlinkOn(tick)) && markerOrigin !== undefined && (
        <img
          alt=""
          data-testid="구장-종류표시"
          src={imageOf(MODE_UI, STADIUM_WINDOW.partMarkerFrame)}
          style={{
            ...pixel,
            left: marker.x + centeredOffsetOf(marker.width, markerOrigin.width),
            top: marker.y + centeredOffsetOf(marker.height, markerOrigin.height),
          }}
        />
      )}
      {STADIUM_KINDS.map((name) => (
        <PressArea key={name} label={name} rect={stadiumKindBoxOf(name)} option={{ isSelected: name === kind }} onPress={() => onPickKind(name)} />
      ))}
      {visible.map((index, row) => {
        const box = windowRowOf(items, row)
        const look = stadiumRowLookOf(record, kind, index, isShop)
        const name = stadiumRowNameOf(kind, index, isHiddenOpen)
        const isCursor = isSlotFocus && index === slot
        return (
          <div key={index} data-testid={`구장-칸-${index}`}>
            {look.bar !== null && <img alt="" src={imageOf(MODE_UI, look.bar)} style={{ ...pixel, left: box.x, top: box.y }} />}
            <CenteredText text={name} box={box} color={look.color} />
            {/* 노랑 테두리 0xb9ed5 (0x83c4e) — 0x6a978 이 (w + 1) × (h + 1) 칸을 덮는다 (U-113) */}
            {isCursor && isBlinkOn(tick) && (
              <div
                data-testid="구장-커서"
                style={{
                  ...pixel,
                  left: box.x,
                  top: box.y,
                  width: box.width + 1,
                  height: box.height + 1,
                  boxSizing: 'border-box',
                  border: `1px solid ${STADIUM_COLORS.cursor}`,
                }}
              />
            )}
            <PressArea label={`${kind} ${name}`} rect={box} option={{ isSelected: isCursor }} onPress={() => onPickSlot(index)} />
          </div>
        )
      })}
      {isSlotFocus && (
        <>
          {/* 박스 2 줄 1 — 가격 0xd45c0 × 10000 만원, 노랑 (0x83c80 · 0x83d5c) */}
          <div data-testid="구장-가격" aria-label={String(stadiumPriceTenThousandsOf(kind, slot))}>
            <SpriteNumber
              glyphs={moneyGlyphsOf(stadiumPriceTenThousandsOf(kind, slot))}
              right={valueRight}
              boxTop={windowRowOf(values, 1).y}
              boxHeight={values.height}
            />
          </div>
          {descriptionText !== null && (
            <div data-testid="구장-설명" aria-label={descriptionText.replaceAll('!N', '\n')}>
              {descriptionText.split('!N').map((line, index) => (
                <PixelText
                  key={index}
                  style={{
                    ...pixel,
                    left: description.x + STADIUM_WINDOW.descriptionInset,
                    top: description.y + STADIUM_WINDOW.descriptionInset + index * TEXT_LINE,
                    color: STADIUM_COLORS.cursor,
                  }}
                >
                  {line}
                </PixelText>
              ))}
            </div>
          )}
        </>
      )}
      <Rects rects={scrollThumbRectsOf(top, slotCount)} testId="구장-굴림" />
    </div>
  )
}

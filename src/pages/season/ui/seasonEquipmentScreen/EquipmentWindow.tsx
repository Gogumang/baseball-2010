import { FrameSprite, SpriteNumber } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { moneyGlyphsOf } from '@/shared/lib/pixelNumber/pixelNumber'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import {
  EQUIPMENT_WINDOW,
  centeredOffsetOf,
  descriptionBoxRectsOf,
  isBlinkOn,
  partMarkerBoxOf,
  partSeparatorRectsOf,
  scrollThumbRectsOf,
  tabPanelRectsOf,
  windowRowOf,
} from '@/pages/season/lib/seasonEquipmentWindow'
import { IMG_TEXT, MODE_UI, frameNameOf, imageOf, pixel, pressable } from './equipmentAssets'
import { Rects, RightImage } from './EquipmentPieces'
import { EquipmentItemRows } from './EquipmentItemRows'
import { EquipmentItemDetail } from './EquipmentItemDetail'

export interface EquipmentWindowProps {
  readonly record: SeasonRecord
  readonly isBatter: boolean
  readonly equipment: readonly number[]
  readonly part: number
  readonly level: number
  readonly top: number
  readonly isItemFocus: boolean
  readonly tick: number
  readonly isHiddenOpen: (id: number) => boolean
  readonly onPickPart: (part: number) => void
  readonly onPickLevel: (level: number) => void
}

const PART_SLOTS = [0, 1, 2, 3]

/** 부위 표시 — 부위 목록에 있을 때는 틱 % 10 == 0 에 꺼진다 */
function PartMarker({ part, origin }: { readonly part: number; readonly origin: { readonly width: number; readonly height: number } }) {
  const marker = partMarkerBoxOf(part)
  return (
    <img
      alt=""
      data-testid="장비-부위표시"
      data-part={part}
      src={imageOf(MODE_UI, EQUIPMENT_WINDOW.partMarkerFrame)}
      style={{
        ...pixel,
        left: marker.x + centeredOffsetOf(marker.width, origin.width),
        top: marker.y + centeredOffsetOf(marker.height, origin.height),
      }}
    />
  )
}

/** 부위 네 칸 누름 — 웹 전용 길 */
function PartButtons({ part, onPickPart }: Pick<EquipmentWindowProps, 'part' | 'onPickPart'>) {
  return PART_SLOTS.map((slot) => {
    const box = partMarkerBoxOf(slot)
    return (
      <button
        key={slot}
        type="button"
        aria-label={`부위 ${slot + 1}`}
        aria-current={slot === part}
        style={{ position: 'absolute', left: box.x, top: box.y, width: box.width, height: box.height, ...pressable }}
        onClick={() => onPickPart(slot)}
      />
    )
  })
}

/** 장비 창 0x83378 (창 종류 3) — 판 · 이름표 · 소지금 · 부위 표시 · 칸 목록 · 칸 정보 · 굴림 막대 */
export function EquipmentWindow(props: EquipmentWindowProps) {
  const { record, isBatter, part, level, isItemFocus, tick, isHiddenOpen } = props
  const uiOrigins = useFrameOrigins(MODE_UI)
  const textOrigins = useFrameOrigins(IMG_TEXT)
  const sizeOf = (frame: number) => textOrigins?.[frameNameOf(frame)]
  const { labels, values } = EQUIPMENT_WINDOW
  const valueRight = values.x + values.width - EQUIPMENT_WINDOW.valueInset
  const markerOrigin = uiOrigins?.[frameNameOf(EQUIPMENT_WINDOW.partMarkerFrame)]
  const showsMarker = (isItemFocus || isBlinkOn(tick)) && markerOrigin !== undefined

  return (
    <>
      <Rects rects={[...tabPanelRectsOf(EQUIPMENT_WINDOW.panel, true), ...partSeparatorRectsOf(), ...descriptionBoxRectsOf()]} testId="장비-판" />
      <FrameSprite folder={MODE_UI} frame={EQUIPMENT_WINDOW.frame} origins={uiOrigins} x={0} y={0} />
      {EQUIPMENT_WINDOW.labelFrames.map((frame, row) => {
        const size = sizeOf(frame)
        if (size === undefined) return null
        const box = windowRowOf(labels, row)
        return (
          <RightImage
            key={frame}
            src={imageOf(IMG_TEXT, frame)}
            box={box}
            width={size.width}
            height={size.height}
            ox={-EQUIPMENT_WINDOW.valueInset}
          />
        )
      })}
      <div data-testid="장비-소지금" aria-label={String(record.money * 100)}>
        <SpriteNumber glyphs={moneyGlyphsOf(record.money * 100)} right={valueRight} boxTop={values.y} boxHeight={values.height} />
      </div>
      {showsMarker && <PartMarker part={part} origin={markerOrigin} />}
      <PartButtons part={part} onPickPart={props.onPickPart} />
      <EquipmentItemRows {...props} />
      {isItemFocus && (
        <EquipmentItemDetail isBatter={isBatter} part={part} level={level} isHiddenOpen={isHiddenOpen} valueRight={valueRight} sizeOf={sizeOf} />
      )}
      <Rects rects={scrollThumbRectsOf(props.top)} testId="장비-굴림" />
    </>
  )
}

import { FrameSprite, PressArea, SpriteNumber } from '@/shared/ui'
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
import { STADIUM_WINDOW, stadiumKindBoxOf, stadiumSlotCountOf } from '@/pages/season/lib/stadiumItemWindow'
import { IMG_TEXT, MODE_UI, frameNameOf, imageOf, pixel } from './seasonEquipmentScreen/equipmentAssets'
import { Rects } from './seasonEquipmentScreen/EquipmentPieces'
import { StadiumSlotRows } from './stadiumItemWindow/StadiumSlotRows'
import { StadiumSlotDetail } from './stadiumItemWindow/StadiumSlotDetail'

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

/** 이름표 img_text — 박스 1 세 줄, 오른쪽(ox −2) · 세로 가운데 */
function LabelImages({ sizeOf }: { readonly sizeOf: (frame: number) => { readonly width: number; readonly height: number } | undefined }) {
  return STADIUM_WINDOW.labelFrames.map((frame, row) => {
    const size = sizeOf(frame)
    const box = windowRowOf(STADIUM_WINDOW.labels, row)
    return size === undefined ? null : (
      <img
        key={frame}
        alt=""
        src={imageOf(IMG_TEXT, frame)}
        style={{ ...pixel, left: box.x + box.width - size.width - STADIUM_WINDOW.valueInset, top: box.y + centeredOffsetOf(box.height, size.height) }}
      />
    )
  })
}

/** 종류 표시 mode_ui 51 — 종류 목록에 있을 때는 틱 % 10 == 0 에 꺼진다 (0x83740) */
function KindMarker({ kind, origin }: { readonly kind: StadiumKind; readonly origin: { readonly width: number; readonly height: number } }) {
  const marker = stadiumKindBoxOf(kind)
  return (
    <img
      alt=""
      data-testid="구장-종류표시"
      src={imageOf(MODE_UI, STADIUM_WINDOW.partMarkerFrame)}
      style={{
        ...pixel,
        left: marker.x + centeredOffsetOf(marker.width, origin.width),
        top: marker.y + centeredOffsetOf(marker.height, origin.height),
      }}
    />
  )
}

/**
 * **구장 아이템 창** — 아이템 창 0x83378 의 종류 4 (`lib/stadiumItemWindow` 머리말, 직접 떴다).
 * 시즌 0xdc 상점(그리기 0xb1f8 의 메뉴 칸 1 갈래)과 0xea 구장관리(0xb158)가 같이 쓴다.
 */
export function StadiumItemWindow(props: StadiumItemWindowProps) {
  const { record, kind, slot, top, isSlotFocus, tick, isShop, isHiddenOpen, onPickKind } = props
  const uiOrigins = useFrameOrigins(MODE_UI)
  const textOrigins = useFrameOrigins(IMG_TEXT)
  const { values } = STADIUM_WINDOW
  const valueRight = values.x + values.width - STADIUM_WINDOW.valueInset
  const markerOrigin = uiOrigins?.[frameNameOf(STADIUM_WINDOW.partMarkerFrame)]
  const showsMarker = (isSlotFocus || isBlinkOn(tick)) && markerOrigin !== undefined

  return (
    <div
      role="group"
      aria-label={isShop ? '구장 아이템' : '구장관리'}
      data-testid="구장-창"
      data-kind={kind}
      data-focus={isSlotFocus ? '칸' : '종류'}
    >
      <Rects
        rects={[...tabPanelRectsOf(STADIUM_WINDOW.panel, true), ...partSeparatorRectsOf(), ...descriptionBoxRectsOf(STADIUM_WINDOW.description)]}
        testId="구장-판"
      />
      <FrameSprite folder={MODE_UI} frame={STADIUM_WINDOW.frame} origins={uiOrigins} x={0} y={0} />
      <LabelImages sizeOf={(frame) => textOrigins?.[frameNameOf(frame)]} />
      {/* 박스 2 줄 0 — 소지금 0x63331(SR+2 × 100 만원, 0x24, ox −2) */}
      <div data-testid="구장-소지금" aria-label={String(record.money * 100)}>
        <SpriteNumber glyphs={moneyGlyphsOf(record.money * 100)} right={valueRight} boxTop={values.y} boxHeight={values.height} />
      </div>
      {showsMarker && <KindMarker kind={kind} origin={markerOrigin} />}
      {STADIUM_KINDS.map((name) => (
        <PressArea key={name} label={name} rect={stadiumKindBoxOf(name)} option={{ isSelected: name === kind }} onPress={() => onPickKind(name)} />
      ))}
      <StadiumSlotRows {...props} />
      {isSlotFocus && <StadiumSlotDetail kind={kind} slot={slot} valueRight={valueRight} isHiddenOpen={isHiddenOpen} />}
      <Rects rects={scrollThumbRectsOf(top, stadiumSlotCountOf(kind))} testId="구장-굴림" />
    </div>
  )
}

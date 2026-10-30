import { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { ComposedScreen, FrameSprite, SolidStamp } from '@/shared/ui'
import { CURSOR_ANIMATION, MAP_FRAMES, OUTING_PLACES, PLACE_LABEL_FRAMES } from '@/shared/config/outingPlaces'
import { mapLabelSrc, outingMapComposeOps, outingMapUnderlayLayoutOf } from '@/pages/management/lib/outingMapUnderlay'
import { useSceneHour } from '@/shared/lib/phoneClock/phoneClock'
/** 0x7ec04 · 0x7e300 의 단색 찍기 자리 — 건물은 네 방향, 글자 테두리는 여덟 방향(표 0xd48c8 · 0xd48e8) */
const FOUR_WAYS: readonly (readonly [number, number])[] = [
  [-1, 0],
  [0, -1],
  [1, 0],
  [0, 1],
]
const EIGHT_WAYS: readonly (readonly [number, number])[] = [
  [-1, 0],
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
]

export interface SeasonOutingMapProps {
  /** 고른 칸 p (this+0xf8) — −1 이면 고른 칸 없음(엔딩 0x87a1c) */
  readonly selected: number
  /** 셋째 인자 이름숨김 — 참이면 0x7eb66 의 장소 이름(고르지 않은 칸)을 안 그린다. 엔딩 0x87a38 만 1 이다 */
  readonly hidesNames?: boolean
  /** 시간대 [gfx+0x1c] 를 고를 한국 시각 — 안 주면 장면에 들어설 때 잡은 시각(`useSceneHour`) */
  readonly hour?: number
}

/**
 * 시즌 외출 지도 `0x7ea64(gfx, p, 0)` (`lib/seasonOutingMap` 머리말) — 0xd1 · 0xe3 의 밑그림.
 * 지도 원점 · 이름 자리 · 밤은 나리 밑그림과 같은 식(`outingMapUnderlayLayoutOf`)이다.
 * 시즌 엔딩 0x87a1c 는 같은 장면 gfx([this+0xc0], 0xb7ec)로 `0x7ea64(gfx, −1, 1)`(0x87a30~0x87a38)을 부른다 —
 * sel = −1 이라 건물 다섯이 효과 0(보통)이고(0x7eb0a) 흰 테두리 · 화살표가 없으며(0x7ec04 → 0x7ed58), 이름숨김 1 이라
 * 0x7eb66 의 이름을 건너뛴다(셋째 인자는 거기서만 본다). 밤 갈래(0x7eba2)는 sel 과 상관없이 탄다.
 * 지도 · 고르지 않은 건물(효과 1 · 7) · 이름 · 밤 덮개는 원본 식 그대로 한 캔버스로 합성한다(`outingMapComposeOps`).
 */
export function SeasonOutingMap({ selected, hidesNames = false, hour }: SeasonOutingMapProps) {
  const origins = useFrameOrigins(MAP_FRAMES)
  const labelOrigins = useFrameOrigins(PLACE_LABEL_FRAMES)
  const animations = useAnimations(MAP_FRAMES)
  const update = useUpdateCounter()
  const sceneHour = useSceneHour()
  const layout = outingMapUnderlayLayoutOf(hour ?? sceneHour)
  const selectedPlace = OUTING_PLACES[selected]
  const selectedLabel = layout.labels[selected]
  const cursorStep = animationStepAt(animations?.[CURSOR_ANIMATION] ?? [], update)

  return (
    <div
      data-testid="시즌-외출지도"
      data-selected={selected}
      style={{ position: 'absolute', left: 0, top: 0, width: 240, height: 320, background: '#000', overflow: 'hidden', pointerEvents: 'none' }}
    >
      <ComposedScreen
        testId="시즌-외출지도-합성"
        ops={outingMapComposeOps({
          origins,
          mapX: layout.mapX,
          mapY: layout.mapY,
          selected,
          isNight: layout.isNight,
          labelOf: (index) =>
            hidesNames
              ? []
              : [{ kind: 'image', src: mapLabelSrc(layout.labels[index].frame), x: layout.labels[index].left, y: layout.labels[index].top }],
        })}
      />
      {placeHighlightOf(selectedPlace, origins, layout)}
      {labelHighlightOf(selectedPlace, selectedLabel, labelOrigins)}
      {placeCursorOf(selectedPlace, cursorStep, origins, layout)}
    </div>
  )
}

type Place = (typeof OUTING_PLACES)[number]
type Origins = ReturnType<typeof useFrameOrigins>
type MapLayout = ReturnType<typeof outingMapUnderlayLayoutOf>

/** 고른 건물 — 네 방향 흰 테두리 뒤 그 건물 */
function placeHighlightOf(place: Place | undefined, origins: Origins, layout: MapLayout) {
  if (place === undefined) return null
  return (
    <>
      {FOUR_WAYS.map(([dx, dy]) => (
        <SolidStamp
          key={`${dx},${dy}`}
          folder={MAP_FRAMES}
          frame={place.frame}
          origins={origins}
          x={layout.mapX + dx}
          y={layout.mapY + dy}
          color="#FFFFFF"
        />
      ))}
      <FrameSprite folder={MAP_FRAMES} frame={place.frame} origins={origins} x={layout.mapX} y={layout.mapY} />
    </>
  )
}

/** 고른 건물 이름 — 이름 그림(map_label_*)은 1px 테두리를 둘러 글자보다 1px 왼쪽 위에서 시작한다(글자 자리는 +1). 여덟 방향 노랑 뒤 검정 */
function labelHighlightOf(place: Place | undefined, label: MapLayout['labels'][number] | undefined, labelOrigins: Origins) {
  if (place === undefined || label === undefined) return null
  return (
    <>
      {EIGHT_WAYS.map(([dx, dy]) => (
        <SolidStamp
          key={`label${dx},${dy}`}
          folder={PLACE_LABEL_FRAMES}
          frame={place.labelFrame}
          origins={labelOrigins}
          x={label.left + 1 + dx}
          y={label.top + 1 + dy}
          color="#FFFF00"
        />
      ))}
      <SolidStamp folder={PLACE_LABEL_FRAMES} frame={place.labelFrame} origins={labelOrigins} x={label.left + 1} y={label.top + 1} color="#000000" />
    </>
  )
}

/** 고른 건물 위 커서 애니 */
function placeCursorOf(place: Place | undefined, cursorStep: ReturnType<typeof animationStepAt>, origins: Origins, layout: MapLayout) {
  if (place === undefined || cursorStep === null) return null
  return (
    <FrameSprite
      folder={MAP_FRAMES}
      frame={cursorStep.frame}
      origins={origins}
      x={layout.mapX + place.cursorBox.x + Math.trunc(place.cursorBox.width / 2) + cursorStep.dx}
      y={layout.mapY + place.cursorBox.y + cursorStep.dy}
    />
  )
}

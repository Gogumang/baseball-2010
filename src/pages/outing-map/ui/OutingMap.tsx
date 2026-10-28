import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'
import { CURSOR_ANIMATION, EVENT_MARKER_ANIMATION, MAP_FRAMES, OUTING_PLACES, PLACE_LABEL_FRAMES } from '@/shared/config/outingPlaces'
import type { MapBox, OutingPlace } from '@/shared/config/outingPlaces'
import { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import { Fragment } from 'react'
import type { ReactNode } from 'react'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { ComposedScreen, FrameSprite, PressArea, SolidStamp } from '@/shared/ui'
import * as styles from '@/pages/outing-map/ui/OutingMapScreen.css'
import { placeLabelTopLeftOf } from '@/pages/outing-map/lib/placeLabelPosition'
import { backgroundFrameOf } from '@/pages/management/lib/managementLayout'
import { outingMapComposeOps } from '@/pages/management/lib/outingMapUnderlay'
import { frameComposeOps } from '@/shared/lib/pixelEffect/screenCompose'
import { useSceneHour } from '@/shared/lib/phoneClock/phoneClock'

/**
 * [!] 표시 기준점 (0x7ed6c, F-2 2-6 확정) — `mapX + bx + (bw >> 1)`, `mapY + by`.
 * 앞서 웹은 y 를 15px 더 내려 잡고 있었다. 애니 2 프레임 11 의 원점이 (−5,−15) 라
 * 원본대로면 [!] 가 박스 **위로** 15px 올라간다.
 */
const markerAnchorOf = (box: MapBox) => ({ x: box.x + (box.width >> 1), y: box.y + styles.MAP_TOP })
/**
 * 선택 화살표 기준점 (0x7ecfc, F-2 2-5 확정) — `mapX + bx + (bw / 2)`, `mapY + by`.
 * 애니 0 은 dx −11 · dy −7→−3 으로 까딱인다. 앞서 웹은 2px 오른쪽·7px 아래였다.
 */
const cursorAnchorOf = (box: MapBox) => ({ x: box.x + Math.trunc(box.width / 2), y: box.y + styles.MAP_TOP })

/** ⚠️ 웹 자리: 취소 — 오른쪽 소프트키 글자 자리 (W − 41 − 1, H − 12 − 1), 타석 "#TIME" 과 같은 자리 */
const OUTING_CANCEL_PRESS_RECT = { x: 198, y: 307, width: 41, height: 12 } as const

/** 고른 건물 테두리 0x7ec44~0x7ecb0 — 찍는 차례 (x−1, y) · (x, y−1) · (x+1, y) · (x, y+1) 과 색 RGB(255,255,255) */
const SELECTED_OUTLINE_WAYS: readonly (readonly [number, number])[] = [
  [-1, 0],
  [0, -1],
  [1, 0],
  [0, 1],
]
const SELECTED_OUTLINE_COLOR = '#FFFFFF'
/** 시간대 2(밤) — 0xb8fbd 의 20~5시 */
const NIGHT_TIME_SLOT = 2

interface OutingMapProps {
  readonly selectedPlaceId: string
  readonly eventPlaceIds: ReadonlySet<string>
  readonly onOpen: (place: OutingPlace) => void
  readonly onBack: () => void
  /** 지도 위에 얹을 것 — 장소 기능 말풍선 (F-2 2-7) */
  readonly children?: ReactNode
  /**
   * 시간대 [gfx+0x1c] 를 고를 휴대폰 시각 — 나리 상태 100 진입 0x1c154 끝(0x1c418~0x1c424)이 `0x7b934(gfx, 0xb8fbd())` 로 세운다
   * (0xb8fbd: 휴대폰 시계 0x6f391 의 한국 시각, 6~15 → 0 · 16~19 → 1 · 그 밖 → 2). 안 주면 장면에 들어설 때 잡은 시각(`useSceneHour`).
   */
  readonly hour?: number
}

/** 원작 외출 지도 — event_map 프레임 그대로 (건물·이름·[!]·선택 화살표) */
export function OutingMap({ selectedPlaceId, eventPlaceIds, onOpen, onBack, children, hour }: OutingMapProps) {
  const origins = useFrameOrigins(MAP_FRAMES)
  const labelOrigins = useFrameOrigins(PLACE_LABEL_FRAMES)
  const animations = useAnimations(MAP_FRAMES)
  const update = useUpdateCounter()
  const sceneHour = useSceneHour()
  const isNight = backgroundFrameOf(hour ?? sceneHour) === NIGHT_TIME_SLOT
  const selectedIndex = OUTING_PLACES.findIndex((place) => place.id === selectedPlaceId)
  const composeOps = outingMapComposeOps({
    origins,
    mapX: 0,
    mapY: styles.MAP_TOP,
    selected: selectedIndex,
    isNight,
    labelOf: (index) => {
      const place = OUTING_PLACES[index]
      const label = labelOrigins?.[String(place.labelFrame).padStart(3, '0')]
      if (label === undefined) return []
      const at = placeLabelTopLeftOf(place.nameBox, label.width, label.height)
      return frameComposeOps(PLACE_LABEL_FRAMES, place.labelFrame, labelOrigins, at.x, at.y)
    },
  })

  const animated = (animation: number, anchor: { x: number; y: number }, key: string) => {
    const step = animationStepAt(animations?.[animation] ?? [], update)
    if (step === null) return null
    return <FrameSprite key={key} folder={MAP_FRAMES} frame={step.frame} origins={origins} x={anchor.x + step.dx} y={anchor.y + step.dy} />
  }

  return (
    <RawScreen>
      {/*
        0x7ea7e~0x7ec00 — 지도 · 고르지 않은 건물(효과 1·인자 7 반투명 겹치기 0x9a449, R6 3a 확정)과 그 이름 · 밤 덮개를 원본 식 그대로
        한 캔버스로 합성한다(`outingMapComposeOps`). 밤: 시간대 [gfx+0x1c] == 2 이면 화면 전체를 [0x15605d4] 단계 9 로 덮고(검정 몸통
        0x9aac4 — 9/16 남김) 프레임 6(창문 불빛)을 지도 원점에 얹는다 (F-2 2-3 확정). 고른 건물은 밤 덮개 뒤에 그린다
      */}
      <ComposedScreen testId="외출지도-합성" ops={composeOps} />
      {OUTING_PLACES.filter((place) => place.id !== selectedPlaceId).map((place) => (
        <PlaceArt key={place.id} place={place} origins={origins} labelOrigins={labelOrigins} isSelected={false} onOpen={onOpen} />
      ))}

      {/*
        0x7ec04~0x7ecf8 — 고른 건물 · 이름은 덮개 뒤에 그려 밝게 남는다. 건물은 프레임 sel+1 을 효과 0xb(단색) · RGB(255,255,255) 로
        (x−1, y) (x, y−1) (x+1, y) (x, y+1) 네 번 찍어 흰 1px 테두리를 두르고(0x7ec44~0x7ecb0) 그 위에 보통으로 그린다(0x7ecc0).
        그다음 선택 화살표(0x7ecfc) · [!](0x7ed6c)
      */}
      {OUTING_PLACES.filter((place) => place.id === selectedPlaceId).map((place) => (
        <Fragment key={place.id}>
          {SELECTED_OUTLINE_WAYS.map(([dx, dy]) => (
            <SolidStamp
              key={`${dx},${dy}`}
              folder={MAP_FRAMES}
              frame={place.frame}
              origins={origins}
              x={dx}
              y={styles.MAP_TOP + dy}
              color={SELECTED_OUTLINE_COLOR}
            />
          ))}
          <PlaceArt place={place} origins={origins} labelOrigins={labelOrigins} isSelected onOpen={onOpen} />
        </Fragment>
      ))}
      {OUTING_PLACES.map((place) =>
        place.id === selectedPlaceId ? animated(CURSOR_ANIMATION, cursorAnchorOf(place.cursorBox), `${place.id}-cursor`) : null,
      )}
      {OUTING_PLACES.map((place) =>
        eventPlaceIds.has(place.id) ? animated(EVENT_MARKER_ANIMATION, markerAnchorOf(place.markerBox), `${place.id}-event`) : null,
      )}

      {/*
        ⚠️ 웹 자리: 취소(CLR → 105, 키 0x13ba4) — 112 그리기 0x16854 는 지도 0x7ea64 만 그려 머리띠 · 바닥띠 · 소프트키 글자가 없다.
        웹 [‹ 관리] 단추와 "건물을 누르세요" 안내 글을 걷고, 지도 아래 오른쪽 소프트키 자리(198, 307, 41×12)를 투명 누름 칸으로 빌린다
      */}
      <PressArea label="취소" rect={OUTING_CANCEL_PRESS_RECT} onPress={onBack} />
      {children}
    </RawScreen>
  )
}

/**
 * 건물 한 채의 누름 칸과(고른 건물이면) 그림 · 이름 — 고르지 않은 건물 · 이름은 합성 캔버스(`outingMapComposeOps`)가 그리고
 * 여기는 투명 누름 칸만 둔다. 이름은 박스에 mapY 를 안 더한다 (F-2 2-4 확정)
 */
function PlaceArt({
  place,
  origins,
  labelOrigins,
  isSelected,
  onOpen,
}: {
  readonly place: OutingPlace
  readonly origins: ReturnType<typeof useFrameOrigins>
  readonly labelOrigins: ReturnType<typeof useFrameOrigins>
  readonly isSelected: boolean
  readonly onOpen: (place: OutingPlace) => void
}) {
  const frameOrigin = origins?.[String(place.frame).padStart(3, '0')]
  const label = labelOrigins?.[String(place.labelFrame).padStart(3, '0')]
  return (
    <>
      {frameOrigin !== undefined && (
        <button
          type="button"
          className={styles.placeButton}
          aria-label={place.name}
          style={{ left: frameOrigin.x, top: frameOrigin.y + styles.MAP_TOP, width: frameOrigin.width, height: frameOrigin.height }}
          onClick={() => onOpen(place)}
        >
          {isSelected && (
            <img className={styles.sprite} style={{ left: 0, top: 0 }} src={`${MAP_FRAMES}/${String(place.frame).padStart(3, '0')}.png`} alt="" />
          )}
        </button>
      )}
      {isSelected && label !== undefined && (
        <FrameSprite
          folder={PLACE_LABEL_FRAMES}
          frame={place.labelFrame}
          origins={labelOrigins}
          {...placeLabelTopLeftOf(place.nameBox, label.width, label.height)}
        />
      )}
    </>
  )
}

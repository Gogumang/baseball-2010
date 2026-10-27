import { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { ComposedScreen, FrameSprite } from '@/shared/ui'
import { EVENT_MARKER_ANIMATION, MAP_FRAMES } from '@/shared/config/outingPlaces'
import { mapLabelSrc, outingMapComposeOps, outingMapUnderlayLayoutOf } from '@/pages/management/lib/outingMapUnderlay'
import { useSceneHour } from '@/shared/lib/phoneClock/phoneClock'

export interface OutingMapUnderlayProps {
  /** [!] 칸 [gfx+0x9c] — 지도 진입 0x118e4 → 0x8cdc0 이 채운 장소들 */
  readonly eventPlaceIds: ReadonlySet<string>
  /** 시간대 [gfx+0x1c](0x7b934 ← 0xb8fbd) 를 고를 한국 시각 — 안 주면 장면에 들어설 때 잡은 시각(`useSceneHour`) */
  readonly hour?: number
}

/**
 * 이벤트 대화창 0x8b5ac 의 지도 갈래 — [gfx+0x174] ∈ {0x70, 0x71}(112 외출 지도 · 113 장소 · 140 대결 결과 뒤)이면
 * 공 무늬 · 상태판 · 머리띠 없이 **`0x7ea64(gfx, −1, 0)`** 하나만 그린다 (0x8b5d4~0x8b5e6 직접 떴다).
 * 고른 칸 −1 · 이름숨김 0 이라 0x7ea64 는 (직접 떴다):
 * ```
 * 0x7ea7e  화면 RGB(0,0,0) · 0x7e9b0(gfx, 0) 지도 프레임 0
 * 0x7eae0  sel = −1 → 프레임 0 을 (mapX, mapY) = (0, 11) 에 한 번 더
 * 0x7eb0a  프레임 1~5(건물) 효과 0 — sel = −1 이라 반투명(효과 1·7)도 흰 테두리도 없다
 * 0x7eb66  이름 0x7e300(img_text 0xd47a6[i], 박스 0, 테두리 RGB(0,0,0) · 글 RGB(255,255,255), 정렬 0x22) — 박스에 mapY 를 안 더한다
 * 0x7eba2  시간대 2 면 화면 전체 [0x15605d4] 단계 9(검정 몸통 — 9/16 남김) 뒤 프레임 6(창문 불빛)
 * 0x7ec04  sel = −1 → 선택 화살표(애니 0) 건너뜀
 * 0x7ed6c  [gfx+0x9c+2i] ≠ 0 인 장소마다 박스 2 기준 애니 2([!]) — (mapX + bx + bw>>1, mapY + by)
 * 0x7ee1a  말풍선은 [gfx+0x174] == 0x71(또는 0xd2) && [gfx+0xea] == 0 일 때만 — 대화창이 0x7fad0 으로 [gfx+0xea] 를
 *          틱마다 +15(55 까지) 올리므로 이벤트 중에는 서지 않는다.
 * ```
 * 대화창이 막 열린 첫 틀([gfx+0xea] = 0)에 0x71 이면 sel + 1 = 프레임 0 의 박스 3 으로 말풍선을 한 번 그린다(0x7ee36~0x7ee54).
 * event_map.pzx 프레임 0 은 **박스가 0개**(머리 `01 00`)다. 적재기를 떠 보면(r309) 박스 읽기는 정해진 값이다 — 프레임 읽기 0xc728c 가
 * 박스 수 바이트를 [sp+0x4c] 에 싣고 0xc7180(c71cc~c720c)이 박스 수가 0 이면 공장 0xc78f0(인자 0)으로 박스 없는 0x18 바이트 프레임
 * (생성 0x943a8, vt 0xd57c0)을 만든다. 그 vt+0xc 0x94ae0 이 0 이라 0x94a64 는 0x94fe1 을 안 부르고 (0, 0, 0, 0) 을 돌려준다
 * (박스 배열 0xc77b0 의 할당 0x1400498 은 박스 수 > 0 일 때만). 그래서 말풍선 바탕은 0×0, 칸은 (x + 4, y + 4, −8, −6) 이 된다 —
 * 그 그림은 둥근 칠 0x6b7d4 · 테두리 0x6a979 · 글 줄바꿈 0x9c52d 가 음수 · 0 크기를 단말 그리기 표(0x14006e8 칠 · 0x14006c8 선)와
 * 글꼴에 그대로 넘겨 단말이 정한다(C — 원본 근거 없음). 웹은 그 한 틀을 그리지 않는다.
 * [!] 칸은 원본이 112 진입(0x118e4 — 140 대결결과 길은 105 진입이 다시 부른다) 때 한 번 채운 값이다. 세션이 그때 찍은
 * 칸(`pages/outing-map/lib/outingPlaceSlots`)을 `eventPlaceIds` 로 넘겨 받는다.
 */
export function OutingMapUnderlay({ eventPlaceIds, hour }: OutingMapUnderlayProps) {
  const origins = useFrameOrigins(MAP_FRAMES)
  const animations = useAnimations(MAP_FRAMES)
  const update = useUpdateCounter()
  const sceneHour = useSceneHour()
  const layout = outingMapUnderlayLayoutOf(hour ?? sceneHour)
  const markerStep = animationStepAt(animations?.[EVENT_MARKER_ANIMATION] ?? [], update)
  return (
    <div data-testid="외출지도-밑그림" style={{ position: 'absolute', left: 0, top: 0, width: 240, height: 320, background: '#000', overflow: 'hidden', pointerEvents: 'none' }}>
      <ComposedScreen testId="외출지도-합성" ops={outingMapComposeOps({
        origins, mapX: layout.mapX, mapY: layout.mapY, selected: -1, isNight: layout.isNight,
        labelOf: (index) => [{ kind: 'image', src: mapLabelSrc(layout.labels[index].frame), x: layout.labels[index].left, y: layout.labels[index].top }],
      })} />
      {markerStep !== null && layout.markers
        .filter((marker) => eventPlaceIds.has(marker.placeId))
        .map((marker) => (
          <FrameSprite key={marker.placeId} folder={MAP_FRAMES} frame={markerStep.frame} origins={origins}
            x={marker.x + markerStep.dx} y={marker.y + markerStep.dy} />
        ))}
    </div>
  )
}

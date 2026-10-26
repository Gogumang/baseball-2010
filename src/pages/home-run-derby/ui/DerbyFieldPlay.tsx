import { DefenseScreen } from '@/pages/defense/ui/DefenseScreen'
import { DefenseDistanceBoard } from '@/pages/defense/ui/DefenseEffectsLayer'
import { screenOffsetOf } from '@/pages/defense/lib/defenseCamera'
import * as defenseStyles from '@/pages/defense/ui/DefenseScreen.css'
import {
  EVENT_ZONE_FRAMES,
  EVENT_ZONE_REWARD,
  EVENT_ZONE_TRANSLUCENT_LEVEL,
  eventZoneRewardFrameAt,
  isEventZoneTranslucentAt,
} from '@/entities/home-run-derby/model/eventZone'
import { derbyFieldFrameAt, derbyFieldViewOf, type DerbyFieldLook } from '@/pages/home-run-derby/lib/derbyField'
import type { DerbyFieldPlay as DerbyFieldPlayModel } from '@/pages/home-run-derby/model/useHomeRunDerby'
import { FrameSprite } from '@/shared/ui/FrameSprite/FrameSprite'
import { LayeredFrameSprite } from '@/shared/ui/LayeredFrameSprite/LayeredFrameSprite'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'

interface DerbyFieldPlayProps {
  readonly field: DerbyFieldPlayModel
  /** 판 틱 — 0x17 진입 그림이 0 (상태 틱 [장면+0x2c]) */
  readonly tick: number
  readonly look: DerbyFieldLook
  /** 이 판의 비거리 판 0x36cd4 숫자 — 표시 비거리 +0x36 */
  readonly distanceValue: number
  /** 존 보상 "200G" 의 x — 0x41098 4111c (`eventZoneRewardXOf`). 존이 안 서는 공이면 null */
  readonly rewardX: number | null
}

/**
 * **홈런더비 판(0x17)의 필드 화면** (A-01, r274) — 다른 모드의 수비 화면(`DefenseScreen`)과 같은 그리기에 모드 7 몫만 얹는다
 * (`lib/derbyField` 머리말). 타석 캔버스(`BattingStage` 의 `isFieldPlay`)는 이 위에서 HOMERUN 글자 · 파티클만 그린다.
 * ```
 * 0x41230 → 0x411e0  구장 0x78931 → 0x41098: event_zone 프레임 0 을 필드 오프셋에(모드 7 이면 늘) — 존이 서면(+0x17cc · +0x17d0 > 0)
 *                    t % 8 ≤ 3 인 그림은 효과 1 · 단계 5, 그리고 trainning 애니 3 "200G" 를 (x, 0x46) 에 그린 뒤 한 칸
 * 0x46c88            비거리 판 0x36cd4(46cb6 — 그리기 목록 앞) → 야수 · 공(그림자는 곧바로) → 작은 지도는 판 종류 8 이면 없다
 * ```
 */
export function DerbyFieldPlay({ field, tick, look, distanceValue, rewardX }: DerbyFieldPlayProps) {
  const frame = derbyFieldFrameAt(field.timeline, tick)
  const view = derbyFieldViewOf(field.input, field.timeline, tick, look)
  const offset = screenOffsetOf(frame.camera)
  const zone = field.timeline.zone
  // 존은 그 그림의 공 그리기(0x46c88 안)가 놓는다 — 같은 그림의 0x41098(0x41230 안, 그 앞)은 아직 못 본다
  const isZonePlaced = zone !== null && tick > zone.tick
  const zoneOrigins = useFrameOrigins(EVENT_ZONE_FRAMES)
  const rewardOrigins = useFrameOrigins(EVENT_ZONE_REWARD.folder)
  return (
    <DefenseScreen
      state={view}
      camera={frame.camera}
      isEmbedded
      hidesFieldMap
      overBackground={
        <>
          <div className={defenseStyles.actor} style={{ left: offset.x, top: offset.y }} data-testid="더비-이벤트존"
            data-placed={isZonePlaced ? 'true' : undefined}>
            <FrameSprite
              folder={EVENT_ZONE_FRAMES}
              frame={0}
              origins={zoneOrigins}
              x={0}
              y={0}
              // 효과 1 · 단계 5 — 그림 5/16 + 화면 11/16 (`EVENT_ZONE_TRANSLUCENT_LEVEL`)
              style={isZonePlaced && isEventZoneTranslucentAt(tick) ? { opacity: EVENT_ZONE_TRANSLUCENT_LEVEL / 16 } : undefined}
            />
          </div>
          {isZonePlaced && rewardX !== null && (
            <LayeredFrameSprite
              folder={EVENT_ZONE_REWARD.folder}
              frame={eventZoneRewardFrameAt(tick - zone.tick - 1)}
              origins={rewardOrigins}
              x={rewardX}
              y={EVENT_ZONE_REWARD.y}
            />
          )}
        </>
      }
      underActors={<DefenseDistanceBoard value={distanceValue} />}
    />
  )
}

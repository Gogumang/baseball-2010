import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import type { EventPortrait } from '@/shared/config/original/eventTypes'
import { placePortraits, portraitAnimationOf, portraitPaletteOf, slideX } from '@/widgets/event-portraits/lib/portraitSlots'
import type { PlacedPortrait } from '@/widgets/event-portraits/lib/portraitSlots'
import { useRecoloredSprite } from '@/shared/lib/sprite/paletteSwap'
import * as styles from '@/widgets/event-portraits/ui/EventPortraits.css'

const SCREEN_WIDTH = 240

interface EventPortraitsProps {
  readonly portraits: readonly EventPortrait[]
  /** 판 높이. 인물 원점(발밑)을 판 바닥에 맞춘다 — 원작 세로 위치는 부르는 코드 안이라 **추정**이다. */
  readonly height: number
  /**
   * 육성 선수 피부 (0 황인 · 1 백인 · 2 흑인) — 주인공 초상화를 `event_char_0.mpl` 로 다시 칠한다.
   * 안 넘기면 0 = PZX 기본 팔레트(황인) 그대로다.
   */
  readonly skinIndex?: number
  /** 육성 선수 배팅 타입 (0 타격형 · 1 장타형) — 장타형이면 주인공 애니가 **+8** 이다. */
  readonly battingTypeIndex?: number
}

/**
 * 원작 이벤트 초상화. 좌우 자리마다 PZX 애니메이션을 반복 재생하고, 새 인물은 미끄러져 들어온다.
 * 주인공은 피부 팔레트와 장타형 몸(+8)을 따라간다 (C-1 확정 — `portraitSlots.ts` 참고).
 *
 * 값은 `app/ui/CareerRoutes.tsx` → `StoryScreen` → 여기로 `career.skinIndex`·`career.battingTypeIndex`
 * 가 내려온다. 안 넘기는 자리(미션·이야기 밖 화면)만 기본값 황인·타격형으로 돈다.
 */
export function EventPortraits({ portraits, height, skinIndex = 0, battingTypeIndex = 0 }: EventPortraitsProps) {
  const placed = placePortraits(portraits, SCREEN_WIDTH)
  return (
    <div className={styles.stage} style={{ height }}>
      {placed.map((item) => (
        <PortraitSprite key={item.key} placed={item} baseline={height}
          skinIndex={skinIndex} battingTypeIndex={battingTypeIndex} />
      ))}
    </div>
  )
}

interface PortraitSpriteProps {
  readonly placed: PlacedPortrait
  readonly baseline: number
  readonly skinIndex: number
  readonly battingTypeIndex: number
}

function PortraitSprite({ placed, baseline, skinIndex, battingTypeIndex }: PortraitSpriteProps) {
  const folder = `./sprites/${placed.portrait.file}/frames`
  const origins = useFrameOrigins(folder)
  const animations = useAnimations(folder)
  const update = useUpdateClock()

  // 같은 자리에서 표정만 바뀌면 원작도 다시 들어오지 않는다 — 슬라이드는 자리 열쇠 기준이다.
  const slideStartRef = useRef(update)
  const slideUpdate = update - slideStartRef.current

  // 장타형 주인공은 애니 번호가 +8 이다 (0x63a70).
  const entries = animations?.[portraitAnimationOf(placed.portrait, battingTypeIndex)]
  const step = entries === undefined ? null : animationStepAt(entries, update)
  const key = step === null ? '' : String(step.frame).padStart(3, '0')
  // 빈 자리 프레임은 그림도 원점도 없다 — 원작도 아무것도 그리지 않는다.
  const origin = step === null ? undefined : origins?.[key]
  if (step === null || origin === undefined) return null

  const x = slideX(placed, slideUpdate, SCREEN_WIDTH) + origin.x + step.dx
  const y = baseline + origin.y + step.dy
  return (
    // 주인공이면 피부 .mpl 로 다시 칠한다 (`key` = 프레임 — 아래 주석 참고).
    <PaintedFrame key={key} url={`${folder}/${key}.png`} style={{ left: x, top: y }}
      palette={portraitPaletteOf(placed.portrait, skinIndex)} />
  )
}

/**
 * 칠한 그림 한 장.
 *
 * 프레임마다 **따로 마운트**해야 한다(`key` = 프레임 번호): `useRecoloredSprite` 는 칠한 주소를
 * 상태로 들고 있어서, 프레임이 바뀐 그 그리기 한 번은 **앞 프레임 주소**를 내보낸다.
 * 새로 마운트하면 처음 상태가 이번 프레임의 구운 주소라 엉뚱한 칸이 비칠 일이 없다.
 * ⚠️ 캔버스가 없거나(테스트의 jsdom) 아직 다 안 칠했으면 구운 그림을 그대로 쓴다 — 색만 한 박자 늦는다.
 */
function PaintedFrame({
  url, palette, style,
}: {
  readonly url: string
  readonly palette: number | null
  readonly style: CSSProperties
}) {
  return <img className={styles.sprite} style={style} src={useRecoloredSprite(url, palette)} alt="" />
}

/** 원작 갱신 횟수. 한 번 갱신 = millisecondsPerFrame(). */
function useUpdateClock(): number {
  const [update, setUpdate] = useState(0)
  useEffect(() => {
    const startedAt = performance.now()
    let handle = 0
    const tick = (now: number) => {
      setUpdate(Math.floor((now - startedAt) / millisecondsPerFrame()))
      handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(handle)
  }, [])
  return update
}

import { useEffect, useRef, useState } from 'react'
import { appTickNow, appTickOf } from '@/shared/lib/frameClock/frameClock'
import type { CSSProperties } from 'react'
import { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import type { EventPortrait } from '@/shared/config/original/eventTypes'
import { placePortraits, portraitAnimationOf, portraitPaletteOf, slideX } from '@/widgets/event-portraits/lib/portraitSlots'
import type { PlacedPortrait } from '@/widgets/event-portraits/lib/portraitSlots'
import { recolorRequestsOf, useRecoloredSprite, useWarmRecoloredSprites } from '@/shared/lib/sprite/paletteSwap'
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
  /**
   * 이 재생이 앞으로 띄울 수 있는 초상화(대본이 적어 둔 인물 · 표정) — 다시 칠하는 것(주인공 피부)의 표정 애니 칸 전부를 미리 칠한다.
   * 표정이 바뀌는 그림부터 칠한 색이 나오게 (원본은 그림 객체 적재 때 팔레트를 갈아 끼워 표정이 바뀌어도 제 색이다). 안 주면 지금 표정만
   */
  readonly upcomingPortraits?: readonly EventPortrait[]
}

/**
 * 원작 이벤트 초상화. 좌우 자리마다 PZX 애니메이션을 반복 재생하고, 새 인물은 미끄러져 들어온다.
 * 주인공은 피부 팔레트와 장타형 몸(+8)을 따라간다 (C-1 확정 — `portraitSlots.ts` 참고).
 *
 * 값은 `app/ui/CareerRoutes.tsx` → `StoryScreen` → 여기로 `career.skinIndex`·`career.battingTypeIndex`
 * 가 내려온다. 안 넘기는 자리(미션·이야기 밖 화면)만 기본값 황인·타격형으로 돈다.
 */
export function EventPortraits({ portraits, height, skinIndex = 0, battingTypeIndex = 0, upcomingPortraits = [] }: EventPortraitsProps) {
  const placed = placePortraits(portraits, SCREEN_WIDTH)
  useWarmPortraitExpressions(upcomingPortraits, skinIndex, battingTypeIndex)
  return (
    <div className={styles.stage} style={{ height }}>
      {placed.map((item) => (
        <PortraitSprite key={item.key} placed={item} baseline={height}
          skinIndex={skinIndex} battingTypeIndex={battingTypeIndex} />
      ))}
    </div>
  )
}

/** 다시 칠하는 초상화가 쓰는 폴더 — 팔레트가 붙는 것은 주인공(event_char_0)뿐이다 (`portraitPaletteOf`) */
const HERO_FOLDER = './sprites/event_char_0/frames'

/**
 * 앞으로 띄울 초상화 중 다시 칠하는 것(벌이 있는 것)의 표정 애니 칸 전부를 미리 칠한다 — 애니 번호는 화면에서 그리는 것과 같은
 * `portraitAnimationOf`(장타형 +8), 벌은 `portraitPaletteOf` 다
 */
function useWarmPortraitExpressions(portraits: readonly EventPortrait[], skinIndex: number, battingTypeIndex: number): void {
  const animations = useAnimations(HERO_FOLDER)
  const requests = portraits.flatMap((portrait) => {
    const palette = portraitPaletteOf(portrait, skinIndex)
    if (palette === null || `./sprites/${portrait.file}/frames` !== HERO_FOLDER) return []
    const entries = animations?.[portraitAnimationOf(portrait, battingTypeIndex)] ?? []
    return recolorRequestsOf(HERO_FOLDER, entries.map((entry) => entry.frame), palette)
  })
  useWarmRecoloredSprites(requests)
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
  const palette = portraitPaletteOf(placed.portrait, skinIndex)
  // 이 애니의 칸 전부를 미리 칠한다 — 넘어가는 칸마다 구운 벌이 한 박자 비치지 않게 (원본은 적재 때 팔레트를 갈아 끼운다)
  useWarmRecoloredSprites(recolorRequestsOf(folder, (entries ?? []).map((entry) => entry.frame), palette))
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
      palette={palette} />
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

/** 원작 갱신 횟수 — 켠 앱 틱부터 센다(`appTickOf`, 한 틱 = millisecondsPerFrame()). */
function useUpdateClock(): number {
  const [update, setUpdate] = useState(0)
  useEffect(() => {
    const startTick = appTickNow()
    let handle = 0
    const tick = (now: number) => {
      setUpdate(Math.max(0, appTickOf(now) - startTick))
      handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(handle)
  }, [])
  return update
}

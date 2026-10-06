import { useEffect, useRef } from 'react'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import type { AnimationEntry } from '@/shared/lib/sprite/useFrameOrigins'
import {
  BALL_PATTERN_BACKDROP, MAIN_TITLE_BACKDROP, SKIN_SCREEN, ballPatternCounterAfter, ballPatternTilesOf, mainTitleLineYs,
} from '@/pages/special/lib/skinBackdrops'
import * as styles from '@/pages/special/ui/SpecialScreen.css'

const MAIN_TITLE = './sprites/main_title'
const GPOINT_FRAMES = './sprites/gpoint/frames'
const pad = (index: number) => String(index).padStart(3, '0')

/** 명예의 전당 목록을 쓰는 화면의 바탕 — 메뉴 바탕 0x58371 · 공 무늬 0x5fd61 (`lib/skinBackdrops.ts`) */
export type SkinBackdropKind = '메뉴바탕' | '공무늬'

export function SkinBackdrop({ kind }: { readonly kind: SkinBackdropKind }) {
  return kind === '메뉴바탕' ? <MainTitleBackdrop /> : <BallPatternBackdrop />
}

/** 0x58371 — 메인 메뉴에 들어올 때 떠 둔 버퍼(흰 바탕 · 프레임 13 · 이미지 7 · 3줄 선 · 흰 단계 3)를 그대로 찍는다 */
function MainTitleBackdrop() {
  const { width, height } = SKIN_SCREEN
  return (
    <div className={styles.skinBackdrop} data-testid="바탕-메뉴" style={{ width, height, background: '#fff' }}>
      <img className={styles.sprite} alt="" src={`${MAIN_TITLE}/frames/${pad(MAIN_TITLE_BACKDROP.frame)}.png`}
        style={{ left: 0, top: 0 }} />
      <img className={styles.sprite} alt="" src={`${MAIN_TITLE}/${pad(MAIN_TITLE_BACKDROP.badgeImage)}.png`}
        style={{ left: MAIN_TITLE_BACKDROP.badgeX, top: MAIN_TITLE_BACKDROP.badgeY }} />
      <svg className={styles.sprite} style={{ left: 0, top: 0 }} width={width} height={height}
        viewBox={`0 0 ${width} ${height}`} shapeRendering="crispEdges">
        {mainTitleLineYs().map((y) => (
          <rect key={y} x={0} y={y} width={width} height={1} fill="#000" fillOpacity={MAIN_TITLE_BACKDROP.lineOpacity} />
        ))}
        <rect x={0} y={0} width={width} height={height} fill="#fff" fillOpacity={MAIN_TITLE_BACKDROP.whitenOpacity} />
      </svg>
    </div>
  )
}

/**
 * gpoint 애니 0 — 프레임 0~5 · 지연 3 (public/sprites/gpoint/frames/animations.json 그대로, 테스트가 맞춰 본다).
 * ⚠️ 이 애니 객체를 0x5fd61 말고 다른 곳도 진행시키는지는 다 훑지 않았다 — 웹은 이 바탕을 그린 수로만 센다.
 */
export const GPOINT_ANIMATION: readonly AnimationEntry[] = [0, 1, 2, 3, 4, 5].map((frame) => ({ frame, delay: 3 }))

/**
 * 공 무늬를 그린 수 — [skin+0x414] 와 gpoint 애니 진행이 둘 다 스킨(앱에 하나)에 있어 화면을 건너 이어진다.
 * 0 으로 놓는 곳은 스킨을 만들 때(0x5390c) 뿐이다.
 */
const ballPatternDraws = { value: 0 }
/** 앱을 새로 띄운 것과 같다 — 테스트용 */
export const resetBallPatternDraws = () => {
  ballPatternDraws.value = 0
}

/** 0x5fd61 — 하늘색 위에 공 아이콘이 엇갈린 격자로 오른쪽 아래로 흐른다. 그린 **뒤** 카운터·애니를 한 번 진행한다 */
function BallPatternBackdrop() {
  const tick = useUpdateCounter()
  const lastDrawnTick = useRef(tick - 1)
  useEffect(() => {
    ballPatternDraws.value += Math.max(0, tick - lastDrawnTick.current)
    lastDrawnTick.current = tick
  }, [tick])
  // 건너뛴 갱신도 원본에선 한 번씩 그렸다 — 그만큼 앞당겨 센다
  const draws = ballPatternDraws.value + Math.max(0, tick - lastDrawnTick.current - 1)
  const counter = ballPatternCounterAfter(draws)
  const frame = animationStepAt(GPOINT_ANIMATION, draws)?.frame ?? 0
  const { width, height } = SKIN_SCREEN
  return (
    <div className={styles.skinBackdrop} data-testid="바탕-공무늬" data-counter={counter}
      style={{ width, height, background: BALL_PATTERN_BACKDROP.color }}>
      {ballPatternTilesOf(counter).map((tile, index) => (
        <img key={index} className={styles.sprite} alt="" src={`${GPOINT_FRAMES}/${pad(frame)}.png`}
          style={{ left: tile.x, top: tile.y }} />
      ))}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { MarkupText } from '@/shared/ui'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import { gameSceneNow, gameSceneTimeOf, useMarksGameScene } from '@/shared/lib/commonWindow/commonWindow'
import * as styles from '@/widgets/loading-tip/ui/LoadingTip.css'

/**
 * 원작 로딩 화면 — ui/loadingbar.pzx.
 *   프레임 0: "TIP:" 상자(170×147) + "DATA LOADING", 안쪽 칸 (7,16)~(162,87) 에 StrTIP 을 쓴다
 *   애니메이션 0: 프레임 1~4 달리는 선수
 * 상자를 화면 가운데 두는 것, 선수가 상자 아래 띠를 왼쪽→오른쪽으로 달리는 것,
 * 로딩 길이(LOADING_UPDATES)는 **추정**이다 — 원본 좌표·시간은 binary.mod 안에 있다.
 *
 * **경기 장면 0x104 의 상태 7 · 9 · 8 이다** (2026-10-16 직접 떴다): 진입 표 0xd04bc[0](상태 7) → 0x52cf8 → 진입 0x39f88 이 판을 싣고,
 * 상태 7 갱신 0x3e340 · 9 0x3f584 · 8 0x48658 이 적재 한 단계마다 0x54128 → 0x53e04 로 판을 다시 그린다. 셋 다 경기 장면 프레임
 * 0x52c50 의 52cc6 게이트 **뒤**(진입 표 52cee · 갱신 표 0xd0530)라 공용 창이 서 있으면 적재 · 판 그리기가 같이 선다. 상태 7~9 는
 * 0x41230 을 안 부르고(52f28~52f32), 그리기 표 0xd05a0 은 상태 9 만 0x3e328(= 판 그리기 0x53e04)이다 — 이것도 52efe 게이트 안이다. 그래서 이 판도 경기 장면으로 센다(`useMarksGameScene` — 창이 줄임
 * 없이 닫히고 [창+0x24f]) 진행은 경기 장면 시계로 잰다. 쓰는 곳은 경기 · 미션 · 더비뿐이다(시즌 0x105 의 0x75fc 판은 웹에 없다).
 */
const FOLDER = './sprites/loadingbar/frames'
const RUNNER_ANIMATION = 0
export const LOADING_UPDATES = 30
const RUNNER_START_X = 20
const RUNNER_END_X = 150
const RUNNER_FOOT_Y = 112

interface LoadingTipProps {
  readonly tip: string
  readonly onDone: () => void
}

export function LoadingTip({ tip, onDone }: LoadingTipProps) {
  const origins = useFrameOrigins(FOLDER)
  const animations = useAnimations(FOLDER)
  const [update, setUpdate] = useState(0)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useMarksGameScene()

  useEffect(() => {
    const startedAt = gameSceneNow()
    let handle = 0
    const tick = (now: number) => {
      const current = Math.floor((gameSceneTimeOf(now) - startedAt) / millisecondsPerFrame())
      setUpdate(current)
      if (current >= LOADING_UPDATES) {
        onDoneRef.current()
        return
      }
      handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(handle)
  }, [])

  const step = animationStepAt(animations?.[RUNNER_ANIMATION] ?? [], update)
  const frameKey = step === null ? null : String(step.frame).padStart(3, '0')
  const origin = frameKey === null ? undefined : origins?.[frameKey]
  const progress = Math.min(1, update / LOADING_UPDATES)
  const runnerX = RUNNER_START_X + (RUNNER_END_X - RUNNER_START_X) * progress

  return (
    <div className={styles.overlay} role="status" aria-label="로딩 중">
      <div className={styles.box}>
        <img className={styles.sprite} src={`${FOLDER}/000.png`} alt="" />
        <div className={styles.tipArea}>
          <MarkupText raw={tip} />
        </div>
        {origin !== undefined && frameKey !== null && (
          <img
            className={styles.sprite}
            style={{ left: runnerX + origin.x, top: RUNNER_FOOT_Y + origin.y }}
            src={`${FOLDER}/${frameKey}.png`}
            alt=""
          />
        )}
      </div>
    </div>
  )
}

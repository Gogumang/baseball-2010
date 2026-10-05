import { useEffect, useRef, useState } from 'react'
import { Button, RawScreen } from '@/shared/ui'
import { activeSound } from '@/shared/api/audio/soundPort'
import {
  BENCH_CLEARING_SOUND,
  BENCH_CLEARING_TARGET_TICK,
  BENCH_CLEARING_TRANSITION_MS,
  BENCH_CLEARING_TRANSITION_TICK,
} from '@/features/play-game/model/benchClearingScene'
import { isOkKey, useSceneTick } from '@/widgets/game-scene/model/useSceneTick'
import * as styles from '@/widgets/game-scene/ui/GameScene.css'

interface BenchClearingSceneProps {
  /**
   * 연출이 끝났다 — 출구 0xae24c. `reachedTargetTick` = 틱 10 의 갱신(수비 목표 굴림 8 번)이 돌았는가.
   * 진행기 `resolveBenchClearing` 이 그 굴림을 대신 낸다.
   */
  readonly onDone: (reachedTargetTick: boolean) => void
}

/**
 * **벤치 클리어링 연출** — 경기 장면 상태 0x1e (`features/play-game/model/benchClearingScene` 머리말).
 *
 * - 진입: 소리 44 (0x3aba4, loop 0). 진입 굴림 45 번은 진행기가 이미 썼다.
 * - 틱 10: 수비 8명 목표 굴림 — 화면은 "돌았다" 만 기억해 끝날 때 알린다(굴림은 진행기가).
 * - 틱 100: 화면 전환 0xbdae8(…, 7, 0, 5, 1500) → 전환이 끝나면 소리 멈춤(0x6e418) 뒤 나간다.
 * - OK(−5)·'5'(0x40628): 소리 멈춤 · 입자 지움 · 같은 출구 — 건너뛰기. 웹은 Enter·Space 도 받는다.
 *
 * ⚠️ 미해결 — 그림(0x43228): 수비 배경 0x411e0 위에 수비 9명(+0x111c)·공격 9명(+0x1758, 마선수면 +0x177c 그림)이
 *    더그아웃 표 0xcfaf8 에서 투수판 0xcfa8c 로 몰려나오는 모습은, 세계 좌표 → 화면 투영과 선수 동작 그림을
 *    이 화면에 옮기지 않아 그리지 않는다. 웹은 글자(웹 전용)만 둔다.
 * ⚠️ 전환 길이 1500 은 0xbdae8 의 마지막 인자다 — 단위(ms)는 유력. 원본은 전환 객체가 끝났다고 할 때 나간다.
 * ⚠️ 0x6e418 은 울리는 소리를 가리지 않고 끊는다 — 웹 소리 통로에는 그 함수가 없어 `stopBgm` 으로 갈음한다.
 */
export function BenchClearingScene({ onDone }: BenchClearingSceneProps) {
  const reachedRef = useRef(false)
  const doneRef = useRef(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const [isTransitioning, setTransitioning] = useState(false)
  const audio = activeSound()

  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    audio.stopBgm()
    onDoneRef.current(reachedRef.current)
  }

  useSceneTick((tick) => {
    if (tick === BENCH_CLEARING_TARGET_TICK) reachedRef.current = true
    if (tick === BENCH_CLEARING_TRANSITION_TICK) setTransitioning(true)
  }, !isTransitioning)

  // 진입 꼬리 0x3aba4 — 0x6e498(음, 0x2c, 0)
  useEffect(() => {
    audio.play(BENCH_CLEARING_SOUND)
    // 진입 한 번 — 다시 내지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isTransitioning) return
    const handle = window.setTimeout(finish, BENCH_CLEARING_TRANSITION_MS)
    return () => window.clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTransitioning])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || !isOkKey(event.key)) return
      event.preventDefault()
      finish()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <RawScreen>
      <div className={styles.webCaption} style={isTransitioning ? { opacity: 0.4 } : undefined}>
        벤치 클리어링
      </div>
      <Button variant="corner" className={styles.okButton} onClick={finish}>
        확인
      </Button>
    </RawScreen>
  )
}

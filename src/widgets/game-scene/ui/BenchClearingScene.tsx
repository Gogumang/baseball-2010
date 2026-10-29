import { type MutableRefObject, useCallback, useEffect, useRef, useState } from 'react'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'
import { RawScreen } from '@/shared/ui'
import { activeSound } from '@/shared/api/audio/soundPort'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { BENCH_CLEARING_SOUND, BENCH_CLEARING_TARGET_TICK, rollBenchClearingTargets } from '@/features/play-game/model/benchClearingScene'
import { isOkKey, useSceneTick } from '@/widgets/game-scene/model/useSceneTick'
import { clearSceneParticles, holdSceneParticleTicks } from '@/entities/particle/model/sceneParticleManager'
import { OkTapArea } from '@/widgets/game-scene/ui/OkTapArea'
import { useMarksGameScene } from '@/shared/lib/commonWindow/commonWindow'
import { useSceneKeyLatchOwner } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'
import {
  BENCH_CLEARING_EXIT_TICK,
  type BenchClearingField,
  type BenchClearingWalkState,
  benchClearingIrisOf,
} from '@/widgets/game-scene/ui/benchClearingScene/otherSlices'
import { BenchClearingFieldView } from '@/widgets/game-scene/ui/benchClearingScene/BenchClearingFieldView'
import { IrisCloseCanvas } from '@/widgets/game-scene/ui/benchClearingScene/IrisCloseCanvas'
import { rollHeldSceneParticleTick } from '@/widgets/game-scene/ui/benchClearingScene/heldParticleTick'
import { useBenchClearingWalk } from '@/widgets/game-scene/ui/benchClearingScene/useBenchClearingWalk'

interface BenchClearingSceneProps {
  /** 운동장 18명 — 안 주면 바탕을 안 그린다(검정) */
  readonly field?: BenchClearingField
  /**
   * 경기 난수 — 주면 틱 10 의 갱신(0x401d4)에서 이 화면이 수비 8명 목표 굴림 8 번을 낸다(그 값으로 수비가 마운드로 몰린다).
   * 안 주면 굴리지 않고 `onDone` 으로 알린다 — 부르는 쪽이 끝에서 굴린다(차례는 같다, 그림의 목표만 없다).
   */
  readonly random?: RandomPort
  /**
   * 연출이 끝났다 — 출구 0xae24c. `reachedTargetTick` = 틱 10 의 갱신이 돌았는데 **굴림 8 번을 아직 안 냈다**
   * (`random` 을 안 넘긴 경우) — 진행기 `resolveBenchClearing` 이 그 굴림을 대신 낸다. `random` 을 넘기면 늘 거짓이다.
   */
  readonly onDone: (reachedTargetTick: boolean) => void
  /**
   * 그린 틱의 18명 상태를 적어 두는 칸 — 연출이 끝나면 부르는 쪽이 수비 줄 자리를 다음 장면(교대 판)으로 넘긴다(`lib/fieldCarry`).
   * `onDone` 앞에 마지막 그림의 상태가 들어 있다
   */
  readonly walkStateRef?: MutableRefObject<BenchClearingWalkState | null>
}

/**
 * **벤치 클리어링 연출** — 경기 장면 상태 0x1e (`features/play-game/model/benchClearingScene` 머리말,
 * 운동장은 `widgets/field-walk/lib/benchClearingWalk`).
 *
 * - 진입: 소리 44 (0x3aba4, loop 0). 진입 굴림 45 번은 진행기가 이미 썼다(값은 `field.entryRolls`).
 * - 그리기 0x43228: 투수판에 맞춘 수비 운동장 위에 수비 9명(제자리 → 틱 10 에 마운드 둘레로) · 공격 9명(더그아웃 → 1루 · 3루 쪽 둘레,
 *   타자는 마운드로, 틱 60 에 더그아웃으로)을 그리기 목록 차례로. 글 · 효과음 없음.
 * - 틱 100: 화면 전환 종류 7(원 닫기, `benchClearingIrisOf`) — 단계 32 를 그린 다음 갱신(틱 133)에서 소리 멈춤(0x6e418) 뒤 나간다.
 *   그림은 0xbd5bc 그대로 — 화면 전체 검정에 지름 240/단계 원 구멍을 뚫는다(`lib/irisClose`, `IrisCloseCanvas`).
 * - OK(−5)·'5'(0x40628): 소리 멈춤 · 입자 지움 · 같은 출구 — 건너뛰기. 받은 다음 틀의 키 자리(갱신 앞)에서 돈다. 웹은 Enter·Space 도 받는다.
 *
 * 0x6e418 은 울리는 소리를 가리지 않고 끊는다(`SoundPort.stop`) — 44 가 아직 울리면 그것을 끊는다.
 * 화면을 누르는 투명 칸(`OkTapArea`)은 웹 전용이다(원본은 OK 키).
 */
export function BenchClearingScene({ field, random, onDone, walkStateRef }: BenchClearingSceneProps) {
  // 벤치 클리어링 0x1e도 경기 장면 0x104 의 한 상태다 — 이 판만 그리는 동안에도 장면 객체(+0xfd4 · 파티클 관리자)는 그대로다(새로 서는 것은
  // 장면 전환 0x3874 의 new 뿐). 공용 창이 줄임 없이 닫히고([창+0x24f]) 창이 떠 있으면 장면이 선다(52cc6)
  useMarksGameScene()
  const reachedRef = useRef(false)
  /** 틱 10 의 목표 굴림 — 고리 · 출구는 ref 를, 걸음 그림은 상태를 본다(같은 틱에 둘을 같이 적는다) */
  const targetRollsRef = useRef<readonly number[] | null>(null)
  const [targetRolls, setTargetRolls] = useState<readonly number[] | null>(null)
  const doneRef = useRef(false)
  const onDoneRef = useRef(onDone)
  useMirrorRef(onDoneRef, onDone)
  const randomRef = useRef(random)
  useMirrorRef(randomRef, random)

  const finish = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    // 0x40500(전환 끝) · 0x4063a(키 건너뛰기) — 0x6e418
    activeSound().stop()
    onDoneRef.current(reachedRef.current && targetRollsRef.current === null)
  }, [])

  /** 키 0x40628 — OK(−5) · '5': 소리 멈춤 0x6e418 · 파티클 +0x57 = 0 · 0x6dee4(4064c, 굴림 없음) 뒤 같은 출구 */
  const skip = useCallback(() => {
    if (doneRef.current) return
    clearSceneParticles()
    finish()
  }, [finish])

  /**
   * 받은 키 칸 — 키 0x40628 은 받은 다음 틀의 52da2~ 상태 키 자리(52de8)에서 갱신 표(52e14 — 틱 10 의 목표 굴림)보다 먼저 돈다
   * (`sceneKeyLatch`). 그래서 틱 10 머리에 처리된 건너뛰기는 목표 굴림 8 번을 안 낸다
   */
  const keyLatch = useSceneKeyLatchOwner()
  const tick = useSceneTick(
    (next) => {
      if (doneRef.current) return
      if (next === BENCH_CLEARING_TARGET_TICK) {
        reachedRef.current = true
        // 0x401d4 틱 10 — 수비 8명 목표 굴림 8 번
        if (randomRef.current !== undefined) {
          targetRollsRef.current = rollBenchClearingTargets(randomRef.current)
          setTargetRolls(targetRollsRef.current)
        }
      }
      if (next >= BENCH_CLEARING_EXIT_TICK) finish()
      rollHeldSceneParticleTick(randomRef.current)
    },
    true,
    false,
    keyLatch,
  )
  // 경기 난수를 받았으면 관리자 틱을 이 장면이 맡는다 — 그리기는 앱 층(`SceneParticleLayer`)이 그대로 한다
  const holdsParticleTicks = random !== undefined
  useEffect(() => (holdsParticleTicks ? holdSceneParticleTicks() : undefined), [holdsParticleTicks])

  // 진입 꼬리 0x3aba4 — 0x6e498(음, 0x2c, 0)
  useEffect(() => {
    activeSound().play(BENCH_CLEARING_SOUND)
    // 진입 한 번 — 다시 내지 않는다
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || !isOkKey(event.key)) return
      event.preventDefault()
      keyLatch.push(skip)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [keyLatch, skip])

  const walk = useBenchClearingWalk(field, tick, targetRolls)
  // 걸음이 있는 그림만 적는다(판 재료가 없는 그림은 앞 걸음 그대로)
  useMirrorRef(walk === null ? undefined : walkStateRef, walk)
  const iris = benchClearingIrisOf(tick)
  return (
    <RawScreen>
      {field !== undefined && walk !== null && <BenchClearingFieldView field={field} walk={walk} />}
      {iris !== null && <IrisCloseCanvas x={iris.x} y={iris.y} size={iris.size} />}
      <OkTapArea onTap={() => keyLatch.push(skip)} />
    </RawScreen>
  )
}

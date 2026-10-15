import { type MutableRefObject, useEffect, useRef } from 'react'
import { RawScreen } from '@/shared/ui'
import { activeSound } from '@/shared/api/audio/soundPort'
import type { RandomPort } from '@/shared/api/random/randomPort'
import {
  BENCH_CLEARING_SOUND,
  BENCH_CLEARING_TARGET_TICK,
  rollBenchClearingTargets,
} from '@/features/play-game/model/benchClearingScene'
import { screenOffsetOf } from '@/pages/defense/lib/defenseCamera'
import {
  BENCH_CLEARING_EXIT_TICK,
  type BenchClearingField,
  type BenchClearingWalkInput,
  type BenchClearingWalkState,
  benchClearingCamera,
  benchClearingIrisOf,
  startBenchClearingWalk,
  stepBenchClearingWalk,
} from '@/widgets/field-walk/lib/benchClearingWalk'
import { FieldWalkView } from '@/widgets/field-walk/ui/FieldWalkView'
import { isOkKey, useSceneTick } from '@/widgets/game-scene/model/useSceneTick'
import { irisHoleSpansOf } from '@/widgets/game-scene/lib/irisClose'
import * as styles from '@/widgets/game-scene/ui/GameScene.css'
import { clearSceneParticles } from '@/entities/particle/model/sceneParticleManager'
import { OkTapArea } from '@/widgets/game-scene/ui/OkTapArea'

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
 * - OK(−5)·'5'(0x40628): 소리 멈춤 · 입자 지움 · 같은 출구 — 건너뛰기. 웹은 Enter·Space 도 받는다.
 *
 * 0x6e418 은 울리는 소리를 가리지 않고 끊는다(`SoundPort.stop`) — 44 가 아직 울리면 그것을 끊는다.
 * 화면을 누르는 투명 칸(`OkTapArea`)은 웹 전용이다(원본은 OK 키).
 */
export function BenchClearingScene({ field, random, onDone, walkStateRef }: BenchClearingSceneProps) {
  const reachedRef = useRef(false)
  const targetRollsRef = useRef<readonly number[] | null>(null)
  const doneRef = useRef(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const randomRef = useRef(random)
  randomRef.current = random
  const audio = activeSound()

  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    // 0x40500(전환 끝) · 0x4063a(키 건너뛰기) — 0x6e418
    audio.stop()
    onDoneRef.current(reachedRef.current && targetRollsRef.current === null)
  }

  /** 키 0x40628 — OK(−5) · '5': 소리 멈춤 0x6e418 · 파티클 +0x57 = 0 · 0x6dee4(4064c, 굴림 없음) 뒤 같은 출구 */
  const skip = () => {
    if (doneRef.current) return
    clearSceneParticles()
    finish()
  }

  const tick = useSceneTick((next) => {
    if (doneRef.current) return
    if (next === BENCH_CLEARING_TARGET_TICK) {
      reachedRef.current = true
      // 0x401d4 틱 10 — 수비 8명 목표 굴림 8 번
      if (randomRef.current !== undefined) targetRollsRef.current = rollBenchClearingTargets(randomRef.current)
    }
    if (next >= BENCH_CLEARING_EXIT_TICK) finish()
  })

  // 진입 꼬리 0x3aba4 — 0x6e498(음, 0x2c, 0)
  useEffect(() => {
    audio.play(BENCH_CLEARING_SOUND)
    // 진입 한 번 — 다시 내지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || !isOkKey(event.key)) return
      event.preventDefault()
      skip()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const walk = useBenchClearingWalk(field, tick, targetRollsRef.current)
  if (walkStateRef !== undefined && walk !== null) walkStateRef.current = walk
  const iris = benchClearingIrisOf(tick)
  return (
    <RawScreen>
      {field !== undefined && walk !== null && (
        <FieldWalkView
          offset={screenOffsetOf(benchClearingCamera())}
          grassPalette={field.grassPalette ?? null}
          rows={[
            // 43240 0x43010(장면, [+0xf20], +0x111c, 0) — 수비 줄
            { walkers: walk.fielders, teamIndex: field.defenseTeam ?? null, ...(field.defenseAces === undefined ? {} : { aceSprites: field.defenseAces }) },
            // 43252 0x43010(장면, [+0x177c], +0x1758, 1) — 공격 줄
            { walkers: walk.offense, teamIndex: field.offenseTeam ?? null, ...(field.offenseAces === undefined ? {} : { aceSprites: field.offenseAces }) },
          ]}
        />
      )}
      {iris !== null && <IrisCloseCanvas x={iris.x} y={iris.y} size={iris.size} />}
      <OkTapArea onTap={skip} />
    </RawScreen>
  )
}

const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320

/**
 * **원 닫기 한 그림** — 0xbd5bc: 화면 크기(W × H) 그림을 검정으로 칠하고(0x14006e8(0, 0, W, H)) (255, 0, 255) 채운 원
 * 0x1400708(x, y, w, h, 0, 360) 으로 구멍을 뚫어 (0, 0) 에 찍는다. 구멍 칸은 `irisHoleSpansOf`(⚠️ 단말 함수라 화소 규칙은 미확인).
 */
function IrisCloseCanvas({ x, y, size }: { readonly x: number; readonly y: number; readonly size: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const context = canvasRef.current?.getContext('2d') ?? null
    if (context === null) return
    context.globalCompositeOperation = 'source-over'
    context.fillStyle = '#000000'
    context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT)
    for (const span of irisHoleSpansOf(x, y, size)) context.clearRect(span.from, span.y, span.to - span.from + 1, 1)
  }, [x, y, size])
  return (
    <canvas ref={canvasRef} className={styles.cover} width={SCREEN_WIDTH} height={SCREEN_HEIGHT}
      data-testid="벤치-원닫기" data-size={size} style={{ imageRendering: 'pixelated' }} />
  )
}

/** 틱마다 한 걸음씩 — 진입부터 다시 굴리지 않게 지난 상태를 들고 있는다 */
function useBenchClearingWalk(
  field: BenchClearingWalkInput | undefined,
  tick: number,
  targetRolls: readonly number[] | null,
): BenchClearingWalkState | null {
  const memory = useRef<{ readonly field: BenchClearingWalkInput; readonly tick: number; readonly state: BenchClearingWalkState } | null>(null)
  if (field === undefined) return null
  let current = memory.current
  const isSame = current !== null && current.field.entryRolls === field.entryRolls
    && current.field.offenseSide === field.offenseSide && current.field.isLeftBatter === field.isLeftBatter
  if (current === null || !isSame || current.tick > tick) {
    current = { field, tick: -1, state: startBenchClearingWalk(field) }
  }
  let { state } = current
  for (let t = current.tick + 1; t <= tick; t += 1) state = stepBenchClearingWalk(state, t, field, targetRolls)
  memory.current = { field, tick: Math.max(tick, current.tick), state }
  return state
}

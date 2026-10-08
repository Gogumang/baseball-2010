import { useEffect, useRef, useState } from 'react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { ZONE_CENTERS } from '@/entities/pitching/model/pitchCurve'
import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'
import {
  AIM_CLAMP,
  AIM_STILL,
  aimKeyActionOf,
  aimStartOf,
  aimTickOf,
} from '@/features/play-pitcher-game/model/pitchAim'
import type { AimDirection, AimKeyAction } from '@/features/play-pitcher-game/model/pitchAim'
import { ZONE_HALF_WORLD } from '@/features/play-pitcher-game/model/pitcherPitch'
import * as styles from '@/pages/pitching/ui/AimCursor.css'

interface AimCursorProps {
  /** 존 중심 표 0xcfbcc 의 칸 — 진행기가 투구에 쓰는 side 와 같다 */
  readonly side: number
  /**
   * 0x10 의 틱 하나 `0x39c5c`. 안 넘기면 걸음 · 자르기만 한다(미션이 아닌 경기 — 난수를 안 쓴다).
   * 투수 미션은 세션이 흔들림(경기 난수)까지 넣은 `aimTickOf` 를 넘긴다.
   */
  readonly onTick?: (aim: WorldPoint, direction: AimDirection) => WorldPoint
  /** OK · '5' (0x50e9c) — 그 틱까지 돈 조준점을 넘긴다 */
  readonly onConfirm: (aim: WorldPoint) => void
  /** CLR (0x50ee0) — 0xf 로 돌아간다. 안 넘기면 CLR 이 방향만 지운다 */
  readonly onCancel?: () => void
  /** 일시정지 팝업(0x741a0)이 떠 있으면 틱도 키도 멈춘다 */
  readonly isPaused?: boolean
}

/** 화면 칸 — 자르기 범위(x ±600 · y ±400)를 이 배율로 줄여 그린다 */
const WORLD_PER_PIXEL = 8

/** 화면 키패드 — 휴대폰 숫자판 그대로 ('5' = OK) */
const KEYPAD: readonly { readonly key: string; readonly label: string }[] = [
  { key: '1', label: '↖' },
  { key: '2', label: '↑' },
  { key: '3', label: '↗' },
  { key: '4', label: '←' },
  { key: '5', label: 'OK' },
  { key: '6', label: '→' },
  { key: '7', label: '↙' },
  { key: '8', label: '↓' },
  { key: '9', label: '↘' },
]

/**
 * **조준 (경기 상태 0x10)** — 원본은 칸을 고르지 않고 **계속 흐르는 조준점**을 움직인다.
 *
 * - 들어설 때 0x39894 가 조준점을 존 중심 표 0xcfbcc[side] 로 놓는다.
 * - 새로 누른 키마다 메시지 8(0x50e3a)이 방향 dx · dy 를 다시 정한다 — 숫자 1~9 · 방향키, 그 밖 키는 멈춤.
 *   **키를 떼도 다른 키를 누를 때까지 흐른다**(뗌은 0x536bc 가 0x10 에 안 넘긴다).
 * - 매 틱 0x39c5c: x · y += 방향 × 20, z −= dy × 10, 존 중심 기준 x ±600 · y ±400 · z ±200 으로 자른다.
 * - OK · '5' 는 확정(0x50e9c → 0x11), CLR 은 0xf 로(0x50ee0). 둘 다 방향을 지운 뒤 그 틱의 0x39c5c 를 한 번 더 지난다.
 *   ⚠️ 근사: 한 틱 안에서 메시지 8 과 0x39c5c 의 앞뒤는 안 봤다 — 웹은 지운 방향으로 한 번 더 돈 뒤 넘긴다.
 *
 * ⚠️ 원본 조준 그림(`ui/slt_pitch.raw` 반투명 원 · 투영 0xbe3d8)은 옮기지 않았다 — 자르기 범위 · 존 · 점만 그린다.
 */
export function AimCursor({ side, onTick, onConfirm, onCancel, isPaused = false }: AimCursorProps) {
  const [aim, setAim] = useState<WorldPoint>(() => aimStartOf(side))
  const aimRef = useRef(aim)
  const directionRef = useRef<AimDirection>(AIM_STILL)
  const isDoneRef = useRef(false)
  const propsRef = useRef({ side, onTick, onConfirm, onCancel, isPaused })
  propsRef.current = { side, onTick, onConfirm, onCancel, isPaused }

  const tick = () => {
    const { side: currentSide, onTick: currentOnTick } = propsRef.current
    const next = currentOnTick
      ? currentOnTick(aimRef.current, directionRef.current)
      : aimTickOf(aimRef.current, directionRef.current, currentSide)
    aimRef.current = next
    setAim(next)
  }
  const tickRef = useRef(tick)
  tickRef.current = tick

  useEffect(() => {
    if (isPaused) return
    const handle = window.setInterval(() => {
      if (!isDoneRef.current) tickRef.current()
    }, millisecondsPerFrame())
    return () => window.clearInterval(handle)
  }, [isPaused])

  const apply = (action: AimKeyAction) => {
    if (isDoneRef.current || propsRef.current.isPaused) return
    // 메시지 8 머리 — 어느 키든 방향을 먼저 지운다
    directionRef.current = action.kind === 'move' ? action.direction : AIM_STILL
    if (action.kind === 'move') return
    if (action.kind === 'cancel' && propsRef.current.onCancel === undefined) return
    isDoneRef.current = true
    tickRef.current()
    if (action.kind === 'confirm') propsRef.current.onConfirm(aimRef.current)
    else propsRef.current.onCancel?.()
  }
  const applyRef = useRef(apply)
  applyRef.current = apply

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 누르고 있는 반복 · 뗌은 0x10 에 안 온다 (0x536bc 의 [+0x1c] == 0 만)
      if (event.repeat || propsRef.current.isPaused) return
      const action = aimKeyActionOf(event.key)
      if (action === null) return
      event.preventDefault()
      applyRef.current(action)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const center = ZONE_CENTERS[side] ?? ZONE_CENTERS[0]
  const boxWidth = (AIM_CLAMP.x * 2) / WORLD_PER_PIXEL
  const boxHeight = (AIM_CLAMP.y * 2) / WORLD_PER_PIXEL
  const toLeft = (x: number) => (x - (center.x - AIM_CLAMP.x)) / WORLD_PER_PIXEL
  // 세계 y 는 위로 클수록 — 화면은 아래로 커진다
  const toTop = (y: number) => (center.y + AIM_CLAMP.y - y) / WORLD_PER_PIXEL

  return (
    <div className={styles.frame}>
      <div
        className={styles.field}
        style={{ width: `${boxWidth}px`, height: `${boxHeight}px` }}
        data-testid="조준판"
      >
        <span
          className={styles.zone}
          style={{
            left: `${toLeft(center.x - ZONE_HALF_WORLD.x)}px`,
            top: `${toTop(center.y + ZONE_HALF_WORLD.y)}px`,
            width: `${(ZONE_HALF_WORLD.x * 2) / WORLD_PER_PIXEL}px`,
            height: `${(ZONE_HALF_WORLD.y * 2) / WORLD_PER_PIXEL}px`,
          }}
        />
        <span
          className={styles.dot}
          style={{ left: `${toLeft(aim.x)}px`, top: `${toTop(aim.y)}px` }}
          data-testid="조준점"
          data-x={aim.x}
          data-y={aim.y}
          data-z={aim.z}
        />
      </div>
      <div className={styles.keypad}>
        {KEYPAD.map((button) => (
          <button
            type="button"
            key={button.key}
            className={styles.key}
            aria-label={button.key === '5' ? '조준 확정' : `조준 ${button.label}`}
            onClick={() => {
              const action = aimKeyActionOf(button.key)
              if (action !== null) apply(action)
            }}
          >
            {button.label}
          </button>
        ))}
      </div>
      {onCancel !== undefined && (
        <button
          type="button"
          className={styles.clear}
          onClick={() => {
            const action = aimKeyActionOf('Escape')
            if (action !== null) apply(action)
          }}
        >
          CLR 구질로
        </button>
      )}
    </div>
  )
}

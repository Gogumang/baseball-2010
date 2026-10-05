import { useEffect, useRef } from 'react'
import { Button, RawScreen } from '@/shared/ui'
import { GAME_END_INPUT_LOCK_TICKS } from '@/widgets/game-scene/lib/endBoardLayout'
import { isOkKey, useSceneTick } from '@/widgets/game-scene/model/useSceneTick'
import { EndBoardRows } from '@/widgets/game-scene/ui/EndBoardRows'
import * as styles from '@/widgets/game-scene/ui/GameScene.css'

interface GameEndBoardProps {
  readonly side0Score: number
  readonly side1Score: number
  /** 승리투수·패전투수·세이브 (state+0x44/0x50/0x5c 그대로 — 측 2 면 null) */
  readonly names: readonly (string | null)[]
  /** OK — 메시지 1(인자 0x18) → 0xae3a0 → 경기 끝이라 **정산 0x19** */
  readonly onConfirm: () => void
}

/**
 * **경기 끝 결과 판** — 경기 장면 상태 0x18 이 경기가 끝났을 때 그리는 판 (R10 5절, 확정).
 *
 * 흐름 (갱신 0x4f928 · 그리기 0x4fe9c):
 * - 경기가 끝나면 0x18 은 반 이닝 교대 일을 하나도 안 한다 — 예약 교체·이어하기 저장·자동진행 확인·
 *   야수 이동(0x3fac4, 난수)·징글 13(0x4f7ac) 모두 경기 끝 판정 `0xb68fc` 가 참이면 건너뛴다.
 *   **난수를 쓰지 않는다.**
 * - 처음 **10틱**(틱 0~9)은 `경기+0x32 = 1` 로 상태 예약을 되돌린다 — OK 가 먹지 않는다.
 * - 그 뒤 OK → 메시지 1 → `0xae3a0` 이 경기 끝을 보고 **정산(0x19)**.
 * - 효과음은 내지 않는다.
 *
 * 모드를 가리지 않는다 — 경기 끝 가지(0x4f94e)는 모드를 안 보므로 나만의리그 타자편·팀 경기 모두 같은 판이다.
 * ⚠️ 판 머리의 점수판 틀 `0x41440` 은 그림 미해결이라 안 그린다 (`endBoardLayout` 머리말).
 */
export function GameEndBoard({ side0Score, side1Score, names, onConfirm }: GameEndBoardProps) {
  const tick = useSceneTick()
  const isLocked = tick < GAME_END_INPUT_LOCK_TICKS
  const confirmRef = useRef(onConfirm)
  confirmRef.current = onConfirm
  const doneRef = useRef(false)

  const confirm = () => {
    if (isLocked || doneRef.current) return
    doneRef.current = true
    confirmRef.current()
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || !isOkKey(event.key)) return
      event.preventDefault()
      if (isLocked || doneRef.current) return
      doneRef.current = true
      confirmRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isLocked])

  return (
    <RawScreen>
      <EndBoardRows side0Score={side0Score} side1Score={side1Score} names={names} />
      {/* 원본에 없는 웹 전용 단추 — 원본은 OK 키가 한다. 10틱 동안은 원본처럼 먹지 않는다 */}
      <Button variant="corner" className={styles.okButton} disabled={isLocked} onClick={confirm}>
        확인
      </Button>
    </RawScreen>
  )
}

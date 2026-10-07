import { useEffect, useRef } from 'react'
import { Button, RawScreen } from '@/shared/ui'
import { isOkKey, useSceneTick } from '@/widgets/game-scene/model/useSceneTick'
import * as styles from '@/widgets/game-scene/ui/GameScene.css'
import { ScoreboardFrame } from '@/widgets/scoreboard-frame/ui/ScoreboardFrame'
import { HALF_INNING_SCOREBOARD_FROM_TICK, SCOREBOARD_AT } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'
import type { ScoreboardSide } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'
import { HalfInningCards } from '@/widgets/game-scene/ui/HalfInningCards'
import type { HalfInningCardsData } from '@/widgets/game-scene/ui/HalfInningCards'

interface HalfInningBoardProps {
  /** 판이 서는 반 이닝 — 웹 전용 글자 (원본 판 그림은 미해결) */
  readonly inning: number
  readonly half: '초' | '말'
  /** 틱마다 (1 부터) — 부르는 쪽이 틱 2 에 징글 13 을 낸다 (0x4f7ac) */
  readonly onTick?: (tick: number) => void
  /** 점수판 틀 0x41440(경기, 0, 0) 의 두 측 — 팀(0xb6bdd)·CPU(0xb6c21). 안 주면 틀을 안 그린다 */
  readonly scoreboardSides?: readonly [ScoreboardSide, ScoreboardSide]
  /** 두 팀 판 0x42364("DUE UP") · 0x420dc("PITCHER") 의 값 — 안 주면 판을 안 그린다 */
  readonly cards?: HalfInningCardsData
  /** OK — 메시지 1(인자 0x18) → 0xae3a0 → 경기 중이라 다음 반 이닝 첫 타석(0xd) */
  readonly onConfirm: () => void
}

/**
 * **공수 교대 판** — 경기 장면 상태 0x18 의 교대 가지가 OK 를 기다리는 동안 (R10 5절,
 * `features/play-game/model/halfInningBoard` 머리말).
 *
 * - 결과 판과 달리 입력 잠금이 없다 — 4fab4 가 `경기+0x32 = 0` 으로 둔다. OK 는 아무 때나 먹는다.
 * - 틱 2 에 징글 13 (0x4f7ac) — 소리는 부르는 쪽이 `onTick` 으로 낸다.
 * - 틱 0 의 야수 걸음 굴림 36 개(0x3fac4)는 진행기가 판을 세울 때 이미 썼다 — 여기서는 굴리지 않는다.
 *
 * - 틱 ≥ 70(0x4ff00 `cmp [+0x2c], #0x45; bgt`) 부터 점수판 틀 0x41440(경기, 0, 0, 0, 0, 0) 을 그리고
 *   (`widgets/scoreboard-frame`), 이어 두 팀 판 0x42364("DUE UP") · 0x420dc("PITCHER") 를 (14, 158) · (150, 158) 에
 *   — 초면 왼쪽이 DUE UP, 말이면 왼쪽이 PITCHER (`lib/halfInningCardsLayout`, 0x4ff16~0x5001a).
 *
 * ⚠️ 미해결 — 그림: 운동장 전경 0x4fb8c(야수 18명이 제자리로 걷는 모습 — 0x43010 두 번 · 0xbe6a1 · 0x40008 …)는
 *    틱과 상관없이 늘 바탕으로 그리고(0x4fef8, 틱 ≤ 69 는 이것만) 그 위에 판이 얹히지만, 3D 운동장·야수 걸음
 *    (0x3fac4 굴림 값)을 웹이 들고 있지 않아 그리지 않는다. 웹은 반 이닝 글자와 확인 단추를 둔다(웹 전용).
 */
export function HalfInningBoard({ inning, half, onTick, scoreboardSides, cards, onConfirm }: HalfInningBoardProps) {
  const tick = useSceneTick(onTick)
  const confirmRef = useRef(onConfirm)
  confirmRef.current = onConfirm
  const doneRef = useRef(false)
  const confirm = () => {
    if (doneRef.current) return
    doneRef.current = true
    confirmRef.current()
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || !isOkKey(event.key)) return
      event.preventDefault()
      if (doneRef.current) return
      doneRef.current = true
      confirmRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <RawScreen>
      {scoreboardSides !== undefined && tick >= HALF_INNING_SCOREBOARD_FROM_TICK && (
        <ScoreboardFrame {...SCOREBOARD_AT.halfInning} side0={scoreboardSides[0]} side1={scoreboardSides[1]} />
      )}
      {cards !== undefined && tick >= HALF_INNING_SCOREBOARD_FROM_TICK && <HalfInningCards data={cards} />}
      <div className={styles.webCaption}>
        {inning}회{half}
      </div>
      <Button variant="corner" className={styles.okButton} onClick={confirm}>
        확인
      </Button>
    </RawScreen>
  )
}

import { useEffect, useRef } from 'react'
import { RawScreen } from '@/shared/ui'
import { isOkKey, useSceneTick } from '@/widgets/game-scene/model/useSceneTick'
import { OkTapArea } from '@/widgets/game-scene/ui/OkTapArea'
import { ScoreboardFrame } from '@/widgets/scoreboard-frame/ui/ScoreboardFrame'
import { HALF_INNING_SCOREBOARD_FROM_TICK, SCOREBOARD_AT } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'
import type { ScoreboardSide } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'
import { HalfInningCards } from '@/widgets/game-scene/ui/HalfInningCards'
import type { HalfInningCardsData } from '@/widgets/game-scene/ui/HalfInningCards'
import { HalfInningField } from '@/widgets/field-walk/ui/HalfInningField'
import type { HalfInningFieldProps } from '@/widgets/field-walk/ui/HalfInningField'
import { useMarksGameScene } from '@/shared/lib/commonWindow/commonWindow'

interface HalfInningBoardProps {
  /** 판이 서는 반 이닝 — 그림에는 안 쓴다(시험 · 부르는 쪽이 판을 가려 보는 표시) */
  readonly inning: number
  readonly half: '초' | '말'
  /** 틱마다 (1 부터) — 부르는 쪽이 틱 2 에 징글 13 을 낸다 (0x4f7ac) */
  readonly onTick?: (tick: number) => void
  /** 점수판 틀 0x41440(경기, 0, 0) 의 두 측 — 팀(0xb6bdd)·CPU(0xb6c21). 안 주면 틀을 안 그린다 */
  readonly scoreboardSides?: readonly [ScoreboardSide, ScoreboardSide]
  /** 두 팀 판 0x42364("DUE UP") · 0x420dc("PITCHER") 의 값 — 안 주면 판을 안 그린다 */
  readonly cards?: HalfInningCardsData
  /**
   * 운동장 전경 0x4fb8c 의 재료 — 판 틱 0 의 굴림 36 개 · 공격 측 · 앞 자리 · 팀 · 이름 (`widgets/field-walk`). 틱은 판이 넣는다.
   * 안 주면 바탕을 안 그린다(검정).
   */
  readonly field?: Omit<HalfInningFieldProps, 'tick'>
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
 * - 운동장 전경 0x4fb8c 는 틱과 상관없이 늘 바탕이다(0x4fef8, 틱 ≤ 69 는 이것만) — 새 수비가 더그아웃에서 제자리로 걷고 앞 수비가
 *   더그아웃으로 들어가며, 틱 100 뒤에는 카메라가 야수를 하나씩 비추며 이름표를 단다 (`widgets/field-walk/ui/HalfInningField`).
 * - 화면을 누르는 투명 칸(`OkTapArea`)은 웹 전용이다(원본은 OK 키). 예전 웹의 "N회초" 글자는 원본에 없어 뺐다.
 */
export function HalfInningBoard({ inning, half, onTick, scoreboardSides, cards, field, onConfirm }: HalfInningBoardProps) {
  // 교대 판 0x18도 경기 장면 0x104 의 한 상태다 — 이 판만 그리는 동안에도 장면 객체(+0xfd4 · 파티클 관리자)는 그대로다(새로 서는 것은
  // 장면 전환 0x3874 의 new 뿐). 공용 창이 줄임 없이 닫히고([창+0x24f]) 창이 떠 있으면 장면이 선다(52cc6)
  useMarksGameScene()
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
      <div data-testid={`교대-판-${inning}회${half}`} data-tick={tick}>
      {/* 0x4fef8 0x4fb8c — 늘 바탕 */}
      {field !== undefined && <HalfInningField {...field} tick={tick} />}
      {scoreboardSides !== undefined && tick >= HALF_INNING_SCOREBOARD_FROM_TICK && (
        <ScoreboardFrame {...SCOREBOARD_AT.halfInning} side0={scoreboardSides[0]} side1={scoreboardSides[1]} />
      )}
      {cards !== undefined && tick >= HALF_INNING_SCOREBOARD_FROM_TICK && <HalfInningCards data={cards} />}
      </div>
      <OkTapArea onTap={confirm} />
    </RawScreen>
  )
}

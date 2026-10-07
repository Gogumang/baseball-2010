import { useEffect, useRef } from 'react'
import { Button, RawScreen } from '@/shared/ui'
import { GAME_END_INPUT_LOCK_TICKS } from '@/widgets/game-scene/lib/endBoardLayout'
import { isOkKey, useSceneTick } from '@/widgets/game-scene/model/useSceneTick'
import { EndBoardRows } from '@/widgets/game-scene/ui/EndBoardRows'
import * as styles from '@/widgets/game-scene/ui/GameScene.css'
import { ScoreboardFrame } from '@/widgets/scoreboard-frame/ui/ScoreboardFrame'
import { SCOREBOARD_AT } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'
import type { ScoreboardSide } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'

interface GameEndBoardProps {
  readonly side0Score: number
  readonly side1Score: number
  /** 승리투수·패전투수·세이브 (state+0x44/0x50/0x5c 그대로 — 측 2 면 null) */
  readonly names: readonly (string | null)[]
  /** 점수판 틀 0x41440(경기, 0, 3) 의 두 측 — 팀(0xb6bdd)·CPU(0xb6c21). 안 주면 틀을 안 그린다 */
  readonly scoreboardSides?: readonly [ScoreboardSide, ScoreboardSide]
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
 * 모드를 가리지 않는다 — 경기 끝 가지(0x4f94e)는 모드를 안 보므로 나만의리그 타자편·투수편·팀 경기 모두 같은 판이다.
 * 판 머리의 점수판 틀 `0x41440(경기, 0, 3, 0, 0, 0)` 은 `widgets/scoreboard-frame` 이 그린다 (0x4fed8 — 경기 끝이면 y = 3).
 *
 * ## 0x18 을 거치지 않는 끝 — 메시지 2 "경기 끝 요청"(0x50cb0 → 곧장 0x19)의 발신자 (미해결, 2026-10-05 조사)
 * 메시지는 모두 `0xbfbac(받는곳, 번호, 인자, …)`(곧바로 0xbfb78 → 받는곳 vt+0xc = 0x509a0) 이나 큐 `0xbfc44`
 * (0xbfbf4 에 쌓고 0xbfc8c 가 꺼냄)로 간다. 두 함수를 부르는 곳을 모두 풀었다:
 * - 0xbfbac 51곳의 번호: 0x10·0x11·0x13·1·0·8·7·9·0x12·0x15·0x3f3·0x51c·0x583~0x587·0x644·0x645·0x6a4~0x6aa·
 *   0xbb9~0xbc9 계열·0xbc0(0xbc<<4)·0x3f4(0xfd<<2)·0x588(0xb1<<3)·0x6a8(0xd5<<3) — **2·3 은 없다.**
 * - 0xbfc44 3곳: 0x76c·0x76d(모드 5·6 기권 쪽, 0xaaa6c·0xaada4)뿐.
 * - 0x509a0 을 담은 곳은 vtable 0xcfa3c 와 풀 0x53144 뿐이고, 경기 코드(0x37000~0x54000·0xa0000~0xc3000)에서
 *   r1 = 2·3 으로 vt 를 직접 부르는 자리도 없다.
 * 곧 메시지 2(그리고 메시지 3 "3아웃")를 상수로 보내는 곳은 원본에 없다 — 경기 끝은 늘 판정 A(0xae24c)·B(0xae3e8)의
 * "경기 끝 → 0x18" 로 이 판을 거친다. 웹도 그대로 늘 이 판을 거친다. (레지스터로 번호를 계산해 보내는 자리가
 * 있을 가능성은 남는다.)
 */
export function GameEndBoard({ side0Score, side1Score, names, scoreboardSides, onConfirm }: GameEndBoardProps) {
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
      {scoreboardSides !== undefined && (
        <ScoreboardFrame {...SCOREBOARD_AT.gameEnd} side0={scoreboardSides[0]} side1={scoreboardSides[1]} />
      )}
      <EndBoardRows side0Score={side0Score} side1Score={side1Score} names={names} />
      {/* 원본에 없는 웹 전용 단추 — 원본은 OK 키가 한다. 10틱 동안은 원본처럼 먹지 않는다 */}
      <Button variant="corner" className={styles.okButton} disabled={isLocked} onClick={confirm}>
        확인
      </Button>
    </RawScreen>
  )
}

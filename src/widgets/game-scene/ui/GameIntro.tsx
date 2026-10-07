import { useEffect, useRef } from 'react'
import { RawScreen } from '@/shared/ui'
import {
  INTRO_TICKS,
  introBandAlphaOf,
  introCounterAt,
  introFadeOf,
} from '@/widgets/game-scene/lib/introSchedule'
import { isOkKey, useSceneTick } from '@/widgets/game-scene/model/useSceneTick'
import * as styles from '@/widgets/game-scene/ui/GameScene.css'
import { ScoreboardFrame } from '@/widgets/scoreboard-frame/ui/ScoreboardFrame'
import { SCOREBOARD_AT, introScoreboardEffectOf } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'
import type { ScoreboardSide } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'

interface GameIntroProps {
  /** 웹 전용 글자 — 두 팀 이름 (원본 그림의 팀 글씨는 미해결) */
  readonly awayName: string
  readonly homeName: string
  /** 점수판 틀 0x41440(경기, W/2 − 120, H/2 − 70, …) 의 두 측 — 팀(0xb6bdd)·CPU(0xb6c21). 안 주면 틀을 안 그린다 */
  readonly scoreboardSides?: readonly [ScoreboardSide, ScoreboardSide]
  /** 54틱이 다 지났거나 OK·'5' 로 건너뛰었다 → 0x18(1회초 판) 또는 0xd */
  readonly onDone: () => void
}

/**
 * **경기 시작 인트로** — 경기 장면 상태 0xc (`lib/introSchedule` 머리말, R10 3절).
 *
 * - 54틱(270 → 0, 5씩)이 지나면 끝, OK(−5)·'5' 면 곧바로 끝 (0x39b54). 웹은 Enter·Space 도 받는다.
 * - 효과음 61 은 진입 예약음이라 부르는 쪽(경기를 세우는 세션)이 이미 낸다.
 * - 띠 색 0x304ea2 · 알파 `max(1, +0x17e4 − 0x55)` 와 마지막 12틱의 네 계단 흐려짐은 원본 그대로다.
 *
 * - 점수판 틀 0x41440(경기, W/2 − 120, H/2 − 70, 효과, 인자, 0) (0x419f4): `[+0x17e6] ≤ 14` 면 효과 1 · 인자 [+0x17e6]
 *   (그림 몫 L/16), 이름 칸 칠은 상태 0xc 라 알파 [+0x17e4] (`widgets/scoreboard-frame`).
 *
 * ⚠️ 미해결 — 그림: 띠의 y(`0xbaa8c()` = 전역 0x15606f4 + 40)·구장 배경 0x40ff0·game_ui 이미지 8 막대·
 *    두 팀 글씨(img_text, `0xb6bdc(st, 측)` 로 고름)·"VS" img_text 0xb9·라이벌전 9프레임 띠(0x3b80c)는
 *    좌표나 그림 고르기를 다 안 읽어 그리지 않는다. 웹은 띠 자리에 두 팀 이름(웹 전용)만 둔다.
 */
export function GameIntro({ awayName, homeName, scoreboardSides, onDone }: GameIntroProps) {
  const doneRef = useRef(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    onDoneRef.current()
  }
  const tick = useSceneTick((next) => {
    if (next >= INTRO_TICKS) finish()
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || !isOkKey(event.key)) return
      event.preventDefault()
      finish()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const fade = introFadeOf(introCounterAt(tick))
  return (
    <RawScreen onPress={finish}>
      <div
        className={styles.introBand}
        style={{ background: `rgba(48, 78, 162, ${introBandAlphaOf(fade) / 255})`, opacity: fade.alpha / 255 }}
      >
        {awayName} VS {homeName}
      </div>
      {/* 띠·막대·팀 글씨 뒤에 그린다 (0x419f4) */}
      {scoreboardSides !== undefined && (
        <ScoreboardFrame {...SCOREBOARD_AT.intro} side0={scoreboardSides[0]} side1={scoreboardSides[1]}
          effectLevel={introScoreboardEffectOf(fade.level)} introAlpha={fade.alpha} />
      )}
    </RawScreen>
  )
}

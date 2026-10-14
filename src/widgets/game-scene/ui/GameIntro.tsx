import { useEffect, useRef } from 'react'
import { FrameSprite, RawScreen } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import {
  INTRO_TICKS,
  introBandAlphaOf,
  introCounterAt,
  introFadeOf,
} from '@/widgets/game-scene/lib/introSchedule'
import {
  INTRO_BAND,
  INTRO_BAND_RGB,
  INTRO_BAR_FRAME,
  INTRO_BAR_X,
  INTRO_BAR_Y,
  INTRO_STADIUM_LABEL_FRAME,
  INTRO_STADIUM_LABEL_X,
  INTRO_TEAM_NAME_X,
  INTRO_TEXT_Y,
} from '@/widgets/game-scene/lib/introLayout'
import { isOkKey, useSceneTick } from '@/widgets/game-scene/model/useSceneTick'
import * as styles from '@/widgets/game-scene/ui/GameScene.css'
import { ScoreboardFrame } from '@/widgets/scoreboard-frame/ui/ScoreboardFrame'
import {
  SCOREBOARD_AT, effectOpacityOf, introScoreboardEffectOf,
} from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'
import type { ScoreboardSide } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'
import { SceneryBackdrop } from '@/widgets/batting-stage/ui/SceneryBackdrop'
import type { SceneryBackdropStage } from '@/widgets/batting-stage/ui/SceneryBackdrop'

const GAME_UI_FRAMES = './sprites/game_ui/frames'
const IMG_TEXT_FRAMES = './sprites/img_text/frames'

interface GameIntroProps {
  /**
   * 막대 위 팀 이름 글씨의 img_text 프레임 — 0x41 + (모드 1 ? 구장 번호 st+0x30 : 홈 팀) (`introStadiumNameFrameOf`).
   * 뒤에 "스타디움"(185)이 붙어 "〈팀〉 스타디움" 한 줄이 된다.
   */
  readonly stadiumNameFrame: number
  /** 점수판 틀 0x41440(경기, W/2 − 120, H/2 − 70, …) 의 두 측 — 팀(0xb6bdd)·CPU(0xb6c21). 안 주면 틀을 안 그린다 */
  readonly scoreboardSides?: readonly [ScoreboardSide, ScoreboardSide]
  /**
   * 배경 고르기 0x40ff0 의 구장 — 경기 장면의 타석 구장(+0x70 · +0xc · 하늘 줄 · 시즌 구장). 카운터 +0x17e2 만큼 구장 · 바닥을
   * 내려 그린다. 안 주면 배경을 안 그린다(검정).
   */
  readonly backdrop?: SceneryBackdropStage
  /** 54틱이 다 지났거나 OK·'5' 로 건너뛰었다 → 0x18(1회초 판) 또는 0xd */
  readonly onDone: () => void
}

/**
 * **경기 시작 인트로** — 경기 장면 상태 0xc (`lib/introSchedule` 머리말, 그리기 자리는 `lib/introLayout`, R10 3절).
 *
 * - 54틱(270 → 0, 5씩)이 지나면 끝, OK(−5)·'5' 면 곧바로 끝 (0x39b54). 웹은 Enter·Space 도 받는다.
 * - 효과음 61 은 진입 예약음이라 부르는 쪽(경기를 세우는 세션)이 이미 낸다.
 *
 * 그리기 차례(0x417ac): 배경 0x40ff0(카운터) → 띠 0x6a9f0(색 0x304ea2 · 알파 `max(1, +0x17e4 − 0x55)`) → game_ui 프레임 8 막대 →
 * 팀 이름 글씨(img_text 0x41 + n) → "스타디움"(img_text 185) → 점수판 틀 0x41440. 막대 · 글씨 · 점수판은 `[+0x17e6] ≤ 14` 면
 * 효과 1 · 인자 [+0x17e6](그림 몫 L/16)으로 함께 흐려진다. 이름 칸 칠은 상태 0xc 라 알파 [+0x17e4].
 * 띠는 효과 인자를 안 받고 알파만 내려간다(예전 웹은 띠 전체를 한 번 더 흐렸다 — 원본에 없다).
 *
 * ⚠️ 미확인: 라이벌전 9프레임 띠(0x3b80c — 두 팀이 표 0xd8a90 의 짝이고 [+0x17e6] > 14 일 때)는 단계별 좌표를 안 읽어 그리지 않는다.
 * ⚠️ 미확인: 띠 칠 0x6a9f0 의 알파 섞기는 점수판 이름 칸(0x6b7d4)과 같은 "윗바이트/255" 로 본다.
 */
export function GameIntro({ stadiumNameFrame, scoreboardSides, backdrop, onDone }: GameIntroProps) {
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
  const gameUiOrigins = useFrameOrigins(GAME_UI_FRAMES)
  const textOrigins = useFrameOrigins(IMG_TEXT_FRAMES)

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

  const counter = introCounterAt(tick)
  const fade = introFadeOf(counter)
  const effectLevel = introScoreboardEffectOf(fade.level)
  const imageOpacity = effectOpacityOf(effectLevel)
  const imageStyle = imageOpacity === 1 ? undefined : { opacity: imageOpacity }
  const { r, g, b } = INTRO_BAND_RGB
  return (
    <RawScreen onPress={finish}>
      {backdrop !== undefined && <SceneryBackdrop stage={backdrop} offsetY={counter} />}
      <div
        className={styles.introBand}
        data-testid="인트로-띠"
        style={{
          left: INTRO_BAND.x, top: INTRO_BAND.y, width: INTRO_BAND.width, height: INTRO_BAND.height,
          background: `rgba(${r}, ${g}, ${b}, ${introBandAlphaOf(fade) / 255})`,
        }}
      />
      {imageOpacity > 0 && (
        <>
          <FrameSprite folder={GAME_UI_FRAMES} frame={INTRO_BAR_FRAME} origins={gameUiOrigins}
            x={INTRO_BAR_X} y={INTRO_BAR_Y} style={imageStyle} />
          <span data-testid="인트로-팀이름" data-frame={stadiumNameFrame}>
            <FrameSprite folder={IMG_TEXT_FRAMES} frame={stadiumNameFrame} origins={textOrigins}
              x={INTRO_TEAM_NAME_X} y={INTRO_TEXT_Y} style={imageStyle} />
          </span>
          <FrameSprite folder={IMG_TEXT_FRAMES} frame={INTRO_STADIUM_LABEL_FRAME} origins={textOrigins}
            x={INTRO_STADIUM_LABEL_X} y={INTRO_TEXT_Y} style={imageStyle} />
        </>
      )}
      {/* 띠·막대·팀 글씨 뒤에 그린다 (0x419f4) */}
      {scoreboardSides !== undefined && (
        <ScoreboardFrame {...SCOREBOARD_AT.intro} side0={scoreboardSides[0]} side1={scoreboardSides[1]}
          effectLevel={effectLevel} introAlpha={fade.alpha} />
      )}
    </RawScreen>
  )
}

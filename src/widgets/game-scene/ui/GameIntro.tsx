import { useCallback, useEffect, useRef } from 'react'
import { RawScreen } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { INTRO_TICKS, introCounterAt, introFadeAt } from '@/widgets/game-scene/lib/introSchedule'
import { isOkKey, useSceneTick } from '@/widgets/game-scene/model/useSceneTick'
import { useSceneKeyLatchOwner } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'
import { introScoreboardEffectOf } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'
import type { ScoreboardSide } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'
import { SceneryBackdrop } from '@/widgets/batting-stage/ui/SceneryBackdrop'
import { rivalryStepAt } from '@/widgets/game-scene/lib/rivalryBand'
import { RivalryBandCanvas } from '@/widgets/game-scene/ui/RivalryBandCanvas'
import { introCanvasOverlayOf } from '@/widgets/game-scene/ui/introCanvas'
import { introDomLayersOf } from '@/widgets/game-scene/ui/gameIntro/introDomLayers'
import type { SceneryBackdropStage } from '@/widgets/batting-stage/ui/SceneryBackdrop'
import { useMarksGameScene } from '@/shared/lib/commonWindow/commonWindow'
import { GAME_UI_FRAMES, IMG_TEXT_FRAMES } from '@/widgets/game-scene/ui/introCanvas/placed'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'

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
  /**
   * 라이벌전(+0x194a) — 적재 상태 8 이 `0xb8f68(두 팀)` 으로 정한다(`isRivalryMatch`). 참이면 흐려지기 전까지 맨 위에
   * 라이벌전 띠 0x3b80c 를 그린다. 안 주면 거짓
   */
  readonly isRivalry?: boolean
  /** 54틱이 다 지났거나 OK·'5' 로 건너뛰었다 → 0x18(1회초 판) 또는 0xd */
  readonly onDone: () => void
}

/**
 * **경기 시작 인트로** — 경기 장면 상태 0xc (`lib/introSchedule` 머리말, 그리기 자리는 `lib/introLayout`, R10 3절).
 *
 * - 54틱(270 → 0, 5씩)이 지나면 끝, OK(−5)·'5' 면 받은 다음 틀의 키 자리(52da2 → 0x39b54, 갱신 앞)에서 끝. 웹은 Enter·Space 도 받는다.
 * - 효과음 61 은 진입 예약음이라 부르는 쪽(경기를 세우는 세션)이 이미 낸다.
 *
 * 그리기 차례(0x417ac): 배경 0x40ff0(카운터) → 띠 0x6a9f0(색 0x304ea2 · 알파 `max(1, +0x17e4 − 0x55)`) → game_ui 프레임 8 막대 →
 * 팀 이름 글씨(img_text 0x41 + n) → "스타디움"(img_text 185) → 점수판 틀 0x41440. 막대 · 글씨 · 점수판은 `[+0x17e6] ≤ 14` 면
 * 효과 1 · 인자 [+0x17e6](그림 몫 L/16)으로 함께 흐려진다. 이름 칸 칠은 상태 0xc 라 알파 [+0x17e4].
 * 띠는 효과 인자를 안 받고 알파만 내려간다(예전 웹은 띠 전체를 한 번 더 흐렸다 — 원본에 없다).
 *
 * 맨 위 겹: 라이벌전이고 `[+0x17e6] > 14`(흐려지기 전)면 라이벌전 띠 0x3b80c (41a00, `lib/rivalryBand`) — 그림 n 이 단계 min(n, 9).
 * 띠 칠 0x6a9f0(직접 뜸 6a9f0~6aa18): 색 윗바이트 알파가 0 · 0xff 가 아니면 플랫폼 그리기 속성 0x1400698(gc, 4, 알파)를 걸고 칠한다 —
 * 알파는 max(1, +0x17e4 − 0x55) = 1~170 이라 늘 섞는다. ⚠️ 미확인: 웹은 "윗바이트/255" 로 섞는다(남김 — 섞기 식은 단말 몫이라
 * 바이너리에 없다).
 */
/** 41a00 — 라이벌전이고 흐려지기 전([+0x17e6] > 14)이며 띠 단계가 1 이상 */
const showsRivalryBand = (isRivalry: boolean, fadeLevel: number, tick: number): boolean => isRivalry && fadeLevel > 14 && rivalryStepAt(tick) > 0

/** 캔버스로 이어 그릴 인트로 재료 — 점수판 측은 준 것만 */
function introCanvasInputOf(
  stadiumNameFrame: number,
  scoreboardSides: GameIntroProps['scoreboardSides'],
  fade: ReturnType<typeof introFadeAt>,
  effectLevel: number | null,
) {
  return { stadiumNameFrame, ...(scoreboardSides === undefined ? {} : { scoreboardSides }), fade, effectLevel }
}

export function GameIntro({ stadiumNameFrame, scoreboardSides, backdrop, isRivalry = false, onDone }: GameIntroProps) {
  // 인트로 0xc도 경기 장면 0x104 의 한 상태다 — 이 판만 그리는 동안에도 장면 객체(+0xfd4 · 파티클 관리자)는 그대로다(새로 서는 것은
  // 장면 전환 0x3874 의 new 뿐). 공용 창이 줄임 없이 닫히고([창+0x24f]) 창이 떠 있으면 장면이 선다(52cc6)
  useMarksGameScene()
  const doneRef = useRef(false)
  const onDoneRef = useRef(onDone)
  useMirrorRef(onDoneRef, onDone)
  const finish = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    onDoneRef.current()
  }, [])
  /** 받은 키 칸 — 인트로 키 0x39b54 는 받은 다음 틀의 52da2~ 상태 키 자리(갱신 표 52e14 앞)에서 돈다(`sceneKeyLatch`) */
  const keyLatch = useSceneKeyLatchOwner()
  const tick = useSceneTick(
    (next) => {
      if (next >= INTRO_TICKS) finish()
    },
    true,
    false,
    keyLatch,
  )
  const gameUiOrigins = useFrameOrigins(GAME_UI_FRAMES)
  const textOrigins = useFrameOrigins(IMG_TEXT_FRAMES)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || !isOkKey(event.key)) return
      event.preventDefault()
      keyLatch.push(finish)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [keyLatch, finish])

  const counter = introCounterAt(tick)
  const fade = introFadeAt(tick)
  const effectLevel = introScoreboardEffectOf(fade.level)
  /**
   * 띠 · 막대 · 글씨 · 점수판을 배경 캔버스에 이어 그린다(Q-03 r301 — 흐려지는 동안 효과 1 이 배경 화면을 읽어 원본 식으로 섞는다).
   * 배경이 없거나 그림을 다 받기 전(· 시험 DOM)이면 아래 DOM 근사로 둔다
   */
  const canvasOverlay =
    backdrop === undefined
      ? null
      : introCanvasOverlayOf(introCanvasInputOf(stadiumNameFrame, scoreboardSides, fade, effectLevel), gameUiOrigins, textOrigins)
  return (
    <RawScreen onPress={() => keyLatch.push(finish)}>
      {backdrop !== undefined && (
        <SceneryBackdrop stage={backdrop} offsetY={counter} {...(canvasOverlay === null ? {} : { overlay: canvasOverlay })} />
      )}
      {canvasOverlay === null && introDomLayersOf({ stadiumNameFrame, scoreboardSides, fade, effectLevel, gameUiOrigins, textOrigins })}
      {/* 41a00 — +0x194a && [+0x17e6] > 14 → 0x3b80c (그림 0 은 단계 0 이라 안 그린다) */}
      {showsRivalryBand(isRivalry, fade.level, tick) && <RivalryBandCanvas step={rivalryStepAt(tick)} />}
    </RawScreen>
  )
}

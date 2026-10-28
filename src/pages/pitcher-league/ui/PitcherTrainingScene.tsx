import { useEffect, useRef, useState } from 'react'
import { appTickNow, appTickOf } from '@/shared/lib/frameClock/frameClock'
import { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { outfitPaletteIndex } from '@/shared/lib/sprite/paletteSwap'
import { animationFolderOf, TRAINING_POPUP_UPDATES } from '@/shared/config/original/trainingAnimation'
import { animationStepAt, figurePoseAt } from '@/widgets/training-scene/lib/animationPlayback'
import { TrainingGauge } from '@/widgets/training-scene/ui/TrainingGauge'
import * as styles from '@/widgets/training-scene/ui/TrainingScene.css'
import { pitcherEquipmentOf, pitcherLayersOf } from '@/widgets/batting-stage/lib/batterLayers'
import type { BatterLayer } from '@/widgets/batting-stage/lib/batterLayers'
import { PITCHER_FRAMES } from '@/widgets/batting-stage/lib/spriteLoader'
import { FigureLayers } from '@/pages/special/ui/HallOfFameFigure'
import type { HallOfFameFigureLook } from '@/pages/special/lib/hallOfFameFigure'
import { isPitcherTrainingSkipKey } from '@/pages/pitcher-league/lib/pitcherTrainingPresentation'
import type { PitcherTrainingPresentation } from '@/pages/pitcher-league/lib/pitcherTrainingPresentation'
import { useSceneHour } from '@/shared/lib/phoneClock/phoneClock'
import { useModeBackSprite } from '@/shared/lib/phoneClock/useModeBackSprite'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

/** 연출 기준점 = 창 사각형 ((x + w) / 2, y + h + d) = (120, 137), d = 0 (0x19eb8 → 0x848d0(팝업, 1, 0) · 0x84954) */
const ANCHOR = { x: 120, y: 137 }
const WINDOW_FOLDER = assetUrl('./sprites/mode_back/frames')
/** 0x7b9ac(1, 66, −14): mode_back 을 (1, 52) 에 — 잘라내기 틀이 (1, 66) 이라 틀 안에서는 y −14 */
const WINDOW_OFFSET_Y = 52 - 66

export interface PitcherTrainingSceneProps {
  readonly presentation: PitcherTrainingPresentation
  /** 0x10810 이 그림에 넘기는 값 — 팀 · 폼 · 피부 · 장비 니블 (`pitcherCardLookOf`) */
  readonly look: HallOfFameFigureLook
  /** 게이지 끝(0x84e58 참) — 틀 0x18dd8 이 훈련 0x17f5c 로 간다 */
  readonly onFinished: () => void
}

/**
 * 나리 투수편 125 훈련 팝업 `0x848d0(팝업, 1, 0)` 모드 3 갈래 (`lib/pitcherTrainingPresentation` 머리말).
 * 창(mode_back 시간대) → 연출 애니 → 투수 그림(0xd49a4) → 게이지 차례는 타자편 · 시즌과 같은 함수다.
 * 확인 키(0x105a4)는 게이지를 끝으로 건너뛴다. 취소는 없다.
 */
export function PitcherTrainingScene({ presentation, look, onFinished }: PitcherTrainingSceneProps) {
  const folder = animationFolderOf(presentation.file)
  const origins = useFrameOrigins(folder)
  const animations = useAnimations(folder)
  const windowOrigins = useFrameOrigins(WINDOW_FOLDER)
  /** 창 배경 0x7b9ac — 프레임 · 팔레트 = 시간대 [gfx+0x1c] */
  const windowSprite = useModeBackSprite(useSceneHour())
  const [update, setUpdate] = useState(0)
  const skipRef = useRef<() => void>(() => undefined)
  const onFinishedRef = useRef(onFinished)
  onFinishedRef.current = onFinished

  useEffect(() => {
    const startTick = appTickNow()
    let handle = 0
    let isDone = false
    const finish = () => {
      if (isDone) return
      isDone = true
      cancelAnimationFrame(handle)
      onFinishedRef.current()
    }
    const tick = (now: number) => {
      const current = Math.max(0, appTickOf(now) - startTick)
      setUpdate(current)
      if (current >= TRAINING_POPUP_UPDATES) return finish()
      handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)
    // [+0x1d0] = [+0x1d8] — 게이지 끝이라 다음 틀의 0x84e58 이 참이다(원본은 다음 갱신, 웹은 곧바로)
    skipRef.current = () => {
      setUpdate(TRAINING_POPUP_UPDATES)
      finish()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isPitcherTrainingSkipKey(event.key)) return
      event.preventDefault()
      skipRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      isDone = true
      cancelAnimationFrame(handle)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const entries = animations?.[presentation.animation]
  const step = entries === undefined ? null : animationStepAt(entries, update)
  const frameKey = step === null ? '' : String(step.frame).padStart(3, '0')
  const origin = step === null ? undefined : origins?.[frameKey]
  const windowKey = windowSprite.key
  const windowOrigin = windowOrigins?.[windowKey]
  const { figure } = presentation

  return (
    <div
      data-testid="투수-훈련팝업"
      data-slot={presentation.slot}
      data-file={presentation.file}
      data-animation={presentation.animation}
      style={{ position: 'absolute', left: 0, top: 0, width: 240, height: 320 }}
      onClick={() => skipRef.current()}
    >
      <div className={styles.windowClip}>
        {windowOrigin !== undefined && (
          <img className={styles.sprite} style={{ left: windowOrigin.x, top: WINDOW_OFFSET_Y + windowOrigin.y }} src={windowSprite.src} alt="" />
        )}
      </div>
      <div className={styles.animationClip}>
        {origin !== undefined && step !== null && (
          <img
            className={styles.sprite}
            style={{ left: ANCHOR.x + origin.x + step.dx, top: ANCHOR.y + origin.y + step.dy }}
            src={`${folder}/${frameKey}.png`}
            alt=""
          />
        )}
        {figure !== null && step !== null && (
          <PitcherTrainingFigure
            look={look}
            pose={figurePoseAt(figure.poses, step.entryIndex)}
            poses={figure.poses}
            x={ANCHOR.x + figure.dx}
            y={ANCHOR.y + figure.dy}
          />
        )}
      </div>
      <TrainingGauge filled={update} />
    </div>
  )
}

/**
 * 단일 PZX 투수 그림 0x79525 — 동작 번호 = pitcher.pzx 프레임 번호(0x795f6). 겹 · 팔레트는 기본정보 카드와 같은 0x10810 값이고,
 * 0x11744 가 그 뒤 +0x3c 를 0 으로 둬 손과 상관없이 안 뒤집는다.
 */
function PitcherTrainingFigure({
  look,
  pose,
  poses,
  x,
  y,
}: {
  readonly look: HallOfFameFigureLook
  readonly pose: number
  /** 이 애니가 낼 자세들 — 그 겹을 미리 칠해 둔다 */
  readonly poses: readonly number[]
  readonly x: number
  readonly y: number
}) {
  const [control, velocity, breaking, stamina] = look.equipment
  const equipment = pitcherEquipmentOf({ control, velocity, breaking, stamina })
  const paletteOf = (layer: BatterLayer) =>
    layer.gradePaletteRow ?? (layer.folder === PITCHER_FRAMES ? outfitPaletteIndex(look.skin, look.team) : null)
  return (
    <FigureLayers
      layers={pitcherLayersOf(pose, equipment)}
      x={x}
      y={y}
      isMirrored={false}
      paletteOf={paletteOf}
      testId="투수-훈련-투수"
      warmLayers={[...new Set(poses)].flatMap((shown) => pitcherLayersOf(shown, equipment))}
    />
  )
}

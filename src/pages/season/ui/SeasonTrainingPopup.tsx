import { useEffect, useRef, useState } from 'react'
import { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useRecoloredSprite, outfitPaletteIndex } from '@/shared/lib/sprite/paletteSwap'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { animationFolderOf, TRAINING_POPUP_UPDATES } from '@/shared/config/original/trainingAnimation'
import { animationStepAt, figurePoseAt } from '@/widgets/training-scene/lib/animationPlayback'
import { TrainingFigure } from '@/widgets/training-scene/ui/TrainingFigure'
import { TrainingGauge } from '@/widgets/training-scene/ui/TrainingGauge'
import { pitcherLayersOf } from '@/widgets/batting-stage/lib/batterLayers'
import type { BatterLayer } from '@/widgets/batting-stage/lib/batterLayers'
import { PITCHER_FRAMES } from '@/widgets/batting-stage/lib/spriteLoader'
import { backgroundFrameOf } from '@/pages/management/lib/managementLayout'
import {
  SEASON_TRAINING_BATTER_FORM, SEASON_TRAINING_PRESENTATIONS, SEASON_TRAINING_SKIN, isSeasonTrainingSkipKey,
} from '@/pages/season/lib/seasonTrainingPopup'
import * as styles from '@/widgets/training-scene/ui/TrainingScene.css'

/** 연출 기준점 = 창 사각형 ((x + w) / 2, y + h + d) = (120, 137), d = 0 (0x84954) */
const ANCHOR = { x: 120, y: 137 }
const WINDOW_FOLDER = './sprites/mode_back/frames'
/** 0x7b9ac(1, 66, −14): mode_back 을 (1, 52) 에 — 잘라내기 틀이 (1, 66) 이라 틀 안에서는 y −14 */
const WINDOW_OFFSET_Y = 52 - 66

export interface SeasonTrainingPopupProps {
  /** 고른 칸 t (0~3 팀 능력치 · 4 지옥훈련) */
  readonly slot: number
  /** 내 팀 [SR+1] — 캐릭터 유니폼 팔레트 */
  readonly teamIndex: number
  /** 게이지 끝 — 굴림 0xc074 로 넘어간다 */
  readonly onFinished: () => void
}

/**
 * 시즌 0xde 훈련 팝업 `0x848d0(gfx, 1, 0)` (`lib/seasonTrainingPopup` 머리말). 창 · 연출 · 캐릭터 · 게이지 차례는
 * 나리 팝업과 같은 함수다 — 갈리는 것은 0x84664 의 파일·애니 표와 캐릭터(칸 0 투수 · 1 타자 · 그 밖 없음)뿐.
 * 확인 키(0x4968)는 게이지를 끝으로 건너뛴다. 취소는 없다.
 */
export function SeasonTrainingPopup({ slot, teamIndex, onFinished }: SeasonTrainingPopupProps) {
  const presentation = SEASON_TRAINING_PRESENTATIONS[slot] ?? SEASON_TRAINING_PRESENTATIONS[0]
  const folder = animationFolderOf(presentation.file)
  const origins = useFrameOrigins(folder)
  const animations = useAnimations(folder)
  const windowOrigins = useFrameOrigins(WINDOW_FOLDER)
  const [update, setUpdate] = useState(0)
  const skipRef = useRef<() => void>(() => undefined)
  const onFinishedRef = useRef(onFinished)
  onFinishedRef.current = onFinished

  useEffect(() => {
    const startedAt = performance.now()
    let handle = 0
    let isDone = false
    const finish = () => {
      if (isDone) return
      isDone = true
      cancelAnimationFrame(handle)
      onFinishedRef.current()
    }
    const tick = (now: number) => {
      const current = Math.floor((now - startedAt) / millisecondsPerFrame())
      setUpdate(current)
      if (current >= TRAINING_POPUP_UPDATES) return finish()
      handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)
    // [gfx+0x1d0] = [gfx+0x1d8] — 게이지 끝이라 0x84e58 이 끝을 본다(원본은 다음 갱신, 웹은 곧바로)
    skipRef.current = () => {
      setUpdate(TRAINING_POPUP_UPDATES)
      finish()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isSeasonTrainingSkipKey(event.key)) return
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
  const windowKey = String(backgroundFrameOf(new Date().getHours())).padStart(3, '0')
  const windowOrigin = windowOrigins?.[windowKey]
  const { figure } = presentation

  return (
    <div data-testid="시즌-훈련팝업" data-slot={slot} style={{ position: 'absolute', left: 0, top: 0, width: 240, height: 320 }}
      onClick={() => skipRef.current()}>
      <div className={styles.windowClip}>
        {windowOrigin !== undefined && (
          <img className={styles.sprite} style={{ left: windowOrigin.x, top: WINDOW_OFFSET_Y + windowOrigin.y }}
            src={`${WINDOW_FOLDER}/${windowKey}.png`} alt="" />
        )}
      </div>
      <div className={styles.animationClip}>
        {origin !== undefined && step !== null && (
          <img className={styles.sprite} style={{ left: ANCHOR.x + origin.x + step.dx, top: ANCHOR.y + origin.y + step.dy }}
            src={`${folder}/${frameKey}.png`} alt="" />
        )}
        {figure !== null && step !== null && figure.kind === '타자' && (
          <TrainingFigure pose={figurePoseAt(figure.poses, step.entryIndex)} skinIndex={SEASON_TRAINING_SKIN} teamIndex={teamIndex}
            form={SEASON_TRAINING_BATTER_FORM} x={ANCHOR.x + figure.dx} y={ANCHOR.y + figure.dy} />
        )}
        {figure !== null && step !== null && figure.kind === '투수' && (
          <PitcherTrainingFigure pose={figurePoseAt(figure.poses, step.entryIndex)} teamIndex={teamIndex}
            x={ANCHOR.x + figure.dx} y={ANCHOR.y + figure.dy} />
        )}
      </div>
      <TrainingGauge filled={update} />
    </div>
  )
}

/**
 * 단일 PZX 투수 그림 0x79525 — 동작 번호 = pitcher.pzx 프레임 번호(0x795f6), +0x3d < 0(마투수 아님) 갈래의 겹 여섯 칸
 * (`pitcherLayersOf` — 새로 만든 객체라 장비 칸은 비어 있다). +0x3c = 0 이라 안 뒤집는다. 바탕 팔레트 = 피부 0 × 15 + 팀.
 */
function PitcherTrainingFigure({ pose, teamIndex, x, y }: {
  readonly pose: number
  readonly teamIndex: number
  readonly x: number
  readonly y: number
}) {
  return (
    <div data-testid="시즌-훈련-투수" style={{ position: 'absolute', left: x, top: 0 }}>
      {pitcherLayersOf(pose).map((layer, index) => (
        <PitcherLayer key={`${layer.folder}#${index}`} layer={layer} y={y}
          paletteIndex={layer.gradePaletteRow ?? (layer.folder === PITCHER_FRAMES ? outfitPaletteIndex(SEASON_TRAINING_SKIN, teamIndex) : null)} />
      ))}
    </div>
  )
}

function PitcherLayer({ layer, y, paletteIndex }: { readonly layer: BatterLayer; readonly y: number; readonly paletteIndex: number | null }) {
  const key = String(layer.frame).padStart(3, '0')
  const src = useRecoloredSprite(`${layer.folder}/${key}.png`, paletteIndex)
  const origin = useFrameOrigins(layer.folder)?.[key]
  if (origin === undefined) return null
  return <img className={styles.sprite} style={{ left: origin.x, top: y + origin.y }} src={src} alt="" />
}

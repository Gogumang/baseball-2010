import { useEffect, useRef, useState } from 'react'
import { appTickNow, appTickOf } from '@/shared/lib/frameClock/frameClock'
import { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { animationFolderOf, figurePosesOf, TRAINING_POPUP_UPDATES } from '@/shared/config/original/trainingAnimation'
import type { TrainingPresentation } from '@/shared/config/original/trainingAnimation'
import { animationStepAt, figurePoseAt } from '@/widgets/training-scene/lib/animationPlayback'
import { batterEquipmentOf, NO_EQUIPMENT } from '@/widgets/batting-stage/lib/batterLayers'
import { TrainingFigure } from '@/widgets/training-scene/ui/TrainingFigure'
import { TrainingGauge } from '@/widgets/training-scene/ui/TrainingGauge'
import * as styles from '@/widgets/training-scene/ui/TrainingScene.css'
import { useSceneHour } from '@/shared/lib/phoneClock/phoneClock'
import { useModeBackSprite } from '@/shared/lib/phoneClock/useModeBackSprite'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

/** 연출 기준점 = 창 사각형 ((x + w) / 2, y + h) = (120, 137) (0x84954) */
const ANCHOR = { x: 120, y: 137 }
const WINDOW_FOLDER = assetUrl('./sprites/mode_back/frames')
/** 창 배경은 mode_back 을 (1, 52) 에 그린다 — 잘라내기 틀이 (1, 66) 이라 틀 안에서는 y −14 */
const WINDOW_OFFSET_Y = 52 - 66

interface TrainingSceneProps {
  /** null 이면 연출 없이 창만 보인다 */
  readonly presentation: TrainingPresentation | null
  /**
   * 타자 타입 (0 타격형 · 그 밖 장타형) — 동작표를 가른다 (F-6 · 5-3 확정).
   * 안 넘기면 타격형으로 본다.
   */
  readonly battingTypeIndex?: number
  /**
   * **장착 장비 니블** = `career.equipmentLevels` (0 미장착 · 1~11 = 레벨+1).
   * 원본 훈련 팝업 캐릭터도 관리 화면 그림 객체 그대로라 0x10810 의 니블 루프(0x10866)가
   * 머리·손·다리 아이템 겹을 채워 준다 — `TrainingFigure` 주석 참고.
   */
  readonly equipmentLevels?: { readonly hit: number; readonly power: number; readonly run: number }
  /** 피부 번호 · 내 팀 — 몸통·헬멧 팔레트 (0x10810 → 0x78be8·0x78c14). 안 넘기면 구운 색 그대로 */
  readonly skinIndex?: number
  readonly teamIndex?: number
  /** 게이지가 가득 차면(60번 갱신) — 또는 확인 키로 건너뛰면 — 불린다 */
  readonly onFinished?: () => void
}

/**
 * 진입 0x11744 가 0x10810(그림 적재 — 손 0xb63c0 을 +0x3c 에 넣는다) **뒤에** 그림 +0x3c 를 모드 4(타자편)면 1, 그 밖이면 0 으로
 * 덮어쓴다(11802~1181e). 그리기 0x78cfc 는 +0x3c == 0 일 때만 효과 0x11(뒤집기)로 부르므로(78d0c~78d18) 타자편 훈련 팝업의
 * 타자는 **손과 상관없이 안 뒤집힌다**.
 */
const BATTER_TRAINING_FIGURE_FLAG = 1

/** 키 0x105a4 — 확인(−5) · '5' 면 [팝업+0x1d0] = [팝업+0x1d8](게이지 끝). 그 밖 키 없음(취소도 안 받는다) */
const isTrainingSkipKey = (key: string): boolean => key === 'Enter' || key === '5' || key === ' '

/**
 * 원작 훈련 팝업. presentation 이 바뀔 때마다 처음부터 튼다.
 * 훈련 이름 글은 없다 — 0x848d0 은 창 · 연출 · 캐릭터 · 게이지만 그리고 글자 그리기(0x9c068)를 안 부른다(투수편 · 시즌 팝업과 같다, r204).
 */
export function TrainingScene({ presentation, battingTypeIndex = 0, equipmentLevels, skinIndex, teamIndex, onFinished }: TrainingSceneProps) {
  const folder = animationFolderOf(presentation?.file ?? 'raise_traning_ani')
  const origins = useFrameOrigins(folder)
  const animations = useAnimations(folder)
  const windowOrigins = useFrameOrigins(WINDOW_FOLDER)
  /** 창 배경 0x7b9ac — 프레임 · 팔레트 = 시간대 [gfx+0x1c] (장면에 들어설 때 0x7b934 가 세운 값) */
  const windowSprite = useModeBackSprite(useSceneHour())
  const [update, setUpdate] = useState(-1)

  const onFinishedRef = useRef(onFinished)
  onFinishedRef.current = onFinished

  useEffect(() => {
    if (presentation === null) {
      setUpdate(-1)
      return
    }
    const startTick = appTickNow()
    let handle = 0
    let isDone = false
    const finish = () => {
      if (isDone) return
      isDone = true
      cancelAnimationFrame(handle)
      onFinishedRef.current?.()
    }
    const tick = (now: number) => {
      const current = Math.max(0, appTickOf(now) - startTick)
      setUpdate(current)
      if (current >= TRAINING_POPUP_UPDATES) return finish()
      handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)
    // 0x105a4 — 게이지 끝이라 다음 틀의 0x84e58 이 참이다(원본은 다음 갱신, 웹은 곧바로 — 투수편 `PitcherTrainingScene` 과 같다)
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTrainingSkipKey(event.key)) return
      event.preventDefault()
      setUpdate(TRAINING_POPUP_UPDATES)
      finish()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      isDone = true
      cancelAnimationFrame(handle)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [presentation])

  const entries = presentation === null ? null : animations?.[presentation.animation]
  const step = entries === undefined || entries === null || update < 0 ? null : animationStepAt(entries, update)
  const frameKey = step === null ? '' : String(step.frame).padStart(3, '0')
  const origin = step === null ? undefined : origins?.[frameKey]
  const figure = presentation?.figure ?? null
  const windowKey = windowSprite.key
  const windowOrigin = windowOrigins?.[windowKey]

  return (
    <div className={styles.scene}>
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
          <TrainingFigure
            pose={figurePoseAt(figurePosesOf(figure, battingTypeIndex), step.entryIndex)}
            warmPoses={figurePosesOf(figure, battingTypeIndex)}
            equipment={equipmentLevels === undefined ? NO_EQUIPMENT : batterEquipmentOf(equipmentLevels)}
            skinIndex={skinIndex}
            teamIndex={teamIndex}
            // 폼 rec[0xb] >> 4 = 2 × 타입 + 손 (0x1081a) — 몸통 종류(폼 >> 1)만 가른다. 손은 아래 +0x3c 덮어쓰기에 묻힌다
            form={battingTypeIndex * 2}
            mirrorFlag={BATTER_TRAINING_FIGURE_FLAG}
            x={ANCHOR.x + figure.offsetX}
            y={ANCHOR.y - figure.liftY}
          />
        )}
      </div>
      {presentation !== null && update >= 0 && <TrainingGauge filled={update} />}
    </div>
  )
}

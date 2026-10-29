import { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { animationFolderOf } from '@/shared/config/original/trainingAnimation'
import { animationStepAt, figurePoseAt } from '@/widgets/training-scene/lib/animationPlayback'
import { TrainingFigure } from '@/widgets/training-scene/ui/TrainingFigure'
import { TrainingGauge } from '@/widgets/training-scene/ui/TrainingGauge'
import {
  SEASON_TRAINING_BATTER_FORM,
  SEASON_TRAINING_BATTER_MIRROR_FLAG,
  SEASON_TRAINING_PRESENTATIONS,
  SEASON_TRAINING_SKIN,
  isSeasonTrainingSkipKey,
} from '@/pages/season/lib/seasonTrainingPopup'
import * as styles from '@/widgets/training-scene/ui/TrainingScene.css'
import { useSceneHour } from '@/shared/lib/phoneClock/phoneClock'
import { useModeBackSprite } from '@/shared/lib/phoneClock/useModeBackSprite'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import { useGaugePopupTicks } from '@/pages/season/ui/gaugePopup/useGaugePopupTicks'
import { PitcherTrainingFigure } from '@/pages/season/ui/seasonTrainingPopup/PitcherTrainingFigure'

/** 연출 기준점 = 창 사각형 ((x + w) / 2, y + h + d) = (120, 137), d = 0 (0x84954) */
const ANCHOR = { x: 120, y: 137 }
const WINDOW_FOLDER = assetUrl('./sprites/mode_back/frames')
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
  /** 창 배경 0x7b9ac — 프레임 · 팔레트 = 시간대 [gfx+0x1c] (장면에 들어설 때 0x7b934 가 세운 값) */
  const windowSprite = useModeBackSprite(useSceneHour())
  const [update, skipRef] = useGaugePopupTicks(isSeasonTrainingSkipKey, onFinished)

  const entries = animations?.[presentation.animation]
  const step = entries === undefined ? null : animationStepAt(entries, update)
  const frameKey = step === null ? '' : String(step.frame).padStart(3, '0')
  const origin = step === null ? undefined : origins?.[frameKey]
  const windowKey = windowSprite.key
  const windowOrigin = windowOrigins?.[windowKey]
  const { figure } = presentation

  return (
    <div
      data-testid="시즌-훈련팝업"
      data-slot={slot}
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
        {figure !== null && step !== null && figure.kind === '타자' && (
          <TrainingFigure
            pose={figurePoseAt(figure.poses, step.entryIndex)}
            warmPoses={figure.poses}
            skinIndex={SEASON_TRAINING_SKIN}
            teamIndex={teamIndex}
            form={SEASON_TRAINING_BATTER_FORM}
            mirrorFlag={SEASON_TRAINING_BATTER_MIRROR_FLAG}
            x={ANCHOR.x + figure.dx}
            y={ANCHOR.y + figure.dy}
          />
        )}
        {figure !== null && step !== null && figure.kind === '투수' && (
          <PitcherTrainingFigure
            pose={figurePoseAt(figure.poses, step.entryIndex)}
            poses={figure.poses}
            teamIndex={teamIndex}
            x={ANCHOR.x + figure.dx}
            y={ANCHOR.y + figure.dy}
          />
        )}
      </div>
      <TrainingGauge filled={update} />
    </div>
  )
}

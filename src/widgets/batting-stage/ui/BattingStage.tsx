import { useCallback, useMemo } from 'react'
import { resolvePitch } from '@/features/play-at-bat/model/resolvePitch'
import type { BattingSwing } from '@/features/play-at-bat/model/resolvePitch'
import { nextBatterShift } from '@/features/play-at-bat/model/batterShift'
import { createPatternDeck } from '@/entities/batting/model/battedBallOutcome'
import type { SwingMode } from '@/entities/batting/model/swingResult'
import type { BatterAbility } from '@/entities/batting/model/batter'
import type { Pitch, PitcherAbility } from '@/entities/pitching/model/pitch'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import { STAGE_HEIGHT, STAGE_WIDTH } from '@/widgets/batting-stage/lib/renderBattingStage'
import { describeResolution, situationOf } from '@/widgets/batting-stage/lib/stageText'
import { ballFrameAt, useStageRefs } from '@/widgets/batting-stage/model/stageRefs'
import type { AcePitcherFrames, StageHud } from '@/widgets/batting-stage/model/stageRefs'
import { useStageAnimation } from '@/widgets/batting-stage/model/useStageAnimation'
import { useStageControls } from '@/widgets/batting-stage/model/useStageControls'
import * as styles from '@/widgets/batting-stage/ui/BattingStage.css'

interface BattingStageProps {
  readonly batterAbility: BatterAbility
  readonly pitcherAbility: PitcherAbility
  readonly isEagleEyeEnabled: boolean
  /** 화면에 겹쳐 그릴 경기 상황 */
  readonly hud: StageHud | null
  /** 등판한 마선수의 합성 프레임. 없으면 평범한 투수다. */
  readonly acePitcher: AcePitcherFrames | null
  /** 번트를 쓸 수 있는지 */
  readonly canBunt?: boolean
  /** 판정 모드 — 나만의리그는 "내 선수" 보너스가 붙는다 (0xab214) */
  readonly swingMode?: SwingMode
  readonly batterSkillIds?: readonly number[]
  readonly recentAtBatCodes?: readonly number[]
  /** 참이면 새 공을 던지지 않는다. 타석 결과 연출 중에 쓴다. */
  readonly isPaused: boolean
  readonly random: RandomPort
  readonly onPitchResolved: (detail: PitchOutcomeDetail, pitch: Pitch) => void
}

/** 원작 타석 화면. 그리기는 lib, 루프와 조작은 model이 맡는다. */
export function BattingStage({ canBunt = false, swingMode = '일반', batterSkillIds = [], recentAtBatCodes = [], ...props }: BattingStageProps) {
  const refs = useStageRefs({ ...props, canBunt, swingMode, batterSkillIds, recentAtBatCodes })
  const { pitchRef, phaseRef, phaseStartedAtRef, resultTextRef, swingStartedAtRef, shiftRef, buntRef, deckRef, latestRef } = refs

  const finishPitch = useCallback((swing: BattingSwing | null, now: number) => {
    const pitch = pitchRef.current
    if (pitch === null) return
    const latest = latestRef.current
    const deck = deckRef.current ?? createPatternDeck(latest.random)
    const context = {
      batter: latest.batterAbility,
      pitcher: latest.pitcherAbility,
      mode: latest.swingMode,
      batterSkillIds: latest.batterSkillIds,
      situation: situationOf(latest.hud, latest.recentAtBatCodes),
      // 마선수가 등판했으면 원본 isAce 가 켜진 것과 같다 (0xab214 의 마선수 계수·보너스)
      isPitcherAce: latest.acePitcher !== null,
    }
    const result = resolvePitch(pitch, swing, context, deck, latest.random)
    deckRef.current = result.deck
    buntRef.current = null
    resultTextRef.current = describeResolution(result.detail)
    phaseRef.current = '결과'
    phaseStartedAtRef.current = now
    latest.onPitchResolved(result.detail, pitch)
  }, [])

  const actions = useMemo(() => {
    const frameNow = (now: number) => ballFrameAt(now, phaseStartedAtRef.current, millisecondsPerFrame())
    // 스윙·번트는 공이 나는 동안(상태 0x11)만 받는다 — 릴리스 전에는 무시한다
    const isFlying = (now: number) => phaseRef.current === '투구중' && pitchRef.current !== null && frameNow(now) >= 0
    return {
      swing: (now: number) => {
        if (!isFlying(now)) return
        swingStartedAtRef.current = now
        finishPitch({ frame: frameNow(now), shift: shiftRef.current, buntKind: 0 }, now)
      },
      toggleBunt: (kind: number, now: number) => {
        if (!isFlying(now)) return
        buntRef.current = buntRef.current === null ? { kind, frame: frameNow(now) } : null
      },
      moveBatter: (direction: -1 | 1) => {
        shiftRef.current = nextBatterShift(shiftRef.current, direction)
      },
    }
  }, [finishPitch])

  useStageAnimation(refs, finishPitch)
  const pointerHandlers = useStageControls(refs, actions)

  return (
    <canvas
      ref={refs.canvasRef}
      className={styles.stage}
      width={STAGE_WIDTH}
      height={STAGE_HEIGHT}
      {...pointerHandlers}
    />
  )
}

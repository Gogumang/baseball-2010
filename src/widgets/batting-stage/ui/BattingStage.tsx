import { useCallback, useMemo, useRef } from 'react'
import { resolvePitch } from '@/features/play-at-bat/model/resolvePitch'
import type { BattingSwing } from '@/features/play-at-bat/model/resolvePitch'
import { nextBatterShift } from '@/features/play-at-bat/model/batterShift'
import { createPatternDeck } from '@/entities/batting/model/battedBallOutcome'
import { hitPauseTicksOf, pauseInputOf } from '@/widgets/batting-stage/lib/hitPause'
import type { SwingMode } from '@/entities/batting/model/swingResult'
import type { BatterAbility } from '@/entities/batting/model/batter'
import type { Pitch, PitcherAbility } from '@/entities/pitching/model/pitch'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import { STAGE_HEIGHT, STAGE_WIDTH } from '@/widgets/batting-stage/lib/renderBattingStage'
import { describeResolution, isHomeRunResolution, situationOf } from '@/widgets/batting-stage/lib/stageText'
import { ballFrameAt, useStageRefs } from '@/widgets/batting-stage/model/stageRefs'
import type { AcePitcherFrames, StageHud } from '@/widgets/batting-stage/model/stageRefs'
import { useStageAnimation } from '@/widgets/batting-stage/model/useStageAnimation'
import { useStageControls } from '@/widgets/batting-stage/model/useStageControls'
import { rollSpecialSwing } from '@/entities/batting/model/specialSwing'
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
  /**
   * **타자 폼** = 원본 선수 레코드 `rec[0xb]` 의 윗니블 `2 × 타입 + 손` (C 5절 0x16f9a).
   * 몸통 파일(balancer/sluger)과 자세표를 `폼 >> 1` 로 고른다 (0x78ab0).
   * 안 넘기면 0 = 타격형·우타라 예전과 같은 밸런스형 몸통이다.
   */
  readonly batterForm?: number
  readonly batterSkillIds?: readonly number[]
  readonly recentAtBatCodes?: readonly number[]
  /** 참이면 새 공을 던지지 않는다. 타석 결과 연출 중에 쓴다. */
  readonly isPaused: boolean
  readonly random: RandomPort
  /**
   * **필살타법 레벨** (선수 기록 +0x201). 0 이면 못 배운 것이라 '0' 키를 눌러도 늘 실패한다.
   * 마타자는 번호와 무관하게 30% 라 `isAceBatter` 로 따로 알린다 (H2 2-2).
   */
  readonly specialSwingLevel?: number
  readonly isAceBatter?: boolean
  /**
   * 세 번째 인자는 **필살타법이 성공한 타구인가** — 성공하면 야수가 쥐지 않고 지나친다
   * (0x51800 → `features/defense-play` 의 `isUncatchable`).
   */
  readonly onPitchResolved: (detail: PitchOutcomeDetail, pitch: Pitch, isUncatchable?: boolean) => void
}

/** 원작 타석 화면. 그리기는 lib, 루프와 조작은 model이 맡는다. */
export function BattingStage({ canBunt = false, swingMode = '일반', batterForm = 0, batterSkillIds = [], recentAtBatCodes = [], specialSwingLevel = 0, isAceBatter = false, ...props }: BattingStageProps) {
  const refs = useStageRefs({ ...props, canBunt, swingMode, batterForm, batterSkillIds, recentAtBatCodes })
  /**
   * 이번 공에 필살타법을 걸어 두었는가 (`S+0x10`).
   * 새 투구 준비 `0x34334` 가 0 으로 되돌리므로 **공마다 다시 눌러야 한다** (H2 2-2).
   */
  const specialArmedRef = useRef(false)
  const { pitchRef, phaseRef, phaseStartedAtRef, resultTextRef, homeRunStartedAtRef, swingStartedAtRef, shiftRef, buntRef, deckRef, pendingHitRef, latestRef } = refs

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
      situation: situationOf(latest.hud, latest.recentAtBatCodes, latest.batterForm),
      // 마선수가 등판했으면 원본 isAce 가 켜진 것과 같다 (0xab214 의 마선수 계수·보너스)
      isPitcherAce: latest.acePitcher !== null,
    }
    const result = resolvePitch(pitch, swing, context, deck, latest.random)
    // 필살 스윙이면 여기서 굴린다 (0x34c74). 걸어 두지 않았으면 굴리지 않는다
    const isUncatchable = specialArmedRef.current
      && rollSpecialSwing(specialSwingLevel, latest.random, isAceBatter)
    specialArmedRef.current = false
    deckRef.current = result.deck
    buntRef.current = null
    const resultText = describeResolution(result.detail)
    // 홈런이면 판정 글자 대신 HOMERUN 글자 연출을 켠다 (원본 0x51cd8 의 +0x1960, 사운드 11 은 웹에 없음)
    const isHomeRun = isHomeRunResolution(result.detail)

    // 맞은 공이면 인플레이(0x17) 앞에 **상태 0x13** 을 한 번 거친다. 헛스윙·볼은 0x12 라 그냥 결과다.
    if (result.detail.resultCode !== null) {
      pendingHitRef.current = {
        ticks: hitPauseTicksOf(pauseInputOf(result.detail.resultCode, result.deck)),
        detail: result.detail,
        pitch,
        isUncatchable,
        isHomeRun,
        resultText,
      }
      phaseRef.current = '타격'
      phaseStartedAtRef.current = now
      return
    }

    resultTextRef.current = resultText
    homeRunStartedAtRef.current = isHomeRun ? now : -1
    phaseRef.current = '결과'
    phaseStartedAtRef.current = now
    latest.onPitchResolved(result.detail, pitch, isUncatchable)
  }, [isAceBatter, specialSwingLevel])

  /** 상태 0x13 을 끝내고 인플레이(0x17)로 넘긴다 — 시간이 다 됐거나 OK/'5' 로 건너뛸 때 */
  const commitHit = useCallback((now: number) => {
    const pending = pendingHitRef.current
    if (pending === null) return
    pendingHitRef.current = null
    resultTextRef.current = pending.resultText
    homeRunStartedAtRef.current = pending.isHomeRun ? now : -1
    phaseRef.current = '결과'
    phaseStartedAtRef.current = now
    latestRef.current.onPitchResolved(pending.detail, pending.pitch, pending.isUncatchable)
  }, [])

  const actions = useMemo(() => {
    const frameNow = (now: number) => ballFrameAt(now, phaseStartedAtRef.current, millisecondsPerFrame())
    // 스윙·번트는 공이 나는 동안(상태 0x11)만 받는다 — 릴리스 전에는 무시한다
    const isFlying = (now: number) => phaseRef.current === '투구중' && pitchRef.current !== null && frameNow(now) >= 0
    return {
      swing: (now: number) => {
        // 상태 0x13 은 OK(−5)·'5' 로 건너뛴다 (0x406e8). 그때 스윙 키는 건너뛰기로만 쓰인다
        if (phaseRef.current === '타격') return commitHit(now)
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
      /** '0' 은 **이번 공에** 필살타법을 건다 — 스윙은 따로 해야 한다 (0x535a4 → 0x6a6) */
      specialSwing: (now: number) => {
        if (!isFlying(now)) return
        specialArmedRef.current = true
      },
    }
  }, [commitHit, finishPitch])

  useStageAnimation(refs, finishPitch, commitHit)
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

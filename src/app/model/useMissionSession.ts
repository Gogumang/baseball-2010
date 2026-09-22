import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import type { Screen } from '@/app/model/screen'
import type { AtBatRunner } from '@/app/model/useAtBatRunner'
import { isAtBatFinished } from '@/entities/at-bat/model/atBatState'
import { describeOutcomeBanner, describePitchResolution } from '@/entities/at-bat/model/resolutionText'
import { missionKeyOf } from '@/entities/mission/model/missionGoal'
import { matchResultEventOf } from '@/entities/story/model/aceMatch'
import { runnerCountOf } from '@/entities/game/model/baseState'
import {
  applyOutcome as applyMissionOutcome,
  applySteal,
  canSteal,
  checkSwingsExhausted,
  failSteal,
  giveUp as giveUpMission,
  recordSwing,
  startMission,
  tick as tickMission,
} from '@/entities/mission/model/missionRun'
import type { MissionRun } from '@/entities/mission/model/missionRun'
import {
  applyPitcherOutcome,
  checkPitchExhausted,
  recordPitch,
  startPitcherMission,
} from '@/entities/mission/model/pitcherRun'
import type { PitcherRun } from '@/entities/mission/model/pitcherRun'
import { attemptSteal } from '@/entities/game/model/steal'
import { missionOpponentOf, pitcherAbilityOf } from '@/entities/game/model/aceOpponent'
import { buildPitch, courseOf } from '@/entities/pitching/model/pitchCommand'
import type { GaugeResult } from '@/entities/pitching/model/pitchCommand'
import { pitchAgainstBatter } from '@/entities/pitching/model/simulateBatter'
import { DEFAULT_PITCHER_ABILITY } from '@/entities/pitching/model/pitch'
import type { PitcherAbility } from '@/entities/pitching/model/pitch'
import { ROOKIE_BATTER_ABILITY } from '@/entities/batting/model/batter'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import { inPlayCallSoundIdOf, pitchCallSoundIdOf, PITCH_RELEASE_SOUND } from '@/features/play-at-bat/model/atBatSounds'
import { playSoundIds } from '@/app/model/useSound'
import { createSilentSound } from '@/shared/api/audio/soundPort'
import type { SoundPort } from '@/shared/api/audio/soundPort'
import type { BatterAbility } from '@/entities/batting/model/batter'
import type { OriginalMission } from '@/shared/config/original/missions'
import type { AcePlayer } from '@/shared/config/original/acePlayers'
import type { PitchTypeInfo } from '@/shared/config/original/pitchTypes'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { MissionClearCounts, MissionRecordPort } from '@/shared/api/save/missionRecordPort'
import { missionRewardOf } from '@/entities/mission/model/missionReward'

interface MissionSessionInput {
  readonly runner: AtBatRunner
  readonly random: RandomPort
  readonly missionRecord: MissionRecordPort
  readonly screen: Screen
  readonly setScreen: (screen: Screen) => void
  /**
   * 미션 클리어 보상 G 를 받아 갈 곳 (0xa52b0). 원본은 전역 저장에 쌓지만 웹은 커리어에 둔다 —
   * 육성 선수가 없으면 받아 갈 곳이 없으므로 넘기지 않아도 된다.
   */
  readonly onGamePointReward?: (amount: number) => void
  /** 소리 통로 (원본 사운드 객체 `[0x1400058]`). 안 넘기면 아무 소리도 안 난다 */
  readonly sound?: SoundPort
}

/** 미션 상대. 원본 레코드의 마선수 순번이 있으면 그 마선수다 (타자 미션이면 마투수). */
export function missionOpponent(mission: OriginalMission): AcePlayer | null {
  return missionOpponentOf(mission.side === '타자' ? '투수' : '타자', mission.opponentAce)
}

export function missionPitcherAbility(mission: OriginalMission): PitcherAbility {
  const opponent = missionOpponent(mission)
  return opponent === null ? DEFAULT_PITCHER_ABILITY : pitcherAbilityOf(opponent)
}

/** 클리어 횟수 상한 — 원본은 s8 칸에 99 까지 센다 (0xa51d0) */
const MAXIMUM_CLEARS = 99

/** 미션 모드 한 판 — 타자편(MissionRun)과 투수편(PitcherRun)을 함께 다룬다. */
export function useMissionSession({
  runner,
  random,
  missionRecord,
  screen,
  setScreen,
  onGamePointReward,
  sound,
}: MissionSessionInput) {
  const silent = useMemo(() => createSilentSound(), [])
  const audio = sound ?? silent
  const [missionRun, setMissionRun] = useState<MissionRun | null>(null)
  const missionRunRef = useRef(missionRun)
  missionRunRef.current = missionRun
  const [pitcherRun, setPitcherRun] = useState<PitcherRun | null>(null)
  /** 결과를 확인하고 돌아갈 때 마지막으로 한 편의 목록을 연다 */
  const [lastSide, setLastSide] = useState<OriginalMission['side']>('타자')
  const [clearCounts, setClearCounts] = useState<MissionClearCounts>(() => missionRecord.load())
  /** 한 번이라도 깬 미션 키 — 잠금 판정과 컬렉션이 쓴다 */
  const clearedKeys = useMemo(
    () => Object.entries(clearCounts).filter(([, count]) => count > 0).map(([key]) => key),
    [clearCounts],
  )

  // 미션 제한 시간. 타자편·투수편 모두 진행 중일 때만 1초씩 흘린다.
  const isBatterRunning = (screen.kind === '미션진행' || screen.kind === '마선수대결') && missionRun?.status === '진행중'
  const isPitcherRunning = screen.kind === '투수미션' && pitcherRun?.status === '진행중'
  useEffect(() => {
    if (!isBatterRunning && !isPitcherRunning) return
    const handle = window.setInterval(() => {
      if (isBatterRunning) {
        setMissionRun((previous) => (previous === null ? previous : tickMission(previous, 1)))
      } else {
        setPitcherRun((previous) => (previous === null ? previous : tickMission(previous, 1)))
      }
    }, 1000)
    return () => window.clearInterval(handle)
  }, [isBatterRunning, isPitcherRunning])

  const handleMissionPitch = useCallback(
    (detail: PitchOutcomeDetail) => {
      const nextAtBat = runner.applyPitch(detail.resolution)
      const hasSwung = detail.hasSwung
      // 타구음 → 심판 콜 순서 (경기 장면과 같은 0x51408 이다).
      // 미션은 수비 시뮬레이션을 따로 돌리지 않으므로 아웃 콜도 여기서 같이 난다
      playSoundIds(audio, [
        detail.contactSoundId,
        pitchCallSoundIdOf(detail.resolution, nextAtBat),
        nextAtBat.outcome === null ? null : inPlayCallSoundIdOf(nextAtBat.outcome),
      ])

      if (!isAtBatFinished(nextAtBat) || nextAtBat.outcome === null) {
        if (hasSwung) {
          setMissionRun((previous) =>
            previous === null ? previous : checkSwingsExhausted(recordSwing(previous)),
          )
        }
        return
      }

      const outcome = nextAtBat.outcome
      const current = missionRunRef.current
      setMissionRun((previous) => {
        if (previous === null) return previous
        const swung = hasSwung ? recordSwing(previous) : previous
        return applyMissionOutcome(swung, outcome, detail.isBunt)
      })
      runner.pauseWithBanner(
        describeOutcomeBanner(outcome, current === null ? 0 : runnerCountOf(current.bases)),
      )
    },
    [audio, runner],
  )

  /** 원작 투구 조작: 구질 → 코스 → 게이지. 타자는 자동으로 반응한다. */
  const handleThrow = (type: PitchTypeInfo, courseCell: number, gauge: GaugeResult) => {
    if (pitcherRun === null || pitcherRun.status !== '진행중') return

    const pitch = buildPitch(
      { type, aim: courseOf(courseCell), gauge },
      DEFAULT_PITCHER_ABILITY,
      random,
    )
    // 마타자 미션은 원본 마선수 능력치로, 그 밖에는 평범한 타자로 상대한다.
    const opponent = missionOpponent(pitcherRun.mission)
    const batterAbility = opponent === null ? ROOKIE_BATTER_ABILITY : opponent.ability
    const resolution = pitchAgainstBatter(pitch, batterAbility, random)

    let nextRun = recordPitch(pitcherRun, gauge === 'PERFECT')
    const nextAtBat = runner.applyPitch(resolution)
    runner.setBannerText(describePitchResolution(resolution))
    // 투구 순간 소리 12 (0x3f378 — 투수 단계가 공을 놓는 칸에 닿을 때). 이어서 심판 콜.
    // ⚠️ 마구 갈래 28 은 잇지 않았다 — 이 자리가 던진 공이 마구인지 알 수 없다
    //    (`PitchTypeInfo` 에 마구 칸이 없고 미션 투수는 평범한 투수다).
    // ⚠️ **근사**: 웹은 던지는 순간에 결과가 다 나오므로 투구음과 심판 콜이 붙어 버린다.
    //    통로가 하나라 뒤 소리가 앞 소리를 끊는다 (원본은 공이 날아가는 동안이 사이에 있다).
    playSoundIds(audio, [
      PITCH_RELEASE_SOUND,
      pitchCallSoundIdOf(resolution, nextAtBat),
      nextAtBat.outcome === null ? null : inPlayCallSoundIdOf(nextAtBat.outcome),
    ])

    if (isAtBatFinished(nextAtBat) && nextAtBat.outcome !== null) {
      nextRun = applyPitcherOutcome(nextRun, nextAtBat.outcome)
      runner.resetAtBat()
    } else {
      nextRun = checkPitchExhausted(nextRun)
    }
    setPitcherRun(nextRun)
  }

  /**
   * 미션을 깼을 때 — **클리어 횟수를 올리고 보상 G 를 준다** (0xa52b0, Q2 1a·1b).
   * 보상은 이번 클리어를 더하기 **전** 횟수로 계산하므로 다시 깰수록 줄어든다.
   * 원본은 99 회에서 센 것을 멈춘다.
   */
  const rememberCleared = (mission: OriginalMission, status: string) => {
    if (status !== '성공') return
    const key = missionKeyOf(mission)
    const previous = clearCounts[key] ?? 0
    const reward = missionRewardOf(mission.stage, previous)
    if (reward > 0) onGamePointReward?.(reward)
    const next = { ...clearCounts, [key]: Math.min(MAXIMUM_CLEARS, previous + 1) }
    setClearCounts(next)
    missionRecord.save(next)
  }

  const actions = {
    begin: (mission: OriginalMission) => {
      setLastSide(mission.side)
      runner.resetAtBat(mission.start)
      runner.setBannerText('')
      runner.setIsPaused(false)

      if (mission.side === '투수') {
        setPitcherRun(startPitcherMission(mission))
        setScreen({ kind: '투수미션', mission })
        return
      }
      setMissionRun(startMission(mission))
      setScreen({ kind: '미션진행', mission })
    },

    /** 이벤트 match — 공략 레코드를 치르고 결과 이벤트로 돌아간다. 미션 클리어 기록에는 남기지 않는다 */
    beginAceMatch: (mission: OriginalMission, pending: Omit<Extract<Screen, { kind: '마선수대결' }>, 'kind' | 'mission'>) => {
      runner.resetAtBat(mission.start)
      runner.setBannerText('')
      runner.setIsPaused(false)
      setMissionRun(startMission(mission))
      setScreen({ kind: '마선수대결', mission, ...pending })
    },

    finishAceMatch: () => {
      if (missionRun === null || screen.kind !== '마선수대결') return
      const eventId = matchResultEventOf(screen.resultEvents, missionRun.status === '성공')
      setMissionRun(null)
      setScreen({ kind: '이벤트', eventId, context: screen.context, carried: screen.carried })
    },

    /** 원작 미션 '기동력은 나의 힘' — 번트와 도루를 1개씩 */
    steal: (ability: BatterAbility) => {
      if (missionRun === null || !canSteal(missionRun)) return
      const result = attemptSteal(ability, random)
      runner.setBannerText(result === '성공' ? '도루 성공!' : '도루 실패')
      setMissionRun(result === '성공' ? applySteal(missionRun) : failSteal(missionRun))
    },

    giveUpBatter: () => {
      if (missionRun !== null) setMissionRun(giveUpMission(missionRun))
    },

    giveUpPitcher: () => {
      if (pitcherRun !== null) setPitcherRun({ ...pitcherRun, status: '실패' })
    },

    finishBatter: () => {
      if (missionRun === null) return
      rememberCleared(missionRun.mission, missionRun.status)
      setMissionRun(null)
      setScreen({ kind: '미션선택' })
    },

    finishPitcher: () => {
      if (pitcherRun === null) return
      rememberCleared(pitcherRun.mission, pitcherRun.status)
      setPitcherRun(null)
      setScreen({ kind: '미션선택' })
    },
  }

  return { missionRun, pitcherRun, clearedKeys, clearCounts, lastSide, handleMissionPitch, handleThrow, actions }
}

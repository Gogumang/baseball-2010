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
  missionDefensePlayInputOf,
  recordSwing,
  startMission,
  tick as tickMission,
} from '@/entities/mission/model/missionRun'
import type { MissionRun } from '@/entities/mission/model/missionRun'
import {
  applyPitcherOutcome,
  checkPitchExhausted,
  MISSION_PITCHER_MODE,
  recordPitch,
  startPitcherMission,
} from '@/entities/mission/model/pitcherRun'
import type { PitcherRun } from '@/entities/mission/model/pitcherRun'
import { attemptSteal } from '@/entities/game/model/steal'
import { missionOpponentOf, pitcherAbilityOf } from '@/entities/game/model/aceOpponent'
import { pitchAgainstBatter } from '@/entities/pitching/model/simulateBatter'
import { DEFAULT_PITCHER_ABILITY } from '@/entities/pitching/model/pitch'
import type { PitcherAbility } from '@/entities/pitching/model/pitch'
import { buildHumanPitch, pitchGradeOf } from '@/features/play-pitcher-game/model/pitcherPitch'
import type { PitcherRepertoire, PitcherStats } from '@/features/play-pitcher-game/model/pitcherPitch'
import { ROOKIE_BATTER_ABILITY } from '@/entities/batting/model/batter'
import { isBattedBallInPlay, runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import type { DefensePlayInput, DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { carryDistanceOf } from '@/entities/batting/model/battedBallFlight'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import {
  deepHitCheerSoundIdOf,
  inPlayCallSoundIdOf,
  pitchCallSoundIdOf,
  PITCH_RELEASE_SOUND,
} from '@/features/play-at-bat/model/atBatSounds'
import { playSoundIds } from '@/app/model/useSound'
import { createSilentSound } from '@/shared/api/audio/soundPort'
import type { SoundPort } from '@/shared/api/audio/soundPort'
import type { BatterAbility } from '@/entities/batting/model/batter'
import type { OriginalMission } from '@/shared/config/original/missions'
import type { AcePlayer } from '@/shared/config/original/acePlayers'
import { PITCH_TYPES } from '@/shared/config/original/pitchTypes'
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

/**
 * **수비 화면(상태 0x17)이 붙들고 있는 타구.**
 *
 * 원본 미션은 모드 5·6 짜리 **보통 경기**(장면 0x104)다 — 상태 표가 모드를 안 가른다.
 * 맞은 공은 0x11 → 메시지 0x6aa → 0x13 → **늘 0x17**(`0xae5f0` 는 `movs r0,#0x17; bx lr` 한 줄,
 * R10 8절 전이표) 이고, 0x17 이 끝나야 `0xae3e8` 이 다음 타석(0xd/0xf)으로 보낸다.
 * 그래서 웹도 인플레이 타구에서 여기 멈춰 서서 화면이 틱을 다 돌리기를 기다린다.
 */
interface PendingMissionDefense {
  readonly side: '타자' | '투수'
  readonly input: DefensePlayInput
  readonly outcome: AtBatOutcome
  readonly isBunt: boolean
  /** 타구 직전의 주자 수 — 결과 띠("2타점" 따위)가 이 값을 쓴다 */
  readonly runnersOnBase: number
}

/**
 * 게이지에서 t=5(최상)로 던진 공만 "MAX게이지" 로 센다.
 *
 * 원본에도 같은 칸이 있다 — 투수 평가 `R+0x158` 을 채우는 0xa5e00 이 `if t != 5 → return`
 * 한 줄뿐이다(S5 5절 확정). 게이지를 끄고 던져 표에서 t=5 가 나온 공과 마구(늘 t=5)도 함께 센다.
 *
 * ⚠️ **유력/추정**: 미션 레코드의 "MAX투구게이지" 목표가 세는 칸이 이 `R+0x158` 과 같은지는
 * 아직 못 밝혔다. t=5 말고 달리 "MAX" 라 부를 값이 없어 같은 줄로 둔다.
 */
const MAX_GAUGE_GRADE = 5

/**
 * 미션 투수의 능력치·레퍼토리.
 *
 * ⚠️ **근사다.** 원본 미션 투수는 나리 투수편 저장(모드 5→3)이나 명예의 전당 투수다(Q2 3절).
 * 웹 미션에는 아직 그 선수 레코드가 없어 등급 3 한가운데인 500 과 폼 0 을 쓴다.
 */
const MISSION_PITCHER_STATS: PitcherStats = { control: 500, velocity: 500, breaking: 500, stamina: 500 }
const MISSION_PITCHER_REPERTOIRE: PitcherRepertoire = { pitchMask: 0, form: 0, magicNumber: 0 }
/** 투영 원점 0xcfb18 의 칸 — 미션 상대 타자의 좌우를 알 길이 없어 1 로 둔다 (추정, 예전 그대로) */
const MISSION_STAGE_SIDE = 1
/** 미션 투수는 체력 레코드가 없다 — 늘 100% 로 둔다 (추정) */
const MISSION_STAMINA_PERCENT = 100

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
  const [pendingDefensePlay, setPendingDefensePlay] = useState<PendingMissionDefense | null>(null)
  const pendingDefensePlayRef = useRef(pendingDefensePlay)
  pendingDefensePlayRef.current = pendingDefensePlay
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
      const outcome = isAtBatFinished(nextAtBat) ? nextAtBat.outcome : null
      // 인플레이 타구면 수비 화면(상태 0x17)이 먼저 돈다 — 아웃·세이프 콜은 그 뒤다
      const runsDefense = outcome !== null && isBattedBallInPlay(outcome)
      // 타구음 → 심판 콜 순서 (경기 장면과 같은 0x51408 이다).
      // 삼진·볼넷·홈런은 수비가 개입할 것이 없어 아웃 콜도 여기서 같이 난다 (0xae24c 갈래)
      playSoundIds(audio, [
        detail.contactSoundId,
        pitchCallSoundIdOf(detail.resolution, nextAtBat),
        outcome === null || runsDefense ? null : inPlayCallSoundIdOf(outcome),
      ])

      if (outcome === null) {
        if (hasSwung) {
          setMissionRun((previous) =>
            previous === null ? previous : checkSwingsExhausted(recordSwing(previous)),
          )
        }
        return
      }

      const current = missionRunRef.current
      const runnersOnBase = current === null ? 0 : runnerCountOf(current.bases)

      if (runsDefense && current !== null) {
        // 스윙 수만 먼저 줄이고 **루·아웃·목표는 한 톨도 건드리지 않는다** — 수비 화면이
        // 다 돈 뒤 `finishDefensePlay` 가 한 번에 먹인다 (원본도 0x17 이 도는 동안 0xf 로 안 간다)
        if (hasSwung) setMissionRun((previous) => (previous === null ? previous : recordSwing(previous)))
        setPendingDefensePlay({
          side: '타자',
          input: missionDefensePlayInputOf(current.bases, current.outs, outcome, random),
          outcome,
          isBunt: detail.isBunt,
          runnersOnBase,
        })
        runner.setIsPaused(true)
        return
      }

      setMissionRun((previous) => {
        if (previous === null) return previous
        const swung = hasSwung ? recordSwing(previous) : previous
        return applyMissionOutcome(swung, outcome, detail.isBunt)
      })
      runner.pauseWithBanner(describeOutcomeBanner(outcome, runnersOnBase))
    },
    [audio, random, runner],
  )

  /**
   * **진행 중인 미션의 조준점 흔들림 세기** — 레코드 바이트 13 (`conditionCode`, 0xaa57c → 0x39c5c).
   * 미션이 안 도는 중이면 0 이다 = 안 흔들린다.
   *
   * 경기 진행기(`features/play-pitcher-game` 의 `PitchInput.missionConditionCode`)가 이 값을 받아
   * 조준점을 흔든다. 값의 뜻은 `shared/config/original/missions.ts` 의 `MISSION_AIM_SHAKES` 에 있다.
   *
   * ⚠️ 타자 미션은 표가 **전부 0** 이라 타자편에서는 늘 0 이다 (원본 그대로).
   *
   * 아래 `handleThrow` 가 이 값을 `buildHumanPitch` 에 실어 **실제로 흔든다**. 원본 0x39c5c 는
   * 경기 장면 **상태 0x10(조준) 의 갱신 함수**이고(R10 2절 상태표) 그 안에서
   * `[this+0x1788] != 0 && [this+0x1104] == 5`(= 미션 객체가 있고 모드 5 = 투수 미션) 일 때만
   * 조건코드 1·2·3 갈래로 간다 — 즉 **원본 미션 투구도 보통 경기와 같은 조준·투구 길**이다.
   * 그래서 웹도 존 좌표 근사(`pitchCommand.buildPitch`) 대신 진행기의 월드 좌표 투구를 쓴다.
   */
  const missionConditionCode =
    pitcherRun !== null && pitcherRun.status === '진행중' ? pitcherRun.mission.conditionCode
    : missionRun !== null && missionRun.status === '진행중' ? missionRun.mission.conditionCode
    : 0

  /**
   * 원작 투구 조작: 구질 → 코스 → 게이지. 타자는 자동으로 반응한다.
   *
   * 공은 나리 투수편과 **같은 진행기 부품**(`buildHumanPitch`)으로 만든다 — 원본 순서
   * 0x50da8 구질 → 0x50e9c 코스 → **0x39c5c 조준 흔들림** → 0x4dc78 제구 흩어짐 그대로다.
   * 조준점이 월드 좌표라야 미션 흔들림(±600·±400)이 뜻을 갖는다.
   *
   * ⚠️ 경기 상태(이닝·점수·로스터)는 미션 레코드에 없으므로 진행기 `PitcherGameProgress` 를
   *    통째로 쓰지는 않는다 — 투구 한 개를 만드는 데 필요한 것만 위 상수로 채웠다.
   */
  const handleThrow = (
    type: PitchTypeInfo,
    courseCell: number,
    /** 게이지에서 **누른 칸 0~9** 그대로다 (0x50e08). 안 눌렀거나 게이지를 안 쓰면 0 */
    gaugeCell: number,
    /** 환경설정 [투구] 가 게이지인가 (설정 +0x2d, 0x3f500) */
    gaugeSettingOn: boolean,
  ) => {
    if (pitcherRun === null || pitcherRun.status !== '진행중') return
    // 화면이 수비를 돌리는 동안에는 다음 공이 나가지 않는다 (원본 0x17 이 도는 동안 0xf 로 안 간다)
    if (pendingDefensePlay !== null) return

    // 원본 구질 번호 1~21. 표에 없는 이름이면 1(FASTBALL)로 둔다
    const typeNumber = Math.max(1, PITCH_TYPES.findIndex((candidate) => candidate.name === type.name) + 1)
    // 게이지를 쓰면 칸에서 t = max(g−4, 1) 을, 안 쓰면 제구·체력 확률표 0xd896c 로 뽑는다 (0x4dbac)
    const grade = pitchGradeOf(
      {
        gaugeSettingOn,
        typeNumber,
        gaugeCell,
        effectiveControl: MISSION_PITCHER_STATS.control,
        staminaPercent: MISSION_STAMINA_PERCENT,
      },
      random,
    )
    const pitch = buildHumanPitch(
      {
        typeNumber,
        courseCell,
        grade,
        gaugeCell,
        stats: MISSION_PITCHER_STATS,
        repertoire: MISSION_PITCHER_REPERTOIRE,
        side: MISSION_STAGE_SIDE,
        // 조건코드 0 이면 `applyControlError` 가 난수를 한 톨도 안 뽑는다 = 예전과 같다
        missionConditionCode,
      },
      random,
    )
    // 마타자 미션은 원본 마선수 능력치로, 그 밖에는 평범한 타자로 상대한다.
    const opponent = missionOpponent(pitcherRun.mission)
    const batterAbility = opponent === null ? ROOKIE_BATTER_ABILITY : opponent.ability
    const resolution = pitchAgainstBatter(pitch, batterAbility, random)

    let nextRun = recordPitch(pitcherRun, grade === MAX_GAUGE_GRADE)
    const nextAtBat = runner.applyPitch(resolution)
    runner.setBannerText(describePitchResolution(resolution))
    const outcome = isAtBatFinished(nextAtBat) ? nextAtBat.outcome : null
    const runsDefense = outcome !== null && isBattedBallInPlay(outcome)
    // 투구 순간 소리 12 (0x3f378 — 투수 단계가 공을 놓는 칸에 닿을 때). 이어서 심판 콜.
    // ⚠️ 마구 갈래 28 은 잇지 않았다 — 이 자리가 던진 공이 마구인지 알 수 없다
    //    (`PitchTypeInfo` 에 마구 칸이 없고 미션 투수는 평범한 투수다).
    // ⚠️ **근사**: 웹은 던지는 순간에 결과가 다 나오므로 투구음과 심판 콜이 붙어 버린다.
    //    통로가 하나라 뒤 소리가 앞 소리를 끊는다 (원본은 공이 날아가는 동안이 사이에 있다).
    playSoundIds(audio, [
      PITCH_RELEASE_SOUND,
      pitchCallSoundIdOf(resolution, nextAtBat),
      outcome === null || runsDefense ? null : inPlayCallSoundIdOf(outcome),
    ])

    if (runsDefense && outcome !== null) {
      // 수비 화면(0x17)이 돈다 — 실점·피안타·이닝 목표는 다 돌고 난 뒤에 센다
      setPendingDefensePlay({
        side: '투수',
        input: missionDefensePlayInputOf(nextRun.bases, nextRun.outs, outcome, random, MISSION_PITCHER_MODE),
        outcome,
        isBunt: false,
        runnersOnBase: runnerCountOf(nextRun.bases),
      })
      setPitcherRun(nextRun)
      return
    }
    if (outcome !== null) {
      nextRun = applyPitcherOutcome(nextRun, outcome, { random })
      runner.resetAtBat()
    } else {
      nextRun = checkPitchExhausted(nextRun)
    }
    setPitcherRun(nextRun)
  }

  /**
   * **수비 화면이 한 타구를 다 돌렸다** (`DefensePlayback` 의 `onDone`).
   * 진루·아웃·실점이 **여기서야** 미션 상태가 된다 — 그 전까지는 타석 결과 코드만 정해져 있었다.
   *
   * 화면이 결과를 안 넘겨 주면 여기서 끝까지 돌려서라도 붙들어 둔 상태를 푼다 — 안 그러면
   * 다음 타석이 영영 시작되지 않는다 (`useCareerSession.finishDefensePlay` 와 같은 자리).
   */
  const finishDefensePlay = useCallback(
    (result?: DefensePlayResult) => {
      const pending = pendingDefensePlayRef.current
      if (pending === null) return
      const played = result ?? runDefensePlay(pending.input)
      setPendingDefensePlay(null)
      // 플레이가 끝난 자리 — 아웃 콜(0x51b36)·세이프 콜(0x51c14)과 장타 함성은 여기서야 난다.
      // 함성 60 은 원본이 **낙구 틱**에 내는 것이라 이 자리는 근사다 (atBatSounds 주석)
      playSoundIds(audio, [
        deepHitCheerSoundIdOf({
          outcome: pending.outcome,
          carryDistance: carryDistanceOf(pending.input.trajectory),
          caughtOnTheFly: played.caughtOnTheFly,
        }),
        inPlayCallSoundIdOf(pending.outcome, played),
      ])

      if (pending.side === '투수') {
        setPitcherRun((previous) =>
          previous === null ? previous : applyPitcherOutcome(previous, pending.outcome, { played }),
        )
        runner.resetAtBat()
        runner.setIsPaused(false)
        return
      }
      setMissionRun((previous) =>
        previous === null
          ? previous
          : applyMissionOutcome(previous, pending.outcome, pending.isBunt, random, played),
      )
      runner.pauseWithBanner(describeOutcomeBanner(pending.outcome, pending.runnersOnBase))
    },
    [audio, random, runner],
  )

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
    /** 수비 화면이 끝났다 — 진루·아웃·실점을 이제 먹인다 */
    finishDefensePlay,

    begin: (mission: OriginalMission) => {
      setLastSide(mission.side)
      runner.resetAtBat(mission.start)
      runner.setBannerText('')
      runner.setIsPaused(false)
      setPendingDefensePlay(null)

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
      setPendingDefensePlay(null)
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
      setPendingDefensePlay(null)
      if (missionRun !== null) setMissionRun(giveUpMission(missionRun))
    },

    giveUpPitcher: () => {
      setPendingDefensePlay(null)
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

  return {
    missionRun, pitcherRun, clearedKeys, clearCounts, lastSide,
    missionConditionCode, pendingDefensePlay, handleMissionPitch, handleThrow, actions,
  }
}

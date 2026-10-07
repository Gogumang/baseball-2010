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
  isMissionPlayOutcome,
  applyPickoff,
  checkSwingsExhausted,
  giveUp as giveUpMission,
  MISSION_BATTER_MODE,
  missionDefensePlayInputOf,
  recordSwing,
  startMission,
  tick as tickMission,
} from '@/entities/mission/model/missionRun'
import type { MissionRun } from '@/entities/mission/model/missionRun'
import {
  applyPitcherOutcome,
  checkPitchExhausted,
  judgePitcherRun,
  MISSION_PITCHER_MODE,
  recordPitch,
  startPitcherMission,
} from '@/entities/mission/model/pitcherRun'
import type { PitcherRun } from '@/entities/mission/model/pitcherRun'
import { EMPTY_BASES } from '@/entities/game/model/baseState'
import { inningGoalOf, isCleared, recordSteal, withOutCalls } from '@/entities/mission/model/missionGoal'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import {
  arrivalApplicationOf,
  arrivesUnhit,
  pitchJudgementOf,
  rollCpuStealStart,
  runPitchArrivalPlay,
  startHumanSteal,
  type PitchArrivalPlay,
} from '@/features/defense-play/model/pitchArrivalPlay'
import { chargedRunsOfFates } from '@/features/defense-play/model/runnerFates'
import { missionOpponentOf, pitcherAbilityOf } from '@/entities/game/model/aceOpponent'
import {
  FULL_STAMINA, consumeStamina, pitchStaminaCostOf, staminaCapacityOf, staminaPercentOf,
} from '@/entities/pitcher-career/model/pitcherStamina'
import { pitchAgainstBatterDetailed } from '@/entities/pitching/model/simulateBatter'
import { RUTHLESS_SKILL_ID, specialSwingCountOf } from '@/entities/batting/model/specialSwing'
import { rollsIntoBenchClearing } from '@/entities/game/model/benchClearing'
import { rollBenchClearingEntry, rollBenchClearingTargets } from '@/features/play-game/model/benchClearingScene'
import { BATTER_SLOT, gameAbilityOf } from '@/features/play-team-game/model/gameAbilities'
import { isMistakePitch } from '@/entities/pitching/model/mistakePitch'
import { MAGIC_PITCH_TYPE_NUMBER, ballMagicNumberAfterPitch } from '@/entities/pitcher-career/model/magicPitch'
import { DEFAULT_PITCHER_ABILITY } from '@/entities/pitching/model/pitch'
import type { PitcherAbility } from '@/entities/pitching/model/pitch'
import { buildHumanPitch, pitchGradeOf } from '@/features/play-pitcher-game/model/pitcherPitch'
import {
  isModeMagicPitchType, modePitcherMagicRemainingOf, modePitcherOf, modePitcherOfHallOfFame,
} from '@/app/model/modePitcher'
import { hallOfFameModeBatterOf } from '@/app/model/modeBatter'
import { rollSimulatorInit } from '@/entities/game/model/simulatorInit'
import { openScenePatternDeck } from '@/entities/batting/model/battedBallOutcome'
import { hallOfFamePitcherAt } from '@/entities/collection/model/collection'
import type { Collection, HallOfFamePlayerPick } from '@/entities/collection/model/collection'
import { pitchReleaseSoundIdOf } from '@/widgets/batting-stage/lib/pitchReleaseSound'
import type { ModePitcher } from '@/app/model/modePitcher'
import { ROOKIE_BATTER_ABILITY } from '@/entities/batting/model/batter'
import { recordedOutcomeOf, runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import { registerContact } from '@/entities/batting/model/battedContact'
import type { DefensePlayInput, DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { pickoffCallSoundIdOf, runPickoffPlay } from '@/features/defense-play/model/pickoffPlay'
import { pickoffPlayForKey } from '@/entities/defense-controls/model/pickoff'
import type { PickoffBase } from '@/entities/defense-controls/model/pickoff'
import { carryDistanceOf } from '@/entities/batting/model/battedBallFlight'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import {
  deepHitCheerSoundIdOf,
  inPlayCallSoundIdOf,
  pitchCallSoundIdOf,
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
import { missionResultEarnedOf } from '@/pages/mission-play/lib/missionResultBoard'
import { aceMatchClearCountAfterWin, aceMatchClearKeyOf } from '@/entities/mission/model/aceMatchClear'
import { aceAbilityAtLevel, aceLevelOf, aceLevelSlotOf } from '@/entities/mission/model/aceLevel'
import { vibrate } from '@/entities/defense-controls/model/vibration'
import { strikeoutVibrationMillisecondsOf } from '@/features/play-game/model/strikeoutVibration'
import { enterSceneConfirm } from '@/features/play-game/model/sceneConfirm'
import type { SceneConfirmWait } from '@/features/play-game/model/sceneConfirm'

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
  /**
   * 환경설정 "송구" 가 **수동**인가 (설정 +0xf4). 안 넘기면 원본 기본값인 수동이다.
   * **투수편 미션은 사람이 수비**라 `0xae6c8` 의 앞 항(`경기[0x31 + 수비측] == 1`)이 거짓이어서
   * 이 설정이 그대로 답이 된다 (타자편 미션은 수비가 CPU 라 상관이 없다 —
   * `missionDefensePlayInputOf` 주석).
   */
  readonly throwModeManual?: boolean
  /**
   * 마선수 레벨 `mgr[0x13a + idx]` (idx 0~4 마투수 · 5~9 마타자 → 0~4 = Lv1~5).
   * 0xb6414 가 마선수 능력치마다 배율 0xd88aa[레벨] 을 곱한다 (`entities/mission/model/aceLevel`).
   * 앱은 전역 저장 칸(`useAceLevels`, 올리는 곳은 레벨업 창 0x5fb24 하나 — 스페셜 마선수 · 일반모드 `0` 키)의
   * 값을 넘긴다 (28af409). 안 넘기면 새 저장 값(0x9f26c 가 0 으로 채움) = Lv1 = 60% 로 본다.
   */
  readonly aceLevels?: Readonly<Record<number, number>>
  /**
   * 투수 미션(모드 5)에서 던지는 투수 — 나리 투수편 저장(0x213c0 5→3) 또는 명예 투수(0x1fbd0)의
   * 0xb6414 능력치·레퍼토리·실투 스킬 (`modePitcherOf`). 안 넘기면 신인 투수다 (원본에 없는 대체).
   */
  readonly pitcher?: ModePitcher
  /** 타자 미션에서 치는 타자의 장착 스킬 (`modeBatterOf(...).skillIds`) — 압도 22 가 마투수 투구 소모를 ×2 한다 */
  readonly batterSkillIds?: readonly number[]
  /**
   * 명예의 전당 (전역기록 +0x880 투수 · +0x940 타자). 미션 선수 고르기에서 명예 선수를 고르면(+0xa5/+0xa6 ≥ 0)
   * 선수 게터 0x1fbd0 · 0x1fc20 이 이 기록을 준다 — `pitcher`·`batterSkillIds` 대신 그 선수의 값이다.
   * 안 넘기면 늘 나리 선수다.
   */
  readonly hallOfFame?: Collection
  /**
   * 환경설정 진동(저장 +0x3b) — 거짓이면 0x3a44 가 안 울린다. 안 넘기면 켬 (`BattingStage` · `usePitcherGame` 과 같다).
   * 투수 미션(모드 5)의 사람 공 삼진 진동(상태 0x12 그리기 0x4ce9c 의 0x4d0d6)이 본다.
   */
  readonly isVibrationOn?: boolean
}

/**
 * 미션 모드 안의 화면 — 이 밖으로 나가면 고른 선수를 지운다. 원본은 미션 모드로 들어올 때마다 선수 고르기
 * 진입 0x2613c → 0x5eb8c 가 전역기록 +0xa5 · +0xa6 을 −1 로 되돌리고 다시 고르게 한다.
 * (마선수 대결 '마선수대결' 은 이벤트에서 오는 길이라 넣지 않는다.)
 */
const MISSION_MODE_SCREENS: readonly Screen['kind'][] = ['미션선택', '미션설명', '미션진행', '투수미션']

/** 미션 상대. 원본 레코드의 마선수 순번이 있으면 그 마선수다 (타자 미션이면 마투수). */
export function missionOpponent(mission: OriginalMission): AcePlayer | null {
  return missionOpponentOf(mission.side === '타자' ? '투수' : '타자', mission.opponentAce)
}

/**
 * 미션 마선수의 **레벨 배율을 먹은** 능력치 네 칸 (마선수가 아니면 null).
 *
 * 마선수 레코드는 실효 능력치 0xb6414 첫 단계에서 `v · 0xd88aa[레벨] / 100` 을 먹는다
 * (b6438~b646a — 모드·플래그·칸을 가리지 않는다). 레벨 = `mgr[0x13a + 순번(+5 타자)]`.
 * 그 뒤 장비·스킬(플래그 1) → 0xb570c 의 0..999 자르기 순서다.
 */
export function missionOpponentAbility(
  mission: OriginalMission,
  aceLevels?: Readonly<Record<number, number>>,
): BatterAbility | null {
  const opponent = missionOpponent(mission)
  if (opponent === null) return null
  const level = aceLevelOf(aceLevels, aceLevelSlotOf(opponent.role, mission.opponentAce))
  return aceAbilityAtLevel(opponent.ability, level)
}

/** 필살 남은 칸의 "아직 안 채움" — 타석 교대 0xaebe4 가 음수일 때만 채운다 (H2 1-2) */
const UNFILLED_SPECIAL_SWING = -1
/** 마선수 레코드 +0x18 = 순번(0부터) + 5 (H2 4-1) */
const ACE_SPECIAL_NUMBER_OFFSET = 5

/**
 * **타자 미션에서 치는 내 타자의 남은 필살 횟수** = 0xaea30. 칸이 −1 이면 0xaebe4 처럼 채운 값이다:
 * `+0x18 == 0 → 0`, 아니면 u8 0xd84f0[번호] (내 선수는 마선수가 아니다) + 스킬 23 무자비(장착) +1.
 * 미션은 나리 타자편 저장(0x213c0 6 → 4)을 올리니 그 선수의 번호·장착 스킬이다.
 */
export function missionBatterSpecialSwingRemainingOf(
  stored: number,
  batter: { readonly specialSwingNumber: number; readonly skillIds: readonly number[] },
): number {
  if (stored >= 0) return stored
  return specialSwingCountOf({
    swingNumber: batter.specialSwingNumber,
    isAceBatter: false,
    hasRuthlessSkill: batter.skillIds.includes(RUTHLESS_SKILL_ID),
  })
}

/**
 * **투수 미션 상대 마타자의 필살** — 0x34468 이 보는 번호·남은 횟수와 0x34d6c 의 순번·레벨.
 * 마타자 미션이 아니면 null (일반 CPU 타자는 S+0x10 을 쓰지 않는다 — Q1 5절).
 * 남은 칸이 −1 이면 0xaebe4 처럼 s8 0xd84fa[레벨] 로 채운다 (레벨 = `mgr[0x13f + 순번]`).
 * ⚠️ 마타자 레코드의 스킬 23 무자비(+1)는 웹 마선수 표에 스킬 비트가 없어 늘 거짓이다.
 */
export function missionOpponentSpecialSwingOf(
  mission: OriginalMission,
  stored: number,
  aceLevels?: Readonly<Record<number, number>>,
): { readonly swingNumber: number; readonly remaining: number; readonly aceOrder: number; readonly aceLevel: number } | null {
  if (mission.side !== '투수' || missionOpponent(mission) === null) return null
  const aceOrder = mission.opponentAce - 1
  const swingNumber = aceOrder + ACE_SPECIAL_NUMBER_OFFSET
  const aceLevel = aceLevelOf(aceLevels, aceLevelSlotOf('타자', mission.opponentAce))
  const remaining =
    stored >= 0 ? stored : specialSwingCountOf({ swingNumber, isAceBatter: true, aceLevel, hasRuthlessSkill: false })
  return { swingNumber, remaining, aceOrder, aceLevel }
}

/**
 * 타자 미션 상대 투수 능력치. 마투수면 레벨 배율(0xb6414)을 먼저 곱한 네 칸을 투구 엔진 눈금으로 줄인다
 * — 마타자와 같은 0xb6414 라 투수 칸(제구·구속·변화·체력)도 똑같이 먹는다.
 */
export function missionPitcherAbility(
  mission: OriginalMission,
  aceLevels?: Readonly<Record<number, number>>,
  /** 마투수의 체력% `0xaebb0` (세션 `opponentStaminaPercent`). 안 넘기면 지치지 않은 것으로 본다 */
  staminaPercent?: number,
): PitcherAbility {
  const opponent = missionOpponent(mission)
  const ability = missionOpponentAbility(mission, aceLevels)
  return opponent === null || ability === null
    ? DEFAULT_PITCHER_ABILITY
    : pitcherAbilityOf({ ...opponent, ability }, undefined, staminaPercent)
}

/** 타자 스킬 22 압도 — 0xa5e14 가 `0xb62b4(현재 타자, 22)` 면 투구 소모 ×2 (0xa5f0e) */
const INTIMIDATE_SKILL_ID = 22
/**
 * 미션 마투수 용량 0x66e44(V, P, 첫 투수)의 사기 — V = `0x1f9a8(app, 모드, 팀)` 이 모드 5·6·7 이면 표 0xcd7e0 의
 * 0x1fa1e(늘 0)로 가서 V 가 없다 → 사기 100.
 */
const MISSION_TEAM_MORALE = 100

/**
 * **타자 미션 마투수의 투구 하나** — 0xa5e14 (모드 갈래 없음, 0x3dec6). 마투수는 0xaae7c 가 저장된 마투수 레코드
 * (0x1f824)를 0xb521c 로 팀 칸 8 에 통째(0x30, +0x2c 포함 — 다섯 줄 모두 10000) 베끼고 0xb8c94 로 0번과 맞바꿔 세우므로
 * 경기마다 10000 에서 선다. 이미 마운드에 그 마투수가 있으면 다시 베끼지 않아 깎인 값이 이어진다.
 * CPU 투수 교체 0xac428 을 미션 객체(0x66864)가 막는 것은 **칸 3·7(레오니·발렌타인)뿐**이다 — 드래고나(칸 11)는
 * 안 막는다(아래 "미션 장면의 상태 0xf 진입" 머리글). 용량의 체력은 `0xb6415(P, 3, 1)` = 레벨 배율 먹은 넷째 칸(마선수 표에 스킬 비트 없음).
 * ⚠️ 첫 투수 +200 (0xaeb08 의 `team+0x26 − team+0x33 == 1`) 이 0xb521c 로 끼운 마투수에게 서는지는 못 읽었다 —
 *    교체가 없으니 선 것으로 둔다(나만의리그 `drainPitcherForPitch` 와 같은 셈). 마선수가 아닌 미션 상대는 붙박이
 *    투수 값이 없어(`DEFAULT_PITCHER_ABILITY`) 깎지 않는다.
 */
export function missionOpponentStaminaAfterPitch(
  stamina: number,
  mission: OriginalMission,
  pitchTypeNumber: number,
  batterSkillIds: readonly number[],
  aceLevels?: Readonly<Record<number, number>>,
): number {
  const ability = missionOpponent(mission) === null ? null : missionOpponentAbility(mission, aceLevels)
  if (ability === null) return stamina
  const cost = pitchStaminaCostOf({
    pitchTypeNumber,
    batterIntimidates: batterSkillIds.includes(INTIMIDATE_SKILL_ID),
    pitcherIsCoward: false,
    pitcherEndures: false,
  })
  return consumeStamina(stamina, cost, staminaCapacityOf(ability.run, MISSION_TEAM_MORALE, true))
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
  /**
   * **파울 각 공 판**인가 — 원본은 맞은 공이면 파울 각이라도 판을 돈다. 판이 파울로 닫히면(`foulEnded`) 정산 없이 같은 타석
   * 다음 공(0xae3e8 ae568 → 0xf · 0x35108 → 0xb6b58 스트라이크)이고, 낙구 전에 잡히면 뜬공 아웃(13)으로 타석이 끝난다.
   */
  readonly isFoulPlay?: boolean
}

/** 파울 각 공 판의 임시 결과 칸 — 판이 파울로 닫히면 쓰지 않고, 잡히면 판 끝 정산(뜬공 아웃)이 갈아 끼운다 */
const FOUL_PLAY_OUTCOME: AtBatOutcome = { kind: '아웃', detail: '뜬공아웃' }

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

/** 투영 원점 0xcfb18 의 칸 — 미션 상대 타자의 좌우를 알 길이 없어 1 로 둔다 (추정, 예전 그대로) */
const MISSION_STAGE_SIDE = 1
/** 미션 투수는 체력 레코드가 없다 — 늘 100% 로 둔다 (추정) */
const MISSION_STAMINA_PERCENT = 100

const NO_SKILLS: readonly number[] = []

/** 미션 모드 한 판 — 타자편(MissionRun)과 투수편(PitcherRun)을 함께 다룬다. */
export function useMissionSession({
  runner,
  random,
  missionRecord,
  screen,
  setScreen,
  onGamePointReward,
  sound,
  throwModeManual,
  aceLevels,
  pitcher: pitcherInput,
  batterSkillIds: nariBatterSkillIds = NO_SKILLS,
  hallOfFame,
  isVibrationOn,
}: MissionSessionInput) {
  const nariPitcher = useMemo(() => pitcherInput ?? modePitcherOf(null), [pitcherInput])
  /**
   * **미션 선수 고르기 결과** (하위 17 0x29a54 · 칸 코드 0x5eae0) — 편과 명전 번호(+0xa5 투수 · +0xa6 타자, 나리면 null).
   * 아직 안 골랐으면 null — 화면이 고르기 창(`HallOfFameScreen` 선수고르기)을 먼저 띄운다.
   */
  const [player, setPlayer] = useState<HallOfFamePlayerPick | null>(null)
  const isInMissionMode = MISSION_MODE_SCREENS.includes(screen.kind)
  useEffect(() => {
    if (!isInMissionMode) setPlayer(null)
  }, [isInMissionMode])
  const silent = useMemo(() => createSilentSound(), [])
  const audio = sound ?? silent
  const [missionRun, setMissionRun] = useState<MissionRun | null>(null)
  const missionRunRef = useRef(missionRun)
  missionRunRef.current = missionRun
  const [pitcherRun, setPitcherRun] = useState<PitcherRun | null>(null)
  /** 타자 미션 상대 마투수의 레코드 스태미나 +0x2c — 새 경기마다 10000 (`missionOpponentStaminaAfterPitch`) */
  const [opponentMoundStamina, setOpponentMoundStamina] = useState(FULL_STAMINA)
  const [pendingDefensePlay, setPendingDefensePlay] = useState<PendingMissionDefense | null>(null)
  const pendingDefensePlayRef = useRef(pendingDefensePlay)
  pendingDefensePlayRef.current = pendingDefensePlay
  /**
   * 다 돌려 놓은 주자 판 하나 — CPU 견제(종류 4) · 공 도착 판(0x3dfac 종류 5 도루 · 9 폭투·포일).
   * 화면이 재생을 마치면 비운다 (`actions.finishPickoffReplay`)
   */
  const [pickoffReplay, setPickoffReplay] = useState<DefensePlayResult | null>(null)
  /**
   * **타자 미션: 이번 투구에 출발한 주자들의 루** — state[0x14 + 루]. 공이 나는 동안 키 '3'·'2'·'1' 로 쌓이고
   * (`actions.steal`, 난수 없음) 공이 도착하면(0x3dfac) 도루 판을 열거나 지워진다. 키와 같은 틱에 공이 도착할 수 있어
   * 진행 칸은 ref 로 든다(화면 표시는 state).
   */
  const [stealingFrom, setStealingFrom] = useState<readonly StealBase[]>([])
  const stealingFromRef = useRef(stealingFrom)
  const takeStealingFrom = () => {
    const taken = stealingFromRef.current
    stealingFromRef.current = []
    if (taken.length > 0) setStealingFrom([])
    return taken
  }
  /**
   * **벤치 클리어링 연출(상태 0x1e)이 붙들고 있는 사구** — 투수 미션 전용.
   * 원본 미션(모드 5)도 보통 경기 장면 0x104 라 상태 0x12 갱신 0x4e6d4 의 끝 0x4e72c~0x4e776 을 그대로 탄다:
   * 거르는 것은 플레이 종류 8(홈런더비, 0x4e740)과 사구 아님(0x4e748)뿐이고 모드를 읽지 않는다.
   * 진입 0x3a5f0 도 모드·미션 칸을 안 본다 → 연출과 그 전역 rand(진입 45 · 틱 10 의 8)가 미션에서도 돈다.
   * 출구 0xae24c 뒤에야 사구가 보통 길(밀어내기·정산)을 간다 — `finishBenchClearing`.
   */
  const [pendingBenchClearing, setPendingBenchClearing] = useState<
    { readonly run: PitcherRun; readonly outcome: AtBatOutcome } | null
  >(null)
  /**
   * **필살 남은 칸** s8 팀[+0x29 + 타순] — 미션 한 판에 한 번 채우고(0xaebe4) 스윙 틱 0x4e136 이 줄인다. −1 = 안 채움.
   * 타자 미션은 내 타자 칸, 투수 미션은 상대 타자 칸이다.
   * ⚠️ 근사: 웹 미션은 상대 타선·타순을 들고 있지 않고 모든 상대 타석을 같은 선수(마타자 미션이면 그 마타자)로
   *    본다 — 그래서 칸도 하나다. 원본 미션 팀에서 마타자가 몇 번 타순에 서는지는 아직 안 읽었다.
   */
  const [batterSpecialSwingStored, setBatterSpecialSwingStored] = useState(UNFILLED_SPECIAL_SWING)
  /**
   * **상태 0xe 의 OK 대기** (`features/play-game/model/sceneConfirm`) — 미션(모드 5·6)도 보통 경기 장면 0x104 라 새 타석마다
   * 0xd → 0xe 를 지나 사람 OK 를 기다린다(0x39e14 · 0x532b0 에 모드 갈림 없음). 미션 시작(0x18 판 뒤)·타석이 끝난 뒤·
   * 3아웃으로 끊긴 뒤마다 새 객체를 싣는다. 화면(`MissionPlayScreen`·`PitchingScreen`)이 `useSceneConfirm` 으로 받는다.
   * 제한 시간은 그 동안에도 흐른다 — 모드 5·6 의 0xaada4 는 장면 상태 갱신 뒤(0x52ed0) 상태를 안 가리고 돈다.
   */
  const [sceneConfirm, setSceneConfirm] = useState<SceneConfirmWait | null>(null)
  /** 타석을 새로 세운다 — 0xd → 0xe 라 OK 를 기다린다 */
  const resetAtBatWithConfirm = (count?: { balls: number; strikes: number }) => {
    setSceneConfirm(enterSceneConfirm())
    runner.resetAtBat(count)
  }
  const [opponentSpecialSwingStored, setOpponentSpecialSwingStored] = useState(UNFILLED_SPECIAL_SWING)
  /**
   * **투수 미션 마구 남은 칸** s8 팀[+0x28] — −1 = 안 채움(팀 new 0xb891c). 0xaebe4 가 미션 투수로 채우고
   * (`modePitcherMagicRemainingOf`) 코스 확정 0x50e9c 가 줄인다. 미션 한 판(새 경기)마다 −1 로 돌아간다.
   */
  const [pitcherMagicStored, setPitcherMagicStored] = useState(UNFILLED_SPECIAL_SWING)
  /**
   * **공 객체 +0x10** — 투수 미션 사람 공에 실린 마구 번호 (0x3de10). 되돌리는 줄이 없어 마구 뒤 공에도 남는다(H2 3-4).
   * 경기 시작 0 (0x1239 new 의 0 채움은 원본 미확인 — 팀 경기 `ballMagicNumber` 와 같다).
   * 미션에서는 CPU 가 이 공을 던질 일이 없다 — 투수 미션은 사람만 던지고 타자 미션은 사람이 안 던진다.
   */
  const [ballMagicNumber, setBallMagicNumber] = useState(0)
  /**
   * **투수편 마선수 대결로 연 투수 미션** — 아니면 null. 원본은 SYS 8(0x8d7e8)이 `g[0x175] = team − 1` ·
   * `g[0x176] = 1`(대기 표시)을 적고 미션 장면(모드 5)으로 나간다 (S13 4-1). 웹은 화면을 투수편 라우트가 그리므로
   * (`renderAceMatch`) 앱 화면(`screen`)을 '투수미션' 으로 바꾸지 않고 이 칸으로 대결 중임을 안다.
   */
  const [pitcherAceMatchMission, setPitcherAceMatchMission] = useState<OriginalMission | null>(null)
  /**
   * 던지는 투수 = 선수 게터 0x1fbd0: 모드 5 · 전역기록 +0x176 == 0(투수편 마선수 대결이 아님) · +0xa5 ≥ 0 이면
   * 명예 투수(0x1f62c), 그 밖은 나리 투수(`pitcher` 입력).
   */
  const hallOfFamePitcher = useMemo(() => {
    if (pitcherAceMatchMission !== null || hallOfFame === undefined) return null
    if (player?.side !== '투수' || player.hallOfFameIndex === null) return null
    const famer = hallOfFamePitcherAt(hallOfFame, player.hallOfFameIndex)
    return famer === null ? null : modePitcherOfHallOfFame(famer)
  }, [hallOfFame, pitcherAceMatchMission, player])
  const pitcher = hallOfFamePitcher ?? nariPitcher
  const pitcherMagicRemaining = modePitcherMagicRemainingOf(pitcherMagicStored, pitcher)
  /**
   * 치는 명예 타자 = 선수 게터 0x1fc20: 모드 6 · 전역기록 +0x11f == 0(마선수 대결이 아님) · +0xa6 ≥ 0 이면 0x1f640.
   * null 이면 나리 타자 — 화면은 앱이 넘긴 `modeBatterOf` 를 쓴다.
   */
  const hallOfFameBatter = useMemo(
    () => (screen.kind === '마선수대결' || hallOfFame === undefined ? null : hallOfFameModeBatterOf(player, hallOfFame)),
    [hallOfFame, player, screen.kind],
  )
  const batterSkillIds = hallOfFameBatter?.skillIds ?? nariBatterSkillIds
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
  const isPitcherRunning =
    (screen.kind === '투수미션' || pitcherAceMatchMission !== null) && pitcherRun?.status === '진행중'
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

  /**
   * 타자 미션의 공 하나.
   *
   * 공이 손을 떠날 때(0x3dec6) 상대 마투수 투구 소모 0xa5e14 가 돈다 — 모드 갈래가 없어(0x3de10~0x3dec8 ·
   * 0xa5e14~0xa5f62) 미션(모드 6)에서도 깎인다(`missionOpponentStaminaAfterPitch`). 깎인 체력%(0xaebb0)는 다음 공의
   * CPU 제구 등급·피로(0xb58e6)와 스윙 판정 0xab214 가 본다 (`missionPitcherAbility` 셋째 인자).
   */
  const handleMissionPitch = useCallback(
    (
      detail: PitchOutcomeDetail,
      /** 필살타법이 성공한 타구인가 (0x517e6 → 0x51800) — 야수가 쥐지 못한다. `BattingStage` 의 셋째 인자 */
      isUncatchable = false,
      /** 이 공의 번트 종류 장면 +0xfdc (`BattingStage` 의 넷째 인자) — 타구 판 리드(0x3d7b8)가 본다 */
      buntKind = 0,
    ) => {
      const pitchingRun = missionRunRef.current
      // 견제는 공이 아니라 구질이 오지 않는다 (`PitchOutcomeDetail.pitchTypeNumber`)
      const pitchTypeNumber = detail.pitchTypeNumber
      if (pitchingRun !== null && pitchTypeNumber !== undefined) {
        setOpponentMoundStamina((stamina) =>
          missionOpponentStaminaAfterPitch(stamina, pitchingRun.mission, pitchTypeNumber, batterSkillIds, aceLevels),
        )
      }
      const hasSwung = detail.hasSwung
      // 파울 각 공 — 원본은 맞은 공이면 각과 무관하게 판(상태 0x17)을 돈다(메시지 0x11 → 0x13 → 0x17). 스트라이크(0xb6b58)는
      // 판이 파울로 닫힐 때(`finishDefensePlay`)다. 공 도착 판(0x3dfac)은 못 맞힌 공만이라 열지 않는다.
      // 필살타법 성공 굴림(0x517e6)도 판 시작이 한다(`foulContact` 의 재료)
      // ⚠️ 파울 콜 25 는 아직 공 판정 자리(`pitchCallSoundIdOf`)에서 낸다 — 원본은 판의 결과 코드 7 메시지 51c5c
      const foulRun = missionRunRef.current
      if (
        detail.resolution.kind === '파울' &&
        detail.foulContact !== undefined &&
        foulRun !== null &&
        foulRun.status === '진행중'
      ) {
        const foulOutcome = registerContact(FOUL_PLAY_OUTCOME, detail.foulContact)
        const foulStealing = takeStealingFrom()
        playSoundIds(audio, [detail.contactSoundId, pitchCallSoundIdOf(detail.resolution, runner.atBatRef.current)])
        // 배트를 냈다 — 스윙 수는 휘두른 자리에서 준다. 다 썼는지는 판이 파울로 닫힌 뒤 본다
        if (hasSwung) setMissionRun((previous) => (previous === null ? previous : recordSwing(previous)))
        setPendingDefensePlay({
          side: '타자',
          input: {
            ...missionDefensePlayInputOf(foulRun.bases, foulRun.outs, foulOutcome, random),
            stealingFrom: foulStealing,
            buntKind,
            // state[4] — 판 끝 결과 코드 11 · 판 뒤 스트라이크(0xb6b58)가 이 공 앞의 스트라이크를 본다
            strikes: runner.atBatRef.current.strikes,
          },
          outcome: foulOutcome,
          isBunt: false,
          runnersOnBase: runnerCountOf(foulRun.bases),
          isFoulPlay: true,
        })
        runner.setIsPaused(true)
        return
      }
      const nextAtBat = runner.applyPitch(detail.resolution)
      const outcome = isAtBatFinished(nextAtBat) ? nextAtBat.outcome : null
      // 맞은 공(쏜 패턴이 묶인 안타·아웃·홈런)이면 수비 화면(상태 0x17)이 먼저 돈다 — 결과·콜은 그 뒤다
      const runsDefense = outcome !== null && isMissionPlayOutcome(outcome)
      const current = missionRunRef.current
      const runnersOnBase = current === null ? 0 : runnerCountOf(current.bases)

      // 공 도착 0x3dfac — 못 맞힌 공이면 0.1% 폭투·포일(종류 9)이나 출발한 도루(종류 5) 판을 연다.
      // 미션(모드 6)도 보통 경기 장면 0x104 라 같은 길이다 (0x3dfac 는 모드 7 만 0.1% 굴림을 건너뛴다)
      const stealing = takeStealingFrom()
      const play =
        current !== null && current.status === '진행중' && arrivesUnhit(detail.resolution)
          ? runPitchArrivalPlay(
              {
                gameMode: MISSION_BATTER_MODE,
                pitchJudgement: pitchJudgementOf(detail.resolution, outcome),
                stealingFrom: stealing,
                bases: current.bases,
                outs: current.outs,
                // 타자 미션은 수비가 CPU · 공격이 사람 — 아홉 칸·주루는 미션 타구(`missionDefensePlayInputOf`)와 같은
                // 진행기 기본값(500)이다(레코드에 팀·타순이 없다, 근사). 주루 설정은 안 넘긴다(기본 자동 — 견제와 같다)
                defenseIsCpu: true,
                offenseIsCpu: false,
              },
              random,
            )
          : null

      // 타구음 → 심판 콜 순서 (경기 장면과 같은 0x51408 이다). 공 도착 판이 열렸으면 그 판정 콜(도루 17 · 62/20,
      // 폭투 17)이 심판 콜 뒤다 — 원본은 판 안의 그 틱에 내지만 웹은 판을 미리 다 돌려 재생하므로 연 자리에서 낸다.
      // 삼진·볼넷·홈런은 수비가 개입할 것이 없어 아웃 콜도 여기서 같이 난다 (0xae24c 갈래)
      playSoundIds(audio, [
        detail.contactSoundId,
        pitchCallSoundIdOf(detail.resolution, nextAtBat),
        play?.callSoundId ?? null,
        outcome === null || runsDefense ? null : inPlayCallSoundIdOf(outcome),
      ])

      if (current !== null && play !== null && arrivalApplicationOf(play) === 'runnerOnly') {
        // 판의 진루·아웃·득점을 먼저 먹이고 재생한다 — 타석은 이어진다(볼카운트 그대로)
        const interrupted = current.outs + play.result.advance.outsAdded >= MISSION_OUTS_PER_INNING
        setMissionRun((previous) => (previous === null ? previous : withMissionRunnerPlay(previous, play)))
        if (play.result.ticks.length > 0) setPickoffReplay(play.result)
        if (interrupted) {
          // 판에서 3아웃 — 이 타석은 끊긴다 (판정 B 0xae3e8 아웃 > 2 → 0x18). 미션은 시작 상황으로 돌아간다(applyPickoff)
          if (hasSwung) setMissionRun((previous) => (previous === null ? previous : checkSwingsExhausted(recordSwing(previous))))
          resetAtBatWithConfirm()
          return
        }
      }

      if (outcome === null) {
        if (hasSwung) {
          setMissionRun((previous) =>
            previous === null ? previous : checkSwingsExhausted(recordSwing(previous)),
          )
        }
        return
      }

      if (runsDefense && current !== null) {
        // 스윙 수만 먼저 줄이고 **루·아웃·목표는 한 톨도 건드리지 않는다** — 수비 화면이
        // 다 돈 뒤 `finishDefensePlay` 가 한 번에 먹인다 (원본도 0x17 이 도는 동안 0xf 로 안 간다)
        if (hasSwung) setMissionRun((previous) => (previous === null ? previous : recordSwing(previous)))
        setPendingDefensePlay({
          side: '타자',
          input: {
            ...missionDefensePlayInputOf(current.bases, current.outs, outcome, random),
            isUncatchable,
            // 공이 나는 동안 출발한 주자 — 판 시작 리드(0x3d7b8)가 다음 루로 몰아 돌린다
            stealingFrom: stealing,
            // 장면 +0xfdc — 번트면 도루 안 한 주자의 판 시작 리드가 +3 틱
            buntKind,
          },
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
        // 낫아웃 — 폭투·포일 판의 진루(타자주자 포함)가 이 삼진 타석의 진루다 (0x3e0d0 state[0x1a])
        if (play !== null && arrivalApplicationOf(play) === 'batterRuns') {
          return withBatterNotOut(swung, outcome, detail.isBunt, play)
        }
        return applyMissionOutcome(swung, outcome, detail.isBunt)
      })
      // 결과 연출 뒤 새 타석 — 0xd → 0xe
      setSceneConfirm(enterSceneConfirm())
      runner.pauseWithBanner(describeOutcomeBanner(outcome, runnersOnBase))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aceLevels, audio, batterSkillIds, random, runner],
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
    // 벤치 클리어링 연출(0x1e)이 도는 동안에도 다음 공은 없다
    if (pendingBenchClearing !== null) return

    // 원본 구질 번호 1~21, 메뉴의 마구 칸은 22 (0xb6d6a). 표에 없는 이름이면 1(FASTBALL)로 둔다
    const isMagic = isModeMagicPitchType(type)
    const typeNumber = isMagic
      ? MAGIC_PITCH_TYPE_NUMBER
      : Math.max(1, PITCH_TYPES.findIndex((candidate) => candidate.name === type.name) + 1)
    // 0x50db8 — 구질 22 는 남은 마구(0xaea10) > 0 일 때만 받는다. 아니면 무시 (난수 없음)
    if (isMagic && pitcherMagicRemaining <= 0) return
    // 게이지를 쓰면 칸에서 t = max(g−4, 1) 을, 안 쓰면 제구·체력 확률표 0xd896c 로 뽑는다 (0x4dbac)
    const grade = pitchGradeOf(
      {
        gaugeSettingOn,
        typeNumber,
        gaugeCell,
        effectiveControl: pitcher.stats.control,
        staminaPercent: MISSION_STAMINA_PERCENT,
      },
      random,
    )
    const builtPitch = buildHumanPitch(
      {
        typeNumber,
        courseCell,
        grade,
        gaugeCell,
        stats: pitcher.stats,
        repertoire: pitcher.repertoire,
        side: MISSION_STAGE_SIDE,
        // 조건코드 0 이면 `applyControlError` 가 난수를 한 톨도 안 뽑는다 = 예전과 같다
        missionConditionCode,
      },
      random,
    )
    // 코스 확정 0x50e9c 가 남은 마구를 먼저 줄이고(`0xae9c4(팀, 남은−1)`), 상태 0x11 진입 0x3de10 이 그 **뒤**에
    // `구질 == 22 && 남은 > 0` 이면 공+0x10 = 투수 +0x18 — 마지막 한 개(1 → 0)는 안 싣는다. 되돌리는 줄이 없다 (H2 3-4).
    // CPU 타석 판정의 보정 구조체 0x34d6c 투수 쪽이 이 칸을 본다 — 미션 투수는 비트7 이라 n = 공+0x10 − 1 칸
    const magicRemainingAfter = isMagic ? pitcherMagicRemaining - 1 : pitcherMagicRemaining
    const nextBallMagicNumber = ballMagicNumberAfterPitch(
      ballMagicNumber,
      typeNumber,
      pitcher.repertoire.magicNumber,
      magicRemainingAfter,
    )
    setPitcherMagicStored(magicRemainingAfter)
    setBallMagicNumber(nextBallMagicNumber)
    const pitch = {
      ...builtPitch,
      magicNumber: nextBallMagicNumber,
      pitcherMagicNumber: pitcher.repertoire.magicNumber,
    }
    // 실투 판정 0x33cbc — 투구 순간 0x4dc78 이 궤적 준비 0x9e669 **뒤**(0x4dea0)에 부른다.
    // 미션도 같은 투구 길이다(위 주석). 마구가 아니면 rand(0,100) 을 늘 한 번 굴린다.
    const isMistake = isMistakePitch(
      {
        isMagicPitch: typeNumber === MAGIC_PITCH_TYPE_NUMBER,
        grade,
        // 0xb570d(ctx, 1, 투수, 1, 90, 1) — 칸 1 구속. 모드 5 는 0xb6414 를 0..999 로 자른 값 (`modePitcherOf`)
        effectiveVelocity: pitcher.stats.velocity,
        runnerCount: runnerCountOf(pitcherRun.bases),
        hasSecondBaseRunner: pitcherRun.bases.second,
        // ⚠️ 마타자 레코드의 스킬 비트(+0x14)가 웹 마선수 표에 없어 압도 22 는 거짓으로 둔다
        batterIntimidates: false,
        // 미션 투수의 장착 비트 0xb62b4 — 32 안정감 · 33 새가슴 · 38 냉정 (투수 비트 16·17·22)
        pitcherIsSteady: pitcher.isSteady,
        pitcherIsTimid: pitcher.isTimid,
        pitcherIsCool: pitcher.isCool,
      },
      random,
    )
    // 마타자 미션은 원본 마선수 능력치로, 그 밖에는 평범한 타자로 상대한다.
    const opponent = missionOpponent(pitcherRun.mission)
    // 마타자는 0xb6414 첫 단계에서 레벨 배율 0xd88aa[mgr[0x13f + 순번]] 을 네 칸 모두 먹는다
    const rawBatter = missionOpponentAbility(pitcherRun.mission, aceLevels) ?? ROOKIE_BATTER_ABILITY
    // CPU 타자 결정 0x34334 의 h 는 **경기용 히트** 0xb570d(ctx, 0, 타자, 1, 90, 1) 다 (ce462ce).
    // 미션 모드 5 에서 0xb570c 는 나만의리그 갈래(모드 3·4)도 시즌 갈래(2)도 안 타고, 체력 인자 90 은
    // 감소가 없고, 팀 능력치 마스크 {1,2,8,9} 에도 없다 → 0xb6414 값을 0..999 로 자른 것이다.
    // ⚠️ 미해결: 0xb6414 스킬 보정(+0x14, 플래그 1)은 마선수 표에 스킬 비트가 없어 못 붙인다.
    const batterAbility = {
      ...rawBatter,
      hit: gameAbilityOf({
        mode: MISSION_PITCHER_MODE,
        base: rawBatter.hit,
        isPitcher: false,
        slot: BATTER_SLOT.히트,
        isMyTeam: false,
      }),
    }
    // 마타자 필살 0x34468~0x34488 — 남은 칸(0xaea30)이 0 이 아니면 휘두를 때마다 필살이다 (난수 없음)
    const specialSwing = missionOpponentSpecialSwingOf(pitcherRun.mission, opponentSpecialSwingStored, aceLevels)
    // CPU 도루 0x520de — 상태 0x11 의 10번째 틱(0x537dc → 메시지 0x583)이라 실투 판정(0x4dea0) 뒤, CPU 타자 결정
    // (11번째 틱 0x34334) **바로 앞**이다. 후보가 있을 때만 rand(0,1000) 한 번 → 0xa9bd4 출발 (`rollCpuStealStart`).
    // ⚠️ 근사: 미션 레코드에 상대 타선이 없어 주자 주루는 진행기 기본값(500)이다 — 0x520de 의 표 칸은 주자 속도
    //    300~383 이면 늘 1 이라(`cpuSteal` 머리말) 주루와 무관하게 같은 확률이다
    const stealingFrom = rollCpuStealStart(
      { bases: pitcherRun.bases, offenseIsCpu: true, runAbilityOf: () => MISSION_DEFAULT_RUN_ABILITY },
      random,
    )
    // 원본 0x34334 가 보는 상황 — state 의 볼카운트·아웃과 주자 유무(0xa9599)
    const thrown = pitchAgainstBatterDetailed(
      pitch,
      batterAbility,
      random,
      undefined,
      {
        strikes: runner.atBatRef.current.strikes,
        balls: runner.atBatRef.current.balls,
        outs: pitcherRun.outs,
        hasRunner: runnerCountOf(pitcherRun.bases) > 0,
      },
      {
        isMistakePitch: isMistake,
        // 0xb633d(타자) — 마타자 미션의 상대는 마선수 레코드(+0xa 비트 6)라 번트 칸을 뽑아도 친다
        isMagicBatter: opponent !== null,
        ...(specialSwing === null ? {} : { specialSwing }),
        // 판정 묶음 '투수미션' = 모드 5 — 수비(사람) −10 (0xab5c0, 모드 3·4 밖) 과
        // 0xab42a 의 비트7 투수 +100. 미션 투수는 나리 투수편 저장 [저장+0x3c] 의 선수(0x1fbd0, 9fe86db) 또는
        // 명예 투수(+0x880) 라 레코드 rec[0xa] 비트7(등록 투수 0x80 — C 노트 · 0xb6389)이 서 있다.
        // 연차(+0xb3)는 모드 3·4 갈래(sp40)에서만 읽혀 여기서는 안 쓰인다 — 넘기지 않는다
        swingMode: '투수미션',
        isPitcherOwnPlayer: true,
        // 파울 각 공도 수비 판을 돈다 — 낙구 전에 잡히면 파울 뜬공 아웃(13), 아니면 판이 닫힌 뒤 스트라이크(0x35108 → 0xb6b58)
        playsFoulBall: true,
      },
    )
    const resolution = thrown.resolution
    const foulContact = thrown.foulContact
    // 0x4e136 — 필살 스윙이 나간 틱에 남은 −1 (헛스윙도). 마타자가 아니면 null 이라 칸을 안 건드린다
    if (thrown.specialSwingRemaining !== null) setOpponentSpecialSwingStored(thrown.specialSwingRemaining)

    let nextRun = recordPitch(pitcherRun, grade === MAX_GAUGE_GRADE)
    // 이 공 **전** 스트라이크 — 0x9d57c 의 st[4] (삼진 진동이 본다)
    const strikesBefore = runner.atBatRef.current.strikes
    // 판을 도는 파울 각 공은 판이 파울로 닫힌 뒤에야 스트라이크가 오른다(0x35108 → 0xb6b58)
    const nextAtBat = foulContact === undefined ? runner.applyPitch(resolution) : runner.atBatRef.current
    // 맞은 공의 결과는 수비 판이 끝나야 정해진다 — 타석에 실린 결과는 임시 값이라(`battedContact`) 판정 글자를 띄우지 않는다
    runner.setBannerText(resolution.kind === '타구' || foulContact !== undefined ? '' : describePitchResolution(resolution))
    const outcome = isAtBatFinished(nextAtBat) ? nextAtBat.outcome : null
    const runsDefense = outcome !== null && isMissionPlayOutcome(outcome)
    // 공 도착 0x3dfac — 못 맞힌 공이면 0.1% 폭투·포일(종류 9)이나 CPU 가 건 도루(종류 5) 판을 연다.
    // 사람 수비라 송구는 환경설정이 먹는다 — 판은 키 없는 사람 수비로 미리 다 돌려 재생한다 (견제와 같은 근사)
    const play = arrivesUnhit(resolution)
      ? runPitchArrivalPlay(
          {
            gameMode: MISSION_PITCHER_MODE,
            pitchJudgement: pitchJudgementOf(resolution, outcome),
            stealingFrom,
            bases: pitcherRun.bases,
            outs: pitcherRun.outs,
            defenseIsCpu: false,
            offenseIsCpu: true,
            throwMode: throwModeManual === false ? '자동' : '수동',
          },
          random,
        )
      : null
    // 투구 순간 소리 (0x3f378 — 투수 단계가 공을 놓는 칸에 닿을 때). 이어서 심판 콜.
    // ⚠️ **근사**: 웹은 던지는 순간에 결과가 다 나오므로 투구음과 심판 콜이 붙어 버린다.
    //    통로가 하나라 뒤 소리가 앞 소리를 끊는다 (원본은 공이 날아가는 동안이 사이에 있다).
    // 삼진 진동 100ms — 미션(모드 5)도 경기 장면 0x104 라 못 맞힌 공은 0x11 → 0x12 를 지나고, 그 그리기 0x4ce9c 는
    // 모드를 가리지 않는다(0x52fb6 표 0xd05a0[0x12]). 0x12 진입 3dfac 이 0x9d57c 로 state[0xc] = 5(삼진) 를 쓰면
    // 첫 그리기(경기+0x2c == 0)의 4d0ba → 4d0d6 0x3a44(100, 100) (`strikeoutVibration`). 난수 없음.
    // ⚠️ 근사(때): 웹은 던지는 순간 판정이 나오므로 심판 콜과 같은 자리에서 울린다 (투수편 `usePitcherGame` 과 같다)
    vibrate(strikeoutVibrationMillisecondsOf(resolution, strikesBefore), isVibrationOn !== false)
    playSoundIds(audio, [
      // 0x3f378 3f46a — 구질 22 면 28. 미션 투수는 육성·명예 투수(비트7)라 0xb633d 가 거짓이어서
      // 공+0x10 갈래(3f488)는 안 탄다 → 투수 +0x18 을 0 으로 넘긴다 (b008959)
      pitchReleaseSoundIdOf({ typeNumber, pitcherMagicNumber: 0, ballMagicNumber: nextBallMagicNumber }),
      pitchCallSoundIdOf(resolution, nextAtBat),
      // 공 도착 판의 판정 콜 — 판을 연 자리에서 낸다 (견제와 같은 근사)
      play?.callSoundId ?? null,
      outcome === null || runsDefense ? null : inPlayCallSoundIdOf(outcome),
    ])

    if (play !== null && arrivalApplicationOf(play) === 'runnerOnly') {
      // 판의 진루·아웃·실점을 먼저 먹이고 재생한다 — 타석은 이어진다(볼카운트 그대로)
      const interrupted = nextRun.outs + play.result.advance.outsAdded >= MISSION_OUTS_PER_INNING
      nextRun = withPitcherMissionRunnerPlay(nextRun, play)
      if (play.result.ticks.length > 0) setPickoffReplay(play.result)
      if (interrupted) {
        // 판에서 3아웃 — 이 타석은 끊긴다 (판정 B 0xae3e8 아웃 > 2 → 0x18)
        resetAtBatWithConfirm()
        setPitcherRun(checkPitchExhausted(nextRun))
        return
      }
    }

    // 파울 각 공 — 원본도 판(상태 0x17)을 돈다(맞은 공은 모두 메시지 0x11 → 0x13 → 0x17). 타석은 아직 안 끝났다 —
    // 판이 파울로 닫히면 `finishDefensePlay` 가 스트라이크를 올리고 같은 타석 다음 공으로, 잡히면 판 끝 정산(뜬공 아웃)이다
    if (foulContact !== undefined) {
      const foulOutcome = registerContact(FOUL_PLAY_OUTCOME, foulContact)
      setPendingDefensePlay({
        side: '투수',
        input: {
          ...missionDefensePlayInputOf(nextRun.bases, nextRun.outs, foulOutcome, random, MISSION_PITCHER_MODE, throwModeManual),
          stealingFrom,
          // state[4] — 판 끝 결과 코드 11 · 판 뒤 스트라이크(0xb6b58)가 이 공 앞의 스트라이크를 본다
          strikes: strikesBefore,
        },
        outcome: foulOutcome,
        isBunt: false,
        runnersOnBase: runnerCountOf(nextRun.bases),
        isFoulPlay: true,
      })
      setPitcherRun(nextRun)
      return
    }

    if (runsDefense && outcome !== null) {
      // 수비 화면(0x17)이 돈다 — 실점·피안타·이닝 목표는 다 돌고 난 뒤에 센다
      setPendingDefensePlay({
        side: '투수',
        input: {
          ...missionDefensePlayInputOf(
            nextRun.bases,
            nextRun.outs,
            outcome,
            random,
            MISSION_PITCHER_MODE,
            // 사람이 수비다 — 환경설정 송구(+0xf4)가 그대로 0xae6c8 의 답이 된다
            throwModeManual,
          ),
          // 0x517e6 — 마타자 필살이 성공한 타구는 필살타법 표시 속성 4(0xaf180 — 송구 공과 무관)가 서서 야수가 쥐지 못한다
          isUncatchable: thrown.isUncatchable,
          // CPU 가 공이 나는 동안 건 도루 — 판 시작 리드(0x3d7b8)가 다음 루로 몰아 돌린다
          stealingFrom,
        },
        outcome,
        isBunt: false,
        runnersOnBase: runnerCountOf(nextRun.bases),
      })
      setPitcherRun(nextRun)
      return
    }
    if (outcome !== null) {
      // 사구면 상태 0x12 끝(0x4e74c)에서 벤치 클리어링을 굴린다 — 미션(모드 5)도 홈런더비가 아니라 늘 한 번 굴린다.
      // 굴림이 돌발 검사보다 앞이라 돌발 유무와 무관하게 난수는 한 번 쓴다.
      // ⚠️ 들어갔을 때의 효과(수비가 사람 → 0xaeab0 미션 투수 스태미나 −1000)는 웹 미션이 스태미나를
      //    들고 있지 않아(`MISSION_STAMINA_PERCENT` 고정) 남길 자리가 없다. S[1] 은 시즌(모드 2)만 적는다.
      const entersBenchClearing = rollsIntoBenchClearing(
        { isHitByPitch: outcome.kind === '사구', isHomeRunDerby: false, burstInProgress: false },
        random,
      )
      if (entersBenchClearing) {
        // 진입 0x3a5f0 — 공격 9명 자리·목표 굴림 45 번이 곧바로 나간다. 사구는 연출이 끝날 때까지 붙든다
        rollBenchClearingEntry(random)
        setPendingBenchClearing({ run: nextRun, outcome })
        setPitcherRun(nextRun)
        return
      }
      nextRun =
        play !== null && arrivalApplicationOf(play) === 'batterRuns'
          ? // 낫아웃 — 폭투·포일 판의 진루(타자주자 포함)가 이 삼진 타석의 진루다 (0x3e0d0 state[0x1a])
            withPitcherNotOut(nextRun, outcome, play)
          : applyPitcherOutcome(nextRun, outcome, { random })
      resetAtBatWithConfirm()
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
      if (pending.isFoulPlay === true && played.foulEnded === true) {
        // 파울로 닫힌 판 — 0xae3e8 ae568 이 정산 없이 0xf(같은 타석 다음 공) · 0x35108 이 0xa975c(주자를 판 앞 자리로) ·
        // 0xb6b58(스트라이크 ≤ 1 이면 +1)
        runner.applyPitch({ kind: '파울' })
        if (pending.side === '투수') {
          setPitcherRun((previous) => (previous === null ? previous : checkPitchExhausted(previous)))
        } else {
          setMissionRun((previous) => (previous === null ? previous : checkSwingsExhausted(previous)))
        }
        runner.setIsPaused(false)
        return
      }
      // 플레이가 끝난 자리 — 아웃 콜(0x51b36)·세이프 콜(0x51c14)과 장타 함성은 여기서야 난다.
      // 함성 60 은 원본이 **낙구 틱**에 내는 것이라 이 자리는 근사다 (atBatSounds 주석)
      // 판 끝 정산(0xa8024)이 낸 결과 — `pending.outcome` 은 타석을 끝낸 임시 값이다(`battedContact`)
      const settled = recordedOutcomeOf(pending.input, played)
      playSoundIds(audio, [
        deepHitCheerSoundIdOf({
          outcome: settled,
          carryDistance: carryDistanceOf(pending.input.trajectory),
          caughtOnTheFly: played.caughtOnTheFly,
        }),
        inPlayCallSoundIdOf(settled, played),
      ])

      if (pending.side === '투수') {
        // `played.runnerFates`(주자별 +0x95·+0x96)로 실점 R+0x128 · 출루 허용 R+0x130 을 원본대로 센다
        setPitcherRun((previous) =>
          previous === null ? previous : applyPitcherOutcome(previous, pending.outcome, { played }),
        )
        resetAtBatWithConfirm()
        runner.setIsPaused(false)
        return
      }
      setMissionRun((previous) =>
        previous === null
          ? previous
          : applyMissionOutcome(previous, pending.outcome, pending.isBunt, random, played),
      )
      // 결과 연출 뒤 새 타석 — 0xd → 0xe
      setSceneConfirm(enterSceneConfirm())
      runner.pauseWithBanner(describeOutcomeBanner(settled, pending.runnersOnBase))
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

  /**
   * **마선수 대결을 이겼을 때** — 0xa5368(obj, 1) 이 g[0x11f]·g[0x176] 을 안 보고 `[obj+0xbd] = team − 1 ≤ 15` 면
   * 그 편의 클리어 칸을 올린다(−1 에서 시작, 99 상한). 보상 G 는 0x4ef3e 가 건너뛴다 (`entities/mission/model/aceMatchClear`).
   */
  const rememberAceMatchCleared = (mission: OriginalMission) => {
    const key = aceMatchClearKeyOf(mission)
    if (key === null) return
    const next = { ...clearCounts, [key]: aceMatchClearCountAfterWin(clearCounts[key]) }
    setClearCounts(next)
    missionRecord.save(next)
  }

  /** 새 경기 — 필살·마구 남은 칸은 0xaebe4 가 다시 채운다 (팀 new 0xb891c 가 −1), 공 객체도 새것 */
  const resetForNewMatch = (mission: OriginalMission) => {
    // 새 경기 — 0xaae7c 가 저장된 마투수 레코드(+0x2c = 10000)를 다시 베낀다
    setOpponentMoundStamina(FULL_STAMINA)
    setBatterSpecialSwingStored(UNFILLED_SPECIAL_SWING)
    setOpponentSpecialSwingStored(UNFILLED_SPECIAL_SWING)
    setPitcherMagicStored(UNFILLED_SPECIAL_SWING)
    setBallMagicNumber(0)
    resetAtBatWithConfirm(mission.start)
    runner.setBannerText('')
    runner.setIsPaused(false)
    setPendingDefensePlay(null)
    setPickoffReplay(null)
    setPendingBenchClearing(null)
    stealingFromRef.current = []
    setStealingFrom([])
    // 경기 장면 상태 9 갱신 0x3f584 의 공통 꼬리 0x3fa0e — 시뮬 초기화 0xc0dac 의 rand(0, 2) 한 번.
    // 미션(모드 5·6)도 보통 경기 장면이라 모드 점프 뒤 이 꼬리를 탄다 — 1회초 판·첫 타석 준비보다 앞.
    // 그 앞 상태 7 장면 초기화 0x3e340 의 3ed76 → 0xb08e8 이 이 장면의 패턴 덱을 섞는다(사람 · CPU 타자가 같이 쓴다)
    openScenePatternDeck(random)
    rollSimulatorInit(random)
  }

  const actions = {
    /** 수비 화면이 끝났다 — 진루·아웃·실점을 이제 먹인다 */
    finishDefensePlay,

    /** 타자 미션의 필살 스윙이 나갔다 (0x4e136) — `BattingStage` 의 `onSpecialSwingUsed`, 인자는 줄인 뒤 남은 횟수 */
    specialSwingUsed: (remaining: number) => setBatterSpecialSwingStored(remaining),

    /**
     * **벤치 클리어링 연출이 끝났다** — 출구 0xae24c (`BenchClearingScene` 의 `onDone`).
     * 틱 10 의 갱신 0x401d4 에 닿았으면 수비 8명 목표 굴림 8 번이 그때 나갔다 — 화면 대신 여기서 굴린다.
     * 그 뒤 사구는 보통 길 그대로다 (투수편 진행기 `resolveBenchClearing` 과 같은 차례).
     */
    finishBenchClearing: (reachedTargetTick: boolean) => {
      const pending = pendingBenchClearing
      if (pending === null) return
      setPendingBenchClearing(null)
      if (reachedTargetTick) rollBenchClearingTargets(random)
      setPitcherRun(applyPitcherOutcome(pending.run, pending.outcome, { random }))
      resetAtBatWithConfirm()
    },

    /**
     * 선수 고르기 결과 1~4 (0x29a54 → 표 0xcec00): 투수(1·3)면 모드 5, 타자(2·4)면 모드 6 — 그 편의 미션 목록으로 간다.
     */
    choosePlayer: (pick: HallOfFamePlayerPick) => {
      setPlayer(pick)
      setLastSide(pick.side)
    },

    begin: (mission: OriginalMission) => {
      setLastSide(mission.side)
      resetForNewMatch(mission)
      // 목록에서 고른 보통 미션 — 투수편 대결 표시는 내린다
      setPitcherAceMatchMission(null)

      if (mission.side === '투수') {
        setPitcherRun(startPitcherMission(mission))
        setScreen({ kind: '투수미션', mission })
        return
      }
      setMissionRun(startMission(mission))
      setScreen({ kind: '미션진행', mission })
    },

    /** 이벤트 match — 공략 레코드를 치르고 결과 이벤트로 돌아간다 (이기면 `finishAceMatch` 가 클리어 칸을 올린다) */
    beginAceMatch: (mission: OriginalMission, pending: Omit<Extract<Screen, { kind: '마선수대결' }>, 'kind' | 'mission'>) => {
      setOpponentMoundStamina(FULL_STAMINA)
      setBatterSpecialSwingStored(UNFILLED_SPECIAL_SWING)
      setOpponentSpecialSwingStored(UNFILLED_SPECIAL_SWING)
      resetAtBatWithConfirm(mission.start)
      runner.setBannerText('')
      runner.setIsPaused(false)
      setPendingDefensePlay(null)
      setPickoffReplay(null)
      setPendingBenchClearing(null)
      stealingFromRef.current = []
      setStealingFrom([])
      // 마선수 대결도 미션 장면(모드 6)으로 나간다 — 장면 덱(0x3e340 → 0xb08e8) · 0x3fa0e 의 rand(0, 2) 한 번 (`resetForNewMatch` 와 같다)
      openScenePatternDeck(random)
      rollSimulatorInit(random)
      setMissionRun(startMission(mission))
      setScreen({ kind: '마선수대결', mission, ...pending })
    },

    /**
     * **투수편 마선수 대결** — 투수편 장소 이벤트의 `match`(SYS 8, 0x8d7e8)가 고른 **투수 미션 레코드 team − 1**
     * (16~20 메디카·킹타이거·로제·크라이져·어거지죠, 목표 아웃 1 · 투구 5 · 실점·피안타·볼넷 한도 1)를
     * 미션 장면(모드 5)과 같은 투구 길로 던진다. 던지는 투수는 세션의 `pitcher` — 0x1fbd0 은 `+0x176 ≠ 0` 이면
     * 명예 투수 갈래를 안 타고 늘 나리 투수편 저장 [저장+0x3c] 선수다 (`modePitcherOf(투수편 career)`).
     * 상대 명부 0xb86e2 도 `+0x176` 이 서 있고 원래 모드(g[0xf6])가 시즌(2)이 아니면 기본 팀 명부라 보통 미션과 같다.
     *
     * 화면 전환은 하지 않는다 — 투수편 라우트가 `PitcherAceMatchRoute` 를 그린다.
     */
    beginPitcherAceMatch: (mission: OriginalMission) => {
      if (mission.side !== '투수') return
      resetForNewMatch(mission)
      setPitcherRun(startPitcherMission(mission))
      setPitcherAceMatchMission(mission)
    },

    /**
     * 투수편 마선수 대결이 끝났다 — **이겼나**를 돌려준다 (대결 중이 아니면 null).
     *
     * 원본 경기 뒤 0x4ea0c 의 모드 5·6 갈래: 0x4ef3e 가 `g[0x11f]`·`g[0x176]` 이 서 있으면 G 보상을 건너뛰고,
     * 0x4f004~0x4f018 이 `g[0x177] = [미션객체+0xbc]` 를 적는다 — +0xbc 는 미션 끝 0x509a0 → 0xa5368(obj, 목표 달성?)
     * 이 적은 **성공 여부**다. 105 진입 0x10df8 이 이 바이트로 `resultEvents[이김 ? 0 : 1]` 을 고른다 (0x10e40).
     * 그래서 이김 = 미션 상태 '성공'. 미션 클리어 G 보상은 없다 (`rememberCleared` 를 안 부른다).
     *
     * 0xa5368(obj, 1) 은 플래그를 안 보고 `[obj+0xbd] ≤ 15` 면 클리어 횟수 칸(전역 +0x150 + 편×16 + idx)을 올린다.
     * 대결의 +0xbd 는 SYS 8 이 `g[0x175]` 와 같은 team − 1(15~19)로 적는다(0x8d88a~0x8d890) — 그래서
     * team 16(메디카, 레코드 15)을 이겼을 때만 투수 15번 칸이 −1 에서 하나 오른다 (`rememberAceMatchCleared`).
     */
    finishPitcherAceMatch: (): boolean | null => {
      if (pitcherRun === null || pitcherAceMatchMission === null) return null
      const isWin = pitcherRun.status === '성공'
      if (isWin) rememberAceMatchCleared(pitcherAceMatchMission)
      setPitcherRun(null)
      setPitcherAceMatchMission(null)
      setPendingDefensePlay(null)
      setPendingBenchClearing(null)
      return isWin
    },

    /**
     * 타자편 마선수 대결이 끝났다 — 결과 이벤트로 돌아간다. SYS 8 의 타자편 갈래(0x8d782~0x8d7ce)도 g[0xf7] = team − 1 ·
     * g[0x11f] = 1 을 적고 미션객체 +0xbd = team − 1 · +0xbf = 6 이라, 이기면 0xa5368(obj, 1) 이 타자 15번 칸을 올린다
     * (team 16 일 때만 — `rememberAceMatchCleared`). G 보상은 0x4ef3e 가 g[0x11f] 로 건너뛴다.
     */
    finishAceMatch: () => {
      if (missionRun === null || screen.kind !== '마선수대결') return
      if (missionRun.status === '성공') rememberAceMatchCleared(screen.mission)
      const eventId = matchResultEventOf(screen.resultEvents, missionRun.status === '성공')
      setMissionRun(null)
      setScreen({ kind: '이벤트', eventId, context: screen.context, carried: screen.carried })
    },

    /**
     * **CPU 투수의 견제** — 타석 화면(`BattingStage.onPickoff`)이 상대 투수 AI 가 목표점 대신 고른 루를 알려 준다.
     *
     * 원본 길은 미션(모드 6)에서도 그대로 돈다 (직접 재역어셈):
     * CPU 조작 객체 0x53874 → 0x53824 `[+0x18] > 5` → 메시지 0x645 → 0x509a0 → 0x5121c → `0x345fc`
     * (모드 갈림은 0x3460e `+0x1104 == 7` 홈런더비 하나) → 종류 4 → `0x34848` 루 굴림 → 메시지 0x10 →
     * `0x50f28`(루 > 0 · 0xa9878 주자 있음 → 종류 4 · 상태 0x17, 모드·미션 객체를 안 본다).
     * 미션 객체로 걸러지는 0x66864 는 CPU 투수 교체 0x3d954·0xc1ba4 에서만 불린다(xref) — 견제 길에는 없다.
     *
     * 판은 바로 다 돌려 진루·아웃을 먹이고(`applyPickoff`), 화면은 `pickoffReplay` 를 재생한다(나만의리그와 같은 꼴).
     * 볼카운트·남은 타석·스윙은 그대로다 — 공을 안 던졌다.
     * 수비 능력치·주루는 미션 타구(`missionDefensePlayInputOf`)와 같은 기본값이다: 아홉 칸 기본 능력치, 사람 공격,
     * 주루 설정은 안 넘긴다(진행기 기본 = 자동) — 미션 세션에는 환경설정 "주루" 가 들어오지 않는다(근사, 타구와 같다).
     *
     * 판정 콜 — 세이프면 늘 17 (0x51c14 의 종류 4·5 갈래), 견제사면 62/20 (0x51b36).
     * ⚠️ 원본은 공이 잡히는 **틱**에 낸다. 웹은 판을 미리 다 돌려 재생하므로 판을 연 자리에서 낸다 (팀경기·나만의리그와 같은 근사).
     */
    cpuPickoff: (base: PickoffBase) => {
      const current = missionRunRef.current
      if (current === null || current.status !== '진행중') return
      if (pendingDefensePlayRef.current !== null) return
      if (!(base === 1 ? current.bases.first : base === 2 ? current.bases.second : current.bases.third)) return
      const result = runPickoffPlay({
        targetBase: base,
        bases: current.bases,
        outs: current.outs,
        random,
        // 타자 미션은 사람이 공격이다 (`missionDefensePlayInputOf` 의 offenseIsCpu 와 같다)
        offenseIsCpu: false,
        // 수비는 CPU 다 — 미션 경기 준비 0xaa57c 가 레코드 +3 의 윗 4비트 칸을 사람(aa658 `0xb6c18(st, 칸, 0)`),
        // 다른 칸을 CPU(aa666 `… , 1)`)로 세우고, 타자 미션의 사람 칸은 공격이라 수비측 경기[0x31 + 수비측] == 1 이다.
        // 슬롯 2 의 0xae6c8 첫 항이 서서 받은 야수의 0xafa60 이 매 틱 돈다 (d80918a · 4dec1e1 의 타자편 cpuPickoff 와 같다).
        // 송구 설정(+0xf4)은 둘째 항이라 안 넘긴다
        defenseIsCpu: true,
      })
      setMissionRun((previous) => (previous === null ? previous : applyPickoff(previous, result.advance)))
      playSoundIds(audio, [pickoffCallSoundIdOf(result)])
      if (result.ticks.length > 0) setPickoffReplay(result)
    },

    /**
     * **투수 미션 사람 견제** — 구질 고르기(상태 0xf)에서 키 '3' 1루 · '1' 2루 · '7' 3루 (`PitchingScreen.onPickoffKey`).
     *
     * 원본은 모드 5 를 막지 않는다 (직접 재역어셈):
     * - 미션 경기 준비 0xaa57c 가 사람 칸을 경기[0x31 + 칸] = 0 으로 세우고(aa658), 조작 객체 생성 0x3f584 가 그 값으로
     *   0x34af8(장면, 칸, 0xb6c20 값)을 불러 0 이면 사람 조작 객체(new 0x30 · 0x53218 → vtable 0xd0a14)를 만든다
     *   (3f974~3f998). 수비측 객체는 [+0xc] = 1 (3f9c4) — 투수 미션의 사람 칸이 수비다.
     * - 키는 경기 장면 키 처리 0x498d4 의 끝(499fa~49a52)이 두 조작 객체 중 `[+0x10] == 0`(사람)에게
     *   슬롯 2 0x53290(상태, 키, r3 = 0 → [+0x1c] = 0) · 슬롯 3 0x536bc 로 넘긴다. 상태 0xe 의 틱 ≤ 2 말고는 거르지 않는다.
     * - 0x536bc 는 [+0x1c] == 0 이면 점프표 0xd0a24 로 상태 0xf → 0x53580: 수비([+0xc] ≠ 0)면 구질 0x534d8 **뒤에 이어서**
     *   견제 0x53548 을 부른다 — 구질 키가 먹는 자리면 견제 키도 늘 먹는다. 모드를 읽는 줄이 없다.
     * - 메시지 0x10 → 0x509a0(앞머리의 [장면+0x214] vt0xc 는 빈 함수 0xae5f8) → 0x50a4c → 0x50f28: 루 > 0 ·
     *   0xa9878 주자 있음 → 종류 4 · state[0x27] = 루 · 상태 0x17. 모드·미션 객체(+0x1788)를 안 본다.
     * - 모드 5·6 에서만 도는 0xaada4(장면 갱신 52ed6)는 제한 시간만 보고 키를 먹지 않는다.
     * 투수편 마선수 대결도 같은 미션 장면(모드 5)이라 같은 길이다.
     *
     * 판은 투수편 `pickoff`(4dec1e1)와 같은 입력이다: 사람 수비 · 환경설정 "송구"(+0xf4)가 0xae6c8 의 답, 공격은 CPU.
     * 끝은 판정 B 0xae3e8 — 아웃 ≤ 2 면 같은 타석 0xf(ae592), 정산 0xa8024 는 늘(ae5a8) → 실점은 주자 운명으로 센다.
     * 3아웃이면 0x18 — 타석이 끊긴다. 견제는 투구가 아니라 투구 수·볼카운트·마구 칸을 안 건드린다.
     * ⚠️ 근사: 수비 아홉 칸·주자 주루는 미션 타구와 같은 진행기 기본값이다(레코드에 팀·타순이 없다).
     * 견제사는 아웃 콜(결과 13 → 0xa7d0c)이 R+0x13c 를 올려 '아웃' 목표에도 든다 — 판 끝 판정 0xaaa6c(ae5c4)가 바로 본다
     * (`outCallsOf`).
     * ⚠️ 미해결(미이식): 같은 타석으로 돌아가면 0xf 진입 0x3d954 가 CPU 대타 0xac228 을 다시 묻는다 —
     *    파일 아래 "미션 장면의 상태 0xf 진입" 머리글. 웹 미션은 상대 타선이 없어 묻지 않는다.
     * 판정 콜(세이프 17 · 견제사 62/20)은 판을 연 자리에서 낸다 (CPU 견제와 같은 근사).
     */
    pickoff: (webKey: string) => {
      if (pitcherRun === null || pitcherRun.status !== '진행중') return
      // 수비 화면·벤치 클리어링·앞 판 재생 중에는 상태 0xf 가 아니다
      if (pendingDefensePlay !== null || pendingBenchClearing !== null || pickoffReplay !== null) return
      const { bases } = pitcherRun
      const play = pickoffPlayForKey(webKey, (base) =>
        base === 1 ? bases.first : base === 2 ? bases.second : bases.third,
      )
      if (play === null) return
      const result = runPickoffPlay({
        targetBase: play.targetBase,
        bases,
        outs: pitcherRun.outs,
        random,
        // 투수 미션은 공격이 CPU 다 — 자동 진루 제어기 0xaf918 이 돈다 (0xae690 첫 항)
        offenseIsCpu: true,
        // 사람이 수비한다 — 0xae6c8 은 환경설정 "송구"(+0xf4) 혼자가 받은 야수의 0xafa60 을 켠다
        defenseIsCpu: false,
        throwMode: throwModeManual === false ? '자동' : '수동',
      })
      const interrupted = pitcherRun.outs + result.advance.outsAdded >= MISSION_OUTS_PER_INNING
      playSoundIds(audio, [pickoffCallSoundIdOf(result)])
      if (result.ticks.length > 0) setPickoffReplay(result)
      // 판정 B 0xae3e8 의 견제 가지는 아웃 ≤ 2 든 3아웃이든 정산 0xa8024 를 부른다 (ae5a8)
      setPitcherRun(withPitcherMissionRunnerResult(pitcherRun, result, true))
      // 3아웃 — 이 타석은 끊긴다 (아웃 > 2 → 0x18)
      if (interrupted) resetAtBatWithConfirm()
    },

    /** 견제 판 재생이 끝났다 */
    finishPickoffReplay: () => setPickoffReplay(null),

    /**
     * **도루 출발** — 타자 미션의 사람 키 '3' 1루 · '2' 2루 · '1' 3루 주자(`0x53610` → 메시지 0x583 → `0xa9bd4`).
     * 주자를 출발만 시킨다(난수·소리 없음). 성공·실패는 공이 도착할 때 도루 판(종류 5)이 정한다(`handleMissionPitch`).
     * 사람 경기 도루는 간이 엔진 표 0xd9064 가 아니다(c18a833).
     */
    steal: (base: StealBase) => {
      const current = missionRunRef.current
      if (current === null || current.status !== '진행중') return
      if (pendingDefensePlayRef.current !== null) return
      const next = startHumanSteal(current.bases, stealingFromRef.current, base)
      if (next === stealingFromRef.current) return
      stealingFromRef.current = next
      setStealingFrom(next)
    },

    giveUpBatter: () => {
      setPendingDefensePlay(null)
      setPickoffReplay(null)
      setPendingBenchClearing(null)
      if (missionRun !== null) setMissionRun(giveUpMission(missionRun))
    },

    /**
     * **경기 중 메뉴 "나가기"** (보통 타자 미션, 모드 6) — 경기 상태 0x22 갱신 `0x40140` 은 밀기가 끝나면 모드 5·6 에서
     * `0xa5368(미션, 0)`(실패 — 횟수·보상·해금을 안 건드리고 [obj+0xbc] = 0 만) 뒤 0x140006c = 4 · 장면 0x103(메인 메뉴 처음 단).
     * 결과 화면(상태 0x19)도 미션 목록(장면 0x107)도 지나지 않는다. 클리어 기록은 그대로다.
     * 다시 들어오면 [최근게임] 5·6 → 하위 17(선수 고르기) — 미션 모드를 떠나면 고른 선수가 내려간다(`isInMissionMode`).
     */
    quitBatterMission: () => {
      setPendingDefensePlay(null)
      setPickoffReplay(null)
      setPendingBenchClearing(null)
      setMissionRun(null)
      runner.setIsPaused(true)
      setScreen({ kind: '메인메뉴' })
    },

    /**
     * **경기 중 메뉴 "나가기"** (보통 투수 미션, 모드 5) — `quitBatterMission` 과 같은 길이다: 0x22 갱신 `0x40140` 의 모드 5·6
     * 갈래가 `0xa5368(미션, 0)` 뒤 장면 0x103(메인 메뉴 처음 단)으로 간다. 결과 화면(0x19)도 미션 목록(0x107)도 안 지난다.
     */
    quitPitcherMission: () => {
      setPendingDefensePlay(null)
      setPickoffReplay(null)
      setPendingBenchClearing(null)
      setPitcherRun(null)
      runner.setIsPaused(true)
      setScreen({ kind: '메인메뉴' })
    },

    giveUpPitcher: () => {
      setPendingDefensePlay(null)
      setPendingBenchClearing(null)
      if (pitcherRun !== null) setPitcherRun({ ...pitcherRun, status: '실패' })
    },

    /** 결과 판(0x19) "아니오"·CLR — 0x140006c = 1 → 장면 0x107 상태 1(미션 목록) */
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

    /**
     * 결과 판(0x19) "예" — 0x140006c = 3 → 장면 0x107 상태 3 진입 0x1e908: 같은 미션(obj+0xbd = this+0x9c)을
     * `0xa5368(obj, 0)` 뒤 곧바로 장면 0x104 로 다시 세운다(목록을 안 지난다, Q2 2a). 보상은 진입 0x4ea0c 가 이미 줬다.
     */
    retryBatter: () => {
      if (missionRun === null) return
      rememberCleared(missionRun.mission, missionRun.status)
      actions.begin(missionRun.mission)
    },

    retryPitcher: () => {
      if (pitcherRun === null) return
      rememberCleared(pitcherRun.mission, pitcherRun.status)
      actions.begin(pitcherRun.mission)
    },
  }

  /**
   * 결과 판 0x4a384 의 번 G [+0x17f4] — 진입 0x4ea0c(0x4ef18~0x4efba): 성공이고 g[0x11f] · g[0x176](마선수 대결)이
   * 안 섰으면 [미션+0xa0] = 0xa5368 이 적은 보상 0xa52b0(이번 클리어를 더하기 전 횟수로), 실패면 0.
   * ⚠️ 근사: 원본은 이 진입에서 g[0x64] 에 보상을 더한다. 웹은 판을 나갈 때(`rememberCleared`) 더하므로 판의 보유 G 는
   *    부르는 쪽이 `missionResultHeldOf` 로 더해 보인다 — 보이는 값은 같다.
   */
  const resultEarnedGamePointOf = (mission: OriginalMission, status: string, isAceMatch: boolean): number =>
    missionResultEarnedOf(
      status === '성공',
      isAceMatch,
      missionRewardOf(mission.stage, clearCounts[missionKeyOf(mission)] ?? 0),
    )

  /** 타자 미션에서 지금 출발시킬 수 있는 루 — `canStartSteal`(0xa9924 앞길 검사). 이번 공에 이미 출발한 주자는 빠진다 */
  const stealableBases: readonly StealBase[] =
    missionRun === null || missionRun.status !== '진행중' || pendingDefensePlay !== null
      ? []
      : ([1, 2, 3] as const).filter((base) => startHumanSteal(missionRun.bases, stealingFrom, base) !== stealingFrom)

  return {
    missionRun, pitcherRun, pitcherAceMatchMission, clearedKeys, clearCounts, lastSide, aceLevels, pitcher,
    player, hallOfFameBatter,
    missionConditionCode, pendingDefensePlay, pendingBenchClearing, pickoffReplay, handleMissionPitch, handleThrow, actions,
    batterSpecialSwingStored, pitcherMagicRemaining, stealableBases, resultEarnedGamePointOf,
    /** 상태 0xe 의 OK 대기 — 화면이 `useSceneConfirm` 에 넘긴다 */
    sceneConfirm,
    /** 타자 미션 상대 마투수의 체력% `0xaebb0` = trunc(+0x2c / 100) — `missionPitcherAbility` 셋째 인자 */
    opponentStaminaPercent: staminaPercentOf(opponentMoundStamina),
  }
}

/** 미션은 한 이닝 안에서 논다 — 3아웃이면 시작 상황으로 돌아간다 (`missionRun` 의 추정과 같다) */
const MISSION_OUTS_PER_INNING = 3
/** 진행기 기본 주루(등급 3 = 500) — 미션 레코드에 팀·타순이 없어 미션 타구도 이 값을 쓴다 (`missionDefensePlayInputOf`) */
const MISSION_DEFAULT_RUN_ABILITY = 500
/** 도루 판 정산 0xa8024 @a83c6 의 기록 8(도루) — 루를 옮긴 도루 주자마다 하나 (`stealRecordIdsOf`) */
const STEAL_RECORD_ID = 8

/**
 * **타자 미션의 주자 판**(공 도착 0x3dfac 의 종류 5 도루 · 9 폭투·포일)을 먹인다 — 진루·아웃은 견제 판과 같은
 * `applyPickoff`(3아웃이면 시작 상황), 미션 도루 목표는 도루 판의 기록 8 하나마다 +1 이다.
 * 도루 목표 칸은 확정이다 (직접 재역어셈): 판정 0xaaa6c 모드 6 갈래가 `0xaa928(R+0x10c, 행+0xa4 아래)`(aab56)로 재고,
 *    R+0x10c(사건 코드 0x10, 핸들러 0xa5900 `+= 1`)를 올리는 곳은 정산 0xa8024 의 a8388 하나 — 도루 주자 루프(a830c~a83d6)
 *    에서 루를 옮긴 주자마다 기록 8(a83c6)과 **같은 반복**에서 부른다. 그래서 기록 8 의 수와 같다. 판정은 판 끝(0xae5c4)에서 돈다.
 * ⚠️ 악송구·폭투로 들어온 득점은 타점이 아니라 목표·화면 점수에 안 든다 — 견제와 같은 근사(`applyPickoff` 주석).
 */
function withMissionRunnerPlay(run: MissionRun, play: PitchArrivalPlay): MissionRun {
  if (run.status !== '진행중') return run
  const moved = applyPickoff(run, play.result.advance)
  const steals = play.recordIds.filter((id) => id === STEAL_RECORD_ID).length
  if (steals === 0) return moved
  let progress = moved.progress
  for (let index = 0; index < steals; index += 1) progress = recordSteal(progress)
  return { ...moved, progress, status: isCleared(run.mission, progress) ? '성공' : moved.status }
}

/**
 * **타자 미션 낫아웃** — 삼진 타석의 목표·타석 수·스윙은 보통 삼진 길(`applyOutcome`) 그대로, 루·아웃만 폭투·포일
 * 판의 진루(타자주자 포함, 아웃 없음)로 바꾼다. 삼진 기록(0xa7c4c)은 원본도 그대로 남는다.
 */
function withBatterNotOut(run: MissionRun, outcome: AtBatOutcome, isBunt: boolean, play: PitchArrivalPlay): MissionRun {
  if (run.status !== '진행중') return run
  const struck = applyMissionOutcome(run, outcome, isBunt)
  const moved = applyPickoff(run, play.result.advance)
  return { ...struck, bases: moved.bases, outs: moved.outs }
}

/**
 * **미션 장면의 상태 0xf 진입 `0x3d954`** — 모드 5·6 에서 실제로 하는 일 (직접 재역어셈, 3d9ca~3da94 · 0x66864 · 0xac228).
 * 0xf 로는 새 타석의 0xe 확인 · 판정 A 0xae24c 의 "그 밖"(볼·스트라이크·파울) · 견제/도루 판 끝 ae592 가 모두 들어오므로
 * **공마다** 돈다. 웹 미션 세션에는 이 자리가 없다.
 *
 * ```
 * 3d9cc  r4 = 0x66864()                       ; 미션 가림막 — 아래 투수 교체 갈래에만 쓴다
 * 3d9e4  수비 팀이 CPU(state[0x31 + state[0xa]] == 1)
 *          돌발 진행 중(0x8eb94) → 건너뜀 · r4 == 0 → 건너뜀
 *          그 밖 → 0xac428(…) CPU 투수 교체                      ; 모드 6(타자 미션)
 *        아니면(수비가 사람)
 *          돌발 진행 중 → 건너뜀
 *          그 밖 → 0xac228([장면+0x21c], [장면+0x220], [장면+0x20c], state) CPU 대타 ; 모드 5(투수 미션) — 가림막 없음
 * 3da74  참이면 22 "Time!"(3da88) · 0x16 예약(3da94) → 0xd → 0xe(돌발 0x8f158 다시) → 0xf 재진입
 *
 * 0x66864: 모드 5·6 이 아니면 1. 모드 6 이면 미션 객체 +0xbd(고른 칸) == 3 또는 7 일 때만 0, 모드 5 면 수비가 사람일 때 0.
 * ```
 * - **모드 5(투수 미션)** — CPU 대타 0xac228 을 공마다 묻는다. 막는 칸(`state[0xe]`(ac234) · 벤치 [팀+0x28c] > 0 ·
 *   지금 타자 마선수 아님 0xb633d · 그 타순 칸 +0x13 홈런 0 · +0x12 안타 ≤ 1 · **+0x14 타석 ≥ 2** · 장비 니블 넷 0)이 모두 열려야
 *   `rand(0, 1000)`(0xbfa54) 을 굴리고, 들면 `rand(0, 벤치)` 로 0xaf06c 교체 · state[0xe] = 1. 칸 하나라도 닫히면 굴림이 없다.
 *   투수편 이식(`pitcherGameFlow.enterPitchSelection` · `applyOpponentCpuPinchHit`)과 같은 함수다.
 * - **모드 6(타자 미션)** — CPU 투수 교체 0xac428 을 공마다 묻는다. 0x66864 가 막는 것은 칸 3·7(스토리 4 레오니 · 8 발렌타인)
 *   뿐이고, 칸 11(12 드래고나)·마투수 없는 미션은 막지 않는다(마선수 대결의 +0xbd 값은 안 읽었다). 마투수는 0xac4f2 갈래(이닝 실점 > 2 ·
 *   경기 실점 > 3 · 체력 ≤ 39%), 그 밖은 보직·이닝·리드 갈래(`judgePitcherChange`).
 *
 * ⚠️ 미해결(미이식): 두 갈래 모두 미션 레코드 +2 의 두 팀(0xaa6c8~0xaa76c 의 0xb891c 팀 채우기)의 실제 명단 —
 *    타순 칸 기록·벤치 수·보직·저장된 체력(+0x2c) — 을 본다. 웹 미션은 상대 타선·투수진을 들고 있지 않아(모든 상대 타석이
 *    같은 선수, 마선수가 아닌 상대 투수는 `DEFAULT_PITCHER_ABILITY`) 판정 입력도, 들어올 선수도 지을 수 없다. 그래서 옮기지 않았다.
 *    원본에서 이 갈래가 굴림을 쓰는 것은 모드 5 에서 같은 타자가 세 번째 타석에 설 때(+0x14 ≥ 2)부터, 모드 6 에서는 교체 판정이
 *    참일 때(마무리 굴림 0xac360 · 새 투수 0xabfcc)뿐이다.
 */
/**
 * **투수 미션의 주자 판**(종류 5 도루 · 9 폭투·포일)을 먹인다 — 3아웃이면 다음 이닝(빈 루 · 0아웃, `advanceDefense` 와 같다).
 * 잡은 아웃은 이닝 목표(`totalOuts`)에 든다.
 * - 실점 R+0x128: 판 끝 판정 B 0xae3e8 이 정산 0xa8024 를 부를 때만 주자 운명으로 센다 — 도루(5)는 늘, 폭투·포일(9)은
 *   삼진이 그대로 선 판만(ae596 → ae5a6). 아니면 정산을 건너뛰어(ae5a2 → ae5b6) 실점 칸에 안 든다.
 * - 판정 0xaaa6c 는 판 끝(0xae5c4, 모드 5·6)에서 돈다 — 정산을 건너뛴 폭투·포일 판(ae5a2 → ae5b6)도 판정은 돈다.
 *   웹 판정(`pitcherRun.judgeStatus`)은 미션 엔티티 안에 있어 여기서는 `judgedAfterRunnerPlay` 가 같은 순서로 본다.
 * - 주자 판에서 잡은 아웃(견제사·도루사·진루 중 아웃)은 '아웃' 목표에도 든다 — `outCallsOf` 머리글.
 * ⚠️ 미해결: R+0x130(출루 허용)을 정산이 주자 판에서도 덮어쓰는지는 안 읽었다 — 손대지 않는다.
 */
function withPitcherMissionRunnerPlay(run: PitcherRun, play: PitchArrivalPlay): PitcherRun {
  return withPitcherMissionRunnerResult(run, play.result, play.kind === 5 || play.strikeout === 'strikeoutStands')
}

/**
 * 주자만 움직인 판 하나(견제 종류 4 · 도루 5 · 폭투·포일 9)의 결과를 투수 미션에 먹인다.
 * `settles` — 판 끝 판정 B 0xae3e8 이 정산 0xa8024 를 부르는가 (견제·도루는 늘, 폭투·포일은 삼진이 선 판만).
 */
function withPitcherMissionRunnerResult(run: PitcherRun, result: DefensePlayResult, settles: boolean): PitcherRun {
  if (run.status !== '진행중') return run
  const advance = result.advance
  const outs = run.outs + advance.outsAdded
  const isInningOver = outs >= MISSION_OUTS_PER_INNING
  const charged = settles ? chargedRunsOfFates(result.runnerFates, Math.min(MISSION_OUTS_PER_INNING, outs)) : 0
  return judgedAfterRunnerPlay({
    ...run,
    progress: withOutCalls(run.progress, outCallsOf(run, advance.outsAdded)),
    bases: isInningOver ? EMPTY_BASES : advance.bases,
    outs: isInningOver ? 0 : outs,
    totalOuts: run.totalOuts + advance.outsAdded,
    allowed: { ...run.allowed, runs: run.allowed.runs + charged },
  })
}

/**
 * **주자 판의 아웃도 '아웃' 목표에 든다** (직접 재역어셈) — 판의 아웃 콜 수.
 *
 * 투수 미션 판정 0xaaa6c 의 모드 5 갈래(0xaab9c~)는 '아웃' 목표를 `0xaa928(미션, R+0x13c, 행+0xa4)`(aacd6)로 잰다 —
 * `0xaa928` 은 한도 > 0 이고 칸 < 한도면 상태 1(아직)로 두는 성공 비교라, 다른 목표가 다 찼으면 칸이 한도에 닿는 판에서
 * 상태 0 → 0x76c(성공)이다. R+0x13c 는 사건 코드 0x1a(0xa57f8 → 표 0xd8218)의 "잡은 아웃 수" 칸이고, 올리는 곳은
 * 삼진 0xa7c4c(a7cc4) · **아웃 콜 0xa7d0c**(a7d52 `0xa57f8(R, 0x1a, 1)`, 코드 0x14~0x1f 라 지금 투수가 R 의 선수일 때 —
 * 미션 투수라 늘 선다) · 정산의 낫아웃 보정 −1(a8cfc) 셋이다.
 * 아웃 콜 0xa7d0c 는 플레이 판정 메시지 0x51408 의 결과 갈래(점프표 0xd0488)가 부른다: 결과 11(0x51b20, 콜 62) ·
 * 결과 13(0x51b36 → 0x51bea, 콜 62/20). **견제사·도루사가 내는 62/20 이 바로 결과 13 갈래**(`pickoffCallSoundIdOf`)라
 * 그 아웃도 R+0x13c 에 1 씩 든다. 판에는 주자 목록뿐이고 정산(0xa8ce8)은 state[0x1a](낫아웃)일 때만 빼므로 그대로 남는다.
 * R 은 같은 객체다 — 미션 준비 0xaa57c 의 여섯째 인자(미션+0x14, aa5a0)가 0x3f8b6 의 [장면+0x230], 0x51b24 가 넘기는 것도 [장면+0x230].
 * 판정은 견제 판 끝 판정 B 0xae3e8 의 ae5c4 에서 정산 뒤에 돈다 → 견제사로 '아웃' 목표를 채우면 그 자리에서 성공이다.
 *
 * 노히트노런·퍼펙트게임 칸(웹의 "잡은 아웃" 표시 칸, `recordPitcherOutcome`)도 같은 아웃 수로 올린다 — 판정은 이닝 목표
 * (`totalOuts`)가 하고, 주자 판은 안타·볼넷을 허용하지 않으니 0 으로 되돌릴 일이 없다.
 * 타석 수·삼진콤보는 타석이 끝난 게 아니라 안 건드린다. 칸을 올리는 것은 `missionGoal.withOutCalls`(타석 결과와 같은 칸들).
 */
function outCallsOf(run: PitcherRun, outsAdded: number): number {
  // 판은 셋째 아웃에서 끝나 그 뒤로는 아웃 콜이 없다
  return Math.max(0, Math.min(outsAdded, MISSION_OUTS_PER_INNING - run.outs))
}

/**
 * **투수 미션 낫아웃** — 삼진 타석은 보통 길(`applyPitcherOutcome`: 삼진 목표·타석 수)로 세고, 루·아웃·이닝 아웃·
 * 실점은 폭투·포일 판의 결과(타자주자 포함)로 바꾼다. 판정 B 가 state[0xc] == 5 라 정산 0xa8024 를 부른다(ae5a6).
 *
 * '아웃' 칸(R+0x13c)은 원본대로 고친다 (직접 재역어셈): 낫아웃 갈래 0x3e09e~0x3e0e0 이 삼진 0xa7c4c 를 불러 +1(a7cc4)
 * 하고 state[0x1a] = 1 을 세운다 → 판에서 잡은 아웃(타자주자 1루 아웃 등)은 아웃 콜 0xa7d0c 마다 +1(a7d52) →
 * 정산 0xa8ce8 이 `0xb6c3c`(state[0x1a]) 면 a8cfc `0xa57f8(R, 0x1a, −1)`. 그래서 판정이 보는 값은 "판의 아웃 수" 다
 * (타자주자가 살면 0). 판정 0xaaa6c 는 정산 **뒤**(ae5c4)에 한 번 돌므로, 보통 길이 삼진 +1 로 미리 낸 판정은
 * 버리고 고친 칸으로 다시 잰다 — 실점 한도(`judgedAfterRunnerPlay`) → 실패 한도·목표·남은 기회(`judgePitcherRun`).
 * 이닝 목표 표시 칸(노히트노런·퍼펙트게임)도 같은 수로 고친다(`withOutCalls`).
 */
export function withPitcherNotOut(run: PitcherRun, outcome: AtBatOutcome, play: PitchArrivalPlay): PitcherRun {
  if (run.status !== '진행중') return run
  const struck = applyPitcherOutcome(run, outcome)
  const advance = play.result.advance
  const outs = run.outs + advance.outsAdded
  const isInningOver = outs >= MISSION_OUTS_PER_INNING
  const charged = chargedRunsOfFates(play.result.runnerFates, Math.min(MISSION_OUTS_PER_INNING, outs))
  // 삼진 0xa7c4c +1 을 낫아웃 보정 −1 로 빼고, 판의 아웃 콜 수를 더한다
  const struckOuts = (struck.progress.counts['아웃'] ?? 0) - (run.progress.counts['아웃'] ?? 0)
  const moved: PitcherRun = {
    ...struck,
    status: '진행중',
    progress: withOutCalls(struck.progress, outCallsOf(run, advance.outsAdded) - struckOuts),
    bases: isInningOver ? EMPTY_BASES : advance.bases,
    outs: isInningOver ? 0 : outs,
    totalOuts: run.totalOuts + advance.outsAdded,
    allowed: { ...struck.allowed, runs: run.allowed.runs + charged },
  }
  const afterRuns = judgedAfterRunnerPlay(moved)
  return afterRuns.status === '실패' ? afterRuns : judgePitcherRun(moved)
}

/**
 * 판 끝 미션 판정 0xaaa6c 중 주자 판이 바꿀 수 있는 갈래 — 실점 한도(+0xa1 ↔ R+0x128) → 실패 · 이닝 목표 → 성공 ·
 * 목표 칸(주자 판의 아웃이 '아웃' R+0x13c 에 든다, `outCallsOf`)이 다 차면 → 성공.
 */
function judgedAfterRunnerPlay(run: PitcherRun): PitcherRun {
  const limit = run.mission.failLimits.runs
  if (limit > 0 && run.allowed.runs >= limit) {
    const broken = run.progress.brokenConditions.includes('무실점')
      ? run.progress.brokenConditions
      : [...run.progress.brokenConditions, '무실점']
    return { ...run, progress: { ...run.progress, brokenConditions: broken }, status: '실패' }
  }
  const inningGoal = inningGoalOf(run.mission)
  if (inningGoal !== null) {
    return run.totalOuts >= inningGoal * MISSION_OUTS_PER_INNING ? { ...run, status: '성공' } : run
  }
  return isCleared(run.mission, run.progress) ? { ...run, status: '성공' } : run
}

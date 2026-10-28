import type { PitchResolution } from '@/entities/at-bat/model/atBatState'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { ControlSide } from '@/entities/defense-controls/model/defenseKeys'
import type { RandomPort } from '@/shared/api/random/randomPort'
import {
  arrivesUnhit,
  openPitchArrivalPlay,
  pitchJudgementOf,
  clearsPitchJudgement,
  runOpenedPitchArrivalPlay,
} from '@/features/defense-play/model/pitchArrivalPlay'
import { defenseTeamBonusFor } from '@/features/play-team-game/model/teamGameRoster'
import { applyTeamArrival } from '@/features/play-team-game/model/teamGameFlow/baseRunning/applyTeamArrival'
import { offenseRunnerTeamGradeOf, runAbilitiesOnBaseOf, withoutSteal } from '@/features/play-team-game/model/teamGameFlow/baseRunning/runners'
import { abilityContextOf } from '@/features/play-team-game/model/teamGameFlow/context/abilityContext'
import {
  defenseAbilitiesFor,
  fielderPlatesFor,
  fielderRecordsFor,
  fielderSkillIdsFor,
  runnerAcesFor,
} from '@/features/play-team-game/model/teamGameFlow/defense/fielders'
import type { TeamPitchArrival } from '@/features/play-team-game/model/teamGameFlow/types/pitchArrival'
import type { TeamPendingRunnerPlay } from '@/features/play-team-game/model/teamGameFlow/types/plays'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * **공 도착** — 상태 0x12 진입 `0x3dfac` (`features/defense-play/model/pitchArrivalPlay`). 타자편 `gameFlow.arrivePitch`
 * 와 같은 길을 팀 경기 두 쪽(사람 공격 `batterPitch` · 사람 수비 `pitchOnce`)이 같은 차례로 지난다.
 *
 * - 맞힌 공(파울·타구)은 0x3dfac 를 안 지난다. 파울이면 출발이 풀리고, 타구면 출발 칸을 타구 판 입력이 읽는다.
 * - 못 맞힌 공: `rollPassedBall` 1번 → 종류 9 / 종류 5 / 없음. 판이 열리면 그 advance 를 견제와 같은 주자 판
 *   (`withRunnerOnlyAdvance`, 타순 그대로)으로 먹이고 재생 칸(`lastDefensePlay`)에 넣는다. 낫아웃(종류 9 + 삼진 +
 *   타자주자)만은 여기서 안 먹이고 타석 결과 쪽(`arrivalPlay`)으로 넘긴다.
 * - 기록: 도루 판의 8(도루)·24(도루 저지)는 0xa77f0 게이트를 지난다 — 사람 공격이면 8, 사람 수비면 24 만 남는다.
 * - 사람 수비 쪽 도루 · 폭투 판은 상태 0x17 동안 사람 송구 키(0x533c8 → 0x588 → +0x160)로 던진다 — 화면이 도는 갈래(`live`)는
 *   판을 붙들어(`pendingRunnerPlay`) 화면이 한 틱씩 돌리게 하고 `resolveRunnerPlay` 가 잇는다(`liveRunnerPlay`). 밀어내기(종류 2)는
 *   vt4c 가 안 돌아 키 송구가 없으니 미리 돌린다. 사람 공격 쪽 판도 같은 0x17 에서 주루 키(0x5331c → 0x582 진루 · 0x584 귀루 →
 *   0xa9b04)와 OK 슬라이딩(0x585)을 받는다 — 화면 갈래(`batterLive`)면 붙들어 실시간으로 돌리고 `resolveRunnerPlay` 가
 *   `batterPitch` 의 나머지를 잇는다(`entities/fielding/model/baserunningKey`).
 *
 * - 루별 주루: 루에 선 주자의 신원(`GameState.runners`, 원본 주자 목록)대로 그 팀 타순 칸 선수(`runAbilitiesOnBaseOf`).
 * - 주자 속도의 팀 등급: 0xa93ac a9488 — 모드 1·2·8 에서 공격 팀 근성 등급(`offenseRunnerTeamGradeOf`). 타구·견제 판도 같다.
 * - 정산: 도루 판(종류 5)은 판정 B 0xae3e8 이 늘 정산 0xa8024 를 종류 5 로 **한 번** 부른다(ae5a8). 삼진이 함께 선 판이면 그
 *   한 번이 삼진 타석의 정산이기도 하다 — 판 쪽 칸은 삼진 길(`finishBatterOutcome` · `finishDefensiveAtBat` 의 `stealPlay`)이 함께
 *   센다. 삼진 없는 도루 판은 여기서 센다(`withStealSettlement`).
 *
 * 난수: `rollPassedBall` 1번(매 못 맞힌 공) → 판이 열리면 그 안의 굴림 (`runPitchArrivalPlay`).
 */
export function arriveTeamPitch(
  progress: TeamGameProgress,
  pitch: {
    readonly resolution: PitchResolution
    readonly outcomeAfter: AtBatOutcome | null
    /** 장면 +0xfdc — 이 공의 번트 종류(못 맞힌 번트면 그 종류, 안 휘둘렀으면 0). 도루 판 리드 0x3d7b8 이 본다 */
    readonly buntKind?: number
    /** 지금 타자의 손 0xb63c0(1 = 좌타) — 밀어내기 · 낫아웃 판의 타자주자 타석 자리(vt94 0xa0884, `PitchArrivalPlayInput.batterHand`) */
    readonly batterHand: number
  },
  humanSide: ControlSide,
  random: RandomPort,
  /**
   * 사람 수비의 도루 · 폭투 판을 화면이 실시간으로 돌리게 붙들 때 — `pitchOnce` 의 나머지가 쓸 값. 안 주면 예전처럼 키 없이
   * 미리 돌린다(`throwPitch` · 시험)
   */
  live?: TeamPendingRunnerPlay['resume'],
  /**
   * 사람 공격의 도루 · 폭투 판을 화면이 실시간으로 돌리게 붙들 때 — `batterPitch` 의 나머지가 쓸 값. 상태 0x17 키 0x53420 은
   * 사람 공격이면 판 종류를 안 보고 주루 0x5331c · OK 0x585 를 보낸다(종류 거르기는 0xa9b04 의 0xae794 · 0x518da 몫)
   */
  batterLive?: TeamPendingRunnerPlay['batter'],
): TeamPitchArrival {
  if (!arrivesUnhit(pitch.resolution)) {
    const next = pitch.resolution.kind === '타구' ? progress : withoutSteal(progress)
    return { progress: next, play: null, interrupted: false }
  }
  const humanOffense = humanSide === '공격'
  const opened = openPitchArrivalPlay(
    {
      gameMode: progress.options.mode,
      pitchJudgement: pitchJudgementOf(pitch.resolution, pitch.outcomeAfter),
      stealingFrom: progress.stealingFrom,
      bases: progress.game.bases,
      outs: progress.game.outs,
      batterHand: pitch.batterHand,
      runAbilities: runAbilitiesOnBaseOf(progress, humanSide),
      // 주자 속도의 팀 등급(0xa93ac a9488) — 공격 팀 근성
      runnerTeamGrade: offenseRunnerTeamGradeOf(progress, humanOffense),
      // 마선수 주자 그림(0x79d10) — 공격 팀 타자 · 루 위 주자
      runnerAces: runnerAcesFor(progress, humanOffense),
      ...(humanOffense ? cpuDefenseFieldOf(progress) : humanDefenseFieldOf(progress)),
      // 장면 +0xfdc — 도루 판 리드 0x3d7b8 이 도루 안 한 주자에게 +3 틱 (안 휘두른 공은 0 — 0x11 진입의 memset)
      buntKind: pitch.buntKind ?? 0,
      scene: progress.defenseScene,
      // 경기 +0xfd4 — 이 공의 값 (부르는 쪽이 이미 적었다)
      sceneResultCode: progress.sceneResultCode,
    },
    random,
  )
  const judged = withPitchJudgementCleared(progress, clearsPitchJudgement(opened))
  if (opened === null) return { progress: withoutSteal(judged), play: null, interrupted: false }
  const held = heldRunnerPlayOf(judged, opened, humanSide, live, batterLive)
  if (held !== null) return { progress: held, play: null, interrupted: false, deferred: true }
  return applyTeamArrival(judged, runOpenedPitchArrivalPlay(opened), humanSide)
}

type OpenedArrivalPlay = NonNullable<ReturnType<typeof openPitchArrivalPlay>>

/** 우리 공격 — 수비는 상대(CPU). 환경설정 "주루" 혼자가 자동 진루 제어기를 켠다 (0xae690 의 둘째 항) */
function cpuDefenseFieldOf(progress: TeamGameProgress) {
  const { options } = progress
  return {
    defenseAbilities: defenseAbilitiesFor(progress, options.opponentTeamId),
    defenseTeamBonus: defenseTeamBonusFor(abilityContextOf(options), options.opponentTeamId),
    fielderPlates: fielderPlatesFor(progress, options.opponentTeamId, progress.opponentPitcherIndex),
    fielderSkillIds: fielderSkillIdsFor(progress, options.opponentTeamId),
    // 야수 · 주자 그림 팔레트 (defender.mpl 15벌 — 팀 번호, C-1)
    defenseTeamIndex: options.opponentTeamId,
    fielderRecords: fielderRecordsFor(progress, options.opponentTeamId),
    offenseTeamIndex: options.ourTeamId,
    defenseIsCpu: true,
    offenseIsCpu: false,
    runningMode: options.runningModeManual === true ? ('수동' as const) : ('자동' as const),
  }
}

/** 우리 수비 — 공격이 CPU 라 늘 자동 진루, 송구만 환경설정이 먹는다 (0xae6c8 의 첫 항이 거짓) */
function humanDefenseFieldOf(progress: TeamGameProgress) {
  const { options } = progress
  return {
    defenseAbilities: defenseAbilitiesFor(progress, options.ourTeamId),
    defenseTeamBonus: defenseTeamBonusFor(abilityContextOf(options), options.ourTeamId),
    fielderPlates: fielderPlatesFor(progress, options.ourTeamId, progress.ourPitcherIndex),
    fielderSkillIds: fielderSkillIdsFor(progress, options.ourTeamId),
    // 야수 · 주자 그림 팔레트 (defender.mpl 15벌 — 팀 번호, C-1)
    defenseTeamIndex: options.ourTeamId,
    fielderRecords: fielderRecordsFor(progress, options.ourTeamId),
    offenseTeamIndex: options.opponentTeamId,
    defenseIsCpu: false,
    offenseIsCpu: true,
    throwMode: options.throwModeManual === false ? ('자동' as const) : ('수동' as const),
  }
}

/** 3e0aa — 낫아웃 갈래가 판정 칸을 지웠나. 같은 진입이 적고 0x12 틱 0 그림이 읽는다 (바뀔 때만 새 객체) */
function withPitchJudgementCleared(progress: TeamGameProgress, cleared: boolean): TeamGameProgress {
  if ((progress.lastPitchJudgementCleared === true) === cleared) return progress
  return { ...progress, lastPitchJudgementCleared: cleared }
}

/**
 * 화면이 실시간으로 돌릴 판이면 붙든 진행(`pendingRunnerPlay`), 아니면 null. 밀어내기(종류 2)는 늘 미리 돌린다.
 * - 사람 수비의 도루 · 폭투 판 — 키(+0x160)로 던지므로 화면이 돌린다 (`liveRunnerPlay`). 밀어내기는 vt4c 가 안 돌아 키 송구가 없다.
 * - 사람 공격의 도루 · 폭투 판 — 주루 키(0x582 · 0x584)와 OK 슬라이딩(0x585)을 받는다. 밀어내기는 0xae794 · 0x518da 가 둘 다 막아 키가 할 일이 없다.
 */
function heldRunnerPlayOf(
  progress: TeamGameProgress,
  opened: OpenedArrivalPlay,
  humanSide: ControlSide,
  live: TeamPendingRunnerPlay['resume'] | undefined,
  batterLive: TeamPendingRunnerPlay['batter'] | undefined,
): TeamGameProgress | null {
  if (opened.kind === WALK_PLAY_KIND) return null
  if (live !== undefined && humanSide === '수비') return { ...progress, pendingRunnerPlay: { kind: 'arrival', opened, resume: live } }
  if (batterLive !== undefined && humanSide === '공격') {
    return { ...progress, pendingRunnerPlay: { kind: 'arrival', opened, side: '공격', batter: batterLive } }
  }
  return null
}

/** 밀어내기 판 종류 2 */
const WALK_PLAY_KIND = 2

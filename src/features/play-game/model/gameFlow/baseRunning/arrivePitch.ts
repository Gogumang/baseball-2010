import type { PitchResolution } from '@/entities/at-bat/model/atBatState'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { isPlayerTurn } from '@/entities/game/model/gameState'
import { sceneResultCodeAfterPitch, sceneResultCodeOfThrown } from '@/features/defense-play/model/sceneResultCode'
import { arrivesUnhit, openPitchArrivalPlay, pitchJudgementOf, runOpenedPitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import { enterPitchSelection } from '@/features/play-game/model/gameFlow/atBat/pitchSelection'
import { applyArrivalPlay } from '@/features/play-game/model/gameFlow/baseRunning/arrivalPlay'
import { ourRunnerAcesOf, runAbilitiesOnBaseOf, withoutSteal } from '@/features/play-game/model/gameFlow/baseRunning/runners'
import {
  opponentDefenseAbilitiesOf,
  opponentFielderPlatesOf,
  opponentFielderRecordsOf,
  opponentFielderSkillIdsOf,
} from '@/features/play-game/model/gameFlow/defense/opponentFielders'
import { MY_LEAGUE_BATTER_MODE } from '@/features/play-game/model/gameFlow/types/constants'
import type { PitchArrivalStep } from '@/features/play-game/model/gameFlow/types/pitchArrival'
import type { AtBatCount } from '@/features/play-game/model/gameFlow/types/plays'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/**
 * **공 도착** — 상태 0x12 진입 `0x3dfac` (`features/defense-play/model/pitchArrivalPlay`).
 *
 * 내 타석의 공 하나가 판정된 뒤 타석 결과를 먹이기 **앞**에 부른다. `outcomeAfter` 는 이 공을 먹인 뒤의 타석 결과
 * (볼넷·삼진·사구면 그 결과, 아니면 null) — 투구 판정 v(0x9d57c)를 고르는 데 쓴다.
 * - 맞힌 공(파울·타구)은 0x3dfac 를 안 지난다. 파울이면 출발이 풀리고, 타구면 출발 칸을 타구 판이 읽는다.
 * - 못 맞힌 공: `rollPassedBall` 1번 → 종류 9(폭투·포일) / 종류 5(도루) / 없음.
 *   판이 열리면 그 advance 를 견제와 같은 주자 판 꼴(타순 그대로)로 먹이고 재생 칸(`lastDefensePlay`)에 넣는다.
 *   낫아웃(종류 9 + 삼진 + 타자주자)만은 여기서 안 먹인다 — `startPlayerOutcome` 의 `arrivalPlay` 로 넘기면 그 판의
 *   advance 가 곧 삼진 타석의 진루가 된다.
 * - 기록: 도루 판의 8(도루 성공)은 사람 공격이라 0xa77f0 게이트를 지나고 24(도루 저지)는 버려진다.
 * - 판정 칸은 판 **앞**에서 먹는다(0x3dfac 의 스위치 0x3e11a — `pitchArrivalPlay` 머리말): 볼넷·사구 + 도루면 종류가
 *   2(밀어내기)로 덮여 도루 판이 없고, 삼진 + 도루면 판은 아웃 + 1 로 열린다(삼진 아웃은 판 뒤 보통 길이 더해 합이 같다).
 *   판에서 3아웃이 나는 것은 카운트만 오른 공뿐이라 끊긴 타석의 볼넷·삼진은 없다(`interrupted`).
 *
 * 난수: `rollPassedBall` 1번(매 못 맞힌 공) → 판이 열리면 그 안의 굴림 (`runPitchArrivalPlay`).
 */
export function arrivePitch(
  progress: GameProgress,
  pitch: {
    readonly resolution: PitchResolution
    readonly outcomeAfter: AtBatOutcome | null
    /** 장면 +0xfdc — 이 공의 번트 종류(못 맞힌 번트면 그 종류, 안 휘둘렀으면 0). 도루 판 리드 0x3d7b8 이 본다 */
    readonly buntKind?: number
    /** 맞은 공(타구)의 방향까지 붙인 결과 코드 (`PitchOutcomeDetail.resultCode`) — 경기 +0xfd4. 안 주면 쏜 공(`contactOfOutcome`)에서 */
    readonly resultCode?: number | null
    /** 지금 타자의 손 0xb63c0(1 = 좌타) — 밀어내기 · 낫아웃 판의 타자주자 타석 자리(vt94 0xa0884, `PitchArrivalPlayInput.batterHand`) */
    readonly batterHand: number
  },
  random: RandomPort,
  options: {
    /** 0xa56dc(ctx, 지금 타자, 1) — 포스트시즌 · 국가대항전이면 거짓 (`resolveDefensePlay` 의 `isRecorded`). 안 넘기면 참 */
    readonly isRecorded?: boolean
    /** 이 공을 먹인 뒤의 볼카운트 — 타석이 이어져 0xf 에 다시 들 때 교체 틱 굴림(0x344dc)이 본다 (`AtBatCount`) */
    readonly countAfter: AtBatCount
    /**
     * 화면이 판을 실시간으로 돌린다 — 도루 · 폭투 판(종류 5 · 9)을 붙들고(`pendingRunnerPlay`, 사람 공격) 끝나면 `resolveRunnerPlay`.
     * 판 시작 굴림(0.1% · 폭투 쏘기 · 도루 리드)은 여기서, 판 안의 굴림은 화면의 틱에서 — 그 사이 다른 굴림이 없어 차례가 같다
     */
    readonly live?: boolean
  },
): PitchArrivalStep {
  const before = progress.game
  if (before.isFinished || !isPlayerTurn(before) || progress.pendingDefensePlay !== null || progress.pendingRunnerPlay != null) {
    return { progress, play: null, interrupted: false }
  }
  // 경기 +0xfd4 — 이 공의 0x11 진입이 지우고 휘두른 공이면 스윙 판정이 덮는다. 바뀔 때만 새 객체(부르는 쪽이 같은 객체로 판 없음을 본다)
  const sceneResultCode =
    pitch.resultCode !== undefined ? sceneResultCodeAfterPitch(pitch.resolution, pitch.resultCode) : sceneResultCodeOfThrown(pitch.resolution)
  if (sceneResultCode !== progress.sceneResultCode) progress = { ...progress, sceneResultCode }
  if (!arrivesUnhit(pitch.resolution)) {
    const next = pitch.resolution.kind === '타구' ? progress : withoutSteal(progress)
    // 판 없이 온 파울(옛 길) — 판정 A 0xae24c 의 파울 → 같은 타석 다음 공 0xf 진입 0x3d954
    const continued = pitch.resolution.kind === '파울' && pitch.outcomeAfter === null ? enterPitchSelection(next, random, options.countAfter) : next
    return { progress: continued, play: null, interrupted: false }
  }
  const cleared = withoutSteal(progress)
  const opened = openPitchArrivalPlay(
    {
      gameMode: MY_LEAGUE_BATTER_MODE,
      pitchJudgement: pitchJudgementOf(pitch.resolution, pitch.outcomeAfter),
      stealingFrom: progress.stealingFrom,
      bases: before.bases,
      outs: before.outs,
      batterHand: pitch.batterHand,
      // 우리 공격이니 수비는 상대 팀 — 타구 진행기와 같은 아홉 칸
      defenseAbilities: opponentDefenseAbilitiesOf(progress),
      // 공 가진 야수 이름 판(0x43cb0) · 마선수 주자 그림(0x79d10) — 타구 판과 같은 칸
      fielderPlates: opponentFielderPlatesOf(progress),
      // 초감각(21) — 같은 칸 고르기의 상대 야수 레코드 +0x14 (`defenseSkillIdsOf`)
      fielderSkillIds: opponentFielderSkillIdsOf(progress),
      // 야수 · 주자 그림 팔레트 (defender.mpl 15벌 — 팀 번호, C-1)
      defenseTeamIndex: progress.opponentTeamId,
      fielderRecords: opponentFielderRecordsOf(progress),
      offenseTeamIndex: progress.ourTeamId,
      runnerAces: ourRunnerAcesOf(progress),
      runAbilities: runAbilitiesOnBaseOf(progress),
      defenseIsCpu: true,
      // 타자편은 사람이 늘 공격이다 — 환경설정 "주루" 혼자가 자동 진루 제어기를 켠다 (0xae690)
      offenseIsCpu: false,
      runningMode: progress.runningModeManual ? '수동' : '자동',
      // 장면 +0xfdc — 못 맞힌 번트면 도루 판 리드 0x3d7b8 이 도루 안 한 주자에게 +3 틱
      // (키 없는 공은 0 — 0x11 진입 0x3de10 이 공마다 memset 한다, `BattingStage.sceneBuntKind`)
      buntKind: pitch.buntKind ?? 0,
      scene: progress.defenseScene,
      sceneResultCode: progress.sceneResultCode,
    },
    random,
  )
  // 판이 안 열린 공 — 판정 A 0xae24c: 타석이 이어지면(볼 · 스트라이크) 0xf 진입 0x3d954 가 CPU 투수 교체를 다시 본다
  if (opened === null) {
    return {
      progress: pitch.outcomeAfter === null ? enterPitchSelection(cleared, random, options.countAfter) : cleared,
      play: null,
      interrupted: false,
    }
  }
  const isRecorded = options.isRecorded !== false
  // 사람 공격의 도루 · 폭투 판 — 상태 0x17 키 0x53420 이 사람 공격이면 주루 0x5331c(0x582 · 0x584 → 0xa9b04)와 OK 0x585 를
  // 보내므로 화면이 실시간으로 돌린다. 밀어내기(종류 2)는 0xae794 · 0x518da 가 둘 다 막아 키가 할 일이 없으니 미리 돌린다
  if (options.live === true && opened.kind !== 2) {
    return {
      progress: {
        ...cleared,
        pendingRunnerPlay: {
          kind: 'arrival',
          opened,
          side: '공격',
          arrival: {
            outcomeAfter: pitch.outcomeAfter,
            isRecorded,
            countAfter: options.countAfter,
          },
        },
      },
      play: null,
      interrupted: false,
      deferred: true,
    }
  }
  return applyArrivalPlay(cleared, progress, runOpenedPitchArrivalPlay(opened), pitch.outcomeAfter, isRecorded, random, options.countAfter)
}

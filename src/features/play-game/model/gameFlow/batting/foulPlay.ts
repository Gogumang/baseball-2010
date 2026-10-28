import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { type BattedContact, registerContact } from '@/entities/batting/model/battedContact'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { withPredictedOutcome, type DefensePlayResult, recordedOutcomeOf } from '@/features/defense-play/model/runDefensePlay'
import { enterPitchSelection } from '@/features/play-game/model/gameFlow/atBat/pitchSelection'
import { withoutStealDisplay } from '@/features/play-game/model/gameFlow/baseRunning/runners'
import { finishPlayerOutcome } from '@/features/play-game/model/gameFlow/batting/finishPlayerOutcome'
import { defensePlayInputOf } from '@/features/play-game/model/gameFlow/defense/defenseInputs'
import { withFoulRecords } from '@/features/play-game/model/gameFlow/records/gameRecords'
import type { AtBatCount } from '@/features/play-game/model/gameFlow/types/plays'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/** 파울 각 공 판의 임시 결과 칸 — 판이 파울로 닫히면 쓰지 않고, 잡히면 판 끝 정산(뜬공 아웃)이 갈아 끼운다 */
const FOUL_PLAY_OUTCOME: AtBatOutcome = { kind: '아웃', detail: '뜬공아웃' }

/**
 * **내 타석의 파울 각 공 판** — 원본은 맞은 공이면 각과 무관하게 메시지 0x11 → 0x13 → 0x17 판을 돈다(a769b8e 머리말).
 * 타석은 아직 안 끝났다: 판이 파울로 닫히면(`DefensePlayResult.foulEnded`) `resolveDefensePlay` 가 경기 상태를 그대로 두고
 * 세션이 스트라이크(0x35108 → 0xb6b58)를 올려 같은 타석 다음 공으로, 낙구 전에 잡히면 판 끝 정산(뜬공 아웃 13)이 타석을 끝낸다.
 * 이 공이 나는 동안 출발한 도루 주자도 판에 싣는다(판이 파울로 닫히면 0xa975c 가 판 앞 자리로 되돌린다).
 * 팀경기 우리 타석(`teamGameFlow.startBatterFoulPlay`)과 같은 길이다. 판을 만드는 데 난수를 쓰지 않는다.
 */
export function startPlayerFoulPlay(
  progress: GameProgress,
  contact: BattedContact,
  random: RandomPort,
  options: {
    /** state[4] — 이 공을 먹이기 전의 스트라이크 (판 끝 결과 코드 11 · 판 뒤 스트라이크가 본다) */
    readonly strikes: number
    /** 장면 +0xfdc — 번트 종류 (판 시작 리드 · 판 끝 결과 코드 11) */
    readonly buntKind?: number
  },
): GameProgress {
  if (progress.game.isFinished) return progress
  const outcome = registerContact(FOUL_PLAY_OUTCOME, contact)
  return {
    // 파울 각 공 판도 타구 판(종류 1)이다 — 시작 리드 0x3d7b8 이 출발 표시를 지운다
    ...withoutStealDisplay(progress),
    // 경기 +0xfd4 — 맞은 공이라 스윙 판정이 방향까지 붙인 코드를 적었다
    sceneResultCode: contact.resultCode,
    pendingDefensePlay: withPredictedOutcome({
      // 필살타법 성공 굴림(0x517e6)은 쏜 공의 재료(`contact.specialSwing`)로 판 시작이 필살수비 · 폴 굴림 뒤에 한다
      ...defensePlayInputOf(progress, outcome, contact.pattern, random, { buntKind: options.buntKind }),
      strikes: options.strikes,
    }),
  }
}

/**
 * 화면이 다 돌린 수비 플레이를 **그때** 경기 상태에 먹인다.
 *
 * `result.advance`(진루·아웃·득점)와 `result.voidedRuns`(3아웃으로 날아간 보류 득점)가 여기서
 * 비로소 경기 상태가 된다. 이미 눈으로 다 본 플레이라 `lastDefensePlay` 에는 넣지 않는다 —
 * 넣으면 화면이 같은 장면을 한 번 더 재생한다.
 */
export function resolveDefensePlay(
  progress: GameProgress,
  result: DefensePlayResult,
  random: RandomPort,
  options: {
    readonly foulRecordIds?: readonly number[]
    /**
     * 정산 0xa8024 의 타자 게이트 [sp+0x34] = 0xa56dc(R, 지금 타자, 0)(a8070) — 나리 타자편은 국가대항전 · 포스트시즌이면 거짓
     * (`recordMyBuntAttempt` 와 같은 답 — 사건 코드 ≤ 0x13 의 게이트 0xa56dc(R, 타자, 1)도 같은 모드 갈래다). 안 넘기면 참.
     * 거짓이면 장내 홈런은 홈런 갈래를 건너뛰고(`finishPlayerOutcome`) 번트 안타 G+0xf4 도 안 센다
     */
    readonly isRecorded?: boolean
    /**
     * 판이 파울로 닫혔을 때 0xf 진입의 볼카운트 — 같은 틱 0x35108 이 파울 스트라이크(0xb6b58)를 먹인 값 (`AtBatCount`).
     * 교체 틱 굴림(0x344dc)이 본다. 판이 파울로 안 닫혀도 늘 넘긴다 — 볼카운트 없는 입구(옛 시험)는 걷었다
     */
    readonly countAfterFoul: AtBatCount
  },
): GameProgress {
  const pending = progress.pendingDefensePlay
  if (pending === null) return progress
  // 파울로 닫힌 판 — 판 끝 판정 B 0xae3e8 ae568 이 정산 0xa8024 를 건너뛰고 0xf(같은 타석 다음 공)로, 0x35108 이
  // 0xa975c(주자를 판 앞 자리로)를 부른다 — 경기 상태는 그대로다. 스트라이크(0xb6b58)와 연속 파울(0xa7dbc)은 타석 칸을 든 세션이 센다
  // 그 0xf 진입 0x3d954 가 CPU 투수 교체를 다시 본다
  if (result.foulEnded === true) {
    return enterPitchSelection({ ...progress, pendingDefensePlay: null, defenseScene: result.scene }, random, options.countAfterFoul)
  }
  // 이 타석에서 앞서 난 연속 파울 기록(32·33) — 파울 각 공을 낙구 전에 잡아(파울 뜬공 아웃) 판이 타석을 끝낼 때 넘겨받는다
  progress = withFoulRecords(progress, options.foulRecordIds)
  // 기록은 판 끝 정산(0xa8024)이 낸 결과다 — `pending.outcome` 은 타석을 끝낸 임시 값이다(`battedContact`)
  return finishPlayerOutcome(
    { ...progress, pendingDefensePlay: null, defenseScene: result.scene },
    recordedOutcomeOf(pending, result),
    random,
    result,
    null,
    { isRecorded: options.isRecorded },
  )
}

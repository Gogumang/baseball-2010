import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { type BattedContact, registerContact } from '@/entities/batting/model/battedContact'
import { withPredictedOutcome } from '@/features/defense-play/model/runDefensePlay'
import type { ControlSide } from '@/entities/defense-controls/model/defenseKeys'
import { applyPitchResolution } from '@/entities/at-bat/model/atBatState'
import { withoutStealDisplay } from '@/features/play-team-game/model/teamGameFlow/baseRunning/runners'
import { batterDefenseInputOf, defensiveDefenseInputOf } from '@/features/play-team-game/model/teamGameFlow/defense/defenseInputs'
import { withFoulRecords } from '@/features/play-team-game/model/teamGameFlow/records/atBatRecords'
import { enterPitchSelection } from '@/features/play-team-game/model/teamGameFlow/scene/enterPitchSelection'
import type { BatterOutcomeOptions } from '@/features/play-team-game/model/teamGameFlow/types/plays'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/** 파울 각 공 판의 임시 결과 칸 — 판이 파울로 닫히면 쓰지 않고, 잡히면 판 끝 정산(뜬공 아웃)이 갈아 끼운다 */
const FOUL_PLAY_OUTCOME: AtBatOutcome = { kind: '아웃', detail: '뜬공아웃' }

/**
 * **사람이 던진 타석의 파울 각 공 판** — 맞은 공이라 판을 돈다(타석은 아직 안 끝났다). 판이 파울로 닫히면(`foulEnded`)
 * `resolveDefensePlay` 가 스트라이크를 올리고 같은 타석 다음 공으로, 낙구 전에 잡히면 파울 뜬공 아웃으로 타석을 끝낸다.
 */
export function startDefensiveFoulPlay(progress: TeamGameProgress, contact: BattedContact, random: RandomPort, buntKind: number): TeamGameProgress {
  const stealing = progress
  // 파울 각 공 판도 타구 판(종류 1)이다 — 시작 리드 0x3d7b8 이 출발 표시를 지운다
  const cleared = withoutStealDisplay(progress)
  const outcome = registerContact(FOUL_PLAY_OUTCOME, contact)
  const input = withPredictedOutcome({
    ...defensiveDefenseInputOf(stealing, outcome, contact.pattern, random, false),
    // 판 끝 결과 코드 11(2스트라이크 번트 파울) · 판 뒤 스트라이크(0xb6b58)가 이 공 앞의 스트라이크를 본다
    strikes: progress.atBat.strikes,
    // 장면 +0xfdc — CPU 타자의 번트 종류. 11 은 번트(state[0x13])일 때만 난다
    buntKind,
  })
  return { ...cleared, pendingDefensePlay: { side: '수비', input, outcome: input.outcome } }
}

/** **우리 타석의 파울 각 공 판** — `startDefensiveFoulPlay` 의 공격 쪽. 상대 수비(CPU)가 공을 쫓고 사람은 주루를 잡는다 */
export function startBatterFoulPlay(
  progress: TeamGameProgress,
  contact: BattedContact,
  random: RandomPort,
  options: BatterOutcomeOptions,
): TeamGameProgress {
  const stealing = progress
  // 파울 각 공 판도 타구 판(종류 1)이다 — 시작 리드 0x3d7b8 이 출발 표시를 지운다
  const cleared = withoutStealDisplay(progress)
  const outcome = registerContact(FOUL_PLAY_OUTCOME, contact)
  const input = withPredictedOutcome({
    ...batterDefenseInputOf(stealing, outcome, contact.pattern, random, options),
    strikes: progress.atBat.strikes,
  })
  return { ...cleared, pendingDefensePlay: { side: '공격', input, outcome: input.outcome } }
}

/**
 * **파울로 닫힌 판의 뒤** — 판 끝 판정 B 0xae3e8 ae568 이 정산 0xa8024 를 건너뛰고 0xf(같은 타석 다음 공)로, 0x35108 이
 * 0xa975c(주자를 판 앞 자리로) · 0xb6b58(스트라이크 ≤ 1 이면 +1)을 부른다. 웹 타석 칸의 '파울' 과 같은 규칙이다.
 * 우리 타석이면 판의 결과 코드 7 메시지(51c5c)의 연속 파울 기록(0xa7dbc)도 이때 센다.
 */
export function afterFoulPlay(progress: TeamGameProgress, side: ControlSide, random: RandomPort): TeamGameProgress {
  const recorded = side === '공격' ? withFoulRecords(progress, true) : progress
  return enterPitchSelection({ ...recorded, atBat: applyPitchResolution(recorded.atBat, { kind: '파울' }) }, random)
}

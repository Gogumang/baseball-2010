import { type PitchOutcomeDetail, contactOutcomeOfDetail } from '@/features/play-at-bat/model/resolvePitch'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { type DefensePlayInput, runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import { contactOfOutcome } from '@/entities/batting/model/battedContact'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { sceneResultCodeAfterPitch } from '@/features/defense-play/model/sceneResultCode'
import { applyPitchResolution } from '@/entities/at-bat/model/atBatState'
import { arriveTeamPitch } from '@/features/play-team-game/model/teamGameFlow/baseRunning/arriveTeamPitch'
import { applyBatterOutcome, startBatterOutcome } from '@/features/play-team-game/model/teamGameFlow/batting/batterOutcome'
import { batterDefenseInputOf } from '@/features/play-team-game/model/teamGameFlow/defense/defenseInputs'
import { startBatterFoulPlay } from '@/features/play-team-game/model/teamGameFlow/defense/defensiveAtBat'
import { resolveDefensePlay } from '@/features/play-team-game/model/teamGameFlow/defense/resolveDefensePlay'
import { advance } from '@/features/play-team-game/model/teamGameFlow/inningChange/advance'
import { withFoulRecords } from '@/features/play-team-game/model/teamGameFlow/records/atBatRecords'
import { enterPitchSelection } from '@/features/play-team-game/model/teamGameFlow/scene/enterPitchSelection'
import { throwOpponentPitch } from '@/features/play-team-game/model/teamGameFlow/stamina/opponentPitch'
import { isBatterTurn } from '@/features/play-team-game/model/teamGameFlow/turn/turns'
import type { BatterOutcomeOptions } from '@/features/play-team-game/model/teamGameFlow/types/plays'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/* ── 사람이 치는 타석 ─────────────────────────────────────────────────────────── */

/**
 * 사람 타석의 **공 하나**를 반영한다. 타석이 끝나면 그 자리에서 주자·점수까지 처리한다.
 * 화면은 `BattingStage` 가 준 `PitchOutcomeDetail` 을 그대로 넘기면 된다.
 *
 * ⚠️ 수비 화면을 띄우는 화면은 `startBatterPitch` 를 쓴다 — 이쪽은 타구까지 미리 다 돌려 버린다.
 */
export function applyBatterPitch(
  progress: TeamGameProgress,
  detail: PitchOutcomeDetail,
  random: RandomPort,
  options: BatterOutcomeOptions = {},
): TeamGameProgress {
  return batterPitch(progress, detail, random, options, applyBatterOutcome)
}

/**
 * 같은 공 하나지만, 타석이 인플레이 타구로 끝나면 **주자 처리를 수비 화면 뒤로 미룬다**
 * (`pendingDefensePlay` 에 얹고 멈춘다). 화면이 다 돌면 `resolveDefensePlay` 를 부르면 된다.
 */
export function startBatterPitch(
  progress: TeamGameProgress,
  detail: PitchOutcomeDetail,
  random: RandomPort,
  options: BatterOutcomeOptions = {},
): TeamGameProgress {
  return batterPitch(progress, detail, random, options, startBatterOutcome)
}

/**
 * **사람 타석의 맞은 판정 틀 판 입력** — 타석 화면이 맞은 틀에 메시지 0x11 굴림 묶음을 미리 굴릴 때(`preRollContactMessage`, A-37) 쓴다.
 * 0x13 뒤 `startBatterPitch` 가 세울 판(우리 타석 · 파울 각 공)과 같은 수비 · 쏜 공 · 난수다(투구 소모를 먹인 뒤의 경기 칸 —
 * `batterPitch` 머리와 같다). 굴림 없이 만든다. 쏜 공이 없거나 우리 타석이 아니면 null.
 */
export function batterContactDefenseInputOf(
  progress: TeamGameProgress,
  detail: PitchOutcomeDetail,
  random: RandomPort,
  options: BatterOutcomeOptions = {},
): DefensePlayInput | null {
  if (!isBatterTurn(progress)) return null
  const outcome = contactOutcomeOfDetail(detail)
  const contact = outcome === null ? undefined : contactOfOutcome(outcome)
  if (outcome === null || contact === undefined) return null
  const thrown = throwOpponentPitch(progress, detail.pitchTypeNumber)
  return batterDefenseInputOf(thrown, outcome, contact.pattern, random, options)
}

function batterPitch(
  progress: TeamGameProgress,
  detail: PitchOutcomeDetail,
  random: RandomPort,
  options: BatterOutcomeOptions,
  applyOutcome: (progress: TeamGameProgress, outcome: AtBatOutcome, random: RandomPort, options: BatterOutcomeOptions) => TeamGameProgress,
): TeamGameProgress {
  if (!isBatterTurn(progress)) return progress
  progress = throwOpponentPitch(progress, detail.pitchTypeNumber)
  // 장면 +0xfdc — 사람 타석은 번트 · 스윙 키(0x51dce · 0x51e2c · 0x51e84)가 쓴다. 타석 화면이 이 칸을 받아 키 없는 공은 앞 값 그대로 낸다
  // 경기 +0xfd4 — 0x11 진입이 지우고 휘두른 공이면 스윙 판정이 덮는다(`sceneResultCodeAfterPitch`)
  progress = {
    ...progress,
    sceneBuntKind: options.buntKind ?? 0,
    sceneResultCode: sceneResultCodeAfterPitch(detail.resolution, detail.resultCode),
  }
  // 파울 각 공 — 원본도 판(상태 0x17)을 돈다. 연속 파울 기록(0xa7dbc)은 판의 결과 코드 7 메시지(51c5c)에서라 판이 파울로 닫힐 때 센다.
  // 필살 스윙의 성공 굴림(0x517e6)은 타석 판정이 쏜 공(`detail.foulContact`)에 재료만 실어 판 시작(필살수비 · 폴 굴림 뒤)이 굴린다
  if (detail.resolution.kind === '파울' && detail.pattern !== undefined && detail.resultCode !== null) {
    const contact = detail.foulContact ?? { pattern: detail.pattern, resultCode: detail.resultCode, batterHand: detail.batterHand }
    const started = startBatterFoulPlay(progress, contact, random, options)
    if (applyOutcome === startBatterOutcome) return started
    const pending = started.pendingDefensePlay
    if (pending === null) return started
    const result = runDefensePlay(pending.input)
    return resolveDefensePlay({ ...started, lastDefensePlay: result }, result, random)
  }
  progress = withFoulRecords(progress, detail.resolution.kind === '파울')
  const atBat = applyPitchResolution(progress.atBat, detail.resolution)
  const outcome = atBat.outcome
  // 공 도착 0x3dfac — 못 맞힌 공이면 0.1% 폭투·포일(종류 9)이나 출발한 도루(종류 5) 판을 연다.
  // 화면이 도는 갈래(`startBatterPitch`)면 판을 붙들어 사람 주루 키(0x5331c · 0x585)를 받으며 실시간으로 돌린다
  const arrival = arriveTeamPitch(
    { ...progress, atBat },
    // 사람 타자의 이 공 번트 종류 — 못 맞힌 번트면 그 종류 (useTeamGame 이 타석 화면에서 받아 넘긴다)
    { resolution: detail.resolution, outcomeAfter: outcome, buntKind: options.buntKind ?? 0, batterHand: detail.batterHand },
    '공격',
    random,
    undefined,
    applyOutcome === startBatterOutcome ? { outcome, options } : undefined,
  )
  if (arrival.deferred === true) return arrival.progress
  // 판에서 반 이닝·경기가 끝났다 — 이 타석은 끊긴다 (판정 B 0xae3e8: 아웃 > 2 → 0x18)
  if (arrival.interrupted) return advance(arrival.progress, random)
  // 판정 A(0xae24c)의 "그 밖 → 0xf" — 같은 타석 다음 공. 0xf 진입 0x3d954 가 CPU 투수 교체를 다시 묻는다
  if (outcome === null) return enterPitchSelection(arrival.progress, random)
  return applyOutcome(arrival.progress, outcome, random, { ...options, arrivalPlay: arrival.play })
}

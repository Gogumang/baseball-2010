import { type DefensePlayResult, recordedOutcomeOf, runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { finishBatterOutcome } from '@/features/play-team-game/model/teamGameFlow/batting/finishBatterOutcome'
import { afterFoulPlay } from '@/features/play-team-game/model/teamGameFlow/defense/foulPlay'
import { finishDefensiveAtBat } from '@/features/play-team-game/model/teamGameFlow/defense/finishDefensiveAtBat'
import { advance } from '@/features/play-team-game/model/teamGameFlow/inningChange/advance'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/* ── 수비 화면이 끝났을 때 (원본 상태 0x17 → 0x18/0xe) ───────────────────────── */

/**
 * 화면이 다 돌린 수비 플레이를 **그때** 경기 상태에 먹인다.
 *
 * `result.advance`(진루·아웃·득점)와 `result.voidedRuns`(3아웃으로 날아간 보류 득점)가 여기서
 * 비로소 경기 상태가 된다. 붙들어 둔 칸을 비우므로 다음 타석이 그제서야 시작된다.
 *
 * 공격이었으면 우리 타석 길로, 수비였으면 상대 타석 길로 간다 — 붙들 때 적어 둔 `side` 가 가른다.
 * 이미 눈으로 다 본 플레이라 재생거리(`lastDefensePlay`)로는 남기지 않는다.
 */
export function resolveDefensePlay(progress: TeamGameProgress, result: DefensePlayResult, random: RandomPort): TeamGameProgress {
  const pending = progress.pendingDefensePlay
  if (pending === null) return progress
  // 판이 남긴 수비 장면 연출 칸은 다음 판으로 (`defenseScene`)
  const cleared = { ...progress, pendingDefensePlay: null, defenseScene: result.scene }
  // 파울로 닫힌 판 — 같은 타석이 이어진다(정산 없음)
  if (result.foulEnded === true) return afterFoulPlay(cleared, pending.side, random)
  if (pending.side === '공격') {
    // 우리 타석 쪽은 몸통 끝에서 이미 다음 사람 차례까지 민다
    // 기록은 판 끝 정산(0xa8024)이 낸 결과다 — `pending.outcome` 은 타석을 끝낸 임시 값이다(`battedContact`)
    return finishBatterOutcome(cleared, recordedOutcomeOf(pending.input, result), random, result, null)
  }
  return advance(finishDefensiveAtBat(cleared, recordedOutcomeOf(pending.input, result), true, result, null), random)
}

/**
 * **붙든 판을 그 자리에서 끝까지 돌려 먹인다** — 끼어들 사람이 없는 갈래(`throwPitch` · `applyBatterPitch` · 시험)의 파울 각 공 판.
 * `runDefensePlay` 는 스테퍼를 끝까지 도는 얇은 껍데기라 난수 차례가 화면 갈래와 같다. 아직 아무것도 안 보여 줬으므로
 * 돌린 결과를 재생 칸(`lastDefensePlay`)에 둔다. 붙든 판이 없으면 그대로 돌려준다.
 */
export function runPendingDefensePlayNow(started: TeamGameProgress, random: RandomPort): TeamGameProgress {
  const pending = started.pendingDefensePlay
  if (pending === null) return started
  const result = runDefensePlay(pending.input)
  return resolveDefensePlay({ ...started, lastDefensePlay: result }, result, random)
}

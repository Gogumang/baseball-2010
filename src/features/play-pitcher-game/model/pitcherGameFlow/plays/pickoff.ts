import { PICKOFF_RESULT, type PickoffPlayInput, type PickoffPlayResult, runPickoffPlay } from '@/features/defense-play/model/pickoffPlay'
import { settlementEventsOfPlay, withSettlementEvents } from '@/features/defense-play/model/settlementEvents'
import { PICKOFF_PLAY_KIND, pickoffPlayForKey } from '@/entities/defense-controls/model/pickoff'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { recordBatterFaced } from '@/entities/pitcher-career/model/pitcherGameRecord'
import { enterPitchSelection } from '@/features/play-pitcher-game/model/pitcherGameFlow/atBat/pitchSelection'
import { advance } from '@/features/play-pitcher-game/model/pitcherGameFlow/auto/advance'
import { runAbilitiesOnBaseOf, runnerRunsOnBaseOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/fielding/fielderInputs'
import { myDefenseFieldsOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/fielding/myDefenseFields'
import { isPitchTurn } from '@/features/play-pitcher-game/model/pitcherGameFlow/pitch/pitchTurn'
import { opponentBatterAbility, opponentRosterSlotOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/roster/opponentBatters'
import { withMyRunnerPlay } from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/myRunnerPlay'
import { withMyRunnerPlaySettlement } from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/runnerPlaySettlement'
import { appendLog } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/gameLog'
import { isHalfInningOrGameEnded } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/halfInning'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'
import { countsMyPitcherRecord } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/recordGates'

/**
 * **견제** — 구질 고르기(상태 0xf)에서 '3'/'1'/'7' (0x53548 → 메시지 0x10 → 0x50f28 → 상태 0x17 종류 4).
 *
 * 그 루에 주자가 없거나 견제 키가 아니면 **아무 일도 없다**(원본도 키를 먹고 끝난다 — 같은 객체를 돌려준다).
 * 견제는 투구가 아니다: 투구 수·스태미나·볼카운트·마구 횟수를 건드리지 않고(0x10~0x12 를 안 지난다),
 * 정산 0xa8024 가 불려도 `state[0x26] = 4` 라 **타자 상대 수(R+0x138)·타석 수(+0x14)가 안 오른다**
 * (`recordBatterFaced` · `pinchHitAi.recordPlateAppearance`).
 *
 * 견제 판(종류 4)도 vt4c 가 돌아 사람 송구 키(+0x160)로 받은 야수가 던진다 — 화면이 도는 갈래(`live`)는 판을 붙들어 화면이
 * 한 틱씩 돌리고 `resolveRunnerPlay` 가 잇는다(`liveRunnerPlay`). 안 주면 키 없이 미리 돌려 `lastDefensePlay` 로 재생한다.
 * 난수는 그 안의 **주자 리드 굴림 · 악송구 굴림(0xa1828) 1번 · 악송구면 +2번**뿐이다.
 *
 * - 사람 경기의 CPU 도루(0x520de)는 공이 나는 동안(상태 0x11)에만 걸리고 견제는 상태 0xf 에서만 들어와 겹치지
 *   않는다(Q1 3b). 견제사·진루는 판 시작 리드(0x3d7b8, 3370bf0)로 루를 떠난 주자에게서 난다.
 * - 진루·아웃·실점은 `withMyRunnerPlay`(도루·폭투 판과 같은 먹이기)로 먹인다. 0xa8024(종류 4)의 거르지 않는 칸
 *   (36 · 시즌 아웃 +0x20 · R[3] · state[0x8a] · 26/27)은 `withMyRunnerPlaySettlement` — 같은 투구 틈 앞 판의 사건까지 센다.
 *   돌발 판정 0x8f414 는 결과비트 0 이라 판정이 없다.
 */
export function pickoff(
  progress: PitcherGameProgress,
  webKey: string,
  random: RandomPort,
  /** 화면이 판을 실시간으로 돌린다 — 판을 붙들고(`pendingRunnerPlay`) 끝나면 `resolveRunnerPlay` (사람 송구 키 +0x160) */
  live = false,
): PitcherGameProgress {
  // 공이 날거나 0x12 인 동안(붙든 공)은 0xf 키가 없다
  if (!isPitchTurn(progress) || !progress.atBatPrepared || progress.pendingPitchArrival != null) return progress
  const bases = progress.game.bases
  const play = pickoffPlayForKey(webKey, (base) => bases[BASE_KEY[base]])
  if (play === null) return progress
  const input = pickoffPlayInputOf(progress, play.targetBase, random)
  if (live) return { ...progress, pendingRunnerPlay: { kind: 'pickoff', input } }
  return applyPickoffResult(progress, play.targetBase, runPickoffPlay(input), random, false)
}

/** 견제 루 → 루 칸 */
const BASE_KEY = { 1: 'first', 2: 'second', 3: 'third' } as const

function pickoffPlayInputOf(progress: PitcherGameProgress, targetBase: PickoffPlayInput['targetBase'], random: RandomPort): PickoffPlayInput {
  return {
    targetBase,
    bases: progress.game.bases,
    outs: progress.game.outs,
    // 사람이 수비한다 — 0xae6c8 은 환경설정 "송구"(+0xf4) 혼자가 받은 야수의 0xafa60 을 켠다 (타구 진행기와 같은 배선)
    ...myDefenseFieldsOf(progress),
    runAbility: opponentBatterAbility(progress.options, opponentRosterSlotOf(progress)).run,
    // 루별 주자 주루 — 루에 선 주자는 제 타석 0xa93ac 가 적은 주자+0xa4 를 든다 (타자는 견제 판에 안 뛴다)
    runAbilities: runnerRunsOnBaseOf(runAbilitiesOnBaseOf(progress)),
    random,
    // 경기 +0xfd4 — 견제는 0x11 을 안 지나 앞 공의 값이 남는다
    sceneResultCode: progress.sceneResultCode,
  }
}

/** 다 돈 견제 판을 경기에 먹인다 — `pickoff` 의 뒷부분. 실시간으로 보여 준 판은 재생 칸에 다시 안 넣는다 */
export function applyPickoffResult(
  progress: PitcherGameProgress,
  targetBase: number,
  result: PickoffPlayResult,
  random: RandomPort,
  shownLive: boolean,
): PitcherGameProgress {
  // 0xa8d98 — 종류 4 는 R+0x138 을 안 올린다 (그대로 돌려받는다)
  const faced: PitcherGameProgress = {
    ...progress,
    pitcherRecord: countsMyPitcherRecord(progress) ? recordBatterFaced(progress.pitcherRecord, PICKOFF_PLAY_KIND) : progress.pitcherRecord,
  }
  // 견제도 정산 0xa8024 를 지난다(I 4a-3, ae576 → ae5a8) — 들어온 주자는 주자 운명으로 센다
  const applied = withMyRunnerPlay(faced, result, true, shownLive)
  const settled = withPickoffSettlement(applied.progress, progress, result)
  const runs = result.advance.runsScored > 0 ? ` (${result.advance.runsScored}실점)` : ''
  const next = appendLog(settled, `${progress.game.inning}회${progress.game.half} ${targetBase}루 견제 — ${pickoffCallOf(result)}${runs}`, true)
  // 반 이닝이 끝났으면(위에서 atBatPrepared 를 내렸다) 다음 사람 타석은 `advance` 가 새로 준비한다 —
  // 0xf 진입도 그 안에서 한 번 돈다
  if (!next.atBatPrepared) return advance(next, random)
  // 같은 타석이 이어지면 견제 판 끝(판정 B 0xae3e8 의 ae592)도 0xf 로 간다 — 0xf 진입 0x3d954 를 지난다
  return enterPitchSelection(applied.changed ? advance(next, random) : next, random)
}

/** 종류 4 정산의 거르지 않는 칸 — 사건 목록은 0x11 을 안 지나 같은 투구 틈 앞 판의 몫이 함께 든다 */
function withPickoffSettlement(moved: PitcherGameProgress, progress: PitcherGameProgress, result: PickoffPlayResult): PitcherGameProgress {
  const events = withSettlementEvents(progress.pendingSettlementEvents, settlementEventsOfPlay(result))
  const next = withMyRunnerPlaySettlement(moved, result, events)
  return { ...next, pendingSettlementEvents: isHalfInningOrGameEnded(progress.game, next.game) ? undefined : events }
}

function pickoffCallOf(result: PickoffPlayResult): string {
  if (result.resultCode === PICKOFF_RESULT.OUT) return '견제사'
  return result.errantThrow ? '악송구' : '세이프'
}

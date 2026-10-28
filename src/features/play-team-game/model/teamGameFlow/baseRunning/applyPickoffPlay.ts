import { type PickoffPlayResult, PICKOFF_RESULT } from '@/features/defense-play/model/pickoffPlay'
import type { ControlSide } from '@/entities/defense-controls/model/defenseKeys'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { settlementEventsOfPlay, withSettlementEvents } from '@/features/defense-play/model/settlementEvents'
import { withRunnerOnlyAdvance } from '@/features/play-team-game/model/teamGameFlow/baseRunning/runnerOnlyAdvance'
import { withRunnerPlaySettlement } from '@/features/play-team-game/model/teamGameFlow/baseRunning/runnerPlaySettlement'
import { advance } from '@/features/play-team-game/model/teamGameFlow/inningChange/advance'
import { appendLog } from '@/features/play-team-game/model/teamGameFlow/log/appendLog'
import { withPlateAppearance } from '@/features/play-team-game/model/teamGameFlow/records/plateAppearances'
import { enterPitchSelection } from '@/features/play-team-game/model/teamGameFlow/scene/enterPitchSelection'
import { isAtBatInterrupted } from '@/features/play-team-game/model/teamGameFlow/inningChange/halfInning'
import { battingSideOf, withEntryRecords } from '@/features/play-team-game/model/teamGameFlow/roster/battingSide'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * 견제 한 판을 경기 상태에 먹인다 — 원본 견제 판 끝 `0xae3e8` 의 길이다.
 *
 * - `0xae576~0xae592`: `state[0x26]` 이 4 면 (아웃 ≤ 2 이고 다른 갈래에 안 걸리면) 다음 상태 **0xf**(같은 타석,
 *   다음 공) — 볼카운트·타순 그대로 두고 `atBatPrepared` 도 그대로 둔다.
 * - `0xae5a8`: 그리고 정산 `0xa8024` 를 부른다 — **종류 4 라 타석 칸(+0x14)이 안 오른다**(`withPlateAppearance`
 *   에 결과 null). 타석에 서 있는 타자(사람 수비면 상대 타순 칸, 사람 공격이면 우리 타순 칸)의 칸이다.
 *
 * 3아웃 갈래(r276 직접 뜸): 0xae554 `state[6] > 2` → 0x18 · 0xae5a8 정산 0xa8024 · 모드 5·6 이면 0xaaa6c — 타순 커서 예약 0xaf020 을
 * 부르는 곳은 0x35108 · 0x3dfac · 간이 엔진 셋뿐이고(0xae3e8 · 0xa8024 엔 없다), 0x35108 은 종류 4 면 안 부른다(3513a~3515c) →
 * **3아웃으로 끊겨도 타순은 그대로**다(웹과 같다). 판은 웹이 미리 돌린다.
 * - 0xf 에 다시 들어서며 진입 `0x3d954` 가 CPU 대타(0xac228)·CPU 투수 교체(0xac428)를 다시 부른다 —
 *   `enterPitchSelection` (공마다 다시 들어서는 것과 같은 자리).
 * - 견제 판이 아웃·진루를 내면(판 시작 리드 0x3d7b8 로 루를 떠난 주자 — 3370bf0) 경기 상태(루·아웃·점수·반 이닝
 *   교대)와 승·패·세 칸(득점 처리 0xa5c34)에 먹인다(`withRunnerOnlyAdvance`). 타순은 안 민다.
 *
 * 정산 0xa8024(종류 4)의 거르지 않는 칸은 `withRunnerPlaySettlement` — 36 · state[0x88] · state[0x8a] · 투수 줄 +0x20 ·
 * 26/27 · 시즌 코드 5/0 · R[3] (직접 떴다). 사건 목록은 같은 투구 틈 앞 판의 몫까지 센다(`pendingSettlementEvents`).
 * 돌발 판정 0x8f414 는 0x17 끝(52a8e)에서 불리지만 결과비트 ctx+0x188 이 0 이라 아무것도 안 한다 — 비트를 켜는 0xa599c 는
 * 종류 4·5 면 안 켜고(a59a8), 칸을 지우는 곳은 타석 초기화 0xa5bcc(a5be0) 하나라 이어지는 타석 안에서는 늘 0 이다.
 */
export function applyPickoffPlay(
  progress: TeamGameProgress,
  result: PickoffPlayResult,
  humanSide: ControlSide,
  random: RandomPort,
  /** 화면이 실시간으로 이미 보여 준 판 — 재생 칸에 다시 안 넣는다 */
  shownLive = false,
): TeamGameProgress {
  const before = progress.game
  const humanDefends = humanSide === '수비'
  const applied = withRunnerOnlyAdvance(withPickoffShown(progress, result, humanDefends, shownLive), result.advance, humanSide, result.runnerFates)
  // 견제 판도 정산 0xa8024 를 지난다(ae5a8) — 종류 4 라 거르지 않는 칸만(`withRunnerPlaySettlement`). 사건 목록은 0x11 을
  // 안 지나 같은 투구 틈에 앞서 돈 판의 몫이 함께 든다
  const events = withSettlementEvents(progress.pendingSettlementEvents, settlementEventsOfPlay(result))
  const settled = withRunnerPlaySettlement(applied.progress, progress, result, !humanDefends, events)
  const pending = { ...settled, pendingSettlementEvents: isAtBatInterrupted(before, settled.game) ? undefined : events }
  const next = appendLog(pending, pickoffLogOf(before, result, humanDefends, applied.runs), true)
  return continueAfterPickoff(next, applied.changed, random)
}

/**
 * 판을 재생 칸에 넣고 타석에 선 타자(사람 수비면 상대 타순 칸, 사람 공격이면 우리 타순 칸)의 칸에 판 하나를 얹는다 —
 * 종류 4 라 타석 칸(+0x14)은 안 오른다(`withPlateAppearance` 에 결과 null)
 */
function withPickoffShown(progress: TeamGameProgress, result: PickoffPlayResult, humanDefends: boolean, shownLive: boolean): TeamGameProgress {
  const shown = { ...progress, defenseScene: result.scene, lastDefensePlay: shownLive ? progress.lastDefensePlay : result }
  const batting = battingSideOf(progress, !humanDefends)
  return withEntryRecords(shown, batting.ours, withPlateAppearance(batting.records, batting.order, null))
}

/** 견제 판 판정 글 */
function pickoffCallOf(result: PickoffPlayResult): string {
  if (result.resultCode === PICKOFF_RESULT.OUT) return '견제사'
  return result.errantThrow ? '악송구' : '세이프'
}

function pickoffLogOf(before: TeamGameProgress['game'], result: PickoffPlayResult, humanDefends: boolean, runs: number): string {
  const who = humanDefends ? '' : '상대 '
  const runsText = runs > 0 ? ` (${runs}${humanDefends ? '실점' : '점'})` : ''
  return `${before.inning}회${before.half} ${who}${result.targetBase}루 견제 — ${pickoffCallOf(result)}${runsText}`
}

/**
 * 아웃 ≤ 2 면 같은 타석 다음 공 0xf (ae592) — 0xf 진입 0x3d954 가 교체를 다시 묻는다.
 * 반 이닝이 넘어갔으면 advance 가 새 타석(prepareAtBat)을 세운다
 */
function continueAfterPickoff(next: TeamGameProgress, changed: boolean, random: RandomPort): TeamGameProgress {
  if (!changed) return enterPitchSelection(next, random)
  const advanced = advance(next, random)
  return advanced === next ? enterPitchSelection(next, random) : advanced
}

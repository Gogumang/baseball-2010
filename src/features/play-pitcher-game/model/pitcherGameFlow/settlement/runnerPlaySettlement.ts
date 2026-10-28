import { laserThrowOutRecordOf, multiOutPlayRecordIdsOf } from '@/entities/game/model/gameRecords'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { PendingSettlementEvents } from '@/features/defense-play/model/settlementEvents'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'
import { recordsAllowed } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/recordGates'

/**
 * **주자만 움직인 판**(견제 종류 4 · 도루 종류 5 · 폭투·포일 종류 9)을 경기 상태에 먹인다 — 내가 던지는 타석이라
 * 수비는 나다. 타순 커서는 그대로(`applyOpponentRunnerPlay`), 재생 칸(`lastDefensePlay`)에 판을 넣는다.
 *
 * - 득점마다 0xa5c34 가 승·패·세이브 칸을 고친다(`applyRunScoredFor`) · 이닝 실점 · 팀 실점.
 * - `settles` — 판 끝 판정 B 0xae3e8 이 정산 0xa8024 를 부르는가. 부르면 들어온 주자를 주자 운명으로 내 투수
 *   R+0x128 · +0x22 에 센다(`chargedRunsOfFates`). 견제(4)·도루(5)는 0xd·0xf 어느 쪽이든 0xae5a8 에서 부르고,
 *   폭투·포일(9)은 `state[0xc] == 5`(삼진) 일 때만 0xd 로 가며 부른다 — 아니면 ae5a2 → ae5b6 으로 **건너뛴다**.
 * - 반 이닝이 넘어갔으면 이닝 칸·삼자범퇴 표시·반 이닝 투구 수·볼카운트·타석 준비를 내린다 — 다음 타석은 `advance` 가 세운다.
 *
 * - 판에서 잡은 아웃은 아웃 콜 0xa7d0c 가 하나마다 센다(정산과 무관) — R+0x13c · 셋째 아웃이면 25 삼구 삼자범퇴 · R+0x154.
 *   정산 0xa8024 의 종류 4·5 갈래는 타석 칸(R+0x138 · R+0x134 · 타석 +0x14 …)을 건너뛰어 여기서 더 셀 것이 없다
 *   (삼진 + 도루 판의 삼진 타석은 `applyDefensivePlay` 의 `stealPlaySettlement`).
 * 주자 판 끝의 돌발 판정(0x8f414 — 0x17 끝 52a8e)은 판정이 없다: 결과비트 ctx+0x188 은 타석 초기화 0xa5bcc(a5be0)만 지우고
 * 0xa599c 는 종류 4·5 면 안 켜 이어지는 타석 안에서 늘 0 이다(8f41e 에서 돌아간다). 정산하는 폭투·포일 판(삼진 · 3아웃)은
 * 타석 · 반 이닝을 끝내는 판이라 타석 결과 쪽이 판정한다.
 * `settles` 가 거짓인 판은 state[0x8a](`teamRunsAllowed`) · R[3]/+0x20(`settledOutsExtra`)도 안 센다.
 */
/**
 * **타석 결과 없는 주자 판(견제 종류 4 · 삼진 없는 도루 종류 5)의 정산 0xa8024 — 거르지 않는 칸** (직접 떴다).
 * 진루 · 실점 R+0x128 · 아웃 콜 칸은 `withMyRunnerPlay` 가 먼저 먹였다.
 * ```
 * a80f8  [sp+0x30] > 0 && state[0x8b](필살송구 표시 — 0xf 진입 0xb67d0 이 지워 이 판 것) → k 36
 * a8cb0  투수 레코드 +0x20 += [sp+0x30]  · a8f8c  R[3] += [sp+0x30]          ; `settledOutsExtra` 로 앞 몫을 더한다
 * a8dd0  state[0x8a] += [sp+0x28]
 * a8e58  [sp+0x30] == 2 → k 26 / == 3 → k 27                                    ; state[0x1a] 는 0xf 진입이 지워 거짓
 * ```
 * `events` 는 사건 목록을 훑은 값 — 견제 판은 같은 투구 틈 앞 판(도루 · 폭투 · 앞 견제)의 몫까지 든다(원본 그대로 다시 센다).
 * 투수편은 사람이 늘 수비라 36 · 26 · 27 이 게이트 0xa77f0 을 지난다. 시즌 코드(0xa755c)는 모드 2 전용이라 없다.
 * 돌발 판정 0x8f414 는 결과비트가 0(0xa599c 는 종류 4·5 면 안 켠다 · 지우는 곳 0xa5bcc 하나)이라 판정이 없다.
 */
export function withMyRunnerPlaySettlement(
  next: PitcherGameProgress,
  result: DefensePlayResult,
  events: PendingSettlementEvents,
): PitcherGameProgress {
  const earlierOuts = events.outs - result.advance.outsAdded
  const earlierRuns = events.runs - result.advance.runsScored
  const recordIds = [
    ...laserThrowOutRecordOf({ laserThrowFlag: result.laserOutFlag, outsInPlay: events.outs }).recordIds,
    ...multiOutPlayRecordIdsOf({ outsInPlay: events.outs, strikeoutWhileRunning: false }),
  ]
  return {
    ...next,
    ...(earlierOuts === 0 ? {} : { settledOutsExtra: (next.settledOutsExtra ?? 0) + earlierOuts }),
    ...(earlierRuns === 0 ? {} : { teamRunsAllowed: next.teamRunsAllowed + earlierRuns }),
    ...(recordIds.length > 0 && recordsAllowed(next) ? { recordIds: [...next.recordIds, ...recordIds] } : {}),
  }
}

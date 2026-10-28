import { type BatterGameRecord, recordPlateAppearance, EMPTY_BATTER_GAME_RECORD } from '@/entities/batting/model/pinchHitAi'
import { type AtBatOutcome, isHit } from '@/entities/at-bat/model/atBatOutcome'
import { quickAtBatResultCodeOf, atBatResultCodeOf } from '@/entities/batting/model/atBatResultRing'
import { PICKOFF_PLAY_KIND } from '@/entities/defense-controls/model/pickoff'
import type { LeaguePlateAppearance } from '@/entities/league/model/leaguePlayerStats'
import { type TeamEntryBatter, NO_ROSTER_SLOT } from '@/features/play-team-game/model/teamGameRoster'
import { leagueRecordKeyOf } from '@/features/play-team-game/model/teamGameFlow/records/leagueRecordKey'
import { isAcePlayer } from '@/features/play-team-game/model/teamGameFlow/roster/battingSide'

/** 우리 타순 칸 하나의 루타 목록에 이번 루타를 얹는다 (`0xa86e0`) */
export function withHitBases(lists: readonly (readonly number[])[], slot: number, hitBases: readonly number[]): readonly (readonly number[])[] {
  const next = [...lists]
  next[slot] = hitBases
  return next
}

/**
 * 타순 칸 기록에 플레이 하나를 얹는다 (`0xa8024`).
 *
 * `outcome` 이 null 이면 **타석 결과 없이 끝난 판**(견제 = 플레이 종류 4)이다 — 원본도 견제 판 끝
 * `0xae3e8` 이 `0xa8024` 를 부르지만(`0xae57e~0xae5b2`) `state[0x26] = 4` 라 타석 칸(+0x14)이 안 오르고,
 * 안타·홈런 칸은 안타 가지(`0xa86e0`) 안이라 애초에 안 선다. 게이트는 `recordPlateAppearance` 의 `playKind` 다.
 */
export function withPlateAppearance(
  records: readonly BatterGameRecord[],
  slot: number,
  outcome: AtBatOutcome | null,
  /** 간이 엔진 타석인가 — 링의 아웃 코드가 늘 5 다 (`quickAtBatResultCodeOf`) */
  quickEngine = false,
  /** 정산 [sp+0x24] > 0 — a8728 의 홈런 +0x13 (`homeRunCountedOf`). 안 넘기면 홈런이면 참 */
  homeRunCounted = outcome !== null && outcome.kind === '홈런',
): readonly BatterGameRecord[] {
  const next = [...records]
  const resultCodeOf = quickEngine ? quickAtBatResultCodeOf : atBatResultCodeOf
  next[slot] = recordPlateAppearance(next[slot] ?? EMPTY_BATTER_GAME_RECORD, {
    isHit: outcome !== null && isHit(outcome),
    isHomeRun: homeRunCounted,
    // 같은 정산이 오늘 타석 결과 링에도 넣는다 (0xa908c) — 견제 판은 게이트에 막힌다
    ...(outcome === null ? { playKind: PICKOFF_PLAY_KIND } : { resultCode: resultCodeOf(outcome) }),
  })
  return next
}

/**
 * 리그 선수 기록표에 타석 하나를 쌓는다 — **지금 그 타순 칸에 선 선수의 로스터 칸**으로.
 *
 * 원본 기록 함수 `0xa8024` 는 명단 칸(`team+0xe`)이 가리키는 선수 레코드에 쌓는다. 명단 칸은 대타
 * 확정 `0xaebe4` 가 맞바꾸고 지우므로(`aed02~aed16`) 대타가 들어온 뒤에는 타순 칸 번호와 로스터 칸이
 * 갈린다 — 타순 칸 번호로 쌓으면 기록이 빠진 선수나 엉뚱한 선수에게 붙는다 (`entities/game` 의
 * `quickLineup` 이 간이 엔진 경기에서 같은 자리를 고친 785796d 와 같은 이치다).
 *
 * 마타자(`NO_ROSTER_SLOT`)는 리그 로스터 선수가 아니라 표에 칸이 없다 — 원본도 저장에서 꺼낸 마타자
 * 레코드(`0x1f84c`)에 쌓으므로 리그 로스터 선수 기록은 오르지 않는다. 그래서 빼고 넘긴다.
 * (마타자는 일반·대전모드에만 들어오고 리그 기록표를 쓰는 시즌모드에는 없다.)
 */
export function withLeaguePlateAppearance(
  appearances: readonly LeaguePlateAppearance[],
  teamId: number,
  entry: readonly TeamEntryBatter[],
  slot: number,
  outcome: AtBatOutcome,
  runsBattedIn: number,
): readonly LeaguePlateAppearance[] {
  const player = entry[slot]
  // 마타자는 표 밖 선수라도 넘기지 않는다 — 기록을 실어 선 표 밖 선수(영입한 명전·나리)만 제 레코드(원본 id)로 쌓인다
  if (isAcePlayer(player) && player?.rosterSlot === NO_ROSTER_SLOT) return appearances
  const key = leagueRecordKeyOf(player, teamId, slot)
  if (key === null) return appearances
  return [...appearances, { ...key, outcome, runsBattedIn }]
}

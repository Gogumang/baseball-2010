import { isBugFixed } from '@/shared/config/bugfixes'
import { LEAGUE_TEAM_COUNT } from '@/entities/league/model/league/schedule'
import type { League } from '@/entities/league/model/league/standings'

/**
 * 순위(1위부터 팀 번호) — 원본 0xb79d8 의 **선택 정렬을 그대로 옮긴 것**이다.
 * 순서 배열 초기값은 표 0xd8a25 = `[0,1,…,9]`, 승·패 사본을 함께 swap 하며 훑는다.
 *
 * ⚠️ **원본 버그를 그대로 둔다** (E 2절·3e 확정 · DECISIONS 2026-09-20):
 * 상대전적 표 `headToHead` 는 **팀 번호**로 된 표인데, 비교에 쓰는 `best`·`j` 는 정렬 중인
 * **배열 위치**다. 표를 함께 섞지도 않는다 → swap 이 한 번이라도 일어나면 엉뚱한 팀끼리의
 * 전적을 비교한다. 상대전적까지 같으면 `best` 를 바꾸지 않으므로 마지막 기준은
 * "현재 배열 위치가 앞선 팀" 이고, 초기값 덕에 대체로 팀 번호 순으로 보이지만 엄밀히는 아니다.
 *
 * **고침(`bugfixes.json` B-36, 기본 켬)**: 상대전적은 그 자리의 **팀 번호**(`order[j]`·`order[best]`)로 읽는다 — 정렬 차례 ·
 * 마지막 기준(배열 위치)은 그대로. 굴림 없음 · 저장 꼴 같음. 승패가 같은 팀의 순위(곧 포스트시즌 진출 · 대진)가 바뀔 수 있다.
 */
/** 상대전적 비교 — 원본은 배열 위치 j·best 로 표를 읽는다(B-36), 고친 길은 그 위치의 팀 번호로 읽는다. 굴림 없음 */
function headToHeadBeats(league: League, order: readonly number[], j: number, best: number): boolean {
  const [a, b] = isBugFixed('B-36') ? [order[j], order[best]] : [j, best]
  return league.headToHead[a][b] > league.headToHead[b][a]
}

/**
 * j 자리 팀이 지금 best 자리 팀보다 앞서는가 — 승 많은 순 → 패 적은 순 → 상대 전적.
 * 색인 버그(B-36): j·best 는 배열 위치인데 headToHead 는 팀 번호 표다 (원본 그대로). 고침: 그 자리에 앉은 팀 번호(order)로 표를 읽는다
 */
function ranksAbove(league: League, standing: SortingStanding, j: number, best: number): boolean {
  const { order, wins, losses } = standing
  if (wins[best] < wins[j]) return true
  if (wins[best] !== wins[j]) return false
  if (losses[best] > losses[j]) return true
  return losses[best] === losses[j] && headToHeadBeats(league, order, j, best)
}

/** 정렬 중인 사본 — 순서 · 승 · 패를 함께 맞바꾼다(상대전적 표는 안 섞는다) */
interface SortingStanding {
  readonly order: number[]
  readonly wins: number[]
  readonly losses: number[]
}

/** i 자리부터 훑어 가장 앞서는 자리 — 같으면 앞 자리를 둔다 */
function bestIndexFrom(league: League, standing: SortingStanding, i: number): number {
  let best = i
  for (let j = i + 1; j < LEAGUE_TEAM_COUNT; j += 1) if (ranksAbove(league, standing, j, best)) best = j
  return best
}

export function rankingOf(league: League): number[] {
  const order = Array.from({ length: LEAGUE_TEAM_COUNT }, (_unused, team) => team)
  const wins = [...league.wins]
  const losses = [...league.losses]
  const standing: SortingStanding = { order, wins, losses }

  for (let i = 0; i < LEAGUE_TEAM_COUNT - 1; i += 1) {
    const best = bestIndexFrom(league, standing, i)
    ;[wins[i], wins[best]] = [wins[best], wins[i]]
    ;[losses[i], losses[best]] = [losses[best], losses[i]]
    ;[order[i], order[best]] = [order[best], order[i]]
  }

  return order
}

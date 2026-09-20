import type { BracketLeg } from '@/pages/season-end/lib/bracketLayout'
import type { PostseasonSeries } from '@/entities/league/model/league'

/**
 * 대진표에 그릴 상태를 진행 중인 시리즈에서 뽑는다 (P6 4a-1 · R13 8절).
 *
 * 원본은 대진 칸 `L+0x38~0x43` 을 통째로 들고 있어서 `0xb7649(L, 라운드 0~2, 쪽)` 로
 * 라운드마다 누가 이겼는지 바로 읽는다. 웹 `PostseasonSeries`(league.ts) 는 **지금 라운드**만
 * 들고 있어서 지나간 라운드 승자는 되살려야 한다.
 *
 *   - 플레이오프의 아랫 시드 = 준플레이오프 승자 (원본 L+0x3b 칸과 같다)
 *   - 한국시리즈의 아랫 시드 = 플레이오프 승자 (원본 L+0x39 칸)
 *
 * 다만 **플레이오프를 2위가 이기면 준플레이오프 승자가 3위인지 4위인지 알 길이 없다**.
 * 그때는 3위·4위 칸 선분을 파랑으로 두고 합류 선분만 빨강으로 둔다 (근사 — 원본은 칸 값이
 * 남아 있어 끝까지 빨갛다). 웹 모델에 라운드 기록이 생기면 그대로 채워 넣으면 된다.
 */
export interface BracketView {
  /** 1~4위 자리에 앉은 팀 번호. 아직 모르면 null (index 0 = 1위) */
  readonly seeds: readonly (number | null)[]
  /** 빨강으로 다시 칠할 선분 묶음 */
  readonly wonLegs: readonly BracketLeg[]
  /** 한국시리즈 우승 팀 (L+0x37) */
  readonly champion: number | null
}

const EMPTY: BracketView = { seeds: [null, null, null, null], wonLegs: [], champion: null }

export function bracketViewOf(series: PostseasonSeries | null): BracketView {
  if (series === null) return EMPTY

  const qualifiers = series.qualifiers
  const seeds = [0, 1, 2, 3].map((index) => qualifiers[index] ?? null)

  const isSemifinalDone = series.round !== '준플레이오프'
  const isFinalDone = series.round === '한국시리즈' || series.round === '종료'
  const isChampionDone = series.round === '종료'

  // 지금 시리즈의 아랫 시드 = 바로 앞 라운드 승자
  const lowerSeed = series.teams[1] ?? null
  const semifinalWinner =
    !isSemifinalDone ? null
    : series.round === '플레이오프' ? lowerSeed
    // 한국시리즈·종료: 남은 건 플레이오프 승자뿐이다. 그게 2위면 준PO 승자는 알 수 없다.
    : lowerSeed === qualifiers[1] ? null
    : lowerSeed
  const finalWinner = isFinalDone ? lowerSeed : null

  const wonLegs: BracketLeg[] = []
  if (isSemifinalDone) {
    if (semifinalWinner !== null) wonLegs.push(semifinalWinner === qualifiers[3] ? 'rank4' : 'rank3')
    wonLegs.push('semiAdvance')
  }
  if (isFinalDone) {
    // 2위가 이겼으면 2위 칸 선분부터, 준PO 승자가 이겼으면 그 길은 이미 빨갛다
    if (finalWinner === qualifiers[1]) wonLegs.push('rank2')
    wonLegs.push('finalAdvance')
  }
  if (isChampionDone) {
    if (series.champion === qualifiers[0]) wonLegs.push('rank1')
    wonLegs.push('champion')
  }

  return { seeds, wonLegs, champion: series.champion }
}

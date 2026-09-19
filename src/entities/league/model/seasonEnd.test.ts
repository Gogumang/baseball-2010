import { describe, expect, it } from 'vitest'
import { finishRegularSeason, isInPostseason, isMyTurn } from '@/entities/league/model/seasonEnd'
import { EMPTY_LEAGUE, advancePostseason, recordLeagueResult } from '@/entities/league/model/league'
import type { League } from '@/entities/league/model/league'

/** 팀 번호가 작을수록 많이 이긴 리그를 만든다 — 0위가 1위, 9위가 꼴찌 */
function 순위대로쌓은리그(): League {
  let league = EMPTY_LEAGUE
  for (let team = 0; team < 10; team += 1) {
    for (let win = 0; win < 10 - team; win += 1) {
      league = recordLeagueResult(league, team, 9 - team)
    }
  }
  return league
}

describe('finishRegularSeason — 45경기 뒤 정산 (0xb818c)', () => {
  it('1위가 내 팀이면 정규시즌 1위로 센다 (레코드 +0x7a)', () => {
    const league = 순위대로쌓은리그()

    expect(finishRegularSeason(league, 0).isRegularSeasonFirst).toBe(true)
    expect(finishRegularSeason(league, 1).isRegularSeasonFirst).toBe(false)
  })

  it('준플레이오프는 3위 vs 4위로 시작한다 (0xb80a8)', () => {
    const { ranking, postseason } = finishRegularSeason(순위대로쌓은리그(), 0)

    expect(postseason.round).toBe('준플레이오프')
    expect(postseason.teams).toEqual([ranking[2], ranking[3]])
    expect(postseason.winsNeeded).toBe(3)
  })

  it('내 팀이 4위 안에 들었는지 가른다', () => {
    const { ranking } = finishRegularSeason(순위대로쌓은리그(), 0)

    expect(isInPostseason(ranking, ranking[3])).toBe(true)
    expect(isInPostseason(ranking, ranking[4])).toBe(false)
  })

  it('준PO 승자가 2위와 붙고, 그 승자가 1위와 한국시리즈를 치른다', () => {
    const { ranking, postseason } = finishRegularSeason(순위대로쌓은리그(), 0)

    // 3위가 준PO 3승
    let series = postseason
    for (let win = 0; win < 3; win += 1) series = advancePostseason(series, ranking[2])
    expect(series.round).toBe('플레이오프')
    expect(series.teams).toEqual([ranking[1], ranking[2]])

    // 그 팀이 PO 도 3승
    for (let win = 0; win < 3; win += 1) series = advancePostseason(series, ranking[2])
    expect(series.round).toBe('한국시리즈')
    expect(series.teams).toEqual([ranking[0], ranking[2]])
    expect(series.winsNeeded).toBe(4)

    // 한국시리즈는 4승이라야 끝난다
    for (let win = 0; win < 3; win += 1) series = advancePostseason(series, ranking[0])
    expect(series.champion).toBeNull()
    series = advancePostseason(series, ranking[0])
    expect(series.round).toBe('종료')
    expect(series.champion).toBe(ranking[0])
  })

  it('지금 시리즈에 내 팀이 나오는지 가른다 — 아니면 CPU 끼리 돌린다 (0x13da0)', () => {
    const { ranking, postseason } = finishRegularSeason(순위대로쌓은리그(), 0)

    expect(isMyTurn(postseason, ranking[2])).toBe(true)
    // 1위는 한국시리즈에서야 나온다
    expect(isMyTurn(postseason, ranking[0])).toBe(false)
  })
})

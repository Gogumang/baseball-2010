import { describe, expect, it } from 'vitest'
import {
  ALL_TITLES_REWARD_GAME_POINT,
  awardTitles,
  conditionTextOf,
  currentTitleOf,
  equipTitle,
  equipTitleNoticeOf,
  evaluateNewTitles,
  isAllTitlesCollected,
  nextTitleOf,
  NO_EQUIPPED_TITLE,
  PITCHER_TITLE_OFFSET,
  TITLE_COUNT,
  TITLE_ROWS_PER_PAGE,
  TITLE_NAMES,
  titleListOf,
  titleNumberOf,
} from '@/entities/career/model/titles'
import { createCareer, GAMES_PER_SEASON, startNextSeason } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { EMPTY_SEASON_STATS } from '@/entities/career/model/seasonStats'
import { ORIGINAL_TITLES } from '@/shared/config/original/titles'

function 선수(overrides: Partial<PlayerCareer> = {}, careerStats: Partial<typeof EMPTY_SEASON_STATS> = {}): PlayerCareer {
  return {
    ...createCareer('테스트'),
    ...overrides,
    careerStats: { ...EMPTY_SEASON_STATS, ...careerStats },
  }
}

describe('원본 칭호 데이터 — StrNICKNAME 은 이름 64개 + 조건 원문 64개', () => {
  it('128개를 이름과 조건으로 나눈다', () => {
    expect(ORIGINAL_TITLES).toHaveLength(128)
    expect(TITLE_NAMES).toHaveLength(64)
    expect(TITLE_NAMES[35]).toBe('안타제조기')
    expect(conditionTextOf('안타제조기')).toBe('통산 500안타 달성')
  })
})

describe('evaluateNewTitles — 원문 조건', () => {
  it('새 선수는 "이름 없는 신인" 만 얻는다', () => {
    expect(evaluateNewTitles(선수())).toEqual(['이름 없는 신인'])
  })

  it('통산 500안타면 안타제조기, 100홈런이면 떠오르는 홈런 타자', () => {
    const titles = evaluateNewTitles(선수({}, { hits: 500, homeRuns: 100 }))

    expect(titles).toContain('안타제조기')
    expect(titles).toContain('떠오르는 홈런 타자')
    expect(titles).not.toContain('넘버원 슬러거')
  })

  it('기록의 사나이는 700안타·400타점·250홈런을 모두 채워야 한다', () => {
    expect(evaluateNewTitles(선수({}, { hits: 700, runsBattedIn: 400, homeRuns: 249 }))).not.toContain('기록의 사나이')
    expect(evaluateNewTitles(선수({}, { hits: 700, runsBattedIn: 400, homeRuns: 250 }))).toContain('기록의 사나이')
  })

  it('훈련 100회면 야구 머신, 200회면 꽃보다 야구', () => {
    const titles = evaluateNewTitles(선수({ trainingCounts: { 히트: 60, 파워: 50 } }))

    expect(titles).toContain('야구 머신')
    expect(titles).not.toContain('꽃보다 야구')
  })

  it('1년간 외출 조건은 다음 시즌 첫 경기 전에 지난해 값으로 본다 (0x1a590·0x1a5d0)', () => {
    const 시즌끝 = 선수({ outingsLastSeason: 0, outingsThisSeason: 0, season: 1, gamesPlayed: GAMES_PER_SEASON })
    const 새시즌 = 선수({ outingsLastSeason: 0, season: 2, gamesPlayed: 0 })
    const 새시즌_경기뒤 = 선수({ outingsLastSeason: 0, season: 2, gamesPlayed: 1 })

    // 시즌이 끝난 그 해에는 아직 안 준다 — 원본은 해를 넘겨야 본다
    expect(evaluateNewTitles(시즌끝)).not.toContain('은둔형 외톨이')
    expect(evaluateNewTitles(새시즌)).toContain('은둔형 외톨이')
    expect(evaluateNewTitles(새시즌_경기뒤)).not.toContain('은둔형 외톨이')
  })

  it('1년차 시작(연차idx 0)에는 외출 칭호를 주지 않는다', () => {
    expect(evaluateNewTitles(선수({ outingsLastSeason: 0, season: 1, gamesPlayed: 0 }))).not.toContain('은둔형 외톨이')
  })

  it('자유로운 영혼은 지난해 외출이 20회 이상일 때만 (> 19)', () => {
    expect(evaluateNewTitles(선수({ outingsLastSeason: 19, season: 2, gamesPlayed: 0 }))).not.toContain('자유로운 영혼')
    expect(evaluateNewTitles(선수({ outingsLastSeason: 20, season: 2, gamesPlayed: 0 }))).toContain('자유로운 영혼')
  })

  it('시즌을 넘기면 이번 시즌 외출 수가 지난해 칸으로 옮겨간다', () => {
    const 넘긴 = startNextSeason(선수({ outingsThisSeason: 7, season: 3 }))

    expect(넘긴.outingsLastSeason).toBe(7)
    expect(넘긴.outingsThisSeason).toBe(0)
  })

  it('평판 700·999, 인기도 2000·4000', () => {
    const titles = evaluateNewTitles(선수({ reputation: 999, popularity: 2500 }))

    expect(titles).toEqual(expect.arrayContaining(['성스러운 영혼', '바른생활 사나이', '슈퍼 스타']))
    expect(titles).not.toContain('월드클래스 슈퍼스타')
  })

  it('9년차 조건은 연차도 본다', () => {
    expect(evaluateNewTitles(선수({ popularity: 2000, season: 8 }))).not.toContain('카리스마 캡틴')
    expect(evaluateNewTitles(선수({ popularity: 2000, season: 9 }))).toContain('카리스마 캡틴')
  })

  it('한 경기 4홈런, 사이클링 히트 2회', () => {
    const titles = evaluateNewTitles(선수({ bestHomeRunsInGame: 4, cycleHitGames: 2 }))

    expect(titles).toContain('다이너마이트 배트')
    expect(titles).toContain('사이클링 히터')
  })

  it('6년차 18경기째에만 통산 타율 4할을 본다 (P3 9절)', () => {
    const 타율4할 = { atBats: 100, hits: 40 }

    expect(evaluateNewTitles(선수({ season: 5, gamesPlayed: 18 }, 타율4할))).not.toContain('공포의 4할 타자')
    expect(evaluateNewTitles(선수({ season: 6, gamesPlayed: 18 }, 타율4할))).toContain('공포의 4할 타자')
    // 그 앞뒤 경기에서는 보지 않는다 — 원본은 딱 한 순간만 판정한다
    expect(evaluateNewTitles(선수({ season: 6, gamesPlayed: 17 }, 타율4할))).not.toContain('공포의 4할 타자')
    expect(evaluateNewTitles(선수({ season: 6, gamesPlayed: 19 }, 타율4할))).not.toContain('공포의 4할 타자')
  })

  it('9년차 칭호는 9년차에만 준다 — 10년차 이후에는 주지 않는다 (P3 9절)', () => {
    expect(evaluateNewTitles(선수({ season: 9, popularity: 2000 }))).toContain('카리스마 캡틴')
    expect(evaluateNewTitles(선수({ season: 10, popularity: 2000 }))).not.toContain('카리스마 캡틴')
  })

  it('이미 가진 칭호는 다시 주지 않는다', () => {
    const career = awardTitles(선수(), evaluateNewTitles(선수()))

    expect(evaluateNewTitles(career)).toEqual([])
  })
})

describe('currentTitleOf', () => {
  it('칭호가 없으면 첫 칭호, 있으면 가장 최근에 얻은 칭호다', () => {
    expect(currentTitleOf(선수())).toBe('이름 없는 신인')
    expect(currentTitleOf(선수({ titleIds: ['이름 없는 신인', '안타제조기'] }))).toBe('안타제조기')
  })

  it('장착값(+0x1c4)이 있으면 그것을 쓴다 — 얻은 순서보다 우선한다 (0x7d5cc)', () => {
    const career = 선수({ titleIds: ['이름 없는 신인', '안타제조기'], equippedTitle: 0 })

    expect(currentTitleOf(career)).toBe('이름 없는 신인')
  })

  it('옛 저장처럼 장착값이 −1 이면 예전처럼 마지막에 얻은 것을 쓴다', () => {
    expect(선수().equippedTitle).toBe(NO_EQUIPPED_TITLE)
    expect(currentTitleOf(선수({ titleIds: ['안타제조기'], equippedTitle: NO_EQUIPPED_TITLE }))).toBe('안타제조기')
  })
})

describe('equipTitle — 칭호 목록(상태 129) 확인 키 0x11f78', () => {
  it('고른 칭호 번호를 +0x1c4 에 쓴다', () => {
    const career = equipTitle(선수({ titleIds: ['이름 없는 신인', '안타제조기'] }), '안타제조기')

    expect(career.equippedTitle).toBe(titleNumberOf('안타제조기'))
    expect(currentTitleOf(career)).toBe('안타제조기')
  })

  it('이미 장착한 것을 다시 고르면 아무 일도 없다 (0x11fd6 의 `!=` 검사)', () => {
    const career = 선수({ equippedTitle: 0 })

    expect(equipTitle(career, '이름 없는 신인')).toBe(career)
  })

  it('모르는 이름은 무시한다', () => {
    const career = 선수({ equippedTitle: 0 })

    expect(equipTitle(career, '없는칭호')).toBe(career)
  })

  it('팝업 글은 이름 + StrMODE[138] 이다 (0x11fe2)', () => {
    expect(equipTitleNoticeOf('안타제조기')).toBe('안타제조기!N닉네임이 적용되었습니다')
  })
})

describe('얻는 즉시 장착 (0x1b214)', () => {
  it('awardTitles 는 준 칭호 중 번호가 가장 큰 것을 장착한다', () => {
    const career = awardTitles(선수(), ['이름 없는 신인', '안타제조기'])

    expect(career.equippedTitle).toBe(titleNumberOf('안타제조기'))
  })

  it('목록은 얻은 순서가 아니라 번호 오름차순이다 (0x104cc)', () => {
    expect(titleListOf(['안타제조기', '이름 없는 신인'])).toEqual(['이름 없는 신인', '안타제조기'])
  })

  it('한 화면 줄 수는 9 다 — 목록 객체에 min(개수, 9) 로 넣는다', () => {
    expect(TITLE_ROWS_PER_PAGE).toBe(9)
  })
})

describe('awardTitles', () => {
  it('줄 칭호가 없으면 같은 객체를 돌려준다', () => {
    const career = 선수()

    expect(awardTitles(career, [])).toBe(career)
  })

  it('MVP 칭호는 연도별 MVP 비트를 본다 — 1년차 MVP 면 2년차 시작에 "최고의 루키" (0x1a204)', () => {
    // 비트 자리는 연차 1 이 bit0 이다
    const 루키MVP = { mvpSeasonBits: 0b1, season: 2, gamesPlayed: 0 }

    expect(evaluateNewTitles(선수(루키MVP))).toContain('최고의 루키')
    // 시즌 도중에는 안 본다 — 원본은 경기 수 0 일 때만 본다
    expect(evaluateNewTitles(선수({ ...루키MVP, gamesPlayed: 1 }))).not.toContain('최고의 루키')
    // 1년차에 MVP 가 아니면 안 준다
    expect(evaluateNewTitles(선수({ ...루키MVP, mvpSeasonBits: 0b10 }))).not.toContain('최고의 루키')
  })

  it('통산 MVP 6회면 "야구의 정점", 10회면 "베이스볼 마스터" (0x1a32e·0x1a34e)', () => {
    const 여섯번 = 0b111111
    const 열번 = 0b1111111111

    expect(evaluateNewTitles(선수({ mvpSeasonBits: 여섯번 }))).toContain('야구의 정점')
    expect(evaluateNewTitles(선수({ mvpSeasonBits: 0b11111 }))).not.toContain('야구의 정점')
    expect(evaluateNewTitles(선수({ mvpSeasonBits: 열번 }))).toContain('베이스볼 마스터')
  })

  it('2년 연속 MVP 면 "괴물 타자", 통산 4회면 "국민 타자" (0x1a6b6·0x1a704)', () => {
    // 1·2년차 연속
    expect(evaluateNewTitles(선수({ mvpSeasonBits: 0b11, season: 3, gamesPlayed: 0 }))).toContain('괴물 타자')
    // 1·3년차는 연속이 아니다
    expect(evaluateNewTitles(선수({ mvpSeasonBits: 0b101, season: 4, gamesPlayed: 0 }))).not.toContain('괴물 타자')
    expect(evaluateNewTitles(선수({ mvpSeasonBits: 0b1111, season: 5, gamesPlayed: 0 }))).toContain('국민 타자')
  })

  it('또또복권 1등 5번은 "행운의 사나이", 100번 구매는 "도박묵시록" (StrNICKNAME[85]·[86])', () => {
    expect(evaluateNewTitles(선수({ titleIds: ['이름 없는 신인'], lotteryFirstPrizes: 5 }))).toContain('행운의 사나이')
    expect(evaluateNewTitles(선수({ titleIds: ['이름 없는 신인'], lotteryPurchases: 100 }))).toContain('도박묵시록')
    expect(evaluateNewTitles(선수({ titleIds: ['이름 없는 신인'], lotteryPurchases: 99 }))).not.toContain('도박묵시록')
  })
})

describe('새로 옮긴 판정 (P3 5·6·7절)', () => {
  it('우승 5회면 "우승청부업자" (0x1a29a — s8 +0x7a > 4)', () => {
    expect(evaluateNewTitles(선수({ regularSeasonFirstCount: 4 }))).not.toContain('우승청부업자')
    expect(evaluateNewTitles(선수({ regularSeasonFirstCount: 5 }))).toContain('우승청부업자')
  })

  it('전설 스킬을 가지면 "살아있는 전설" (0x1a36e)', () => {
    expect(evaluateNewTitles(선수({ skillIds: [7] }))).toContain('살아있는 전설')
    expect(evaluateNewTitles(선수({ skillIds: [] }))).not.toContain('살아있는 전설')
  })

  it('번트왕 스킬(비트 11)이면 "번트의 귀재" (0x1a752)', () => {
    expect(evaluateNewTitles(선수({ skillIds: [11] }))).toContain('번트의 귀재')
  })

  it('연애 이벤트 300~303 을 본 수가 칭호 14~20 을 가른다 (0x1a392~0x1a49e)', () => {
    const 본선수 = (...ids: number[]) => 선수({ seenEventIds: ids.map(String) })

    expect(evaluateNewTitles(본선수(300))).toContain('간호사 페티쉬')
    expect(evaluateNewTitles(본선수(301))).toContain('와일드 씽씽이')
    expect(evaluateNewTitles(본선수(302))).toContain('로리콘은 범죄')
    expect(evaluateNewTitles(본선수(303))).toContain('피할 수 없는 유혹')
    // 이름 칭호가 먼저, 사람 수 칭호가 뒤다 (번호 순서)
    expect(evaluateNewTitles(본선수(300, 301))).toContain('사랑에 빠진 남자')
    expect(evaluateNewTitles(본선수(300))).not.toContain('사랑에 빠진 남자')
    expect(evaluateNewTitles(본선수(300, 301, 302))).toContain('바람둥이')
    expect(evaluateNewTitles(본선수(300, 301, 302, 303))).toContain('희대의 풍운아')
  })

  it('실효 능력이 모두 999 면 "5툴 플레이어" (0x1ad7e)', () => {
    const 만렙 = { hit: 999, power: 999, defense: 999, run: 999 }

    expect(evaluateNewTitles(선수({ ability: 만렙 }))).toContain('5툴 플레이어')
    expect(evaluateNewTitles(선수({ ability: { ...만렙, run: 998 } }))).not.toContain('5툴 플레이어')
    // 사기가 낮으면 실효값이 깎여서 못 받는다 — 원본도 0xb6414 실효값을 본다
    expect(evaluateNewTitles(선수({ ability: 만렙, morale: 10 }))).not.toContain('5툴 플레이어')
  })

  it('필살타법 4단계면 "약속된 승리의 타자" (0x1ae04, +0x201 > 3 — 근사다)', () => {
    expect(evaluateNewTitles(선수({ specialSwingLevel: 3 }))).not.toContain('약속된 승리의 타자')
    expect(evaluateNewTitles(선수({ specialSwingLevel: 4 }))).toContain('약속된 승리의 타자')
  })

  it('칭호는 번호 오름차순으로 나온다 (0x1a1c0 은 작은 번호부터 본다)', () => {
    const titles = evaluateNewTitles(선수({ popularity: 4000, reputation: 999 }))

    expect(titles.map(titleNumberOf)).toEqual([...titles.map(titleNumberOf)].sort((a, b) => a - b))
  })

  it('nextTitleOf 는 원본처럼 하나만 준다', () => {
    const career = 선수({ popularity: 4000 })

    expect(nextTitleOf(career)).toBe('이름 없는 신인')
    // 이름 없는 신인을 받은 뒤에야 다음 번호가 나온다 — 원본은 확인할 때마다 하나씩 이어 준다
    expect(nextTitleOf(선수({ popularity: 4000, titleIds: ['이름 없는 신인'] }))).toBe('슈퍼 스타')
  })
})

describe('칭호 표·목록·완성 보상 (P3 10절)', () => {
  it('이름 64개는 모두 다르다 — 웹은 이름으로 칭호를 들고 있다', () => {
    expect(new Set(TITLE_NAMES).size).toBe(TITLE_COUNT)
    expect(TITLE_COUNT).toBe(64)
  })

  it('투수편 이름은 타자편 번호 + 16 이다 (0x7d5ee)', () => {
    expect(TITLE_NAMES[32]).toBe('괴물 타자')
    expect(TITLE_NAMES[32 + PITCHER_TITLE_OFFSET]).toBe('괴물 투수')
    expect(conditionTextOf('퍼펙트 플레이어')).toBe('퍼펙트 게임 2회 달성')
  })

  it('목록은 얻은 순서가 아니라 번호 오름차순이다 (0x104cc)', () => {
    expect(titleListOf(['사이클링 히터', '이름 없는 신인', '슈퍼 스타'])).toEqual([
      '이름 없는 신인',
      '슈퍼 스타',
      '사이클링 히터',
    ])
    // 모르는 이름은 버린다
    expect(titleListOf(['없는칭호'])).toEqual([])
  })

  it('64개를 다 모으면 완성이고 보상은 60,000 G 다 (0x28e98)', () => {
    expect(isAllTitlesCollected(TITLE_NAMES.slice(0, 63))).toBe(false)
    expect(isAllTitlesCollected(TITLE_NAMES)).toBe(true)
    expect(ALL_TITLES_REWARD_GAME_POINT).toBe(60_000)
  })
})

import { describe, expect, it } from 'vitest'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import {
  AUTO_SEASON_EVENTS,
  ILLNESS_COOLDOWN,
  ILLNESS_SLACK_ON_CATCH,
  acceptsSeasonEvents,
  advanceAfterGame,
  catchIllness,
  cureIllnessAtHospital,
  cureIllnessByItem,
  illnessChancePercentOf,
  isInEventWindow,
  moralePenaltyOf,
  nextAutoSeasonEventId,
  pollsSeasonEvents,
  rollIllness,
} from '@/entities/season-mode/model/seasonEventFlow'

const 기본 = (덮어쓰기: Partial<SeasonRecord> = {}): SeasonRecord => ({
  ...startNewSeason(0, '테스트구단').record,
  ...덮어쓰기,
})

/** next() 가 고정값을 돌려주는 난수 — randomIntegerBelow 가 `min + floor(next × 폭)` 을 쓴다 */
const 고정난수 = (value: number): RandomPort => ({
  next: () => value,
  nextInRange: (minimum, maximum) => minimum + value * (maximum - minimum),
  pick: <T,>(candidates: readonly T[]) => candidates[0],
})

const 전역 = { event100Awarded: false, newPlayerFlag: false }

describe('자동 발동(대상 4) 이벤트는 5건뿐이다', () => {
  it('400 · 1 · 5 · 100 · 490', () => {
    expect(AUTO_SEASON_EVENTS.map((event) => event.id)).toEqual([400, 1, 5, 100, 490])
  })

  it('날짜 창은 1 · 3 · 21 한 점짜리다 (모두 관리 메뉴가 열리는 때다)', () => {
    const [, 환영, 설정, 축하] = AUTO_SEASON_EVENTS
    expect(isInEventWindow(환영, 기본({ games: 0 }))).toBe(true)
    expect(isInEventWindow(환영, 기본({ games: 2 }))).toBe(false)
    expect(isInEventWindow(설정, 기본({ games: 2 }))).toBe(true)
    expect(isInEventWindow(축하, 기본({ games: 20 }))).toBe(true)
    expect(isInEventWindow(축하, 기본({ games: 22 }))).toBe(false)
  })

  it('질병 490 만 되풀이된다', () => {
    expect(AUTO_SEASON_EVENTS.filter((event) => event.repeats).map((event) => event.id)).toEqual([490])
  })
})

describe('폴링 화면 — ⚠️ 외출 지도에서는 s_event 가 하나도 안 뜬다', () => {
  it('폴링은 관리 메뉴와 외출 지도에서 돈다', () => {
    expect(pollsSeasonEvents(SEASON_SCENE_STATE.관리메뉴)).toBe(true)
    expect(pollsSeasonEvents(SEASON_SCENE_STATE.외출지도)).toBe(true)
    expect(pollsSeasonEvents(SEASON_SCENE_STATE.다음경기)).toBe(false)
  })

  it('실제로 받는 화면은 관리 메뉴(201)뿐이다 — trigger 0 이 209 를 안 받는다', () => {
    expect(acceptsSeasonEvents(SEASON_SCENE_STATE.관리메뉴)).toBe(true)
    expect(acceptsSeasonEvents(SEASON_SCENE_STATE.외출지도)).toBe(false)
    expect(nextAutoSeasonEventId(기본(), SEASON_SCENE_STATE.외출지도, 전역, false)).toBeNull()
  })
})

describe('자동 이벤트 고르기', () => {
  it('새 선수 플래그가 서 있으면 오프닝 400 이 먼저다', () => {
    expect(
      nextAutoSeasonEventId(기본({ games: 20 }), SEASON_SCENE_STATE.관리메뉴, { ...전역, newPlayerFlag: true }, false),
    ).toBe(400)
  })

  it('날짜가 맞는 이벤트를 파일 순서로 고른다', () => {
    expect(nextAutoSeasonEventId(기본({ games: 0 }), SEASON_SCENE_STATE.관리메뉴, 전역, false)).toBe(1)
    expect(nextAutoSeasonEventId(기본({ games: 2 }), SEASON_SCENE_STATE.관리메뉴, 전역, false)).toBe(5)
    expect(nextAutoSeasonEventId(기본({ games: 20 }), SEASON_SCENE_STATE.관리메뉴, 전역, false)).toBe(100)
    expect(nextAutoSeasonEventId(기본({ games: 4 }), SEASON_SCENE_STATE.관리메뉴, 전역, false)).toBeNull()
  })

  it('이벤트 100 특례 — 저장+0xbe 가 서 있으면 불발된다 (기기당 한 번)', () => {
    expect(
      nextAutoSeasonEventId(기본({ games: 20 }), SEASON_SCENE_STATE.관리메뉴, { ...전역, event100Awarded: true }, false),
    ).toBeNull()
  })

  it('질병 490 은 굴림이 맞을 때만 뜬다', () => {
    expect(nextAutoSeasonEventId(기본({ games: 4 }), SEASON_SCENE_STATE.관리메뉴, 전역, true)).toBe(490)
  })
})

describe('시즌 질병 (조건 22) — 팀 사기로 읽고 유리몸·행운 보정이 없다', () => {
  it('확률 구간표 그대로다', () => {
    expect(illnessChancePercentOf(100)).toBe(0)
    expect(illnessChancePercentOf(71)).toBe(0)
    expect(illnessChancePercentOf(70)).toBe(2)
    expect(illnessChancePercentOf(51)).toBe(2)
    expect(illnessChancePercentOf(50)).toBe(4)
    expect(illnessChancePercentOf(31)).toBe(4)
    expect(illnessChancePercentOf(30)).toBe(7)
    expect(illnessChancePercentOf(11)).toBe(7)
    expect(illnessChancePercentOf(10)).toBe(14)
    expect(illnessChancePercentOf(0)).toBe(14)
  })

  it('이미 앓고 있거나 쿨다운이 남아 있으면 굴리지 않는다', () => {
    expect(rollIllness(기본({ illness: 2 }), 0, 고정난수(0))).toBe(false)
    expect(rollIllness(기본({ illnessCooldown: 5 }), 0, 고정난수(0))).toBe(false)
    expect(rollIllness(기본(), 0, 고정난수(0))).toBe(true)
  })

  it('사기가 높으면 확률이 0 이라 절대 안 걸린다', () => {
    expect(rollIllness(기본(), 100, 고정난수(0))).toBe(false)
  })

  it('걸리면 종류 1~4 와 여유 칸 3, 쿨다운 20 이 들어간다', () => {
    const 걸림 = catchIllness(기본(), 고정난수(0))
    expect(걸림.illness).toBe(1)
    expect(걸림.illnessSlack).toBe(ILLNESS_SLACK_ON_CATCH)
    expect(걸림.illnessCooldown).toBe(ILLNESS_COOLDOWN)
    expect(catchIllness(기본(), 고정난수(0.99)).illness).toBe(4)
  })
})

describe('질병 낫기', () => {
  it('입원은 rand(0,101) ≤ 89 면 낫는다 (90/101)', () => {
    const 아픈 = 기본({ illness: 3, illnessSlack: 3 })
    // 0.88 × 101 = 88.88 → 88 ≤ 89 → 치료
    expect(cureIllnessAtHospital(아픈, 고정난수(0.88)).cured).toBe(true)
    // 0.95 × 101 = 95.95 → 95 > 89 → 실패, 여유 칸만 준다
    const 실패 = cureIllnessAtHospital(아픈, 고정난수(0.95))
    expect(실패.cured).toBe(false)
    expect(실패.record.illness).toBe(3)
    expect(실패.record.illnessSlack).toBe(2)
  })

  it('여유 칸이 0 이면 굴림과 상관없이 낫는다', () => {
    const 결과 = cureIllnessAtHospital(기본({ illness: 3, illnessSlack: 0 }), 고정난수(0.99))
    expect(결과.cured).toBe(true)
    expect(결과.record.illness).toBe(0)
    expect(결과.record.illnessCooldown).toBe(ILLNESS_COOLDOWN)
  })

  it('GP 아이템은 무조건 낫는다', () => {
    expect(cureIllnessByItem(기본({ illness: 4, illnessSlack: 3 })).illness).toBe(0)
  })
})

describe('경기를 한 판 치르면', () => {
  it('경기 수가 오르고 행동 제한이 풀리며 쿨다운이 하나씩 준다', () => {
    const 뒤 = advanceAfterGame(기본({ games: 3, acted: true, illnessCooldown: 20, aimVisionGames: 5 }))
    expect(뒤.games).toBe(4)
    expect(뒤.acted).toBe(false)
    expect(뒤.illnessCooldown).toBe(19)
    expect(뒤.aimVisionGames).toBe(4)
  })

  it('0 아래로는 내려가지 않는다', () => {
    const 뒤 = advanceAfterGame(기본({ illnessCooldown: 0, aimVisionGames: 0 }))
    expect(뒤.illnessCooldown).toBe(0)
    expect(뒤.aimVisionGames).toBe(0)
  })

  it('경기로는 질병이 낫지 않는다 — 줄어드는 것은 쿨다운뿐이다', () => {
    const 뒤 = advanceAfterGame(기본({ illness: 2, illnessCooldown: 0 }))
    expect(뒤.illness).toBe(2)
  })
})

describe('사기에 따른 팀 능력치 정액 감소 (J-4)', () => {
  it('50 초과는 없음 · 31~50 −50 · 11~30 −100 · 10 이하 −200', () => {
    expect(moralePenaltyOf(100)).toBe(0)
    expect(moralePenaltyOf(51)).toBe(0)
    expect(moralePenaltyOf(50)).toBe(50)
    expect(moralePenaltyOf(31)).toBe(50)
    expect(moralePenaltyOf(30)).toBe(100)
    expect(moralePenaltyOf(11)).toBe(100)
    expect(moralePenaltyOf(10)).toBe(200)
  })
})

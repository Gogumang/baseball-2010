import { describe, expect, it } from 'vitest'
import { opponentOf } from '@/entities/league/model/league'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import {
  SEASON_END_CHAIN,
  SEASON_PHASE,
  SEASON_SCENE_STATE,
  afterGameNext,
  afterKoreanSeries,
  clearNationalCup,
  enterSeasonScene,
  isRegularSeasonOver,
  managementMenuTarget,
  opensManagementMenu,
  regularSeasonRankEventId,
  seasonOpponentOf,
  teamMenuTarget,
} from '@/entities/season-mode/model/seasonStateMachine'

const 기본 = (덮어쓰기: Partial<SeasonRecord> = {}): SeasonRecord => ({
  ...startNewSeason(0, '테스트구단').record,
  ...덮어쓰기,
})

const 저장있음 = { hasSeasonSave: true }

describe('진입 분기 0xcb (0x4b50)', () => {
  it('시즌 저장이 없으면 팀 고르기로 간다', () => {
    expect(enterSeasonScene(기본(), { hasSeasonSave: false })).toBe(SEASON_SCENE_STATE.팀고르기)
  })

  it('phase 로 먼저 갈린다 — 2 관중·수입 · 0xb 포스트시즌 시작 · 0x10 정규시즌 순위 · 6 엔딩', () => {
    expect(enterSeasonScene(기본({ phase: SEASON_PHASE.경기끝 }), 저장있음)).toBe(SEASON_SCENE_STATE.관중수입)
    expect(enterSeasonScene(기본({ phase: SEASON_PHASE.포스트시즌시작 }), 저장있음)).toBe(
      SEASON_SCENE_STATE.포스트시즌시작,
    )
    expect(enterSeasonScene(기본({ phase: SEASON_PHASE.정규시즌순위 }), 저장있음)).toBe(
      SEASON_SCENE_STATE.정규시즌순위,
    )
    expect(enterSeasonScene(기본({ phase: SEASON_PHASE.엔딩 }), 저장있음)).toBe(SEASON_SCENE_STATE.엔딩)
  })

  it('정규시즌은 경기 수가 짝수이고 phase 가 1·3 일 때만 관리 메뉴를 연다', () => {
    expect(enterSeasonScene(기본({ phase: 1, games: 0 }), 저장있음)).toBe(SEASON_SCENE_STATE.관리메뉴)
    expect(enterSeasonScene(기본({ phase: 3, games: 4 }), 저장있음)).toBe(SEASON_SCENE_STATE.관리메뉴)
    expect(enterSeasonScene(기본({ phase: 3, games: 5 }), 저장있음)).toBe(SEASON_SCENE_STATE.다음경기)
    expect(enterSeasonScene(기본({ phase: 4, games: 4 }), 저장있음)).toBe(SEASON_SCENE_STATE.다음경기)
  })

  it('포스트시즌은 경기 수가 0 이 아니면 결산으로, 0 이면 phase 단계로 간다', () => {
    const 포스트 = { inPostseason: true }
    expect(enterSeasonScene(기본({ ...포스트, games: 1, phase: 3 }), 저장있음)).toBe(SEASON_SCENE_STATE.시즌결산)
    expect(enterSeasonScene(기본({ ...포스트, games: 0, phase: SEASON_PHASE.타자시상 }), 저장있음)).toBe(
      SEASON_SCENE_STATE.타자시상,
    )
    expect(enterSeasonScene(기본({ ...포스트, games: 0, phase: SEASON_PHASE.최우수선수 }), 저장있음)).toBe(
      SEASON_SCENE_STATE.최우수선수,
    )
    expect(enterSeasonScene(기본({ ...포스트, games: 0, phase: 3 }), 저장있음)).toBe(SEASON_SCENE_STATE.시즌결산)
  })
})

describe('⚠️ 국가대항전 플래그가 안 내려가는 원본 버그', () => {
  it('플래그가 서 있으면 정규시즌 경기 뒤마다 대진표로 샌다 — 시즌 진행이 막힌다', () => {
    const record = 기본({ nationalCup: true, phase: 3, games: 4 })
    // 원래대로면 관리 메뉴가 열릴 자리인데 대진표로 빠진다
    expect(enterSeasonScene(record, 저장있음)).toBe(SEASON_SCENE_STATE.국가대항전)
    expect(enterSeasonScene({ ...record, games: 5 }, 저장있음)).toBe(SEASON_SCENE_STATE.국가대항전)
  })

  it('한 줄(clearNationalCup)을 넣으면 풀린다 — 지금은 아무도 부르지 않는다', () => {
    const record = clearNationalCup(기본({ nationalCup: true, phase: 3, games: 4 }))
    expect(enterSeasonScene(record, 저장있음)).toBe(SEASON_SCENE_STATE.관리메뉴)
  })
})

describe('관리 메뉴 6칸과 2경기 주기', () => {
  it('칸 번호가 상태로 이어진다', () => {
    expect(managementMenuTarget(0)).toBe(SEASON_SCENE_STATE.시즌정보)
    expect(managementMenuTarget(1)).toBe(SEASON_SCENE_STATE.구단관리)
    expect(managementMenuTarget(2)).toBe(SEASON_SCENE_STATE.트레이닝)
    expect(managementMenuTarget(3)).toBe(SEASON_SCENE_STATE.외출지도)
    expect(managementMenuTarget(4)).toBe(SEASON_SCENE_STATE.아이템)
    expect(managementMenuTarget(5)).toBe(SEASON_SCENE_STATE.다음경기)
    expect(managementMenuTarget(6)).toBeNull()
  })

  it('구단관리 하위 4칸도 이어진다', () => {
    expect(teamMenuTarget(0)).toBe(SEASON_SCENE_STATE.구장관리)
    expect(teamMenuTarget(1)).toBe(SEASON_SCENE_STATE.트레이드)
    expect(teamMenuTarget(2)).toBe(SEASON_SCENE_STATE.선수영입)
    expect(teamMenuTarget(3)).toBe(SEASON_SCENE_STATE.선수단)
  })

  it('관리 메뉴는 0·2·4·…·44 경기 뒤에만 열린다', () => {
    expect(opensManagementMenu(기본({ games: 0 }))).toBe(true)
    expect(opensManagementMenu(기본({ games: 44 }))).toBe(true)
    expect(opensManagementMenu(기본({ games: 45 }))).toBe(false)
  })

  it('경기 뒤 마무리에서 홀수면 관리 메뉴를 건너뛴다', () => {
    expect(afterGameNext(기본({ games: 4 }))).toBe(SEASON_SCENE_STATE.관리메뉴)
    expect(afterGameNext(기본({ games: 5 }))).toBe(SEASON_SCENE_STATE.다음경기)
    expect(afterGameNext(기본({ games: 4, inPostseason: true }))).toBe(SEASON_SCENE_STATE.시즌결산)
  })
})

describe('경기 일정 · 정규시즌 끝', () => {
  it('오늘 상대는 리그 일정표에서 가져온다 (일차 = 치른 경기 수)', () => {
    const record = 기본({ teamId: 3, games: 7 })
    expect(seasonOpponentOf(record)).toBe(opponentOf(7, 3))
  })

  it('45경기를 채우면 정규시즌이 끝난다', () => {
    expect(isRegularSeasonOver(기본({ games: 44 }))).toBe(false)
    expect(isRegularSeasonOver(기본({ games: 45 }))).toBe(true)
    expect(isRegularSeasonOver(기본({ games: 45, inPostseason: true }))).toBe(false)
  })
})

describe('시즌 끝 이벤트 사슬', () => {
  it('392 → 370 → 371 → 376 → 순위 → 결산 순서다', () => {
    expect(SEASON_END_CHAIN.map((step) => step.eventId)).toEqual([392, 370, 371, 376, null])
    expect(SEASON_END_CHAIN.map((step) => step.state)).toEqual([
      SEASON_SCENE_STATE.포스트시즌시작,
      SEASON_SCENE_STATE.타자시상,
      SEASON_SCENE_STATE.투수시상,
      SEASON_SCENE_STATE.최우수선수,
      SEASON_SCENE_STATE.정규시즌순위,
    ])
    expect(SEASON_END_CHAIN[SEASON_END_CHAIN.length - 1].next).toBe(SEASON_SCENE_STATE.시즌결산)
  })

  it('각 단계는 이어지는 상태를 가리킨다', () => {
    for (let i = 0; i < SEASON_END_CHAIN.length - 1; i += 1) {
      expect(SEASON_END_CHAIN[i].next).toBe(SEASON_END_CHAIN[i + 1].state)
    }
  })

  it('정규시즌 순위 이벤트는 1위 401 · 2~4위 402 · 그 밖 403 이다', () => {
    expect(regularSeasonRankEventId(0)).toBe(401)
    expect(regularSeasonRankEventId(1)).toBe(402)
    expect(regularSeasonRankEventId(3)).toBe(402)
    expect(regularSeasonRankEventId(4)).toBe(403)
  })

  it('국가대항전은 연차 idx 가 짝수(1·3·5·7·9년차)일 때만 열린다', () => {
    expect(afterKoreanSeries(기본({ yearIndex: 0 }))).toBe(SEASON_SCENE_STATE.국가대항전안내)
    expect(afterKoreanSeries(기본({ yearIndex: 1 }))).toBe('새해')
    expect(afterKoreanSeries(기본({ yearIndex: 8 }))).toBe(SEASON_SCENE_STATE.국가대항전안내)
  })
})

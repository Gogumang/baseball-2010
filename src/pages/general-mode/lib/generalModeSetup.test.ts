import { describe, expect, it } from 'vitest'
import {
  DEFAULT_OPENED_ACE_BATTER_IDS, DEFAULT_OPENED_ACE_PITCHER_IDS, NO_ACE, teamGameOptionsOf,
} from '@/pages/general-mode/lib/generalModeSetup'
import { changePitcher, ourPitcherStats, startTeamGame } from '@/features/play-team-game/model/teamGameFlow'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

/**
 * App.tsx 가 `GeneralModeScreen` 에 마선수 오픈 배열을 안 넘겨서 마선수 고르기 칸 10개가
 * 전부 LOCK 으로 뜨던 것을 고친 값 — 저장에 마선수 오픈 플래그 칸이 생기기 전까지 쓰는
 * 임시 기본값. 원본은 싸이커(마투수 로컬 0)·메디카(마타자 로컬 0)를 기본 개방한다
 * (`docs/re/K-bursts-special.md` K-3: "싸이커·메디카는 기본 개방").
 */
describe('마선수 기본 개방', () => {
  it('마투수는 싸이커(로컬 0)만 기본으로 열려 있다', () => {
    expect(DEFAULT_OPENED_ACE_PITCHER_IDS).toEqual([0])
  })

  it('마타자는 메디카(로컬 0)만 기본으로 열려 있다', () => {
    expect(DEFAULT_OPENED_ACE_BATTER_IDS).toEqual([0])
  })
})

describe('teamGameOptionsOf — 마선수 레벨 (전역 mgr[0x13a..0x143])', () => {
  const 준비 = {
    userTeamId: 0, aiTeamId: 1, playerSide: 0, stadiumId: 0, aceBatterId: NO_ACE, acePitcherId: 1,
  } as const

  it('넘긴 레벨 칸을 경기 옵션 aceLevels 로 그대로 싣고, 안 넘기면 칸이 없다', () => {
    expect(teamGameOptionsOf(준비, { aceLevels: { 1: 4 } }).aceLevels).toEqual({ 1: 4 })
    expect('aceLevels' in teamGameOptionsOf(준비)).toBe(false)
  })

  it('실은 레벨이 사람 팀 마투수 능력치 배율 0xd88aa 로 먹는다 — 레오니 Lv5 100% − Lv1 60% = 850 − 510', () => {
    const 구속 = (aceLevels?: Readonly<Record<number, number>>) => {
      const options = teamGameOptionsOf(준비, aceLevels === undefined ? {} : { aceLevels })
      const progress = startTeamGame(options, createSeededRandom(20100901))
      // 마투수는 투수 명단 8번 칸 (0xb88c8) — `#` 교체로 올린다
      return ourPitcherStats(changePitcher(progress, 8, createSeededRandom(0))).velocity
    }
    expect(구속({ 1: 4 }) - 구속()).toBe(850 - 510)
  })
})
